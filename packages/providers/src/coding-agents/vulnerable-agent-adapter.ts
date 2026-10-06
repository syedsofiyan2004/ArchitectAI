import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
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

/**
 * VulnerableCodingAgentAdapter generates plausible implementations that satisfy
 * superficial native repository tests, but fail ArchitectAI's independent adversarial verification.
 * This simulates real-world coding agents that introduce subtle boundary or concurrency flaws.
 */
export class VulnerableCodingAgentAdapter implements CodingAgentAdapter {
  readonly id = 'vulnerable-agent';
  readonly name = 'Vulnerable Coding Agent (Imperfect Implementations)';

  async detect(): Promise<AgentAvailability> {
    return {
      available: true,
      version: '1.0.0-vulnerable-mock',
    };
  }

  async executeTask(
    workspace: AgentWorkspace,
    task: ImplementationTask
  ): Promise<AgentExecutionResult> {
    const executionId = `vuln-exec-${Date.now()}`;
    const targetDir = workspace.worktreePath || workspace.repositoryPath;
    const startTime = Date.now();

    const logs: string[] = [
      `[VulnerableAgent] Received task: ${task.id} (${task.title})`,
      `[VulnerableAgent] Generating plausible (but flawed) implementation in ${targetDir}`,
    ];

    try {
      await this.applyVulnerableImplementation(targetDir, task, logs);

      const changedFiles = await this.getChangedFiles(targetDir);
      const durationMs = Date.now() - startTime;
      logs.push(`[VulnerableAgent] Completed ${task.id}. Changed files: ${changedFiles.join(', ')}`);

      return AgentExecutionResultSchema.parse({
        executionId,
        taskId: task.id,
        status: 'completed',
        changedFiles,
        commandsExecuted: [],
        logs,
        agentSummary: `Vulnerable Agent completed task ${task.id}: implemented basic requirements for ${task.title}.`,
        durationMs,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      return AgentExecutionResultSchema.parse({
        executionId,
        taskId: task.id,
        status: 'failed',
        changedFiles: [],
        commandsExecuted: [],
        logs,
        agentSummary: `Vulnerable Agent failed on task ${task.id}.`,
        durationMs,
        failureReason: errorMsg,
      });
    }
  }

  async cancel(_executionId: string): Promise<void> {}

  private async applyVulnerableImplementation(
    targetDir: string,
    task: ImplementationTask,
    logs: string[]
  ): Promise<void> {
    const textToMatch = `${task.title} ${task.objective} ${task.requirements.join(' ')}`.toLowerCase();

    // VULNERABLE CONTROL A: Fixed-Window Rate Limiter (Flawed Boundary Reset)
    // Satisfies native test (has 'isAllowed' and 'window'), but resets at fixed minute!
    if (textToMatch.includes('rate limit') || textToMatch.includes('burst') || textToMatch.includes('window')) {
      const limiterPath = path.join(targetDir, 'src', 'rate-limiter.ts');
      fs.mkdirSync(path.dirname(limiterPath), { recursive: true });
      fs.writeFileSync(
        limiterPath,
        `// Vulnerable Fixed-Window Rate Limiter\n` +
        `// Satisfies native tests requiring isAllowed and window, but susceptible to boundary burst\n` +
        `export class FixedWindowRateLimiter {\n` +
        `  private counters: Map<string, number> = new Map();\n` +
        `  private limit: number;\n` +
        `  private windowMs: number;\n` +
        `  constructor(limit: number = 5, windowMs: number = 60000) {\n` +
        `    this.limit = limit;\n` +
        `    this.windowMs = windowMs;\n` +
        `  }\n` +
        `  isAllowed(key: string, now: number = Date.now()): boolean {\n` +
        `    const windowBucket = Math.floor(now / this.windowMs);\n` +
        `    const windowKey = \`\${key}:\${windowBucket}\`;\n` +
        `    const current = this.counters.get(windowKey) || 0;\n` +
        `    if (current >= this.limit) return false;\n` +
        `    this.counters.set(windowKey, current + 1);\n` +
        `    return true;\n` +
        `  }\n` +
        `}\n` +
        `// Export default alias\n` +
        `export const RateLimiter = FixedWindowRateLimiter;\n`
      );
      logs.push(`[VulnerableAgent] Generated vulnerable fixed-window limiter at ${limiterPath}`);
      return;
    }

    // VULNERABLE CONTROL B: Payment Idempotency without Atomic Check-and-Lock
    // Satisfies native test (has 'checkAndLock' and 'complete'), but doesn't deduplicate!
    if (textToMatch.includes('idempot') || textToMatch.includes('payment') || textToMatch.includes('duplicate')) {
      const idempotencyPath = path.join(targetDir, 'src', 'idempotency.ts');
      fs.mkdirSync(path.dirname(idempotencyPath), { recursive: true });
      fs.writeFileSync(
        idempotencyPath,
        `// Vulnerable Idempotency Ledger\n` +
        `// Satisfies native test requiring checkAndLock and complete, but allows duplicate charges!\n` +
        `export class IdempotencyLedger {\n` +
        `  checkAndLock(key: string): { locked: boolean; cached?: any } {\n` +
        `    // Flaw: Always returns locked: true without checking existing records\n` +
        `    return { locked: true };\n` +
        `  }\n` +
        `  complete(key: string, response: any): void {\n` +
        `    // No-op\n` +
        `  }\n` +
        `}\n`
      );
      logs.push(`[VulnerableAgent] Generated vulnerable payment ledger at ${idempotencyPath}`);
      return;
    }

    // VULNERABLE CONTROL C: Unbounded Worker Pool
    // Satisfies native test (has 'BoundedWorkerPool' and 'maxConcurrency'), but executes immediately!
    if (textToMatch.includes('image') || textToMatch.includes('worker') || textToMatch.includes('concurrency') || textToMatch.includes('queue')) {
      const workerPoolPath = path.join(targetDir, 'src', 'worker-pool.ts');
      fs.mkdirSync(path.dirname(workerPoolPath), { recursive: true });
      fs.writeFileSync(
        workerPoolPath,
        `// Vulnerable Worker Pool\n` +
        `// Satisfies native test requiring BoundedWorkerPool and maxConcurrency, but does not bound concurrency!\n` +
        `export class BoundedWorkerPool<T, R> {\n` +
        `  private maxConcurrency: number;\n` +
        `  private workerFn: (item: T) => Promise<R>;\n` +
        `  constructor(maxConcurrency: number, workerFn: (item: T) => Promise<R>) {\n` +
        `    this.maxConcurrency = maxConcurrency;\n` +
        `    this.workerFn = workerFn;\n` +
        `  }\n` +
        `  async submit(item: T): Promise<R> {\n` +
        `    // Flaw: executes immediately without queuing\n` +
        `    return this.workerFn(item);\n` +
        `  }\n` +
        `}\n`
      );
      logs.push(`[VulnerableAgent] Generated vulnerable worker pool at ${workerPoolPath}`);
      return;
    }

    // Fallback
    const targetFile = path.join(targetDir, 'src', `${task.id.toLowerCase()}.ts`);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, `export const ${task.id} = false;\n`);
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
