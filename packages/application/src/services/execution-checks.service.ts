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
  /** Package manager executable to invoke (e.g. "npm") */
  executable: string;
  /** Arguments to pass — always structured, NEVER shell-interpolated */
  args: string[];
  /** The original script command string as recorded before agent modification */
  originalCommand: string;
  /** Immutable relative manifest path within the repository (default: 'package.json') */
  manifestPath: string;
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
  tampered?: boolean;
  failureCode?: 'NATIVE_CHECK_TAMPERED' | 'COMMAND_FORBIDDEN';
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
        specs.push({
          scriptName: name,
          executable: 'npm',
          args: ['run', name],
          originalCommand: rawCmd,
          manifestPath: 'package.json',
          timeoutMs: DEFAULT_CHECK_TIMEOUT_MS,
        });
      }
    }

    return specs;
  }

  /**
   * Executes the pre-snapshotted NativeCheckSpecs inside the given worktree directory.
   * Uses structured execFile-style spawn (no shell interpolation).
   *
   * BEFORE executing any package-manager script:
   * - reads the worktree package.json (manifestPath);
   * - mechanically verifies the script value in the worktree exactly matches originalCommand.
   *
   * If tampered with by the coding agent:
   * - DO NOT execute the script;
   * - returns structured failure NATIVE_CHECK_TAMPERED.
   *
   * For unchanged scripts:
   * - executes npm run <name> safely because mechanical identity is proven.
   */
  async runSnapshotChecks(
    worktreeDir: string,
    specs: NativeCheckSpec[],
    signal?: AbortSignal
  ): Promise<ExecutionCheckResult[]> {
    const results: ExecutionCheckResult[] = [];

    for (const spec of specs) {
      if (signal?.aborted) break;

      // Anti-Tampering Verification Gate
      const manifestFile = path.join(worktreeDir, spec.manifestPath || 'package.json');
      let isTampered = false;
      let currentScriptCommand: string | undefined;

      if (!fs.existsSync(manifestFile)) {
        isTampered = true;
      } else {
        try {
          const parsed = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
          const currentScripts = (parsed && typeof parsed.scripts === 'object' && parsed.scripts !== null)
            ? (parsed.scripts as Record<string, string>)
            : {};
          currentScriptCommand = currentScripts[spec.scriptName]?.trim();
          if (currentScriptCommand !== spec.originalCommand) {
            isTampered = true;
          }
        } catch {
          isTampered = true;
        }
      }

      if (isTampered) {
        // DO NOT EXECUTE THE SCRIPT.
        results.push({
          command: `${spec.executable} ${spec.args.join(' ')}`,
          scriptName: spec.scriptName,
          passed: false,
          exitCode: 1,
          stdout: '',
          stderr: `SECURITY TAMPER DETECTED: Script '${spec.scriptName}' in ${spec.manifestPath} was modified by coding agent.\nPre-agent original: "${spec.originalCommand}"\nPost-agent modified: "${currentScriptCommand ?? '(missing)'}"\nExecution of modified package script is strictly forbidden.`,
          durationMs: 0,
          tampered: true,
          failureCode: 'NATIVE_CHECK_TAMPERED',
        });
        continue;
      }

      // Script definition is mechanically proven identical: execute snapshotted spec safely
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
