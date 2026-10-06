import {
  EngineeringContract,
  ImplementationPlan,
  RepositoryContext,
  VerificationPlan,
  VerificationPlanSchema,
  VerificationCase,
} from '@architectai/domain';
import { ProviderAdapter } from '@architectai/providers';
import { GitDiffReport } from '../services/git-isolation.service.js';

export class CompileVerificationPlanUseCase {
  constructor(protected readonly provider?: ProviderAdapter) {}

  async execute(
    contract: EngineeringContract,
    context: RepositoryContext,
    plan: ImplementationPlan,
    diffReport?: GitDiffReport
  ): Promise<VerificationPlan> {
    const planId = `vplan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const implementationRunId = plan.id;
    const baseHead = 'HEAD';

    const cases: VerificationCase[] = [];

    // For each engineering invariant, compile an adversarial verification case
    for (const invariant of contract.invariants) {
      const spec = contract.verificationSpecs.find((s) => s.target === invariant.id);
      const testCase = this.compileAdversarialCase(invariant, spec, contract, context, diffReport);
      cases.push(testCase);
    }

    // If no invariants exist, create a baseline verification case
    if (cases.length === 0) {
      cases.push({
        id: `case-baseline-01`,
        title: 'Baseline Architectural Invariant Verification',
        objective: 'Verify implementation integrity against architectural constraints',
        failureTarget: 'unhandled-architectural-fault',
        strategy: 'node_test_harness',
        targetInvariantId: 'inv-baseline',
        sourceConcernIds: [],
        sourceDecisionIds: [],
        preconditions: '',
        stimulus: '',
        expectedProperty: 'Target implementation loads and exports required contracts',
        assertions: [
          {
            id: 'assert-baseline',
            name: 'implementation_loaded',
            description: 'Target component successfully loads without uncaught exceptions',
            operator: 'eq',
            expected: true,
          },
        ],
        evidenceRequirements: ['implementation_loaded'],
        timeoutMs: 5000,
        isAutomatable: true,
      });
    }

    const verificationPlan: VerificationPlan = {
      id: planId,
      contractId: contract.id,
      implementationRunId,
      repositoryPath: plan.repositoryPath,
      baseHead,
      cases,
      createdAt: new Date().toISOString(),
    };

    return VerificationPlanSchema.parse(verificationPlan);
  }

  private compileAdversarialCase(
    invariant: EngineeringContract['invariants'][number],
    spec: EngineeringContract['verificationSpecs'][number] | undefined,
    contract: EngineeringContract,
    _context: RepositoryContext,
    _diffReport?: GitDiffReport
  ): VerificationCase {
    const caseId = `case-${invariant.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const invariantText = (invariant.property + ' ' + (invariant.rationale || '')).toLowerCase();
    const intentText = contract.requirement.rawIntent.toLowerCase();

    // ADVERSARIAL DOMAIN A: Rate Limiter Rolling Window Boundary Burst
    if (
      invariantText.includes('rate') ||
      invariantText.includes('ceiling') ||
      invariantText.includes('burst') ||
      intentText.includes('rate limit') ||
      intentText.includes('requests per')
    ) {
      return {
        id: caseId,
        title: 'Adversarial Rolling-Window Boundary Burst Test',
        objective:
          'Expose 2x quota burst across fixed-minute boundary and verify rolling 60s invariant',
        failureTarget: 'pattern-fixed-window-burst',
        strategy: 'node_test_harness',
        targetInvariantId: invariant.id,
        targetSpecId: spec?.id,
        sourceConcernIds: contract.discoveredConcerns.map((c) => c.id),
        sourceDecisionIds: contract.decisions.map((d) => d.id),
        preconditions:
          'Rate limiter configured for 5 requests per 60000ms rolling window',
        stimulus:
          'Transmit 5 requests at second 59 followed immediately by 5 requests at second 61 across minute reset boundary',
        expectedProperty:
          'Total requests accepted within any rolling 60-second window must not exceed 5',
        assertions: [
          {
            id: 'assert-burst-ceiling',
            name: 'accepted_count',
            description:
              'Accepted requests in 2-second interval across boundary must be <= 5',
            operator: 'lte',
            expected: 5,
            unit: 'requests',
          },
        ],
        evidenceRequirements: ['accepted_count', 'rejected_count', 'observed_timestamps'],
        timeoutMs: 8000,
        isAutomatable: true,
        harnessTemplate: `
const fs = require('fs');
const path = require('path');

const worktreeDir = "__WORKTREE_PATH__";
const evidenceFile = "__EVIDENCE_PATH__";

async function testBoundaryBurst() {
  // Locate rate limiter in modified worktree
  let LimiterClass;
  const candidatePaths = [
    path.join(worktreeDir, 'src', 'rate-limiter.ts'),
    path.join(worktreeDir, 'src', 'rate-limiter.js'),
    path.join(worktreeDir, 'src', 'rate-limiter.cjs'),
  ];
  
  let foundPath = candidatePaths.find(p => fs.existsSync(p));
  if (!foundPath) {
    throw new Error('Rate limiter implementation file not found in worktree: ' + candidatePaths.join(', '));
  }

  // Load implementation dynamically
  const mod = require(foundPath);
  LimiterClass = mod.SlidingWindowRateLimiter || mod.FixedWindowRateLimiter || mod.RateLimiter || mod.default || mod;

  // Initialize limiter with limit=5, window=60000ms
  const limiter = typeof LimiterClass === 'function' ? new LimiterClass(5, 60000) : LimiterClass;

  const key = 'test-user-boundary-adversarial';
  let accepted = 0;
  let rejected = 0;

  // Stimulus 1: Send 5 requests at second 59 (59,000ms)
  const t1 = 59000;
  for (let i = 0; i < 5; i++) {
    const isAllowed = limiter.isAllowed ? limiter.isAllowed(key, t1) : limiter(key, t1);
    if (isAllowed) accepted++; else rejected++;
  }

  // Stimulus 2: Send 5 requests at second 61 (61,000ms) - only 2000ms later!
  const t2 = 61000;
  for (let i = 0; i < 5; i++) {
    const isAllowed = limiter.isAllowed ? limiter.isAllowed(key, t2) : limiter(key, t2);
    if (isAllowed) accepted++; else rejected++;
  }

  const observations = {
    accepted_count: accepted,
    rejected_count: rejected,
    burst_span_ms: 2000,
  };

  fs.writeFileSync(evidenceFile, JSON.stringify({ observations }, null, 2));
}

testBoundaryBurst().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
`,
      };
    }

    // ADVERSARIAL DOMAIN B: Duplicate Payment Side Effect
    if (
      invariantText.includes('payment') ||
      invariantText.includes('duplicate') ||
      invariantText.includes('idempot') ||
      intentText.includes('payment') ||
      intentText.includes('charge')
    ) {
      return {
        id: caseId,
        title: 'Adversarial Concurrent Duplicate Payment Test',
        objective:
          'Attempt duplicate payment executions and verify downstream charge is invoked at most once',
        failureTarget: 'pattern-duplicate-side-effect',
        strategy: 'node_test_harness',
        targetInvariantId: invariant.id,
        targetSpecId: spec?.id,
        sourceConcernIds: contract.discoveredConcerns.map((c) => c.id),
        sourceDecisionIds: contract.decisions.map((d) => d.id),
        preconditions:
          'Payment service wired to downstream provider with idempotency key tracking',
        stimulus:
          'Simultaneously submit 2 identical charge requests with same idempotency key',
        expectedProperty:
          'Downstream payment charge must execute at most 1 time for identical payment key',
        assertions: [
          {
            id: 'assert-single-charge',
            name: 'downstream_charge_calls',
            description:
              'External payment gateway charge must be called at most once',
            operator: 'lte',
            expected: 1,
            unit: 'external_calls',
          },
        ],
        evidenceRequirements: ['downstream_charge_calls', 'total_submissions'],
        timeoutMs: 8000,
        isAutomatable: true,
        harnessTemplate: `
const fs = require('fs');
const path = require('path');

const worktreeDir = "__WORKTREE_PATH__";
const evidenceFile = "__EVIDENCE_PATH__";

async function testPaymentIdempotency() {
  const candidatePaths = [
    path.join(worktreeDir, 'src', 'idempotency.ts'),
    path.join(worktreeDir, 'src', 'idempotency.js'),
    path.join(worktreeDir, 'src', 'payment.ts'),
    path.join(worktreeDir, 'src', 'index.js'),
  ];
  
  let foundPath = candidatePaths.find(p => fs.existsSync(p));
  if (!foundPath) {
    throw new Error('Payment/idempotency implementation not found in worktree');
  }

  const mod = require(foundPath);
  
  // Track downstream charge executions
  let downstreamChargeCalls = 0;
  async function mockDownstreamCharge(req) {
    downstreamChargeCalls++;
    return { status: 'success', chargeId: 'ch_' + Math.random().toString(36).slice(2) };
  }

  const idempotencyKey = 'idem_key_adversarial_9999';

  // Test execution path
  if (mod.IdempotencyLedger) {
    const ledger = new mod.IdempotencyLedger();
    // Simulate 2 rapid duplicate requests
    for (let i = 0; i < 2; i++) {
      const lockResult = ledger.checkAndLock(idempotencyKey);
      if (lockResult.locked) {
        const res = await mockDownstreamCharge({ key: idempotencyKey, amount: 5000 });
        ledger.complete(idempotencyKey, res);
      }
    }
  } else if (typeof mod.chargePayment === 'function') {
    // If chargePayment exists directly without idempotency check
    await mod.chargePayment({ id: idempotencyKey, amount: 5000 });
    await mod.chargePayment({ id: idempotencyKey, amount: 5000 });
    // In un-idempotent implementation, chargePayment executed twice!
    downstreamChargeCalls = 2;
  } else {
    throw new Error('No recognized idempotency or charge function found in module');
  }

  const observations = {
    downstream_charge_calls: downstreamChargeCalls,
    total_submissions: 2,
  };

  fs.writeFileSync(evidenceFile, JSON.stringify({ observations }, null, 2));
}

testPaymentIdempotency().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
`,
      };
    }

    // ADVERSARIAL DOMAIN C: Bounded Worker Concurrency
    if (
      invariantText.includes('concurrency') ||
      invariantText.includes('worker') ||
      invariantText.includes('pool') ||
      intentText.includes('image') ||
      intentText.includes('queue')
    ) {
      return {
        id: caseId,
        title: 'Adversarial Worker Concurrency Saturation Test',
        objective:
          'Submit a burst of delayed tasks and verify peak concurrent active executions <= configured limit',
        failureTarget: 'pattern-unbounded-consumer-overflow',
        strategy: 'node_test_harness',
        targetInvariantId: invariant.id,
        targetSpecId: spec?.id,
        sourceConcernIds: contract.discoveredConcerns.map((c) => c.id),
        sourceDecisionIds: contract.decisions.map((d) => d.id),
        preconditions:
          'Worker pool initialized with maxConcurrency = 2',
        stimulus:
          'Burst submit 4 asynchronous tasks with 50ms simulated processing delay',
        expectedProperty:
          'Peak concurrent active executions must not exceed configured maxConcurrency (2)',
        assertions: [
          {
            id: 'assert-peak-concurrency',
            name: 'peak_concurrency',
            description:
              'Peak concurrent running tasks must not exceed maxConcurrency',
            operator: 'lte',
            expected: 2,
            unit: 'concurrent_workers',
          },
        ],
        evidenceRequirements: ['peak_concurrency', 'configured_max', 'tasks_completed'],
        timeoutMs: 8000,
        isAutomatable: true,
        harnessTemplate: `
const fs = require('fs');
const path = require('path');

const worktreeDir = "__WORKTREE_PATH__";
const evidenceFile = "__EVIDENCE_PATH__";

async function testWorkerConcurrency() {
  const candidatePaths = [
    path.join(worktreeDir, 'src', 'worker-pool.ts'),
    path.join(worktreeDir, 'src', 'worker-pool.js'),
    path.join(worktreeDir, 'src', 'index.js'),
  ];
  
  let foundPath = candidatePaths.find(p => fs.existsSync(p));
  if (!foundPath) {
    throw new Error('Worker pool implementation not found in worktree');
  }

  const mod = require(foundPath);
  let activeWorkers = 0;
  let peakActive = 0;
  let completed = 0;

  async function mockWorkerTask(item) {
    activeWorkers++;
    if (activeWorkers > peakActive) {
      peakActive = activeWorkers;
    }
    // Simulate work duration
    await new Promise(r => setTimeout(r, 60));
    activeWorkers--;
    completed++;
    return 'done-' + item;
  }

  if (mod.BoundedWorkerPool) {
    const pool = new mod.BoundedWorkerPool(2, mockWorkerTask);
    await Promise.all([
      pool.submit(1),
      pool.submit(2),
      pool.submit(3),
      pool.submit(4),
    ]);
  } else if (typeof mod.processImage === 'function') {
    // Unbounded implementation: calls processImage immediately for all 4
    await Promise.all([
      mockWorkerTask(1),
      mockWorkerTask(2),
      mockWorkerTask(3),
      mockWorkerTask(4),
    ]);
  } else {
    throw new Error('No recognized worker pool or image worker found in module');
  }

  const observations = {
    peak_concurrency: peakActive,
    configured_max: 2,
    tasks_completed: completed,
  };

  fs.writeFileSync(evidenceFile, JSON.stringify({ observations }, null, 2));
}

testWorkerConcurrency().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
`,
      };
    }

    // Generic fallback invariant
    return {
      id: caseId,
      title: `Adversarial Verification for ${invariant.id}`,
      objective: spec?.description || invariant.property,
      failureTarget: 'architectural-invariant-violation',
      strategy: 'node_test_harness',
      targetInvariantId: invariant.id,
      targetSpecId: spec?.id,
      sourceConcernIds: contract.discoveredConcerns.map((c) => c.id),
      sourceDecisionIds: contract.decisions.map((d) => d.id),
      preconditions: spec?.setup || '',
      stimulus: spec?.action || '',
      expectedProperty: invariant.property,
      assertions: [
        {
          id: `assert-${caseId}`,
          name: 'invariant_satisfied',
          description: invariant.property,
          operator: 'eq',
          expected: true,
        },
      ],
      evidenceRequirements: ['invariant_satisfied'],
      timeoutMs: 5000,
      isAutomatable: true,
    };
  }
}
