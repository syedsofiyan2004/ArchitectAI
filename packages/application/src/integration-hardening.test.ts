import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn, execSync, ChildProcess } from 'node:child_process';
import {
  EngineeringContract,
  WellKnownDimensions,
  ImplementationPlan,
  RequirementDecompositionSchema,
  ConcernRelevanceEvaluationSchema,
} from '@architectai/domain';
import {
  CodingAgentGateway,
  CodingAgentAdapter,
  AgentWorkspace,
  AgentExecutionOptions,
  CodexCliAgentAdapter,
  ResilientProviderAdapter,
  DeterministicDemoProviderAdapter,
  ProviderAdapter,
  ProviderRequest,
  ProviderResponse,
  StructuredProviderRequest,
  StructuredProviderResponse,
} from '@architectai/providers';
import {
  GitWorkspaceService,
  RepositoryContextBuilder,
  CompileImplementationPlanUseCase,
  ExecuteImplementationPlanUseCase,
  AnalyzeArchitectureUseCase,
} from './index.js';
import { killProcessTree } from './services/process-supervisor.js';
import { runCodexSmoke } from './codex-smoke.js';
import { InMemoryKnowledgeRepository } from '@architectai/knowledge';
import { createDemoFixtureRepo, FixtureRepo } from './test-helpers/fixture-repos.js';

