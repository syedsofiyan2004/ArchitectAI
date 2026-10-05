import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface IsolatedWorktreeSession {
  worktreePath: string;
  branch: string;
  originalHead: string;
  originalBranch: string;
  runId: string;
}

export interface GitDiffReport {
  isClean: boolean;
  changedFiles: string[];
  diff: string;
  rawStatus: string;
}

export class GitIsolationService {
  async createIsolatedWorktree(repoPath: string, runId: string): Promise<IsolatedWorktreeSession> {
    const resolvedRepo = path.resolve(repoPath);

    // Capture original branch & HEAD
    const { stdout: headOut } = await execFileAsync('git', ['-C', resolvedRepo, 'rev-parse', 'HEAD']);
    const originalHead = headOut.trim();

    let originalBranch = 'main';
    try {
      const { stdout: branchOut } = await execFileAsync('git', ['-C', resolvedRepo, 'rev-parse', '--abbrev-ref', 'HEAD']);
      originalBranch = branchOut.trim();
    } catch {
      originalBranch = 'detached';
    }

    const branch = `architectai/${runId}`;
    const worktreesBase = path.join(os.tmpdir(), 'architectai-worktrees');
    fs.mkdirSync(worktreesBase, { recursive: true });
    const worktreePath = path.join(worktreesBase, runId);

    // Create branch from originalHead and checkout into isolated worktree
    try {
      await execFileAsync('git', [
        '-C',
        resolvedRepo,
        'worktree',
        'add',
        '-b',
        branch,
        worktreePath,
        originalHead,
      ]);
    } catch (err) {
      throw new Error(
        `Failed to create isolated Git worktree: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    return {
      worktreePath,
      branch,
      originalHead,
      originalBranch,
      runId,
    };
  }

  async captureDiffAndStatus(worktreePath: string, originalHead: string): Promise<GitDiffReport> {
    let rawStatus = '';
    let isClean = true;
    try {
      const { stdout } = await execFileAsync('git', ['-C', worktreePath, 'status', '--porcelain']);
      rawStatus = stdout;
      isClean = stdout.trim().length === 0;
    } catch {
      rawStatus = '';
    }

    let diff = '';
    let changedFiles: string[] = [];
    try {
      // First stage untracked files in worktree so diff captures them accurately if committed/staged
      const { stdout: diffOut } = await execFileAsync('git', ['-C', worktreePath, 'diff', originalHead]);
      diff = diffOut;

      const { stdout: nameOnlyOut } = await execFileAsync('git', ['-C', worktreePath, 'diff', '--name-only', originalHead]);
      const diffFiles = nameOnlyOut
        .split(/\r?\n/)
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      // Also parse raw status for untracked files
      const statusFiles = rawStatus
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 3)
        .map((l) => l.slice(3).trim());

      const uniqueFiles = new Set([...diffFiles, ...statusFiles]);
      changedFiles = Array.from(uniqueFiles);

      // If diff is empty but status has untracked files, generate diff against those files
      if (diff.trim().length === 0 && changedFiles.length > 0) {
        try {
          const { stdout: untrackedDiff } = await execFileAsync('git', ['-C', worktreePath, 'diff']);
          diff = untrackedDiff || rawStatus;
        } catch {
          diff = rawStatus;
        }
      }
    } catch {
      diff = rawStatus;
    }

    return {
      isClean,
      changedFiles,
      diff,
      rawStatus,
    };
  }

  async cleanupWorktree(repoPath: string, worktreePath: string): Promise<void> {
    const resolvedRepo = path.resolve(repoPath);
    try {
      await execFileAsync('git', ['-C', resolvedRepo, 'worktree', 'remove', '--force', worktreePath]);
    } catch {
      // If worktree remove fails, remove directory manually and prune
      try {
        if (fs.existsSync(worktreePath)) {
          fs.rmSync(worktreePath, { recursive: true, force: true });
        }
        await execFileAsync('git', ['-C', resolvedRepo, 'worktree', 'prune']);
      } catch {
        // cleanup best-effort
      }
    }
  }

  async verifyOriginalBranchUntouched(
    repoPath: string,
    originalBranch: string,
    originalHead: string
  ): Promise<{ untouched: boolean; currentBranch: string; currentHead: string }> {
    const resolvedRepo = path.resolve(repoPath);
    const { stdout: currentHeadOut } = await execFileAsync('git', ['-C', resolvedRepo, 'rev-parse', 'HEAD']);
    const currentHead = currentHeadOut.trim();

    let currentBranch = '';
    try {
      const { stdout: branchOut } = await execFileAsync('git', ['-C', resolvedRepo, 'rev-parse', '--abbrev-ref', 'HEAD']);
      currentBranch = branchOut.trim();
    } catch {
      currentBranch = 'detached';
    }

    const untouched = currentHead === originalHead && currentBranch === originalBranch;
    return { untouched, currentBranch, currentHead };
  }
}
