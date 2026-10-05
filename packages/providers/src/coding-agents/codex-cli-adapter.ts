import { execFile, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import {
  ImplementationTask,
  AgentExecutionResult,
  AgentExecutionResultSchema,
} from '@architectai/domain';
import {
  CodingAgentAdapter,
  AgentAvailability,
  AgentWorkspace,
} from '../types.js';

const execFileAsync = promisify(execFile);

export class CodexCliAgentAdapter implements CodingAgentAdapter {
  readonly id = 'codex-cli';
  readonly name = 'Codex CLI';

  private activeProcesses = new Map<string, ChildProcess>();

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
    task: ImplementationTask
  ): Promise<AgentExecutionResult> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const targetDir = workspace.worktreePath || workspace.repositoryPath;
    const startTime = Date.now();

    // Construct bounded prompt strictly adhering to task discipline
    const prompt = this.buildBoundedTaskPrompt(task);

    const logs: string[] = [
      `[ArchitectAI Gateway] Starting execution ${executionId} on worktree: ${targetDir}`,
      `[ArchitectAI Gateway] Task: ${task.id} — ${task.title}`,
      `[ArchitectAI Gateway] Allowed files: ${task.allowedFiles.join(', ') || 'Any non-excluded'}`,
    ];

    try {
      // Execute codex exec non-interactively
      // We pass instructions via prompt argument or stdin
      const child = execFile(
        'codex',
        [
          'exec',
          '--cd',
          targetDir,
          '--dangerously-bypass-approvals-and-sandbox',
          prompt,
        ],
        {
          cwd: targetDir,
          timeout: 120000, // 2 minutes max per task
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      this.activeProcesses.set(executionId, child);

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdoutChunks.push(text);
        logs.push(`[codex stdout] ${text.trim()}`);
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderrChunks.push(text);
        logs.push(`[codex stderr] ${text.trim()}`);
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
    if (proc) {
      proc.kill('SIGTERM');
      this.activeProcesses.delete(executionId);
    }
  }

  private buildBoundedTaskPrompt(task: ImplementationTask): string {
    return [
      `# ArchitectAI Bounded Implementation Task: ${task.id}`,
      `Objective: ${task.objective}`,
      '',
      '## Architectural Traceability',
      `- Source Concerns: ${task.sourceConcernIds.join(', ') || 'N/A'}`,
      `- Source Decisions: ${task.sourceDecisionIds.join(', ') || 'N/A'}`,
      `- Source Invariants: ${task.sourceInvariantIds.join(', ') || 'N/A'}`,
      '',
      '## Scope Boundaries',
      `- Files Allowed to Modify: ${task.allowedFiles.join(', ') || 'None specified (stay bounded)'}`,
      `- Files EXCLUDED from Modification: ${task.excludedFiles.join(', ') || 'Do not modify unrelated code or package lockfiles without permission'}`,
      '',
      '## Requirements',
      ...task.requirements.map((r, i) => `${i + 1}. ${r}`),
      '',
      '## Acceptance Criteria',
      ...task.acceptanceCriteria.map((a) => `- [ ] ${a}`),
      '',
      '## Operational Instructions',
      '1. Implement ONLY what is requested in this bounded task.',
      '2. Do NOT redesign the architecture or change public API contracts outside scope.',
      '3. Ensure existing tests pass and add unit tests for new behavior if appropriate.',
    ].join('\n');
  }

  private async getChangedFiles(dir: string): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync('git', ['-C', dir, 'status', '--porcelain']);
      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 3)
        .map((line) => line.slice(3).trim());
    } catch {
      return [];
    }
  }
}