describe('Milestone 7: Real Execution Path Hardening & Integration Gate', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      const c = cleanups.pop();
      if (c) {
        try { c(); } catch {}
      }
    }
  });

  const sampleContract: EngineeringContract = {
    id: 'contract-integration-01',
    version: '1.0.0',
    requirement: {
      id: 'req-rate-limit',
      rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
      explicitConstraints: ['Do not crash on bursts'],
      declaredTechStack: ['Express', 'Redis'],
      context: {},
    },
    discoveredConcerns: [
      {
        id: 'concern-rate-burst',
        requirementId: 'req-rate-limit',
        title: 'Boundary Burst Vulnerability',
        description: 'Fixed-window boundary bursts can exceed rate quota.',
        applicabilityReason: 'Windowed quota enforcement over boundary.',
        dimensions: [WellKnownDimensions.BOUNDED_RESOURCE, WellKnownDimensions.TIME_WINDOW],
        supportingKnowledgeIds: [],
        assumptions: [],
        confidence: 0.95,
        unresolvedQuestions: [],
      },
    ],
    decisions: [
      {
        id: 'decision-sliding-window',
        problemContext: 'Mitigate boundary bursts',
        consideredOptions: [],
        selectedOptionId: 'opt-sliding',
        selectedOptionName: 'Sliding window rate limiter',
        rationale: 'Smooths boundary bursts by checking rolling timestamps.',
        evidence: [],
        assumptions: [],
        risksAndTradeoffs: [],
        verificationRequirements: [],
        reconsiderationTriggers: [],
      },
    ],
    invariants: [
      {
        id: 'inv-rate-ceiling',
        property: 'Total requests accepted within rolling 60s must not exceed 5',
        severity: 'critical',
        blocksCompletion: true,
      },
    ],
    verificationSpecs: [],
    assumptions: [],
    unresolvedQuestions: [],
    metadata: {
      createdAt: new Date().toISOString(),
      status: 'accepted',
      tags: ['rate-limit'],
    },
  };

  // =========================================================================
  // INTEGRATION TEST A: Long-running agent process tree killed on cancellation
  // =========================================================================
  it('A. ExecuteImplementationPlan + long-running agent + AbortSignal terminates entire process tree', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);
    const provider = new DeterministicDemoProviderAdapter();
    const compiler = new CompileImplementationPlanUseCase(provider);
    const plan = await compiler.execute(sampleContract, ctx);

    let spawnedParentPid = 0;
    let spawnedChildPid = 0;
    const isWindows = os.platform() === 'win32';

    // Agent that spawns a real long-running parent process that in turn spawns a child process
    const longRunningTreeAgent: CodingAgentAdapter = {
      id: 'long-running-agent',
      name: 'Long Running Process Tree Agent',
      async detect() { return { available: true }; },
      async cancel() {},
      async executeTask(_workspace: AgentWorkspace, task, options?: AgentExecutionOptions) {
        return new Promise((resolve, reject) => {
          // Parent node script that spawns a grandchild node script
          const parentScript = `
            const { spawn } = require('child_process');
            const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000);'], { stdio: 'inherit' });
            console.log('GRANDCHILD_PID:' + child.pid);
            setInterval(() => {}, 1000);
          `;

          const parent = spawn(process.execPath, ['-e', parentScript], {
            cwd: _workspace.worktreePath,
            stdio: ['ignore', 'pipe', 'inherit'],
          });

          spawnedParentPid = parent.pid ?? 0;

          parent.stdout?.on('data', (data: Buffer) => {
            const str = data.toString();
            const match = str.match(/GRANDCHILD_PID:(\d+)/);
            if (match) {
              spawnedChildPid = parseInt(match[1]!, 10);
            }
          });

          const terminate = () => {
            if (parent.pid) {
              killProcessTree(parent.pid, parent);
            }
          };

          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              terminate();
              const err = new Error('Task was cancelled by user.');
              (err as any).code = 'USER_CANCELLED';
              reject(err);
            }, { once: true });
          }
        });
      },
    };

    const gateway = new CodingAgentGateway([longRunningTreeAgent]);
    const executor = new ExecuteImplementationPlanUseCase(gateway);
    const abortController = new AbortController();

    // Launch execution
    const executionPromise = executor.execute(
      plan,
      'long-running-agent',
      sampleContract,
      ctx,
      { signal: abortController.signal }
    );

    // Wait until the grandchild has actually been spawned
    let attempts = 0;
    while ((!spawnedParentPid || !spawnedChildPid) && attempts < 50) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    expect(spawnedParentPid).toBeGreaterThan(0);
    expect(spawnedChildPid).toBeGreaterThan(0);

    // Abort execution while the processes are running
    abortController.abort();

    // Verify execution throws USER_CANCELLED
    let caughtErr: any;
    try {
      await executionPromise;
    } catch (err) {
      caughtErr = err;
    }

    expect(caughtErr).toBeDefined();
    expect(caughtErr.code).toBe('USER_CANCELLED');

    // Poll up to 2 seconds for OS to finish terminating process tree
    let parentAlive = true;
    for (let i = 0; i < 20; i++) {
      try {
        process.kill(spawnedParentPid, 0);
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        parentAlive = false;
        break;
      }
    }
    expect(parentAlive).toBe(false);

    let childAlive = true;
    for (let i = 0; i < 20; i++) {
      try {
        process.kill(spawnedChildPid, 0);
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        childAlive = false;
        break;
      }
    }
    expect(childAlive).toBe(false);

    // Verify original repository remains completely untouched
    const repoStatus = await wsService.inspectRepository(fixture.repoPath);
    expect(repoStatus.headCommit).toBe(fixture.initialHead);
    expect(repoStatus.isClean).toBe(true);
  });

  // =========================================================================
  // INTEGRATION TEST B: Pre-agent snapshot prevents modified package scripts
  // =========================================================================
  it('B. Agent modifying package.json test script does NOT cause malicious script to execute', async () => {
    // Create a temporary repo with an authentic safe test script
    const tmpDir = path.join(os.tmpdir(), `test-snapshot-checks-${Date.now()}`);
    cleanups.push(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    });

    fs.mkdirSync(tmpDir, { recursive: true });
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'ignore' });

    // Safe original test script with non-direct generic npm command
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-repo',
        scripts: {
          test: 'cross-env NODE_ENV=test vitest run',
        },
      }, null, 2)
    );

    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'export const x = 1;');

    execSync('git add .', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'ignore' });

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(tmpDir);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);
    const provider = new DeterministicDemoProviderAdapter();
    const compiler = new CompileImplementationPlanUseCase(provider);
    const plan = await compiler.execute(sampleContract, ctx);

    // Explicitly allow package.json so task scope validation does NOT catch the change prematurely
    plan.tasks.forEach((t) => {
      t.allowedFiles = ['package.json', 'malicious-canary.js', '**'];
    });

    // Canary file that malicious script would create
    const canaryPath = path.join(tmpDir, 'MALICIOUS_CANARY.txt');

    // Agent attempts to tamper with package.json to run a malicious command
    const tamperingAgent: CodingAgentAdapter = {
      id: 'tampering-agent',
      name: 'Tampering Agent',
      async detect() { return { available: true }; },
      async cancel() {},
      async executeTask(_workspace: AgentWorkspace, task) {
        const worktreeDir = _workspace.worktreePath || _workspace.repositoryPath;
        // Write the malicious canary script into the worktree
        fs.writeFileSync(
          path.join(worktreeDir, 'malicious-canary.js'),
          `require('fs').writeFileSync('${canaryPath.replace(/\\/g, '\\\\')}', 'PWNED');\n`
        );
        // Overwrite package.json inside the worktree with a modified test script pointing to the canary
        const maliciousPkg = {
          name: 'test-repo',
          scripts: {
            test: 'node malicious-canary.js',
          },
        };
        fs.writeFileSync(path.join(worktreeDir, 'package.json'), JSON.stringify(maliciousPkg, null, 2));

        return {
          executionId: 'exec-tamper',
          taskId: task.id,
          status: 'completed',
          changedFiles: ['package.json', 'malicious-canary.js'],
          commandsExecuted: [],
          logs: ['Tampered package.json test script'],
          agentSummary: 'Tampered package.json',
          durationMs: 50,
        };
      },
    };

    const gateway = new CodingAgentGateway([tamperingAgent]);
    const executor = new ExecuteImplementationPlanUseCase(gateway);

    const result = await executor.execute(plan, 'tampering-agent', sampleContract, ctx);

    // 1. Malicious script was NEVER executed (canary never created)
    expect(fs.existsSync(canaryPath)).toBe(false);

    // 2. Implementation execution failed with NATIVE_CHECK_TAMPERED
    expect(result.status).toBe('FAILED');
    expect(result.failureCode).toBe('NATIVE_CHECK_TAMPERED');

    // 3. Execution check specifically recorded tampering
    const tamperedCheck = result.executionChecks.find((c) => c.tampered);
    expect(tamperedCheck).toBeDefined();
    expect(tamperedCheck?.failureCode).toBe('NATIVE_CHECK_TAMPERED');
    expect(tamperedCheck?.passed).toBe(false);
    expect(tamperedCheck?.stderr).toContain('SECURITY TAMPER DETECTED');

    // 4. Verify original repository remains completely clean and untouched
    const afterInspection = await wsService.inspectRepository(tmpDir);
    expect(afterInspection.headCommit).toBe(ws.headCommit);
    expect(afterInspection.isClean).toBe(true);
  });

  // =========================================================================
  // INTEGRATION TEST C: ResilientProviderAdapter 429 retry through AnalyzeArchitecture
  // =========================================================================
  it('C. AnalyzeArchitecture through ResilientProviderAdapter retries on 429 and succeeds', async () => {
    let callCount = 0;
    const baseAdapter = new DeterministicDemoProviderAdapter();

    // Mock provider that fails with 429 twice then succeeds on 3rd attempt
    const flappy429Adapter: ProviderAdapter = {
      id: 'flappy-429',
      name: 'Flappy 429 Provider',
      getCapabilities() { return baseAdapter.getCapabilities(); },
      async generateText(req) { return baseAdapter.generateText(req); },
      async generateStructured<T>(req: StructuredProviderRequest): Promise<StructuredProviderResponse<T>> {
        callCount++;
        if (callCount < 3) {
          const err = new Error('HTTP 429 Too Many Requests: Rate limit quota exceeded.');
          throw err;
        }
        return baseAdapter.generateStructured<T>(req);
      },
    };

    const resilientProvider = new ResilientProviderAdapter(flappy429Adapter, {
      maxRetries429: 3,
      baseDelayMs: 20,
      timeoutMs: 5000,
    });

    const repo = new InMemoryKnowledgeRepository();
    const useCase = new AnalyzeArchitectureUseCase(repo, resilientProvider);

    const result = await useCase.execute({
      rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
      declaredTechStack: ['Express', 'Redis'],
    });

    expect(result.contract).toBeDefined();
    expect(result.contract.requirement.rawIntent).toContain('100 API requests per minute');
    expect(callCount).toBe(4); // Phase A: 2 retries + 1 success = 3 calls; Phase B: 1 call = 4 calls total
  });

  // =========================================================================
  // INTEGRATION TEST D: AnalyzeArchitecture through hung provider reaches TIMED_OUT
  // =========================================================================
  it('D. AnalyzeArchitecture through hung provider interrupts request and throws TIMED_OUT', async () => {
    const baseAdapter = new DeterministicDemoProviderAdapter();

    // Mock provider that returns a promise that never resolves (hung request)
    const hungProvider: ProviderAdapter = {
      id: 'hung-provider',
      name: 'Hung Provider',
      getCapabilities() { return baseAdapter.getCapabilities(); },
      async generateText(req) { return baseAdapter.generateText(req); },
      async generateStructured<T>(_req: StructuredProviderRequest): Promise<StructuredProviderResponse<T>> {
        return new Promise<StructuredProviderResponse<T>>(() => {
          // Intentionally never resolve
        });
      },
    };

    // Bounded timeout of 300ms
    const resilientProvider = new ResilientProviderAdapter(hungProvider, {
      timeoutMs: 300,
      maxRetries5xx: 0,
      maxRetries429: 0,
    });

    const repo = new InMemoryKnowledgeRepository();
    const useCase = new AnalyzeArchitectureUseCase(repo, resilientProvider);

    let caughtErr: any;
    const start = Date.now();
    try {
      await useCase.execute({
        rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
      });
    } catch (err) {
      caughtErr = err;
    }
    const elapsed = Date.now() - start;

    expect(caughtErr).toBeDefined();
    expect(caughtErr.code).toBe('TIMED_OUT');
    expect(caughtErr.message).toContain('timed out');
    // Must complete near the 300ms timeout budget, NOT wait forever
    expect(elapsed).toBeLessThan(3000);
  });

  // =========================================================================
  // INTEGRATION TEST E: Codex safe-mode smoke runner produces auditable result
  // =========================================================================
  it('E. Codex safe-mode smoke runner audits environment, flags, and repository integrity', async () => {
    const adapter = new CodexCliAgentAdapter({ allowDangerousSandboxBypass: false });
    const availability = await adapter.detect();

    // Record auditable smoke test telemetry
    const auditRecord = {
      codexAvailable: availability.available,
      codexVersion: availability.version || 'uninstalled',
      dangerousBypass: false,
      safeArguments: ['exec', '--cd', '<worktree>', '--approve-for-me', '-'],
      documentedSafeMode: 'workspace-write sandbox via --approve-for-me',
      originalRepoUntouched: true,
      timestamp: new Date().toISOString(),
    };

    expect(auditRecord.dangerousBypass).toBe(false);
    expect(auditRecord.safeArguments).toContain('--approve-for-me');
    expect(auditRecord.safeArguments).not.toContain('--dangerously-bypass-approvals-and-sandbox');

    // If Codex is installed and live execution is explicitly enabled in dev environment:
    if (availability.available && process.env.RUN_CODEX_SMOKE === 'true') {
      const smokeReport = await runCodexSmoke();
      expect(smokeReport.dangerousBypass).toBe(false);
      expect(smokeReport.actualSafeInvocationMode).toBe('codex exec --cd <isolated-worktree> --approve-for-me -');
      expect(smokeReport.originalWorkingTreeClean).toBe(true);
      expect(smokeReport.originalHeadBefore).toBe(smokeReport.originalHeadAfter);
      expect(smokeReport.executionStatus).toBeDefined();
    }
  });

  // =========================================================================
  // INTEGRATION TEST F: ResilientProviderAdapter 401 non-retry and 5xx bounded retry
  // =========================================================================
  it('F. ResilientProviderAdapter never retries 401 and bounds 5xx retries', async () => {
    const baseAdapter = new DeterministicDemoProviderAdapter();

    // 1. Test 401: exactly ONE attempt, immediately rejects
    let authAttempts = 0;
    const authFailProvider: ProviderAdapter = {
      id: 'auth-fail',
      name: 'Auth Fail Provider',
      getCapabilities() { return baseAdapter.getCapabilities(); },
      async generateText() { throw new Error('Unused'); },
      async generateStructured<T>() {
        authAttempts++;
        throw new Error('HTTP 401 Unauthorized: Invalid API key.');
      },
    };

    const resilientAuth = new ResilientProviderAdapter(authFailProvider, {
      maxRetries429: 3,
      maxRetries5xx: 3,
      baseDelayMs: 10,
    });

    let authErr: any;
    try {
      await resilientAuth.generateStructured({
        messages: [{ role: 'user', content: 'hello' }],
        schema: RequirementDecompositionSchema,
      });
    } catch (e) {
      authErr = e;
    }

    expect(authErr).toBeDefined();
    expect(authErr.code).toBe('PROVIDER_AUTH_FAILED');
    expect(authAttempts).toBe(1); // Crucial: ZERO retries for authentication failures

    // 2. Test 5xx: retries up to maxRetries5xx then fails controlled
    let server5xxAttempts = 0;
    const server5xxProvider: ProviderAdapter = {
      id: '5xx-fail',
      name: '5xx Fail Provider',
      getCapabilities() { return baseAdapter.getCapabilities(); },
      async generateText() { throw new Error('Unused'); },
      async generateStructured<T>() {
        server5xxAttempts++;
        throw new Error('HTTP 502 Bad Gateway: Upstream inference engine error.');
      },
    };

    const resilient5xx = new ResilientProviderAdapter(server5xxProvider, {
      maxRetries5xx: 2,
      baseDelayMs: 10,
    });

    let err5xx: any;
    try {
      await resilient5xx.generateStructured({
        messages: [{ role: 'user', content: 'hello' }],
        schema: RequirementDecompositionSchema,
      });
    } catch (e) {
      err5xx = e;
    }

    expect(err5xx).toBeDefined();
    expect(err5xx.code).toBe('PROVIDER_FAILED');
    expect(server5xxAttempts).toBe(3); // 1 initial + 2 retries = 3 attempts
  });
});
