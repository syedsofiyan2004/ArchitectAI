import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  ImplementationTask,
  RepairTask,
  AgentExecutionResult,
  AgentExecutionResultSchema,
} from '@architectai/domain';
import {
  CodingAgentAdapter,
  AgentAvailability,
  AgentWorkspace,
  AgentExecutionOptions,
} from '../types.js';

// NOTE: ProcessSupervisor lives in @architectai/application but providers must not import application.
// We inline the minimal supervisor needed here using the same killProcessTree logic from process-supervisor.ts.
// This avoids a circular dependency while keeping the process-tree kill behavior equivalent.
import { spawn, ChildProcess, execSync } from 'node:child_process';
import * as os from 'node:os';
import * as fs from 'node:fs';

const execFileAsync = promisify(execFile);

export interface CodexAdapterOptions {
  allowDangerousSandboxBypass?: boolean;
  timeoutMs?: number;
  maxBufferBytes?: number;
}

/**
 * Cross-platform process tree killer — duplicated here from ProcessSupervisor
 * to avoid an application→provider import cycle.
 */
function killProcessTree(pid: number, child?: ChildProcess): void {
  if (!pid || pid <= 0) return;

  // Liveness check: if process is already dead, return immediately
  try {
    process.kill(pid, 0);
  } catch {
    return;
  }

  const isWindows = os.platform() === 'win32';
  if (isWindows) {
    const sysRoot = process.env['SystemRoot'] || 'C:\\Windows';
    const taskkillPath = `${sysRoot}\\System32\\taskkill.exe`;
    const taskkillCmd = fs.existsSync(taskkillPath) ? taskkillPath : 'taskkill';
    try {
      execSync(`"${taskkillCmd}" /pid ${pid} /T /F`, { stdio: 'ignore', timeout: 2000 });
    } catch {
      // ignore
    }
  } else {
    try {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          execSync(`pkill -KILL -P ${pid}`, { stdio: 'ignore' });
        } catch {
          // ignore
        }
        try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
      }
    } catch {
      // Process already exited
    }
  }

  if (child) {
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
  }
}

/**
 * Bounded, supervised execution of the Codex CLI binary.
 * Uses spawn (no shell interpolation), process-tree kill, AbortSignal, and bounded output.
 */
async function runCodexSupervised(
  codexArgs: string[],
  prompt: string,
  targetDir: string,
  timeoutMs: number,
  maxBufferBytes: number,
  signal: AbortSignal | undefined,
  onLog: (line: string) => void
): Promise<{ exitCode: number; cancelled: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const child: ChildProcess = spawn(isWin ? 'codex.cmd' : 'codex', [...codexArgs, '-'], {
      cwd: targetDir,
      detached: !isWin,
      shell: isWin,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (child.stdin) {
      try {
        child.stdin.write(prompt);
        child.stdin.end();
      } catch {
        // child might have exited immediately
      }
    }

    let totalStdoutBytes = 0;
    let totalStderrBytes = 0;
    let timedOut = false;
    let cancelled = false;

    const terminate = (reason: 'timeout' | 'cancel') => {
      if (reason === 'timeout') timedOut = true;
      else cancelled = true;
      if (child.pid) killProcessTree(child.pid, child);
    };

    const timer = timeoutMs > 0
      ? setTimeout(() => terminate('timeout'), timeoutMs)
      : undefined;

    const onAbort = () => terminate('cancel');
    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      totalStdoutBytes += chunk.length;
      if (totalStdoutBytes <= maxBufferBytes) {
        onLog(`[codex stdout] ${chunk.toString('utf-8').trim()}`);
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      totalStderrBytes += chunk.length;
      if (totalStderrBytes <= maxBufferBytes) {
        onLog(`[codex stderr] ${chunk.toString('utf-8').trim()}`);
      }
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve({ exitCode: code ?? 1, cancelled, timedOut });
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      onLog(`[codex error] ${err.message}`);
      resolve({ exitCode: 1, cancelled, timedOut });
    });
  });
}

export class CodexCliAgentAdapter implements CodingAgentAdapter {
  readonly id = 'codex-cli';
  readonly name = 'Codex CLI';

  constructor(private readonly options: CodexAdapterOptions = {}) {}

  async detect(): Promise<AgentAvailability> {
    const isWin = os.platform() === 'win32';
    const binary = isWin ? 'codex.cmd' : 'codex';
    try {
      const { stdout } = await execFileAsync(binary, ['--version'], { timeout: 8000, shell: isWin });
      const version = stdout.trim();
      return {
        available: true,
        version: version || 'installed',
      };
    } catch (err) {
      return {
        available: false,
        reason: err instanceof Error ? `Codex CLI not available: ${err.message}` : 'Codex CLI not found in PATH',
      };
    }
  }

  async executeTask(
    workspace: AgentWorkspace,
    task: ImplementationTask | RepairTask,
    executionOptions?: AgentExecutionOptions
  ): Promise<AgentExecutionResult> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const targetDir = workspace.worktreePath || workspace.repositoryPath;
    const startTime = Date.now();
    const taskTitle = 'title' in task ? task.title : task.id;
    const timeoutMs = executionOptions?.timeoutMs ?? this.options.timeoutMs ?? 180000; // 3 min
    const maxBufferBytes = this.options.maxBufferBytes ?? 1024 * 1024; // 1 MB
    const signal = executionOptions?.signal;

