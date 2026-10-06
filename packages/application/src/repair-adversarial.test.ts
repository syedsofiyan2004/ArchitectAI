import { describe, it, expect, afterEach } from 'vitest';
import {
  EngineeringContract,
  WellKnownDimensions,
  RepairRunResultSchema,
} from '@architectai/domain';
import {
  DeterministicDemoProviderAdapter,
  CodingAgentGateway,
  DeterministicCodingAgentAdapter,
  VulnerableCodingAgentAdapter,
} from '@architectai/providers';
import {
  GitWorkspaceService,
  RepositoryContextBuilder,
  CompileImplementationPlanUseCase,
  ExecuteImplementationPlanUseCase,
  DiagnoseVerificationFailureUseCase,
  CompileRepairPlanUseCase,
  ExecuteRepairLoopUseCase,
} from './index.js';
import { createDemoFixtureRepo, FixtureRepo } from './test-helpers/fixture-repos.js';

describe('Milestone 4: Evidence-Driven Diagnosis, Repair & Re-Verification', { timeout: 45000 }, () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      const c = cleanups.pop();
      if (c) c();
    }
  });

  const rateLimitContract: EngineeringContract = {
    id: 'contract-m4-ratelimit',
    version: '1.0.0',
    requirement: {
      id: 'req-rate-limit',
      rawIntent: 'Limit each authenticated user to 5 requests per 60 seconds.',
      explicitConstraints: ['Strict rolling rate ceiling across boundaries'],
      declaredTechStack: ['Express', 'Redis'],
      context: {},
    },
    discoveredConcerns: [
      {
        id: 'concern-boundary-burst',
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
        id: 'decision-sliding-window',
        problemContext: 'Mitigate boundary bursts',
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
        property: 'Total requests accepted within any rolling 60-second window must not exceed 5',
        severity: 'critical',
        blocksCompletion: true,
      },
    ],
    verificationSpecs: [
      {
        id: 'verif-burst-boundary',
        target: 'inv-rate-ceiling',
        description: 'Send 5 requests at second 59 and 5 at second 61; reject excess.',
        setup: 'Rate limiter configured with limit 5 and window 60s',
        action: 'Emit boundary burst across second 60',
        expectedProperty: 'Accepted requests across boundary <= 5',
        evidenceToCollect: ['accepted_count', 'rejected_count'],
        isAutomatable: true,
      },
    ],
    assumptions: [],
    unresolvedQuestions: [],
    metadata: {
      createdAt: new Date().toISOString(),
      status: 'accepted',
      tags: ['rate-limiter', 'boundary-burst'],
    },
  };

  const paymentContract: EngineeringContract = {
    id: 'contract-m4-payment',
    version: '1.0.0',
    requirement: {
      id: 'req-payment',
      rawIntent: 'Charge customer credit card idempotently on retry.',
      explicitConstraints: ['Zero duplicate downstream credit card charges'],
      declaredTechStack: ['PostgreSQL'],
      context: {},
    },
    discoveredConcerns: [
      {
        id: 'concern-duplicate-charge',
        requirementId: 'req-payment',
        title: 'Duplicate Downstream Mutations',
        description: 'Retries without idempotency locks cause duplicate credit card debits.',
        applicabilityReason: 'Financial mutation processing over unreliable network.',
        dimensions: [WellKnownDimensions.SIDE_EFFECT, WellKnownDimensions.RETRY],
        supportingKnowledgeIds: ['pattern-duplicate-side-effect-retry'],
        assumptions: [],
        confidence: 0.95,
        unresolvedQuestions: [],
      },
    ],
    decisions: [
      {
        id: 'decision-idempotency-ledger',
        problemContext: 'Deduplicate charge operations',
        consideredOptions: [],
        selectedOptionId: 'opt-ledger',
        selectedOptionName: 'Atomic idempotency ledger',
        rationale: 'Locks idempotency key before initiating downstream charge.',
        evidence: [],
        assumptions: [],
        risksAndTradeoffs: [],
        verificationRequirements: [],
        reconsiderationTriggers: [],
      },
    ],
    invariants: [
      {
        id: 'inv-payment-idempotency',
        property: 'At most one downstream payment charge executed for identical idempotency key',
        severity: 'critical',
        blocksCompletion: true,
      },
    ],
    verificationSpecs: [
      {
        id: 'verif-payment-retry',
        target: 'inv-payment-idempotency',
        description: 'Submit duplicate charge requests with identical idempotency key',
        setup: 'Payment service initialized with ledger',
        action: 'Send 2 duplicate charge requests',
        expectedProperty: 'downstream_charge_calls <= 1',
        evidenceToCollect: ['downstream_charge_calls'],
        isAutomatable: true,
      },
    ],
    assumptions: [],
    unresolvedQuestions: [],
    metadata: {
      createdAt: new Date().toISOString(),
      status: 'accepted',
      tags: ['payment', 'idempotency'],
    },
  };

  const workerContract: EngineeringContract = {
    id: 'contract-m4-worker',
    version: '1.0.0',
    requirement: {
      id: 'req-worker',
      rawIntent: 'Process uploaded images in parallel with bounded worker concurrency.',
      explicitConstraints: ['Do not exceed max worker concurrency of 2'],
      declaredTechStack: ['Sharp'],
      context: {},
    },
    discoveredConcerns: [
      {
        id: 'concern-unbounded-worker-overflow',
        requirementId: 'req-worker',
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
    invariants: [
      {
        id: 'inv-worker-bounded-concurrency',
        property: 'Peak concurrent active executions must not exceed configured maxConcurrency (2)',
        severity: 'critical',
        blocksCompletion: true,
      },
    ],
    verificationSpecs: [
      {
        id: 'verif-concurrency-burst',
        target: 'inv-worker-bounded-concurrency',
        description: 'Submit 4 delayed tasks to worker pool with maxConcurrency 2',
        setup: 'BoundedWorkerPool initialized with concurrency 2',
        action: 'Submit 4 asynchronous image resize tasks simultaneously',
        expectedProperty: 'peak_active_workers <= 2',
        evidenceToCollect: ['peak_active_workers'],
        isAutomatable: true,
      },
    ],
    assumptions: [],
    unresolvedQuestions: [],
    metadata: {
      createdAt: new Date().toISOString(),
      status: 'accepted',
      tags: ['worker', 'concurrency'],
    },
  };

  const tokenContract: EngineeringContract = {
    id: 'contract-m4-token',
    version: '1.0.0',
    requirement: {
      id: 'req-token',
      rawIntent: 'When access token expires, refresh it and retry failed requests concurrently.',
      explicitConstraints: ['At most 1 token exchange call during concurrent 401 expiration storm'],
      declaredTechStack: ['Axios'],
      context: {},
    },
    discoveredConcerns: [
      {
        id: 'concern-token-refresh-race',
        requirementId: 'req-token',
        title: 'Token Refresh Race Condition',
        description: 'Concurrent requests each independently trigger token refresh.',
        applicabilityReason: 'Coalesced authentication renewal under token expiry.',
        dimensions: [WellKnownDimensions.CONCURRENCY, WellKnownDimensions.SIDE_EFFECT],
        supportingKnowledgeIds: ['pattern-token-refresh-race'],
        assumptions: [],
        confidence: 0.95,
        unresolvedQuestions: [],
      },
    ],
    decisions: [
      {
        id: 'decision-single-flight-mutex',
        problemContext: 'Coalesce concurrent token refreshes',
        consideredOptions: [],
        selectedOptionId: 'opt-singleflight',
        selectedOptionName: 'Single-flight promise coalescing',
        rationale: 'Shares single in-flight refresh promise across all concurrent callers.',
        evidence: [],
        assumptions: [],
        risksAndTradeoffs: [],
        verificationRequirements: [],
        reconsiderationTriggers: [],
      },
    ],
    invariants: [
      {
        id: 'inv-single-flight-token-refresh',
        property: 'At most one token refresh exchange executed during concurrent token expiry spike',
        severity: 'critical',
        blocksCompletion: true,
      },
    ],
    verificationSpecs: [
      {
        id: 'verif-token-race',
        target: 'inv-single-flight-token-refresh',
        description: 'Execute 5 concurrent refreshToken calls simultaneously',
        setup: 'TokenManager initialized with mock upstream OAuth endpoint',
        action: 'Promise.all with 5 refreshToken calls',
        expectedProperty: 'upstream_exchange_calls <= 1',
        evidenceToCollect: ['upstream_exchange_calls'],
        isAutomatable: true,
      },
    ],
    assumptions: [],
    unresolvedQuestions: [],
    metadata: {
      createdAt: new Date().toISOString(),
      status: 'accepted',
      tags: ['token-refresh', 'concurrency'],
    },
  };

  it('Control A: Rate Limiter repair loop (Fixed-Window FAIL -> Sliding-Window VERIFIED)', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(rateLimitContract, ws);

    const taskCompiler = new CompileImplementationPlanUseCase(new DeterministicDemoProviderAdapter());
    const plan = await taskCompiler.execute(rateLimitContract, ctx);

    // Initial Execution: Vulnerable Coding Agent
    const vulnerableAgent = new VulnerableCodingAgentAdapter();
    const deterministicAgent = new DeterministicCodingAgentAdapter();
    const gateway = new CodingAgentGateway([vulnerableAgent, deterministicAgent]);
    const planExecutor = new ExecuteImplementationPlanUseCase(gateway);

    const initialOutput = await planExecutor.execute(
      plan,
      'vulnerable-agent',
      rateLimitContract,
      ctx,
      { preserveWorktreeOnFailure: true }
    );

    // Initial State: Native tests PASS, Verification FAILS
    expect(initialOutput.executionChecks.find((c) => c.scriptName === 'test')?.passed).toBe(true);
    expect(initialOutput.verificationRun?.overallStatus).toBe('FAILED');
    expect(initialOutput.worktreeSession).toBeDefined();

    // Milestone 4 Repair Loop
    const repairLoopUseCase = new ExecuteRepairLoopUseCase(gateway);
    const repairResult = await repairLoopUseCase.execute({
      contract: rateLimitContract,
      implementationPlan: plan,
      verificationPlan: initialOutput.verificationPlan!,
      initialVerificationRun: initialOutput.verificationRun!,
      context: ctx,
      worktreeSession: initialOutput.worktreeSession!,
      agentId: 'deterministic-agent',
      cleanupWorktreeOnFinish: true,
    });

    // Validate RepairRunResult schema
    expect(RepairRunResultSchema.safeParse(repairResult).success).toBe(true);

    // Final Outcome: REPAIRED & VERIFIED
    expect(repairResult.outcome).toBe('REPAIRED');
    expect(repairResult.isRepaired).toBe(true);
    expect(repairResult.totalAttempts).toBe(1);
    expect(repairResult.attempts[0]?.progress).toBe('VERIFIED');
    expect(repairResult.attempts[0]?.policyPassed).toBe(true);
    expect(repairResult.finalVerificationResult?.overallStatus).toBe('VERIFIED');

    // Original branch remains completely untouched
    const untouched = await wsService.inspectRepository(fixture.repoPath);
    expect(untouched.headCommit).toBe(fixture.initialHead);
  });

  it('Control B: Duplicate Payment repair loop (Unprotected FAIL -> Deduplicated VERIFIED)', async () => {
    const fixture = createDemoFixtureRepo('payment-idempotency');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(paymentContract, ws);

    const taskCompiler = new CompileImplementationPlanUseCase(new DeterministicDemoProviderAdapter());
    const plan = await taskCompiler.execute(paymentContract, ctx);

    const vulnerableAgent = new VulnerableCodingAgentAdapter();
    const deterministicAgent = new DeterministicCodingAgentAdapter();
    const gateway = new CodingAgentGateway([vulnerableAgent, deterministicAgent]);
    const planExecutor = new ExecuteImplementationPlanUseCase(gateway);

    const initialOutput = await planExecutor.execute(
      plan,
      'vulnerable-agent',
      paymentContract,
      ctx,
      { preserveWorktreeOnFailure: true }
    );

    expect(initialOutput.verificationRun?.overallStatus).toBe('FAILED');

    // Execute Repair
    const repairLoopUseCase = new ExecuteRepairLoopUseCase(gateway);
    const repairResult = await repairLoopUseCase.execute({
      contract: paymentContract,
      implementationPlan: plan,
      verificationPlan: initialOutput.verificationPlan!,
      initialVerificationRun: initialOutput.verificationRun!,
      context: ctx,
      worktreeSession: initialOutput.worktreeSession!,
      agentId: 'deterministic-agent',
      cleanupWorktreeOnFinish: true,
    });

    expect(repairResult.outcome).toBe('REPAIRED');
    expect(repairResult.isRepaired).toBe(true);
    expect(repairResult.finalVerificationResult?.overallStatus).toBe('VERIFIED');
  });

  it('Control C: Bounded Worker repair loop (Unbounded FAIL -> Concurrency Bounded VERIFIED)', async () => {
    const fixture = createDemoFixtureRepo('image-worker');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(workerContract, ws);

    const taskCompiler = new CompileImplementationPlanUseCase(new DeterministicDemoProviderAdapter());
    const plan = await taskCompiler.execute(workerContract, ctx);

    const vulnerableAgent = new VulnerableCodingAgentAdapter();
    const deterministicAgent = new DeterministicCodingAgentAdapter();
    const gateway = new CodingAgentGateway([vulnerableAgent, deterministicAgent]);
    const planExecutor = new ExecuteImplementationPlanUseCase(gateway);

    const initialOutput = await planExecutor.execute(
      plan,
      'vulnerable-agent',
      workerContract,
      ctx,
      { preserveWorktreeOnFailure: true }
    );

    expect(initialOutput.verificationRun?.overallStatus).toBe('FAILED');

    // Execute Repair
    const repairLoopUseCase = new ExecuteRepairLoopUseCase(gateway);
    const repairResult = await repairLoopUseCase.execute({
      contract: workerContract,
      implementationPlan: plan,
      verificationPlan: initialOutput.verificationPlan!,
      initialVerificationRun: initialOutput.verificationRun!,
      context: ctx,
      worktreeSession: initialOutput.worktreeSession!,
      agentId: 'deterministic-agent',
      cleanupWorktreeOnFinish: true,
    });

    expect(repairResult.outcome).toBe('REPAIRED');
    expect(repairResult.isRepaired).toBe(true);
    expect(repairResult.finalVerificationResult?.overallStatus).toBe('VERIFIED');
  });

  it('Control D: Token Refresh Single-Flight repair loop (Racing FAIL -> Single Flight VERIFIED)', async () => {
    const fixture = createDemoFixtureRepo('token-refresh');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(tokenContract, ws);

    const taskCompiler = new CompileImplementationPlanUseCase(new DeterministicDemoProviderAdapter());
    const plan = await taskCompiler.execute(tokenContract, ctx);

    const vulnerableAgent = new VulnerableCodingAgentAdapter();
    const deterministicAgent = new DeterministicCodingAgentAdapter();
    const gateway = new CodingAgentGateway([vulnerableAgent, deterministicAgent]);
    const planExecutor = new ExecuteImplementationPlanUseCase(gateway);

    const initialOutput = await planExecutor.execute(
      plan,
      'vulnerable-agent',
      tokenContract,
      ctx,
      { preserveWorktreeOnFailure: true }
    );

    expect(initialOutput.verificationRun?.overallStatus).toBe('FAILED');

    // Execute Repair
    const repairLoopUseCase = new ExecuteRepairLoopUseCase(gateway);
    const repairResult = await repairLoopUseCase.execute({
      contract: tokenContract,
      implementationPlan: plan,
      verificationPlan: initialOutput.verificationPlan!,
      initialVerificationRun: initialOutput.verificationRun!,
      context: ctx,
      worktreeSession: initialOutput.worktreeSession!,
      agentId: 'deterministic-agent',
      cleanupWorktreeOnFinish: true,
    });

    expect(repairResult.outcome).toBe('REPAIRED');
    expect(repairResult.isRepaired).toBe(true);
    expect(repairResult.finalVerificationResult?.overallStatus).toBe('VERIFIED');
  });

  it('Failure Demonstration: Reaches MAX_ATTEMPTS_REACHED / NEEDS_HUMAN_REVIEW when repair cannot succeed', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(rateLimitContract, ws);

    const taskCompiler = new CompileImplementationPlanUseCase(new DeterministicDemoProviderAdapter());
    const plan = await taskCompiler.execute(rateLimitContract, ctx);

    const repeatFailAgent = new VulnerableCodingAgentAdapter();
    repeatFailAgent.setBehavior('repeat_fail');
    const gateway = new CodingAgentGateway([repeatFailAgent]);
    const planExecutor = new ExecuteImplementationPlanUseCase(gateway);

    const initialOutput = await planExecutor.execute(
      plan,
      'vulnerable-agent',
      rateLimitContract,
      ctx,
      { preserveWorktreeOnFailure: true }
    );

    expect(initialOutput.verificationRun?.overallStatus).toBe('FAILED');

    // Execute Repair with repeat_fail agent (cannot fix the defect)
    const repairLoopUseCase = new ExecuteRepairLoopUseCase(gateway);
    const repairResult = await repairLoopUseCase.execute({
      contract: rateLimitContract,
      implementationPlan: plan,
      verificationPlan: initialOutput.verificationPlan!,
      initialVerificationRun: initialOutput.verificationRun!,
      context: ctx,
      worktreeSession: initialOutput.worktreeSession!,
      agentId: 'vulnerable-agent',
      maxAttempts: 3,
      cleanupWorktreeOnFinish: true,
    });

    expect(repairResult.outcome).toBe('MAX_ATTEMPTS_REACHED');
    expect(repairResult.isRepaired).toBe(false);
    expect(repairResult.totalAttempts).toBe(3);
    expect(repairResult.escalationReason).toContain('Maximum repair attempts reached');
  });

  it('Architecture-Review Demonstration: Invariant conflicts with architecture decision -> ARCHITECTURE_REVIEW_REQUIRED without executing repair', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(rateLimitContract, ws);

    const dummyPlan = {
      id: 'plan-test',
      contractId: rateLimitContract.id,
      repositoryPath: fixture.repoPath,
      summary: 'Rate limiter plan',
      tasks: [],
      createdAt: new Date().toISOString(),
    };

    const dummyVPlan = {
      id: 'vplan-1',
      contractId: rateLimitContract.id,
      repositoryPath: fixture.repoPath,
      cases: [],
      summary: 'VPlan',
      createdAt: new Date().toISOString(),
    };

    const failedRun = {
      runId: 'vrun-1',
      planId: 'vplan-1',
      contractId: rateLimitContract.id,
      executedAt: new Date().toISOString(),
      durationMs: 100,
      overallStatus: 'FAILED' as const,
      isVerified: false,
      totalCases: 1,
      passedCases: 0,
      failedCases: 1,
      inconclusiveCases: 0,
      errorCases: 0,
      skippedCases: 0,
      caseResults: [
        {
          caseId: 'case-arch-conflict',
          targetInvariantId: 'inv-rate-ceiling',
          strategy: 'node_test_harness' as const,
          verdict: 'FAIL' as const,
          isBlocking: true,
          passed: false,
          summary: 'Hardware boundary conflict',
          durationMs: 100,
          assertions: [{ name: 'clock_sync', expected: 0, observed: 100, passed: false }],
          evidence: [
            {
              id: 'ev-1',
              caseId: 'case-arch-conflict',
              kind: 'numeric_metric' as const,
              name: 'drift',
              expected: 0,
              observed: 100,
              capturedAt: new Date().toISOString(),
            },
          ],
        },
      ],
      nativeCheckResults: [],
      summary: '1 case failed',
    };

    // Mock diagnosis that flags ARCHITECTURE_DECISION_INVALID
    const archDiagnosis = {
      id: 'diag-arch-1',
      verificationCaseId: 'case-arch-conflict',
      targetInvariantId: 'inv-rate-ceiling',
      classification: 'ARCHITECTURE_DECISION_INVALID' as const,
      expectedBehavior: 'Expected sub-nanosecond hardware clock synchronization',
      observedBehavior: 'Observed 100ms distributed network jitter',
      evidenceReferences: ['ev-1'],
      likelyFailureMechanism: 'Invariant contradicts accepted physical hardware architecture decisions',
      likelyAffectedFiles: [],
      likelyAffectedSymbols: [],
      confidence: 0.98,
      assumptions: [],
      unresolvedQuestions: [],
      isRepairable: false,
      requiresArchitectureReview: true,
      reconsiderationRationale: 'Reconsider distributed consensus model',
      createdAt: new Date().toISOString(),
    };

    const mockAgent = {
      id: 'test-agent',
      name: 'Agent',
      detect: async () => ({ available: true }),
      executeTask: async () => {
        throw new Error('Agent execution MUST NOT occur during architecture review!');
      },
      cancel: async () => {},
    };

    const gateway = new CodingAgentGateway([mockAgent as any]);
    const repairLoopUseCase = new ExecuteRepairLoopUseCase(gateway);

    const repairResult = await repairLoopUseCase.execute({
      contract: rateLimitContract,
      implementationPlan: dummyPlan,
      verificationPlan: dummyVPlan,
      initialVerificationRun: failedRun,
      context: ctx,
      diagnoses: [archDiagnosis],
      cleanupWorktreeOnFinish: true,
    });

    expect(repairResult.outcome).toBe('ARCHITECTURE_REVIEW_REQUIRED');
    expect(repairResult.isRepaired).toBe(false);
    expect(repairResult.totalAttempts).toBe(0); // Zero agent attempts executed!
    expect(repairResult.architectureReviewContext).toBeDefined();
    expect(repairResult.architectureReviewContext?.rationale).toContain('physical hardware architecture');
  });

  it('Inconclusive / Error behavior: Does NOT launch code repair when verification is INCONCLUSIVE or ERROR', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(rateLimitContract, ws);

    const dummyPlan = {
      id: 'plan-test',
      contractId: rateLimitContract.id,
      repositoryPath: fixture.repoPath,
      summary: 'Rate limiter plan',
      tasks: [],
      createdAt: new Date().toISOString(),
    };

    const dummyVPlan = {
      id: 'vplan-1',
      contractId: rateLimitContract.id,
      repositoryPath: fixture.repoPath,
      cases: [],
      summary: 'VPlan',
      createdAt: new Date().toISOString(),
    };

    // Test INCONCLUSIVE run
    const inconclusiveRun = {
      runId: 'vrun-inc',
      planId: 'vplan-1',
      contractId: rateLimitContract.id,
      executedAt: new Date().toISOString(),
      durationMs: 100,
      overallStatus: 'INCONCLUSIVE' as const,
      isVerified: false,
      totalCases: 1,
      passedCases: 0,
      failedCases: 0,
      inconclusiveCases: 1,
      errorCases: 0,
      skippedCases: 0,
      caseResults: [],
      nativeCheckResults: [],
      summary: 'Inconclusive verdict',
    };

    const gateway = new CodingAgentGateway([new DeterministicCodingAgentAdapter()]);
    const repairLoopUseCase = new ExecuteRepairLoopUseCase(gateway);

    const incResult = await repairLoopUseCase.execute({
      contract: rateLimitContract,
      implementationPlan: dummyPlan,
      verificationPlan: dummyVPlan,
      initialVerificationRun: inconclusiveRun,
      context: ctx,
      cleanupWorktreeOnFinish: true,
    });

    expect(incResult.outcome).toBe('VERIFICATION_BLOCKED');
    expect(incResult.isRepaired).toBe(false);
    expect(incResult.totalAttempts).toBe(0);
    expect(incResult.escalationReason).toContain('Inconclusive verification verdict');

    // Test ERROR run
    const errorRun = {
      runId: 'vrun-err',
      planId: 'vplan-1',
      contractId: rateLimitContract.id,
      executedAt: new Date().toISOString(),
      durationMs: 100,
      overallStatus: 'ERROR' as const,
      isVerified: false,
      totalCases: 1,
      passedCases: 0,
      failedCases: 0,
      inconclusiveCases: 0,
      errorCases: 1,
      skippedCases: 0,
      caseResults: [],
      nativeCheckResults: [],
      summary: 'Verification runner crashed',
    };

    const errResult = await repairLoopUseCase.execute({
      contract: rateLimitContract,
      implementationPlan: dummyPlan,
      verificationPlan: dummyVPlan,
      initialVerificationRun: errorRun,
      context: ctx,
      cleanupWorktreeOnFinish: true,
    });

    expect(errResult.outcome).toBe('VERIFICATION_BLOCKED');
    expect(errResult.isRepaired).toBe(false);
    expect(errResult.totalAttempts).toBe(0);
    expect(errResult.escalationReason).toContain('Verification infrastructure error');
  });
});
