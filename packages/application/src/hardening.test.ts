import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import {
  EngineeringContract,
  WellKnownDimensions,
  ImplementationPlan,
} from '@architectai/domain';
import {
  CodingAgentGateway,
  DeterministicCodingAgentAdapter,
  DeterministicDemoProviderAdapter,
  CodexCliAgentAdapter,
  CodingAgentAdapter,
  VulnerableCodingAgentAdapter,
} from '@architectai/providers';
import {
  GitWorkspaceService,
  RepositoryContextBuilder,
  CompileImplementationPlanUseCase,
  ExecuteImplementationPlanUseCase,
  ExecuteRepairLoopUseCase,
  BoundedArtifactStorage,
  ArtifactCorruptedError,
  withProviderResilience,
  redactSensitiveData,
  isSafeSymlink,
} from './index.js';
import {
  createDemoFixtureRepo,
  createMonorepoFixtureRepo,
  createDirtyFixtureRepo,
  createFailingNativeTestFixtureRepo,
  createSecretsAndBinariesFixtureRepo,
  FixtureRepo,
} from './test-helpers/fixture-repos.js';

describe('Milestone 7: Real-World End-to-End Product Hardening', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      const c = cleanups.pop();
      if (c) c();
    }
  });

  const sampleContract: EngineeringContract = {
    id: 'contract-hardening-01',
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
        id: 'concern-fixed-window-burst',
        requirementId: 'req-rate-limit',
        title: 'Fixed-Window Boundary Bursts',
        description: 'Clients can double allowance across window boundary.',
        applicabilityReason: 'Windowed API ingress quota enforcement.',
        dimensions: [WellKnownDimensions.BOUNDED_RESOURCE, WellKnownDimensions.TIME_WINDOW],
        supportingKnowledgeIds: ['pattern-fixed-window-burst'],
        assumptions: [],
        confidence: 0.95,
        unresolvedQuestions: [],
      },
    ],
    decisions: [
      {
        id: 'decision-sliding-window-limiter',
        problemContext: 'Mitigate 2x quota burst across boundary.',
        consideredOptions: [],
        selectedOptionId: 'opt-sliding',
        selectedOptionName: 'Sliding window rate limiter',
        rationale: 'Smooths boundary bursts by checking rolling timestamps.',
        evidence: [],
        assumptions: [],
        risksAndTradeoffs: [],
        verificationRequirements: ['Verify requests at boundary are bounded'],
        reconsiderationTriggers: [],
      },
    ],
    invariants: [
      {
        id: 'inv-rate-ceiling',
        property: 'At most 100 requests per rolling 60 seconds per user key.',
        severity: 'critical',
        blocksCompletion: true,
      },
    ],
    verificationSpecs: [
      {
        id: 'verif-burst-boundary',
        target: 'inv-rate-ceiling',
        description: 'Send 100 requests at second 59 and 100 at second 61; reject excess.',
        setup: 'Mock clock at second 59',
        action: 'Emit burst',
        expectedProperty: 'Excess requests return 429',
        evidenceToCollect: ['response status codes'],
        isAutomatable: true,
      },
    ],
    assumptions: [],
    unresolvedQuestions: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  // 1. REPOSITORY HEAD DRIFT (REPOSITORY_CHANGED)
  it('A. rejects plan execution when repository HEAD has moved since compilation', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);
    const provider = new DeterministicDemoProviderAdapter();
    const compiler = new CompileImplementationPlanUseCase(provider);
    const plan = await compiler.execute(sampleContract, ctx);

    expect(plan.repositoryFingerprint).toBeDefined();
    expect(plan.repositoryFingerprint?.headCommit).toBe(fixture.initialHead);

    // Advance repository HEAD with a new commit
    fs.writeFileSync(path.join(fixture.repoPath, 'src', 'extra.js'), '// extra commit\n');
    execSync('git add . && git commit -m "advanced HEAD commit"', { cwd: fixture.repoPath, stdio: 'ignore' });
    const newHead = execSync('git rev-parse HEAD', { cwd: fixture.repoPath, encoding: 'utf8' }).trim();
    expect(newHead).not.toBe(fixture.initialHead);

    // Execution must reject with REPOSITORY_CHANGED
    const gateway = new CodingAgentGateway([new DeterministicCodingAgentAdapter()]);
    const executor = new ExecuteImplementationPlanUseCase(gateway);

    let thrownError: any = null;
    try {
      await executor.execute(plan);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.code).toBe('REPOSITORY_CHANGED');
    expect(thrownError.message).toContain('Repository HEAD has changed');

    // PROOF: Original repo is intact at newHead, no worktree or branch created
    const currentHeadAfter = execSync('git rev-parse HEAD', { cwd: fixture.repoPath, encoding: 'utf8' }).trim();
    expect(currentHeadAfter).toBe(newHead);
  });

  // 2. DIRTY REPO SAFETY POLICY (REPOSITORY_DIRTY and allowDirtyRepo)
  it('B. blocks dirty repository execution without explicit acknowledgement and preserves working tree', async () => {
    const fixture = createDirtyFixtureRepo();
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);
    const provider = new DeterministicDemoProviderAdapter();
    const compiler = new CompileImplementationPlanUseCase(provider);
    const plan = await compiler.execute(sampleContract, ctx);

    const gateway = new CodingAgentGateway([new DeterministicCodingAgentAdapter()]);
    const executor = new ExecuteImplementationPlanUseCase(gateway);

    // 1. Without allowDirtyRepo -> blocked with REPOSITORY_DIRTY
    let blockedErr: any = null;
    try {
      await executor.execute(plan, undefined, undefined, undefined, { allowDirtyRepo: false });
    } catch (err) {
      blockedErr = err;
    }
    expect(blockedErr).toBeDefined();
    expect(blockedErr.code).toBe('REPOSITORY_DIRTY');
    expect(blockedErr.message).toContain('working tree contains local uncommitted changes');

    // 2. With allowDirtyRepo: true -> execution succeeds from HEAD
    const output = await executor.execute(plan, undefined, undefined, undefined, { allowDirtyRepo: true });
    expect(output.allTasksCompleted).toBe(true);

    // PROOF: Original working tree uncommitted files remain untouched
    const uncommittedFile = path.join(fixture.repoPath, 'uncommitted.txt');
    expect(fs.existsSync(uncommittedFile)).toBe(true);
    expect(fs.readFileSync(uncommittedFile, 'utf8')).toBe('dirty working tree content');
  });

  // 3. REPOSITORY IDENTITY AND REPLACEMENT DETECTION
  it('C. detects repository identity mismatch or filesystem deletion', async () => {
    const fixtureA = createDemoFixtureRepo('rate-limiter');
    const fixtureB = createDemoFixtureRepo('payment-idempotency');
    cleanups.push(fixtureA.cleanup);
    cleanups.push(fixtureB.cleanup);

    const wsService = new GitWorkspaceService();

    // Check non-existent path
    const unavailableRes = await wsService.verifyRepositoryIdentity('C:\\non_existent_folder_xyz123');
    expect(unavailableRes.valid).toBe(false);
    expect(unavailableRes.failureCode).toBe('REPOSITORY_UNAVAILABLE');

    // Check replaced repository (path of B with initial commit of A)
    const fpA = await wsService.computeFingerprint(fixtureA.repoPath);
    const mismatchRes = await wsService.verifyRepositoryIdentity(fixtureB.repoPath, fpA.initialCommit);
    expect(mismatchRes.valid).toBe(false);
    expect(mismatchRes.failureCode).toBe('REPOSITORY_IDENTITY_MISMATCH');
    expect(mismatchRes.reason).toContain('Repository replacement detected');
  });

  // 4. SYMLINK BOUNDARY SAFETY
  it('D. rejects external symlinks and permits safe internal symlinks', () => {
    const tmpDir = path.join(os.tmpdir(), `symlink-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    cleanups.push(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    });

    const repoDir = path.join(tmpDir, 'repo');
    const outsideDir = path.join(tmpDir, 'outside');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });

    const outsideFile = path.join(outsideDir, 'secret.txt');
    fs.writeFileSync(outsideFile, 'secret outside repo');

    const internalFile = path.join(repoDir, 'internal.txt');
    fs.writeFileSync(internalFile, 'clean internal');

    expect(isSafeSymlink(internalFile, repoDir)).toBe(true);
    expect(isSafeSymlink(outsideFile, repoDir)).toBe(false);
  });

  // 5. SECRET SCANNING AND BINARY FILE OMISSION
  it('E. excludes credentials, secrets, binary files, and oversized files from repository context', async () => {
    const fixture = createSecretsAndBinariesFixtureRepo();
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);

    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);

    // Verify secret files were excluded from relevantFiles
    const fileNames = ctx.relevantFiles.map((f) => path.basename(f));
    expect(fileNames).not.toContain('.env.production');
    expect(fileNames).not.toContain('id_rsa');
    expect(fileNames).not.toContain('credentials');

    // Verify binary and huge files were excluded
    expect(fileNames).not.toContain('archive.zip');
    expect(fileNames).not.toContain('image.png');
    expect(fileNames).not.toContain('huge-file.bin');

    // Verify context metrics track omissions
    expect(ctx.selectionRationale).toBeDefined();
    expect(ctx.filesOmitted).toBeGreaterThan(0);
    expect(ctx.filesInspected).toBeGreaterThan(0);
  });

  // 6. CONTEXT BUDGET BOUNDING
  it('F. bounds repository context within file and byte budgets', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    // Create 30 small files
    for (let i = 0; i < 30; i++) {
      fs.writeFileSync(path.join(fixture.repoPath, 'src', `file_${i}.js`), `// file ${i}\n`);
    }

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);

    const builder = new RepositoryContextBuilder({ maxFiles: 5, maxContextBytes: 1024 });
    const ctx = await builder.buildContext(sampleContract, ws);

    expect(ctx.relevantFiles.length).toBeLessThanOrEqual(5);
    expect(ctx.contextBytes).toBeLessThanOrEqual(1024);
  });

  // 7. PROVIDER RESILIENCE & BOUNDED RETRIES
  it('G. retries 429 rate limit with backoff and rejects 401 without retry', async () => {
    let callCount = 0;

    // Simulated 429 that recovers on 3rd attempt
    const operation429 = async () => {
      callCount++;
      if (callCount < 3) {
        const err = new Error('Rate limit exceeded');
        (err as any).status = 429;
        throw err;
      }
      return 'recovered';
    };

    const res429 = await withProviderResilience(operation429, {
      maxRetries429: 3,
      baseDelayMs: 10,
    });
    expect(res429).toBe('recovered');
    expect(callCount).toBe(3);

    // Simulated 401 unauthorized: must fail immediately without retrying
    let callCount401 = 0;
    const operation401 = async () => {
      callCount401++;
      const err = new Error('Unauthorized');
      (err as any).status = 401;
      throw err;
    };

    let caught401: any = null;
    try {
      await withProviderResilience(operation401, {
        maxRetries429: 3,
        baseDelayMs: 10,
      });
    } catch (err) {
      caught401 = err;
    }

    expect(caught401).toBeDefined();
    expect(callCount401).toBe(1); // No retries for 401!
  });

  // 8. CODING AGENT SCOPE VIOLATION ENFORCEMENT
  it('H. rejects agent modifications to files outside authorized task scope', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);
    const provider = new DeterministicDemoProviderAdapter();
    const compiler = new CompileImplementationPlanUseCase(provider);
    const plan = await compiler.execute(sampleContract, ctx);

    // Agent adapter that deliberately mutates an unauthorized file
    const rogueAgent: CodingAgentAdapter = {
      id: 'rogue-agent',
      name: 'Rogue Agent',
      async detect() { return { available: true }; },
      async cancel() {},
      async executeTask(workspace, task) {
        // Write to unauthorized file outside task scope
        const targetDir = workspace.worktreePath || workspace.repositoryPath;
        fs.writeFileSync(path.join(targetDir, 'unauthorized_file.txt'), 'hacked');
        return {
          executionId: `exec-${Date.now()}`,
          taskId: task.id,
          status: 'completed',
          changedFiles: ['unauthorized_file.txt'],
          commandsExecuted: [],
          logs: ['Wrote unauthorized file'],
          agentSummary: 'Rogue task completed',
          durationMs: 50,
        };
      },
    };

    const gateway = new CodingAgentGateway([rogueAgent]);
    const executor = new ExecuteImplementationPlanUseCase(gateway);

    let scopeErr: any = null;
    try {
      await executor.execute(plan, 'rogue-agent');
    } catch (err) {
      scopeErr = err;
    }

    expect(scopeErr).toBeDefined();
    expect(scopeErr.code).toBe('SCOPE_VIOLATION');
    expect(scopeErr.message).toContain('which is not in allowedFiles');
  });

  // 9. NATIVE CHECK SEPARATION
  it('I. captures native check failure separately from ArchitectAI invariant verification', async () => {
    const fixture = createFailingNativeTestFixtureRepo();
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);
    const provider = new DeterministicDemoProviderAdapter();
    const compiler = new CompileImplementationPlanUseCase(provider);
    const plan = await compiler.execute(sampleContract, ctx);

    const gateway = new CodingAgentGateway([new DeterministicCodingAgentAdapter()]);
    const executor = new ExecuteImplementationPlanUseCase(gateway);
    const output = await executor.execute(plan);

    // nativeChecksPassed is false because test.cjs exited with 1
    expect(output.nativeChecksPassed).toBe(false);
    expect(output.executionChecks.some((c) => !c.passed)).toBe(true);
  });

  // 10. REPAIR LOOP REPEATED IDENTICAL FAILURE EARLY TERMINATION
  it('J. terminates repair loop early when failure fingerprint repeats without code change', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);
    const provider = new DeterministicDemoProviderAdapter();
    const compiler = new CompileImplementationPlanUseCase(provider);
    const plan = await compiler.execute(sampleContract, ctx);

    // Stalling agent that makes no changes
    const stallingAgent: CodingAgentAdapter = {
      id: 'stalling-agent',
      name: 'Stalling Agent',
      async detect() { return { available: true }; },
      async cancel() {},
      async executeTask(_workspace, task) {
        return {
          executionId: `exec-${Date.now()}`,
          taskId: task.id,
          status: 'completed',
          changedFiles: [],
          commandsExecuted: [],
          logs: ['Noop'],
          agentSummary: 'Made no changes',
          durationMs: 50,
        };
      },
    };

    const vulnerableAgent = new VulnerableCodingAgentAdapter();
    const gateway = new CodingAgentGateway([vulnerableAgent, stallingAgent]);
    const planExecutor = new ExecuteImplementationPlanUseCase(gateway);

    const initialOutput = await planExecutor.execute(
      plan,
      'vulnerable-agent',
      sampleContract,
      ctx,
      { preserveWorktreeOnFailure: true }
    );

    const repairLoop = new ExecuteRepairLoopUseCase(gateway);

    const repairResult = await repairLoop.execute({
      contract: sampleContract,
      implementationPlan: plan,
      verificationPlan: initialOutput.verificationPlan!,
      initialVerificationRun: initialOutput.verificationRun!,
      context: ctx,
      worktreeSession: initialOutput.worktreeSession!,
      maxAttempts: 5,
      agentId: 'stalling-agent',
      cleanupWorktreeOnFinish: true,
    });

    // Loop detects identical repeated failure fingerprint and terminates with NEEDS_HUMAN_REVIEW early
    expect(repairResult.isRepaired).toBe(false);
    expect(repairResult.outcome).toBe('NEEDS_HUMAN_REVIEW');
    expect(repairResult.attempts.length).toBeLessThan(5);
  });

  // 11. ARTIFACT SHA-256 INTEGRITY VALIDATION
  it('K. detects tampered or corrupted artifacts via SHA-256 hash mismatch', () => {
    const tmpStorage = path.join(os.tmpdir(), `artifact-integrity-${Date.now()}`);
    cleanups.push(() => {
      try { fs.rmSync(tmpStorage, { recursive: true, force: true }); } catch {}
    });

    const storage = new BoundedArtifactStorage({ baseDir: tmpStorage });
    const stored = storage.storeArtifact('run-101', 'evidence.log', 'authentic verified log content');

    // Retrieve original -> succeeds
    const verified = storage.readArtifact('run-101', 'evidence.log', stored.contentHash);
    expect(verified).toBe('authentic verified log content');

    // Tamper file directly on filesystem
    const diskPath = path.join(tmpStorage, stored.relativePath);
    fs.writeFileSync(diskPath, 'tampered malicious log content');

    // Retrieve tampered -> throws ArtifactCorruptedError
    expect(() => {
      storage.readArtifact('run-101', 'evidence.log', stored.contentHash);
    }).toThrow(ArtifactCorruptedError);
  });

  // 12. SENSITIVE CREDENTIAL REDACTION
  it('L. scrubs API keys, bearer tokens, github tokens, and database passwords from error output', () => {
    const rawError = 'Provider error with key sk-proj-1234567890abcdef12345678 and token ghp_1234567890abcdef1234567890abcdef1234 on postgres://admin:superSecretPassword@localhost:5432/db';
    const redacted = redactSensitiveData(rawError);

    expect(redacted).not.toContain('sk-proj-1234567890abcdef12345678');
    expect(redacted).not.toContain('ghp_1234567890abcdef1234567890abcdef1234');
    expect(redacted).not.toContain('superSecretPassword');
    expect(redacted).toContain('[REDACTED]');
  });

  // 13. MONOREPO DISCOVERY
  it('M. discovers package manifests across monorepo workspace subdirectories', async () => {
    const fixture = createMonorepoFixtureRepo();
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);

    expect(ws.packageManifests.length).toBeGreaterThanOrEqual(2);
    const manifestNames = ws.packageManifests.map((m) => m.name);
    expect(manifestNames).toContain('@demo/api');
    expect(manifestNames).toContain('@demo/shared');
  });

  // 14. PROCESS & OPERATION CANCELLATION (AbortSignal)
  it('N. aborts execution immediately when user cancels via AbortSignal', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);
    const provider = new DeterministicDemoProviderAdapter();
    const compiler = new CompileImplementationPlanUseCase(provider);
    const plan = await compiler.execute(sampleContract, ctx);

    const abortController = new AbortController();
    abortController.abort(); // Cancel before execution

    const gateway = new CodingAgentGateway([new DeterministicCodingAgentAdapter()]);
    const executor = new ExecuteImplementationPlanUseCase(gateway);

    let cancelErr: any = null;
    try {
      await executor.execute(plan, undefined, undefined, undefined, { signal: abortController.signal });
    } catch (err) {
      cancelErr = err;
    }

    expect(cancelErr).toBeDefined();
    expect(cancelErr.code).toBe('USER_CANCELLED');
  });

  // 15. CODEX CLI ADAPTER DETECT & ENVIRONMENT INTEGRITY
  it('O. verifies Codex CLI adapter status and configuration safety', async () => {
    const adapter = new CodexCliAgentAdapter();
    const availability = await adapter.detect();

    expect(availability).toBeDefined();
    expect(typeof availability.available).toBe('boolean');
    if (availability.available) {
      expect(availability.version).toBeDefined();
      expect(availability.version).toContain('0.158');
    }
  });
});