    // Immediate cancellation check before starting
    if (signal?.aborted) {
      const err = new Error('Coding agent task was cancelled before starting.');
      (err as NodeJS.ErrnoException).code = 'USER_CANCELLED';
      throw err;
    }

    const useDangerousBypass = Boolean(this.options.allowDangerousSandboxBypass);
    if (useDangerousBypass) {
      // Dangerous bypass requires explicit additional acknowledgement beyond default option.
      // WARNING: This mode bypasses Codex sandbox safety mechanisms.
      const logs = [`[ArchitectAI Gateway] DANGEROUS BYPASS MODE ACTIVE for task ${task.id}`];
      logs.push(`[ArchitectAI Gateway] WARNING: allowDangerousSandboxBypass=true was explicitly set.`);
    }

    const sandboxModeLabel = useDangerousBypass
      ? 'DANGEROUS BYPASS (--dangerously-bypass-approvals-and-sandbox)'
      : 'SAFE WORKSPACE SANDBOX (--approve-for-me [workspace-write])';

    const logs: string[] = [
      `[ArchitectAI Gateway] Starting execution ${executionId} on worktree: ${targetDir}`,
      `[ArchitectAI Gateway] Task: ${task.id} — ${taskTitle}`,
      `[ArchitectAI Gateway] Codex Sandbox Policy: ${sandboxModeLabel}`,
      `[ArchitectAI Gateway] Allowed files: ${task.allowedFiles.join(', ') || 'Any non-excluded'}`,
    ];

    // Assemble codex exec arguments using structured arg array (no shell interpolation)
    const codexArgs = ['exec', '--cd', targetDir];

    if (useDangerousBypass) {
      codexArgs.push('--dangerously-bypass-approvals-and-sandbox');
    } else {
      // In Codex CLI, --approve-for-me automatically applies the workspace-write sandbox
      codexArgs.push('--approve-for-me');
    }

    const prompt = this.buildBoundedTaskPrompt(task);

    try {
      const result = await runCodexSupervised(
        codexArgs,
        prompt,
        targetDir,
        timeoutMs,
        maxBufferBytes,
        signal,
        (line) => logs.push(line)
      );

      // Handle cancellation
      if (result.cancelled || signal?.aborted) {
        const err = new Error(`Codex task ${task.id} was cancelled by user signal.`);
        (err as NodeJS.ErrnoException).code = 'USER_CANCELLED';
        throw err;
      }

      // Handle timeout
      if (result.timedOut) {
        const err = new Error(`Codex task ${task.id} exceeded timeout budget of ${timeoutMs}ms.`);
        (err as NodeJS.ErrnoException).code = 'TIMED_OUT';
        throw err;
      }

      if (result.exitCode !== 0) {
        throw new Error(`Codex process exited with code ${result.exitCode}`);
      }

      // Capture changed files from git status in worktree
      const changedFiles = await this.getChangedFiles(targetDir);
      const durationMs = Date.now() - startTime;
      logs.push(`[ArchitectAI Gateway] Execution completed in ${durationMs}ms with ${changedFiles.length} files changed.`);

      return AgentExecutionResultSchema.parse({
        executionId,
        taskId: task.id,
        status: 'completed',
        changedFiles,
        commandsExecuted: [],
        logs,
        agentSummary: `Codex CLI successfully executed task ${task.id}. Modified ${changedFiles.length} files.`,
        durationMs,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const code = (err as NodeJS.ErrnoException).code;

      // Re-throw cancellation/timeout errors directly
      if (code === 'USER_CANCELLED' || code === 'TIMED_OUT') {
        throw err;
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      logs.push(`[ArchitectAI Gateway] Execution failed: ${errorMsg}`);

      const changedFiles = await this.getChangedFiles(targetDir).catch(() => []);

      return AgentExecutionResultSchema.parse({
        executionId,
        taskId: task.id,
        status: 'failed',
        changedFiles,
        commandsExecuted: [],
        logs,
        agentSummary: `Codex CLI execution failed for task ${task.id}.`,
        durationMs,
        failureReason: errorMsg,
      });
    }
  }

  async cancel(_executionId: string): Promise<void> {
    // Cancellation is handled via AbortSignal in executeTask.
    // The legacy cancel(executionId) method is a no-op since the new contract uses signal.
  }

  private buildBoundedTaskPrompt(task: ImplementationTask | RepairTask): string {
    const title = 'title' in task ? task.title : task.id;
    const requirements = 'requirements' in task ? task.requirements : [task.objective];
    const acceptance = 'acceptanceCriteria' in task ? task.acceptanceCriteria : ['Pass verification'];

    return [
      `TASK: ${task.id} — ${title}`,
      `OBJECTIVE: ${task.objective}`,
      '',
      'REQUIREMENTS:',
      ...requirements.map((r: string) => `- ${r}`),
      '',
      'ACCEPTANCE CRITERIA:',
      ...acceptance.map((a: string) => `- ${a}`),
      '',
      `ALLOWED FILES: ${task.allowedFiles.join(', ') || 'Any relevant source files'}`,
      `EXCLUDED FILES: ${task.excludedFiles.join(', ') || 'Tests, CI workflows, and package configs must not be weakened.'}`,
      '',
      'INSTRUCTIONS: Modify the codebase inside the current working directory to fulfill the objective and acceptance criteria. Do not delete or weaken existing test suites.',
    ].join('\n');
  }

  private async getChangedFiles(targetDir: string): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: targetDir });
      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.slice(3).trim());
    } catch {
      return [];
    }
  }
}
