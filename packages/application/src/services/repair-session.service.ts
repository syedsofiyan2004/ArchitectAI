import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  VerificationRunResult,
  RepairProgress,
} from '@architectai/domain';

const execFileAsync = promisify(execFile);

export class RepairSessionService {
  /**
   * Creates a safe Git commit checkpoint in the isolated worktree before an attempt.
   */
  async createCheckpoint(worktreePath: string, attemptNumber: number): Promise<string> {
    try {
      // Stage any existing changes
      await execFileAsync('git', ['-C', worktreePath, 'add', '-A']);
      // Commit checkpoint
      await execFileAsync('git', [
        '-C',
        worktreePath,
        'commit',
        '-m',
        `architectai-checkpoint-attempt-${attemptNumber}`,
        '--allow-empty',
      ]);
      const { stdout } = await execFileAsync('git', [
        '-C',
        worktreePath,
        'rev-parse',
        'HEAD',
      ]);
      return stdout.trim();
    } catch (err) {
      throw new Error(
        `Failed to create worktree checkpoint: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Restores worktree to previous checkpoint if an attempt violates policy or fails.
   */
  async rollbackToCheckpoint(worktreePath: string, checkpointRef: string): Promise<void> {
    try {
      await execFileAsync('git', ['-C', worktreePath, 'reset', '--hard', checkpointRef]);
      await execFileAsync('git', ['-C', worktreePath, 'clean', '-fd']);
    } catch (err) {
      throw new Error(
        `Failed to rollback to checkpoint ${checkpointRef}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Captures diff and changed files between checkpoint and current attempt state.
   */
  async captureAttemptDiff(
    worktreePath: string,
    checkpointRef: string
  ): Promise<{ diff: string; changedFiles: string[] }> {
    try {
      const { stdout: diffFiles } = await execFileAsync('git', [
        '-C',
        worktreePath,
        'diff',
        '--name-only',
        checkpointRef,
      ]);
      const { stdout: diff } = await execFileAsync('git', [
        '-C',
        worktreePath,
        'diff',
        checkpointRef,
      ]);

      const changedFiles = diffFiles
        .split(/\r?\n/)
        .map((f) => f.trim().replace(/\\/g, '/'))
        .filter((f) => f.length > 0);

      return {
        diff,
        changedFiles,
      };
    } catch {
      return { diff: '', changedFiles: [] };
    }
  }

  /**
   * Evaluates verification progress between consecutive verification runs.
   * Categorizes as VERIFIED, REGRESSED, IMPROVED, or UNCHANGED.
   */
  evaluateProgress(
    previousRun: VerificationRunResult,
    currentRun: VerificationRunResult
  ): RepairProgress {
    if (currentRun.isVerified) {
      return 'VERIFIED';
    }

    // Check for regression: previously passing case now fails
    const prevPassedCases = new Set(
      previousRun.caseResults.filter((c) => c.verdict === 'PASS').map((c) => c.caseId)
    );
    const hasRegressedCase = currentRun.caseResults.some(
      (c) => c.verdict === 'FAIL' && prevPassedCases.has(c.caseId)
    );
    if (hasRegressedCase) {
      return 'REGRESSED';
    }

    const prevFailCount = previousRun.caseResults.filter((c) => c.verdict === 'FAIL').length;
    const currFailCount = currentRun.caseResults.filter((c) => c.verdict === 'FAIL').length;

    if (currFailCount > prevFailCount) {
      return 'REGRESSED';
    }

    if (currFailCount < prevFailCount) {
      return 'IMPROVED';
    }

    // Compare total failed assertions count
    const countFailedAssertions = (r: VerificationRunResult) =>
      r.caseResults.reduce((sum, c) => sum + c.assertions.filter((a) => !a.passed).length, 0);

    const prevFailedAssertions = countFailedAssertions(previousRun);
    const currFailedAssertions = countFailedAssertions(currentRun);

    if (currFailedAssertions < prevFailedAssertions) {
      return 'IMPROVED';
    }

    if (currFailedAssertions > prevFailedAssertions) {
      return 'REGRESSED';
    }

    return 'UNCHANGED';
  }
}
