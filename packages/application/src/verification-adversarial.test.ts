import { describe, it, expect, afterEach } from 'vitest';
import {
  EngineeringContract,
  WellKnownDimensions,
  VerificationPlanSchema,
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
  CompileVerificationPlanUseCase,
  VerifyImplementationUseCase,
  ExecuteImplementationPlanUseCase,
} from './index.js';
import { createDemoFixtureRepo, FixtureRepo } from './test-helpers/fixture-repos.js';

describe('Milestone 3: Independent Adversarial Verification Engine', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      const c = cleanups.pop();
      if (c) c();
    }
  });

  const rateLimitContract: EngineeringContract = {
    id: 'contract-m3-ratelimit',
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
    id: 'contract-m3-payment',
    version: '1.0.0',
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
        id: 'decision-idempotency-ledger',
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
    invariants: [
      {
        id: 'inv-payment-idempotency',
        property: 'Downstream payment charge must execute at most 1 time for identical payment key',
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
    id: 'contract-m3-worker',
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
        setup: 'Worker pool initialized with maxConcurrency 2',
        action: 'Burst submit 4 tasks',
        expectedProperty: 'peak_concurrency <= 2',
        evidenceToCollect: ['peak_concurrency'],
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

  it('1. Compiles schema-valid VerificationPlan with strict traceability to invariants', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(rateLimitContract, ws);

    const compiler = new CompileVerificationPlanUseCase();
    const dummyPlan = {
      id: 'plan-test',
      contractId: rateLimitContract.id,
      repositoryPath: fixture.repoPath,
      summary: 'Rate limiter plan',
      tasks: [],
      createdAt: new Date().toISOString(),
    };

    const vPlan = await compiler.execute(rateLimitContract, ctx, dummyPlan);
    expect(VerificationPlanSchema.safeParse(vPlan).success).toBe(true);
    expect(vPlan.cases).toHaveLength(1);
    expect(vPlan.cases[0].targetInvariantId).toBe('inv-rate-ceiling');
    expect(vPlan.cases[0].failureTarget).toBe('pattern-fixed-window-burst');
  });

  it('2. MOST IMPORTANT DEMO: Vulnerable Rate Limiter PASSES native tests but FAILS ArchitectAI verification', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(rateLimitContract, ws);

    const taskCompiler = new CompileImplementationPlanUseCase(new DeterministicDemoProviderAdapter());
    const plan = await taskCompiler.execute(rateLimitContract, ctx);

    // Execute with Vulnerable Coding Agent
    const gateway = new CodingAgentGateway([new VulnerableCodingAgentAdapter()]);
    const executor = new ExecuteImplementationPlanUseCase(gateway);

    const output = await executor.execute(plan, 'vulnerable-agent', rateLimitContract, ctx);

    // 1. Coding Agent claimed completion
    expect(output.allTasksCompleted).toBe(true);

    // 2. Repository-Native checks PASSED! (npm test exit 0)
    const nativeTest = output.executionChecks.find((c) => c.scriptName === 'test');
    expect(nativeTest).toBeDefined();
    expect(nativeTest?.passed).toBe(true);

    // 3. ArchitectAI Independent Verification FAILED!
    expect(output.verificationRun).toBeDefined();
    expect(output.verificationRun?.overallStatus).toBe('FAILED');
    expect(output.isVerified).toBe(false);

    // 4. Verify concrete measured evidence
    const boundaryCase = output.verificationRun?.caseResults.find(
      (c) => c.targetInvariantId === 'inv-rate-ceiling'
    );
    expect(boundaryCase).toBeDefined();
    expect(boundaryCase?.verdict).toBe('FAIL');
    expect(boundaryCase?.assertions[0].passed).toBe(false);
    expect(boundaryCase?.assertions[0].expected).toBe(5);
    expect(boundaryCase?.assertions[0].observed).toBe(10); // Accepted 10 across boundary!

    // 5. Verify original branch was untouched
    expect(output.originalBranchUntouched).toBe(true);
  }, 30000);

  it('3. Correct Sliding-Window Rate Limiter PASSES ArchitectAI independent verification', async () => {
    const fixture = createDemoFixtureRepo('rate-limiter');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(rateLimitContract, ws);

    const taskCompiler = new CompileImplementationPlanUseCase(new DeterministicDemoProviderAdapter());
    const plan = await taskCompiler.execute(rateLimitContract, ctx);

    // Execute with Correct Deterministic Coding Agent
    const gateway = new CodingAgentGateway([new DeterministicCodingAgentAdapter()]);
    const executor = new ExecuteImplementationPlanUseCase(gateway);

    const output = await executor.execute(plan, 'deterministic-agent', rateLimitContract, ctx);

    // 1. Coding Agent completed
    expect(output.allTasksCompleted).toBe(true);

    // 2. Repository-Native checks passed
    const nativeTest = output.executionChecks.find((c) => c.scriptName === 'test');
    expect(nativeTest?.passed).toBe(true);

    // 3. ArchitectAI Verification VERIFIED!
    expect(output.verificationRun?.overallStatus).toBe('VERIFIED');
    expect(output.isVerified).toBe(true);

    // 4. Verify measured evidence
    const boundaryCase = output.verificationRun?.caseResults[0];
    expect(boundaryCase?.verdict).toBe('PASS');
    expect(boundaryCase?.assertions[0].expected).toBe(5);
    expect(boundaryCase?.assertions[0].observed).toBe(5); // Excess rejected at boundary!
  }, 30000);

  it('4. Control B: Vulnerable Payment FAILS duplicate-charge invariant; Correct Payment PASSES', async () => {
    const fixture = createDemoFixtureRepo('payment-idempotency');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(paymentContract, ws);

    const taskCompiler = new CompileImplementationPlanUseCase(new DeterministicDemoProviderAdapter());
    const plan = await taskCompiler.execute(paymentContract, ctx);

    // Part A: Vulnerable Agent execution
    const vulnGateway = new CodingAgentGateway([new VulnerableCodingAgentAdapter()]);
    const vulnExecutor = new ExecuteImplementationPlanUseCase(vulnGateway);
    const vulnOutput = await vulnExecutor.execute(plan, 'vulnerable-agent', paymentContract, ctx);

    // Native tests pass, but ArchitectAI verification fails
    expect(vulnOutput.executionChecks.find((c) => c.scriptName === 'test')?.passed).toBe(true);
    expect(vulnOutput.verificationRun?.overallStatus).toBe('FAILED');
    expect(vulnOutput.verificationRun?.caseResults[0].assertions[0].expected).toBe(1);
    expect(vulnOutput.verificationRun?.caseResults[0].assertions[0].observed).toBe(2); // 2 downstream charges!

    // Part B: Correct Agent execution
    const correctGateway = new CodingAgentGateway([new DeterministicCodingAgentAdapter()]);
    const correctExecutor = new ExecuteImplementationPlanUseCase(correctGateway);
    const correctOutput = await correctExecutor.execute(plan, 'deterministic-agent', paymentContract, ctx);

    expect(correctOutput.executionChecks.find((c) => c.scriptName === 'test')?.passed).toBe(true);
    expect(correctOutput.verificationRun?.overallStatus).toBe('VERIFIED');
    expect(correctOutput.verificationRun?.caseResults[0].assertions[0].observed).toBe(1); // 1 charge only!
  }, 30000);

  it('5. Control C: Unbounded Worker FAILS concurrency invariant; Bounded Worker PASSES', async () => {
    const fixture = createDemoFixtureRepo('image-worker');
    cleanups.push(fixture.cleanup);

    const wsService = new GitWorkspaceService();
    const ws = await wsService.inspectRepository(fixture.repoPath);
    const builder = new RepositoryContextBuilder();
    const ctx = await builder.buildContext(workerContract, ws);

    const taskCompiler = new CompileImplementationPlanUseCase(new DeterministicDemoProviderAdapter());
    const plan = await taskCompiler.execute(workerContract, ctx);

    // Part A: Vulnerable Agent execution
    const vulnGateway = new CodingAgentGateway([new VulnerableCodingAgentAdapter()]);
    const vulnExecutor = new ExecuteImplementationPlanUseCase(vulnGateway);
    const vulnOutput = await vulnExecutor.execute(plan, 'vulnerable-agent', workerContract, ctx);

    expect(vulnOutput.executionChecks.find((c) => c.scriptName === 'test')?.passed).toBe(true);
    expect(vulnOutput.verificationRun?.overallStatus).toBe('FAILED');
    expect(vulnOutput.verificationRun?.caseResults[0].assertions[0].expected).toBe(2);
    expect(vulnOutput.verificationRun?.caseResults[0].assertions[0].observed).toBe(4); // 4 concurrent workers!

    // Part B: Correct Agent execution
    const correctGateway = new CodingAgentGateway([new DeterministicCodingAgentAdapter()]);
    const correctExecutor = new ExecuteImplementationPlanUseCase(correctGateway);
    const correctOutput = await correctExecutor.execute(plan, 'deterministic-agent', workerContract, ctx);

    expect(correctOutput.executionChecks.find((c) => c.scriptName === 'test')?.passed).toBe(true);
    expect(correctOutput.verificationRun?.overallStatus).toBe('VERIFIED');
    expect(correctOutput.verificationRun?.caseResults[0].assertions[0].observed).toBe(2); // bounded at 2!
  }, 30000);

  it('6. Negative Control: Unsupported verification environment yields INCONCLUSIVE (never PASS)', async () => {
    const unsupportedPlan = {
      id: 'vplan-unsupported',
      contractId: 'contract-custom',
      implementationRunId: 'run-custom',
      repositoryPath: '/mock/repo',
      baseHead: 'HEAD',
      cases: [
        {
          id: 'case-unsupported-01',
          title: 'Specialized Hardware FPGA Verification',
          objective: 'Inspect PCIe bus register timing',
          failureTarget: 'fpga-timing-skew',
          strategy: 'process_monitor' as const, // Unsupported in default Node registry
          targetInvariantId: 'inv-hardware',
          sourceConcernIds: [],
          sourceDecisionIds: [],
          preconditions: '',
          stimulus: '',
          expectedProperty: 'Register reads <= 10ns',
          assertions: [
            {
              id: 'a1',
              name: 'timing',
              description: 'Timing check',
              operator: 'lte' as const,
              expected: 10,
            },
          ],
          evidenceRequirements: [],
          timeoutMs: 5000,
          isAutomatable: true,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const verifier = new VerifyImplementationUseCase();
    const result = await verifier.execute(unsupportedPlan, {
      repositoryPath: '/mock/repo',
      worktreePath: '/mock/wt',
      baseHead: 'HEAD',
      branch: 'branch',
    });

    expect(result.overallStatus).toBe('INCONCLUSIVE');
    expect(result.isVerified).toBe(false);
    expect(result.caseResults[0].verdict).toBe('INCONCLUSIVE');
  });

  it('7. Negative Control: Infrastructure error / broken harness produces ERROR (never PASS)', async () => {
    const brokenPlan = {
      id: 'vplan-broken',
      contractId: 'contract-broken',
      implementationRunId: 'run-broken',
      repositoryPath: '/mock/repo',
      baseHead: 'HEAD',
      cases: [
        {
          id: 'case-broken-01',
          title: 'Broken Syntax Harness',
          objective: 'Expose syntax failure in harness',
          failureTarget: 'test-error',
          strategy: 'node_test_harness' as const,
          targetInvariantId: 'inv-broken',
          sourceConcernIds: [],
          sourceDecisionIds: [],
          preconditions: '',
          stimulus: '',
          expectedProperty: 'Property holds',
          assertions: [
            {
              id: 'a1',
              name: 'metric',
              description: 'Metric check',
              operator: 'eq' as const,
              expected: true,
            },
          ],
          evidenceRequirements: [],
          timeoutMs: 5000,
          isAutomatable: true,
          harnessTemplate: `
            // Syntax error in harness
            const invalid syntax = ;;;
          `,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const verifier = new VerifyImplementationUseCase();
    const result = await verifier.execute(brokenPlan, {
      repositoryPath: '/mock/repo',
      worktreePath: '/mock/wt',
      baseHead: 'HEAD',
      branch: 'branch',
    });

    expect(result.overallStatus).toBe('ERROR');
    expect(result.isVerified).toBe(false);
    expect(result.caseResults[0].verdict).toBe('ERROR');
  });
});
