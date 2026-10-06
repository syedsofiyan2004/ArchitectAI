import * as fs from 'node:fs';
import * as path from 'node:path';
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
} from '../types.js';

const execFileAsync = promisify(execFile);

export class DeterministicCodingAgentAdapter implements CodingAgentAdapter {
  readonly id = 'deterministic-agent';
  readonly name = 'Deterministic Test Agent';

  async detect(): Promise<AgentAvailability> {
    return {
      available: true,
      version: '1.0.0-mock',
    };
  }

  async executeTask(
    workspace: AgentWorkspace,
    task: ImplementationTask | RepairTask
  ): Promise<AgentExecutionResult> {
    const executionId = `mock-exec-${Date.now()}`;
    const targetDir = workspace.worktreePath || workspace.repositoryPath;
    const startTime = Date.now();
    const taskTitle = 'title' in task ? task.title : task.id;
    const taskReqs = 'requirements' in task ? task.requirements : task.repairRequirements;

    const logs: string[] = [
      `[DeterministicAgent] Received task: ${task.id} (${taskTitle})`,
      `[DeterministicAgent] Target worktree directory: ${targetDir}`,
      `[DeterministicAgent] Analyzing requirements: ${taskReqs.join('; ')}`,
    ];

    try {
      // Apply deterministic implementation based on task context and target files
      await this.applyImplementation(targetDir, task, logs);

      // Inspect changed files via git status
      const changedFiles = await this.getChangedFiles(targetDir);

      const durationMs = Date.now() - startTime;
      logs.push(`[DeterministicAgent] Successfully implemented ${task.id}. Changed files: ${changedFiles.join(', ')}`);

      return AgentExecutionResultSchema.parse({
        executionId,
        taskId: task.id,
        status: 'completed',
        changedFiles,
        commandsExecuted: [],
        logs,
        agentSummary: `Deterministic Agent completed task ${task.id}: implemented requirements for ${taskTitle}.`,
        durationMs,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      logs.push(`[DeterministicAgent] Error during task execution: ${errorMsg}`);

      return AgentExecutionResultSchema.parse({
        executionId,
        taskId: task.id,
        status: 'failed',
        changedFiles: [],
        commandsExecuted: [],
        logs,
        agentSummary: `Deterministic Agent failed on task ${task.id}.`,
        durationMs,
        failureReason: errorMsg,
      });
    }
  }

  async cancel(_executionId: string): Promise<void> {
    // No-op for synchronous deterministic executor
  }

  private async applyImplementation(
    targetDir: string,
    task: ImplementationTask | RepairTask,
    logs: string[]
  ): Promise<void> {
    const taskTitle = 'title' in task ? task.title : task.id;
    const taskReqs = 'requirements' in task ? task.requirements : task.repairRequirements;
    const targetInvariants = 'targetInvariantIds' in task ? task.targetInvariantIds : ('sourceInvariantIds' in task ? task.sourceInvariantIds : []);
    const textToMatch = `${taskTitle} ${task.objective} ${taskReqs.join(' ')} ${targetInvariants.join(' ')}`.toLowerCase();

    // Target Scenario A: Rate Limiting
    if (textToMatch.includes('rate limit') || textToMatch.includes('burst') || textToMatch.includes('window')) {
      const limiterPath = path.join(targetDir, 'src', 'rate-limiter.ts');
      fs.mkdirSync(path.dirname(limiterPath), { recursive: true });
      fs.writeFileSync(
        limiterPath,
        `// ArchitectAI Generated Implementation for Rate Limiting\n` +
        `export class SlidingWindowRateLimiter {\n` +
        `  private requests: Map<string, number[]> = new Map();\n` +
        `  private limit: number;\n` +
        `  private windowMs: number;\n` +
        `  constructor(limit: number = 100, windowMs: number = 60000) {\n` +
        `    this.limit = limit;\n` +
        `    this.windowMs = windowMs;\n` +
        `  }\n` +
        `  isAllowed(key: string, now: number = Date.now()): boolean {\n` +
        `    const timestamps = (this.requests.get(key) || []).filter(t => now - t < this.windowMs);\n` +
        `    if (timestamps.length >= this.limit) return false;\n` +
        `    timestamps.push(now);\n` +
        `    this.requests.set(key, timestamps);\n` +
        `    return true;\n` +
        `  }\n` +
        `}\n`
      );
      logs.push(`[DeterministicAgent] Generated ${limiterPath}`);
      return;
    }

    // Target Scenario B: Payment Idempotency
    if (textToMatch.includes('idempot') || textToMatch.includes('payment') || textToMatch.includes('duplicate')) {
      const idempotencyPath = path.join(targetDir, 'src', 'idempotency.ts');
      fs.mkdirSync(path.dirname(idempotencyPath), { recursive: true });
      fs.writeFileSync(
        idempotencyPath,
        `// ArchitectAI Generated Implementation for Idempotency\n` +
        `export class IdempotencyLedger {\n` +
        `  private ledger: Map<string, { status: string; response?: any }> = new Map();\n` +
        `  checkAndLock(key: string): { locked: boolean; cached?: any } {\n` +
        `    if (this.ledger.has(key)) {\n` +
        `      return { locked: false, cached: this.ledger.get(key)?.response };\n` +
        `    }\n` +
        `    this.ledger.set(key, { status: 'in_flight' });\n` +
        `    return { locked: true };\n` +
        `  }\n` +
        `  complete(key: string, response: any): void {\n` +
        `    this.ledger.set(key, { status: 'completed', response });\n` +
        `  }\n` +
        `}\n`
      );
      logs.push(`[DeterministicAgent] Generated ${idempotencyPath}`);
      return;
    }

    // Target Scenario C: Image Worker Bounded Concurrency
    if (textToMatch.includes('image') || textToMatch.includes('worker') || textToMatch.includes('concurrency') || textToMatch.includes('queue')) {
      const workerPoolPath = path.join(targetDir, 'src', 'worker-pool.ts');
      fs.mkdirSync(path.dirname(workerPoolPath), { recursive: true });
      fs.writeFileSync(
        workerPoolPath,
        `// ArchitectAI Generated Implementation for Bounded Worker Concurrency\n` +
        `export class BoundedWorkerPool<T, R> {\n` +
        `  private activeCount: number = 0;\n` +
        `  private queue: Array<{ item: T; resolve: (res: R) => void; reject: (err: any) => void }> = [];\n` +
        `  private maxConcurrency: number;\n` +
        `  private workerFn: (item: T) => Promise<R>;\n` +
        `  constructor(maxConcurrency: number, workerFn: (item: T) => Promise<R>) {\n` +
        `    this.maxConcurrency = maxConcurrency;\n` +
        `    this.workerFn = workerFn;\n` +
        `  }\n` +
        `  async submit(item: T): Promise<R> {\n` +
        `    return new Promise<R>((resolve, reject) => {\n` +
        `      this.queue.push({ item, resolve, reject });\n` +
        `      this.drain();\n` +
        `    });\n` +
        `  }\n` +
        `  private drain(): void {\n` +
        `    while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {\n` +
        `      const task = this.queue.shift()!;\n` +
        `      this.activeCount++;\n` +
        `      this.workerFn(task.item)\n` +
        `        .then(res => task.resolve(res))\n` +
        `        .catch(err => task.reject(err))\n` +
        `        .finally(() => { this.activeCount--; this.drain(); });\n` +
        `    }\n` +
        `  }\n` +
        `}\n`
      );
      logs.push(`[DeterministicAgent] Generated ${workerPoolPath}`);
      return;
    }

    // Target Scenario D: Single-Flight Token Manager
    if (textToMatch.includes('token') || textToMatch.includes('refresh') || textToMatch.includes('auth')) {
      const tokenPath = path.join(targetDir, 'src', 'token-manager.ts');
      fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
      fs.writeFileSync(
        tokenPath,
        `// ArchitectAI Generated Implementation for Single-Flight Token Manager\n` +
        `export class TokenManager {\n` +
        `  private exchangeFn: () => Promise<any>;\n` +
        `  private inFlightPromise: Promise<any> | null = null;\n` +
        `  constructor(exchangeFn: () => Promise<any>) {\n` +
        `    this.exchangeFn = exchangeFn;\n` +
        `  }\n` +
        `  async refreshToken(): Promise<any> {\n` +
        `    if (this.inFlightPromise) {\n` +
        `      return this.inFlightPromise;\n` +
        `    }\n` +
        `    this.inFlightPromise = (async () => {\n` +
        `      try {\n` +
        `        return await this.exchangeFn();\n` +
        `      } finally {\n` +
        `        this.inFlightPromise = null;\n` +
        `      }\n` +
        `    })();\n` +
        `    return this.inFlightPromise;\n` +
        `  }\n` +
        `}\n`
      );
      logs.push(`[DeterministicAgent] Generated ${tokenPath}`);
      return;
    }

    // Fallback: create primary artifact from concrete allowedFiles or src/task-id.ts
    let targetFile = path.join('src', `${task.id.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ts`);
    const candidateFile = task.allowedFiles.find((f) => !f.includes('*'));
    if (candidateFile) {
      targetFile = candidateFile;
    }
    const fullPath = path.join(targetDir, targetFile);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(
      fullPath,
      `// ArchitectAI Implementation for ${task.id}\nexport const ${task.id.replace(/[^a-zA-Z0-9]/g, '_')} = true;\n`
    );
    logs.push(`[DeterministicAgent] Generated ${fullPath}`);
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
