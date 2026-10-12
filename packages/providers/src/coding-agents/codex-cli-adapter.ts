import { execFile, execSync, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import * as os from 'node:os';
import * as fs from 'node:fs';
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
} from '../types.js';

const execFileAsync = promisify(execFile);

export interface CodexAdapterOptions {
  allowDangerousSandboxBypass?: boolean;
  timeoutMs?: number;
  maxBufferBytes?: number;
}

function killProcessTree(pid: number, child?: ChildProcess): void {
  if (!pid || pid <= 0) return;

  const isWindows = os.platform() === 'win32';
  if (isWindows) {
    const sysRoot = process.env['SystemRoot'] || 'C:\\Windows';
    const taskkillPath = `${sysRoot}\\System32\\taskkill.exe`;
    const taskkillCmd = fs.existsSync(taskkillPath) ? taskkillPath : 'taskkill';
    try {
      execSync(`"${taskkillCmd}" /pid ${pid} /T /F`, { stdio: 'ignore' });
    } catch {
      try {
        execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`, { stdio: 'ignore' });
      } catch {
        // ignore
      }
    }
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        execSync(`pkill -KILL -P ${pid}`, { stdio: 'ignore' });
      } catch {
        // ignore
      }
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }
  }

  if (child) {
    try {
      child.kill('SIGKILL');
    } catch {
      // ignore
    }
  }
}

export class CodexCliAgentAdapter implements CodingAgentAdapter {
  readonly id = 'codex-cli';
  readonly name = 'Codex CLI';

  private activeProcesses = new Map<string, ChildProcess>();

  constructor(private readonly options: CodexAdapterOptions = {}) {}

  async detect(): Promise<AgentAvailability> {
    try {
      const { stdout } = await execFileAsync('codex', ['--version'], { timeout: 8000 });
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
    task: ImplementationTask | RepairTask
  ): Promise<AgentExecutionResult> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const targetDir = workspace.worktreePath || workspace.repositoryPath;
    const startTime = Date.now();
    const taskTitle = 'title' in task ? task.title : task.id;
    const timeoutMs = this.options.timeoutMs ?? 180000; // 3 minutes
    const maxBufferBytes = this.options.maxBufferBytes ?? 1024 * 1024; // 1 MB

    // Construct bounded prompt strictly adhering to task discipline
    const prompt = this.buildBoundedTaskPrompt(task);

    const useDangerousBypass = Boolean(this.options.allowDangerousSandboxBypass);
    const sandboxModeLabel = useDangerousBypass
      ? 'DANGEROUS BYPASS (--dangerously-bypass-approvals-and-sandbox)'
      : 'SAFE WORKSPACE SANDBOX (--sandbox workspace-write --approve-for-me)';

    const logs: string[] = [
      `[ArchitectAI Gateway] Starting execution ${executionId} on worktree: ${targetDir}`,
      `[ArchitectAI Gateway] Task: ${task.id} — ${taskTitle}`,
      `[ArchitectAI Gateway] Codex Sandbox Policy: ${sandboxModeLabel}`,
      `[ArchitectAI Gateway] Allowed files: ${task.allowedFiles.join(', ') || 'Any non-excluded'}`,
    ];

    try {
      // Assemble codex exec arguments based on configured safety policy
      const codexArgs = ['exec', '--cd', targetDir];

      if (useDangerousBypass) {
        codexArgs.push('--dangerously-bypass-approvals-and-sandbox');
      } else {
        codexArgs.push('--sandbox', 'workspace-write', '--approve-for-me');
      }

      codexArgs.push(prompt);

      const child = execFile('codex', codexArgs, {
        cwd: targetDir,
        timeout: timeoutMs,
        maxBuffer: maxBufferBytes,
      });

      this.activeProcesses.set(executionId, child);

      let totalStdoutBytes = 0;
      let totalStderrBytes = 0;

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        totalStdoutBytes += Buffer.byteLength(text, 'utf-8');
        if (totalStdoutBytes <= maxBufferBytes) {
          logs.push(`[codex stdout] ${text.trim()}`);
        }
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        totalStderrBytes += Buffer.byteLength(text, 'utf-8');
        if (totalStderrBytes <= maxBufferBytes) {
          logs.push(`[codex stderr] ${text.trim()}`);
        }
      });

      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          this.activeProcesses.delete(executionId);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Codex process exited with code ${code}`));
          }
        });
        child.on('error', (err) => {
          this.activeProcesses.delete(executionId);
          reject(err);
        });
      });

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
      this.activeProcesses.delete(executionId);
      const durationMs = Date.now() - startTime;
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

  async cancel(executionId: string): Promise<void> {
    const proc = this.activeProcesses.get(executionId);
    if (proc && proc.pid) {
      killProcessTree(proc.pid, proc);
      this.activeProcesses.delete(executionId);
    }
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
