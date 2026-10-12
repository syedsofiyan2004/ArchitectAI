import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProcessSupervisor } from './process-supervisor.js';

/**
 * NativeCheckSpec captures the exact executable + args for a native repository check,
 * snapshotted from the ORIGINAL repository state BEFORE any agent modification.
 *
 * This prevents agent-modified package.json scripts from introducing new or malicious commands.
 * Only pre-existing scripts become native checks; no rediscovery after agent runs.
 */
export interface NativeCheckSpec {
  /** The script name as declared in package.json (e.g. "test", "build") */
  scriptName: string;
  /** Package manager executable to invoke (e.g. "npm", "node") */
  executable: string;
  /** Arguments to pass — always structured, NEVER shell-interpolated */
  args: string[];
  /** The original script command string as recorded before agent modification */
  originalCommand?: string;
  /** Timeout for this specific check in ms */
  timeoutMs?: number;
}

export interface ExecutionCheckResult {
  command: string;
  scriptName: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/** Priority-ordered script names to consider as native checks */
const PRIORITY_CHECK_NAMES = ['typecheck', 'test', 'build', 'lint'] as const;

/** Maximum timeout for a single native check */
const DEFAULT_CHECK_TIMEOUT_MS = 60_000;

/** Max output bytes captured per check */
const DEFAULT_MAX_BUFFER_BYTES = 512 * 1024;

export class ExecutionChecksService {
  private readonly supervisor: ProcessSupervisor;

  constructor(supervisor?: ProcessSupervisor) {
    this.supervisor = supervisor ?? new ProcessSupervisor();
  }

  /**
   * Snapshots NativeCheckSpec[] from the ORIGINAL repository path, before agent modification.
   * Returns only the pre-existing scripts that match priority check names.
   * The returned specs are immutable: no re-reading of package.json occurs at execution time.
   */
  async snapshotNativeCheckSpecs(repositoryPath: string): Promise<NativeCheckSpec[]> {
    const pkgPath = path.join(repositoryPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return [];
    }

    let scripts: Record<string, string> = {};
    try {
      const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (typeof parsed.scripts === 'object' && parsed.scripts !== null) {
        scripts = parsed.scripts as Record<string, string>;
      }
    } catch {
      return [];
    }

    const specs: NativeCheckSpec[] = [];
    for (const name of PRIORITY_CHECK_NAMES) {
      if (scripts[name]) {
        const rawCmd = scripts[name].trim();
        // If command is a direct node/vitest/jest command, extract executable & args directly
        // so that even if agent mutates package.json, the original command definition executes
        const parts = rawCmd.split(/\s+/);
        const first = parts[0] || 'npm';
        const isDirect = first === 'node' || first === 'vitest' || first === 'jest' || first === 'tsc';

        specs.push({
          scriptName: name,
          executable: isDirect ? first : 'npm',
          args: isDirect ? parts.slice(1) : ['run', name],
          originalCommand: rawCmd,
          timeoutMs: DEFAULT_CHECK_TIMEOUT_MS,
        });
      }
    }

    return specs;
  }

  /**
   * Executes the pre-snapshotted NativeCheckSpecs inside the given worktree directory.
   * Uses structured execFile-style spawn (no shell interpolation).
   * Does NOT rediscover or re-read package.json — only executes what was snapshotted.
   */
  async runSnapshotChecks(
    worktreeDir: string,
    specs: NativeCheckSpec[],
    signal?: AbortSignal
  ): Promise<ExecutionCheckResult[]> {
    const results: ExecutionCheckResult[] = [];

    for (const spec of specs) {
      if (signal?.aborted) break;

      const result = await this.supervisor.execute(spec.executable, spec.args, {
        cwd: worktreeDir,
        timeoutMs: spec.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS,
        maxBufferBytes: DEFAULT_MAX_BUFFER_BYTES,
        signal,
      });

      results.push({
        command: `${spec.executable} ${spec.args.join(' ')}`,
        scriptName: spec.scriptName,
        passed: result.exitCode === 0 && !result.timedOut && !result.cancelled,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
      });
    }

    return results;
  }

  /**
   * Legacy discovery-based check runner.
   * Used only when no pre-snapshot is available (e.g. bare calls without a plan).
   * Prefer runSnapshotChecks(worktreeDir, snapshotNativeCheckSpecs(repoPath)) in production paths.
   *
   * @deprecated Use snapshotNativeCheckSpecs + runSnapshotChecks for production execution paths.
   */
  async runDiscoveredChecks(targetDir: string, signal?: AbortSignal): Promise<ExecutionCheckResult[]> {
    const specs = await this.snapshotNativeCheckSpecs(targetDir);
    return this.runSnapshotChecks(targetDir, specs, signal);
  }
}
