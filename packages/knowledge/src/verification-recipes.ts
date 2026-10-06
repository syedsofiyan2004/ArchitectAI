import {
  VerificationRecipe,
  VerificationRecipeSchema,
  WellKnownDimensions,
} from '@architectai/domain';

export interface VerificationRecipeRepository {
  getAll(): Promise<VerificationRecipe[]>;
  getById(id: string): Promise<VerificationRecipe | undefined>;
  findForFailurePattern(patternId: string): Promise<VerificationRecipe[]>;
  findForDimensions(dimensions: string[]): Promise<VerificationRecipe[]>;
  findApplicable(options: { patternIds?: string[]; dimensions?: string[] }): Promise<VerificationRecipe[]>;
}

export const neutralVerificationRecipes: VerificationRecipe[] = [
  // Recipe 1: Rolling-Window Boundary Burst
  {
    id: 'recipe-rolling-window-boundary-burst',
    name: 'Rolling-Window Boundary Burst Adversarial Stimulus',
    description:
      'Submits requests immediately before and after a window boundary to verify rolling interval ceiling.',
    applicableFailurePatterns: ['pattern-fixed-window-burst'],
    applicableDimensions: [
      WellKnownDimensions.BOUNDED_RESOURCE,
      WellKnownDimensions.TIME_WINDOW,
      WellKnownDimensions.CONCURRENCY,
    ],
    strategy: 'node_test_harness',
    requiredCapabilities: ['node_execution', 'timing_control', 'metric_collection'],
    observationDefinitions: ['accepted_count', 'rejected_count', 'burst_span_ms'],
    assertionTemplates: [
      {
        id: 'assert-burst-ceiling',
        name: 'accepted_count',
        description: 'Accepted requests across window boundary must be <= configured limit',
        operator: 'lte',
        expected: 5,
        unit: 'requests',
      },
    ],
    setupGuidance: 'Locate rate limiter component in worktree and initialize with target limit and window duration.',
    stimulusGuidance: 'Emit 5 requests at second 59 followed immediately by 5 requests at second 61 across minute reset boundary.',
    harnessTemplate: `
const fs = require('fs');
const path = require('path');

const worktreeDir = "__WORKTREE_PATH__";
const evidenceFile = "__EVIDENCE_PATH__";

async function testBoundaryBurst() {
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

  const mod = require(foundPath);
  LimiterClass = mod.SlidingWindowRateLimiter || mod.FixedWindowRateLimiter || mod.RateLimiter || mod.default || mod;

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

  // Stimulus 2: Send 5 requests at second 61 (61,000ms) - only 2000ms later
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
    provenance: 'ArchitectAI Neutral Knowledge Base (Boundary Burst Mitigation)',
  },

  // Recipe 2: Concurrent Duplicate Mutation / Payment Side-Effect
  {
    id: 'recipe-idempotent-mutation-retry',
    name: 'Concurrent / Retry Idempotency Side-Effect Count',
    description:
      'Transmits duplicate mutations with identical idempotency key and counts external downstream invocations.',
    applicableFailurePatterns: [
      'pattern-duplicate-side-effect',
      'pattern-duplicate-payment-retry',
      'pattern-duplicate-queue-message-delivery',
      'pattern-duplicate-side-effect-retry',
    ],
    applicableDimensions: [
      WellKnownDimensions.SIDE_EFFECT,
      WellKnownDimensions.RETRY,
      WellKnownDimensions.CONCURRENCY,
    ],
    strategy: 'node_test_harness',
    requiredCapabilities: ['node_execution', 'local_stubs', 'metric_collection'],
    observationDefinitions: ['downstream_charge_calls', 'total_submissions'],
    assertionTemplates: [
      {
        id: 'assert-single-charge',
        name: 'downstream_charge_calls',
        description: 'External payment gateway or mutation must be executed at most once for identical key',
        operator: 'lte',
        expected: 1,
        unit: 'external_calls',
      },
    ],
    setupGuidance: 'Locate payment or mutation service in worktree with mock downstream sink.',
    stimulusGuidance: 'Simultaneously submit 2 identical requests with same idempotency key.',
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
  
  let downstreamChargeCalls = 0;
  async function mockDownstreamCharge(req) {
    downstreamChargeCalls++;
    return { status: 'success', chargeId: 'ch_' + Math.random().toString(36).slice(2) };
  }

  const idempotencyKey = 'idem_key_adversarial_9999';

  if (mod.IdempotencyLedger) {
    const ledger = new mod.IdempotencyLedger();
    for (let i = 0; i < 2; i++) {
      const lockResult = ledger.checkAndLock(idempotencyKey);
      if (lockResult.locked) {
        const res = await mockDownstreamCharge({ key: idempotencyKey, amount: 5000 });
        ledger.complete(idempotencyKey, res);
      }
    }
  } else if (typeof mod.chargePayment === 'function') {
    await mod.chargePayment({ id: idempotencyKey, amount: 5000 });
    await mod.chargePayment({ id: idempotencyKey, amount: 5000 });
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
    provenance: 'ArchitectAI Neutral Knowledge Base (Idempotency Side-Effect Guard)',
  },

  // Recipe 3: Bounded Worker Concurrency
  {
    id: 'recipe-bounded-worker-concurrency',
    name: 'Burst Task Saturation & Peak Concurrency Tracking',
    description:
      'Burst submits concurrent tasks with simulated processing delay and measures peak active concurrency.',
    applicableFailurePatterns: [
      'pattern-unbounded-consumer-overflow',
      'pattern-oom-memory-exhaustion',
    ],
    applicableDimensions: [
      WellKnownDimensions.BOUNDED_RESOURCE,
      WellKnownDimensions.CONCURRENCY,
    ],
    strategy: 'node_test_harness',
    requiredCapabilities: ['node_execution', 'concurrency_stimulus', 'metric_collection'],
    observationDefinitions: ['peak_concurrency', 'configured_max', 'tasks_completed'],
    assertionTemplates: [
      {
        id: 'assert-peak-concurrency',
        name: 'peak_concurrency',
        description: 'Peak concurrent active executions must not exceed configured maxConcurrency',
        operator: 'lte',
        expected: 2,
        unit: 'concurrent_workers',
      },
    ],
    setupGuidance: 'Initialize worker pool with maxConcurrency = 2.',
    stimulusGuidance: 'Burst submit 4 asynchronous tasks with simulated delay.',
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
    provenance: 'ArchitectAI Neutral Knowledge Base (Concurrency Throttling)',
  },

  // Recipe 4: Concurrent Refresh-Token Single-Flight Invariant (UNSEEN EXECUTABLE CASE)
  {
    id: 'recipe-single-flight-mutex',
    name: 'Concurrent Single-Flight Mutex / In-Flight Coalescing',
    description:
      'Simultaneously triggers multiple parallel callers for an expensive or single-use token refresh exchange and counts upstream invocations.',
    applicableFailurePatterns: [
      'pattern-token-refresh-race',
    ],
    applicableDimensions: [
      WellKnownDimensions.CONCURRENCY,
      WellKnownDimensions.SHARED_MUTABLE_STATE,
      WellKnownDimensions.RETRY,
    ],
    strategy: 'node_test_harness',
    requiredCapabilities: ['node_execution', 'concurrency_stimulus', 'local_stubs', 'metric_collection'],
    observationDefinitions: ['upstream_refresh_calls', 'concurrent_callers', 'successful_tokens'],
    assertionTemplates: [
      {
        id: 'assert-single-flight-refresh',
        name: 'upstream_refresh_calls',
        description: 'Upstream refresh exchange must be executed at most 1 time for concurrent callers',
        operator: 'lte',
        expected: 1,
        unit: 'upstream_exchanges',
      },
    ],
    setupGuidance: 'Locate token manager or auth client in worktree with mock upstream exchange hook.',
    stimulusGuidance: 'Simultaneously invoke refreshToken() from 5 concurrent callers.',
    harnessTemplate: `
const fs = require('fs');
const path = require('path');

const worktreeDir = "__WORKTREE_PATH__";
const evidenceFile = "__EVIDENCE_PATH__";

async function testSingleFlightTokenRefresh() {
  const candidatePaths = [
    path.join(worktreeDir, 'src', 'token-manager.ts'),
    path.join(worktreeDir, 'src', 'token-manager.js'),
    path.join(worktreeDir, 'src', 'auth.ts'),
    path.join(worktreeDir, 'src', 'index.js'),
  ];
  
  let foundPath = candidatePaths.find(p => fs.existsSync(p));
  if (!foundPath) {
    throw new Error('Token manager implementation not found in worktree: ' + candidatePaths.join(', '));
  }

  const mod = require(foundPath);
  
  let upstreamRefreshCalls = 0;
  async function mockUpstreamExchange() {
    upstreamRefreshCalls++;
    await new Promise(r => setTimeout(r, 50)); // Network delay
    return { token: 'jwt_new_' + Math.random().toString(36).slice(2), expiresAt: Date.now() + 3600000 };
  }

  let manager;
  if (mod.TokenManager) {
    manager = new mod.TokenManager(mockUpstreamExchange);
  } else if (mod.SingleFlightTokenManager) {
    manager = new mod.SingleFlightTokenManager(mockUpstreamExchange);
  } else if (typeof mod.refreshToken === 'function') {
    manager = { refreshToken: () => mod.refreshToken(mockUpstreamExchange) };
  } else {
    throw new Error('No recognized TokenManager or refreshToken function found in module');
  }

  // Stimulus: 5 callers discover expired token simultaneously and race to refresh
  const results = await Promise.all([
    manager.refreshToken(),
    manager.refreshToken(),
    manager.refreshToken(),
    manager.refreshToken(),
    manager.refreshToken(),
  ]);

  const observations = {
    upstream_refresh_calls: upstreamRefreshCalls,
    concurrent_callers: 5,
    successful_tokens: results.length,
  };

  fs.writeFileSync(evidenceFile, JSON.stringify({ observations }, null, 2));
}

testSingleFlightTokenRefresh().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
`,
    provenance: 'ArchitectAI Neutral Knowledge Base (Single-Flight Token Exchange)',
  },

  // Recipe 5: Concurrent Lost Updates / Atomic Mutation
  {
    id: 'recipe-atomic-mutation-check',
    name: 'Concurrent Atomic Mutation / Lost Update Verification',
    description:
      'Performs concurrent mutations on shared state and verifies final state equals initial plus exact applied deltas.',
    applicableFailurePatterns: [
      'pattern-lost-update-concurrency',
      'pattern-duplicate-side-effect',
    ],
    applicableDimensions: [
      WellKnownDimensions.CONCURRENCY,
      WellKnownDimensions.SHARED_MUTABLE_STATE,
    ],
    strategy: 'node_test_harness',
    requiredCapabilities: ['node_execution', 'concurrency_stimulus', 'metric_collection'],
    observationDefinitions: ['lost_updates', 'final_inventory', 'expected_inventory'],
    assertionTemplates: [
      {
        id: 'assert-zero-lost-updates',
        name: 'lost_updates',
        description: 'Lost update count must be zero across concurrent mutations',
        operator: 'eq',
        expected: 0,
      },
    ],
    setupGuidance: 'Initialize store with known inventory counter.',
    stimulusGuidance: 'Dispatch 20 concurrent decrements simultaneously.',
    provenance: 'ArchitectAI Neutral Knowledge Base (Atomic State Mutation)',
  },

  // Recipe 6: Downstream Network Timeout Enforcement
  {
    id: 'recipe-timeout-enforcement',
    name: 'Downstream Timeout & Latency Bound Enforcement',
    description:
      'Stubs downstream supplier with unbounded latency and verifies client aborts within configured timeout limit.',
    applicableFailurePatterns: [
      'pattern-missing-network-timeout-hang',
    ],
    applicableDimensions: [
      WellKnownDimensions.DEPENDENCY,
      WellKnownDimensions.TIME_WINDOW,
      WellKnownDimensions.BOUNDED_RESOURCE,
    ],
    strategy: 'node_test_harness',
    requiredCapabilities: ['node_execution', 'timing_control', 'metric_collection'],
    observationDefinitions: ['elapsed_duration_ms', 'hung_requests', 'timeout_triggered'],
    assertionTemplates: [
      {
        id: 'assert-hung-requests-zero',
        name: 'hung_requests',
        description: 'No requests may hang beyond configured timeout limit',
        operator: 'eq',
        expected: 0,
      },
    ],
    setupGuidance: 'Configure client with 2000ms timeout.',
    stimulusGuidance: 'Call downstream endpoint that never responds.',
    provenance: 'ArchitectAI Neutral Knowledge Base (Network Bound Guard)',
  },

  // Recipe 7: Cache Stampede Dogpiling Origin Guard
  {
    id: 'recipe-cache-stampede-origin-guard',
    name: 'Cache Expiration Dogpiling / Origin Call Coalescing',
    description:
      'Simulates concurrent cache miss burst and measures number of queries reaching origin database.',
    applicableFailurePatterns: [
      'pattern-cache-stampede-dogpiling',
    ],
    applicableDimensions: [
      WellKnownDimensions.SCALING_CONCENTRATION,
      WellKnownDimensions.TIME_WINDOW,
      WellKnownDimensions.DEPENDENCY,
    ],
    strategy: 'node_test_harness',
    requiredCapabilities: ['node_execution', 'concurrency_stimulus', 'local_stubs', 'metric_collection'],
    observationDefinitions: ['database_queries', 'concurrent_requesters'],
    assertionTemplates: [
      {
        id: 'assert-origin-queries-coalesced',
        name: 'database_queries',
        description: 'Origin database queries must be at most 1 under concurrent cache miss burst',
        operator: 'lte',
        expected: 1,
      },
    ],
    setupGuidance: 'Configure cache with expired entry.',
    stimulusGuidance: 'Simultaneously query cache from 10 parallel callers.',
    provenance: 'ArchitectAI Neutral Knowledge Base (Cache Stampede Mitigation)',
  },
];

export class InMemoryVerificationRecipeRepository implements VerificationRecipeRepository {
  private readonly recipes: Map<string, VerificationRecipe> = new Map();

  constructor(initialRecipes: VerificationRecipe[] = neutralVerificationRecipes) {
    for (const r of initialRecipes) {
      this.recipes.set(r.id, VerificationRecipeSchema.parse(r));
    }
  }

  async getAll(): Promise<VerificationRecipe[]> {
    return Array.from(this.recipes.values());
  }

  async getById(id: string): Promise<VerificationRecipe | undefined> {
    return this.recipes.get(id);
  }

  async findForFailurePattern(patternId: string): Promise<VerificationRecipe[]> {
    return Array.from(this.recipes.values()).filter((r) =>
      r.applicableFailurePatterns.includes(patternId)
    );
  }

  async findForDimensions(dimensions: string[]): Promise<VerificationRecipe[]> {
    const dimSet = new Set(dimensions);
    return Array.from(this.recipes.values()).filter((r) =>
      r.applicableDimensions.some((d) => dimSet.has(d))
    );
  }

  async findApplicable(options: {
    patternIds?: string[];
    dimensions?: string[];
  }): Promise<VerificationRecipe[]> {
    const results = new Map<string, VerificationRecipe>();

    // 1. Prioritize specific failure pattern matches (L2 knowledge)
    if (options.patternIds && options.patternIds.length > 0) {
      for (const pid of options.patternIds) {
        const matches = await this.findForFailurePattern(pid);
        for (const m of matches) results.set(m.id, m);
      }
    }

    // 2. If no failure patterns matched, fall back to engineering dimensions
    if (results.size === 0 && options.dimensions && options.dimensions.length > 0) {
      const dimMatches = await this.findForDimensions(options.dimensions);
      for (const m of dimMatches) results.set(m.id, m);
    }

    return Array.from(results.values());
  }
}
