import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  EngineeringContract,
  WellKnownDimensions,
  ImplementationPlanSchema,
} from '@architectai/domain';
import {
  DeterministicDemoProviderAdapter,
  CodingAgentGateway,
  CodexCliAgentAdapter,
  DeterministicCodingAgentAdapter,
} from '@architectai/providers';
import {
  GitWorkspaceService,
  NonGitRepositoryError,
  RepositoryContextBuilder,
  CompileImplementationPlanUseCase,
  ExecuteImplementationPlanUseCase,
} from './index.js';
import { createDemoFixtureRepo, FixtureRepo } from './test-helpers/fixture-repos.js';

describe('Milestone 2: Engineering Execution Pipeline', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      const c = cleanups.pop();
      if (c) c();
    }
  });

  const sampleContract: EngineeringContract = {
    id: 'contract-exec-test-01',
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
        consideredOptions: [
          { id: 'opt-fixed', name: 'Fixed window counter', description: 'Simple reset' },
          { id: 'opt-sliding', name: 'Sliding window log', description: 'Rolling time window' },
        ],
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
      status: 'accepted',
      tags: ['rate-limit'],
    },
  };

  it('1. GitWorkspaceService inspects a valid Git repo and extracts workspace signals', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const service = new GitWorkspaceService();
    const ws = await service.inspectRepository(fixture.repoPath);

    expect(ws.repositoryPath).toBe(path.resolve(fixture.repoPath));
    expect(ws.currentBranch).toBe(fixture.initialBranch);
    expect(ws.headCommit).toBe(fixture.initialHead);
    expect(ws.isClean).toBe(true);
    expect(ws.detectedFrameworks).toContain('Express');
    expect(ws.detectedFrameworks).toContain('Redis');
    expect(ws.buildScripts['test']).toBe('node test.cjs');
    expect(ws.packageManifests.length).toBe(1);
    expect(ws.trackedFileCount).toBeGreaterThan(0);
  });

  it('2. GitWorkspaceService rejects non-Git directory gracefully with NonGitRepositoryError', async () => {
    const emptyDir = path.join(os.tmpdir(), `non-git-${Date.now()}`);
    fs.mkdirSync(emptyDir, { recursive: true });
    cleanups.push(() => fs.rmSync(emptyDir, { recursive: true, force: true }));

    const service = new GitWorkspaceService();
    await expect(service.inspectRepository(emptyDir)).rejects.toThrow(NonGitRepositoryError);
  });

  it('3. GitWorkspaceService strictly filters sensitive files from tracked files and inspection', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    // Create sensitive dummy files
    fs.writeFileSync(path.join(fixture.repoPath, '.env'), 'SECRET_KEY=12345');
    fs.writeFileSync(path.join(fixture.repoPath, '.env.production'), 'API_TOKEN=xyz');
    fs.writeFileSync(path.join(fixture.repoPath, 'id_rsa'), 'PRIVATE KEY');

    const service = new GitWorkspaceService();
    const ws = await service.inspectRepository(fixture.repoPath);

    // Context builder check
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);

    for (const f of ctx.relevantFiles) {
      expect(f).not.toContain('.env');
      expect(f).not.toContain('id_rsa');
    }
  });

  it('4. RepositoryContextBuilder maps contract concerns to relevant files and produces structured context', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);

    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);

    expect(ctx.repositoryPath).toBe(ws.repositoryPath);
    expect(ctx.probableEntryPoints.length).toBeGreaterThan(0);
    expect(ctx.existingTests.length).toBeGreaterThan(0);
    expect(ctx.implementationObservations.length).toBeGreaterThan(0);
  });

  it('5. CompileImplementationPlanUseCase compiles schema-valid ImplementationPlan with strict traceability', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(sampleContract, ws);

    const provider = new DeterministicDemoProviderAdapter();
    const compiler = new CompileImplementationPlanUseCase(provider);

    const plan = await compiler.execute(sampleContract, ctx);

    expect(ImplementationPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.tasks.length).toBeGreaterThanOrEqual(1);

    // Check traceability on every task
    for (const task of plan.tasks) {
      const hasTrace =
        task.sourceConcernIds.length > 0 ||
        task.sourceDecisionIds.length > 0 ||
        task.sourceInvariantIds.length > 0;
      expect(hasTrace, `Task ${task.id} must have architectural trace`).toBe(true);
      expect(task.requirements.length).toBeGreaterThan(0);
      expect(task.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(task.allowedFiles.length).toBeGreaterThan(0);
      expect(task.excludedFiles).toContain('.env*');
    }
  });

  it('6. Demonstrates generic execution on Target A (API Rate Limiter)', async () => {
    await runExecutionScenario('rate-limiter', sampleContract);
  }, 30000);

  it('7. Demonstrates generic execution on Target B (Payment Idempotency)', async () => {
    const paymentContract: EngineeringContract = {
      ...sampleContract,
      id: 'contract-exec-payment-02',
      requirement: {
        id: 'req-payment',
        rawIntent: 'Charge customer credit card idempotently on retry.',
        explicitConstraints: ['No double charge'],
        declaredTechStack: ['PostgreSQL'],
        context: {},
      },
      discoveredConcerns: [
        {
          id: 'concern-duplicate-payment',
          requirementId: 'req-payment',
          title: 'Duplicate Payment Processing on Retry',
          description: 'Network retries can execute side effects multiple times.',
          applicabilityReason: 'Payment mutation across untrusted network.',
          dimensions: [WellKnownDimensions.SIDE_EFFECTS, WellKnownDimensions.RETRY],
          supportingKnowledgeIds: ['pattern-duplicate-payment-retry'],
          assumptions: [],
          confidence: 0.95,
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'decision-idempotency-key-ledger',
          problemContext: 'Deduplicate redundant charge requests.',
          consideredOptions: [],
          selectedOptionId: 'opt-ledger',
          selectedOptionName: 'Idempotency ledger with checkAndLock',
          rationale: 'Tracks request state atomically.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
      ],
    };

    await runExecutionScenario('payment-idempotency', paymentContract);
  }, 30000);

  it('8. Demonstrates generic execution on Target C (Image Worker Bounded Concurrency)', async () => {
    const imageContract: EngineeringContract = {
      ...sampleContract,
      id: 'contract-exec-image-03',
      requirement: {
        id: 'req-image',
        rawIntent: 'Process uploaded images in parallel with bounded memory.',
        explicitConstraints: ['Do not exceed max worker concurrency'],
        declaredTechStack: ['Sharp'],
        context: {},
      },
      discoveredConcerns: [
        {
          id: 'concern-unbounded-worker-overflow',
          requirementId: 'req-image',
          title: 'Unbounded Worker Saturation',
          description: 'Concurrent image processing spikes saturate memory.',
          applicabilityReason: 'High memory intensity image transforms.',
          dimensions: [WellKnownDimensions.BOUNDED_RESOURCE, WellKnownDimensions.CONCURRENCY],
          supportingKnowledgeIds: ['pattern-unbounded-consumer-overflow'],
          assumptions: [],
          confidence: 0.95,
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'decision-bounded-worker-pool',
          problemContext: 'Queue jobs beyond concurrency limit.',
          consideredOptions: [],
          selectedOptionId: 'opt-pool',
          selectedOptionName: 'Bounded worker pool queue',
          rationale: 'Limits active tasks to maxConcurrency.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
      ],
    };

    await runExecutionScenario('image-worker', imageContract);
  }, 30000);

  it('9. CodexCliAgentAdapter detects local CLI availability and reports clean status', async () => {
    const adapter = new CodexCliAgentAdapter();
    const availability = await adapter.detect();

    expect(typeof availability.available).toBe('boolean');
    if (availability.available) {
      expect(availability.version).toBeDefined();
    } else {
      expect(availability.reason).toBeDefined();
    }
  });

  // Helper running the complete generic execution pipeline across targets
  async function runExecutionScenario(
    type: 'rate-limiter' | 'payment-idempotency' | 'image-worker',
    contract: EngineeringContract
  ) {
    const fixture = createDemoFixtureRepo(type);
    cleanups.push(fixture.cleanup);

    // 1. Inspect repository
    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);

    // 2. Build repository context
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(contract, ws);

    // 3. Compile implementation plan
    const provider = new DeterministicDemoProviderAdapter();
    const compiler = new CompileImplementationPlanUseCase(provider);
    const plan = await compiler.execute(contract, ctx);

    // 4. Execute plan using agent gateway
    const gateway = new CodingAgentGateway([new DeterministicCodingAgentAdapter()]);
    const executor = new ExecuteImplementationPlanUseCase(gateway);
    const output = await executor.execute(plan, 'deterministic-agent');

    // 5. Verify isolated execution
    expect(output.allTasksCompleted).toBe(true);
    expect(output.isolatedBranch).toMatch(/^architectai\/run-/);
    expect(output.originalBranch).toBe(fixture.initialBranch);
    expect(output.originalHead).toBe(fixture.initialHead);

    // PROOF: Original branch was preserved and untouched
    expect(output.originalBranchUntouched).toBe(true);

    // Verify changed files captured
    expect(output.diffReport.changedFiles.length).toBeGreaterThan(0);
    expect(output.diffReport.diff.length).toBeGreaterThan(0);

    // Verify repository-native checks (npm test) ran and passed
    expect(output.executionChecks.length).toBeGreaterThanOrEqual(1);
    const testCheck = output.executionChecks.find((c) => c.scriptName === 'test');
    expect(testCheck).toBeDefined();
    expect(testCheck?.passed).toBe(true);
  }
});
