import { EvaluationCase, WellKnownDimensions } from '@architectai/domain';

/**
 * Architectural Principle:
 * Negative eval assertions require sufficient context to establish that a concern is genuinely inapplicable.
 */

// 1. Memory / Resource Ingestion (Scenario 1)
export const sampleNeutralEvalCase: EvaluationCase = {
  id: 'eval-bounded-ingestion-001',
  name: 'Sensor Stream Ingestion Bounded Resources',
  description:
    'Evaluates that high-volume sensor ingestion triggers bounded resource and concurrency discovery.',
  requirementIntent: {
    id: 'req-sensor-01',
    rawIntent: 'Ingest high frequency sensor telemetry streams over network sockets.',
    explicitConstraints: ['Do not crash during sudden traffic bursts'],
    declaredTechStack: ['Node.js'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.CONCURRENCY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['streaming', 'bounded_resource', 'eval'],
};

// 2. Rate Limiting Boundary (Scenario 2)
export const rateLimitBoundaryEvalCase: EvaluationCase = {
  id: 'eval-rate-limit-boundary-002',
  name: 'API Rate Limiting Boundary Behavior',
  description:
    'Evaluates that request rate limits trigger time window and bounded resource analysis.',
  requirementIntent: {
    id: 'req-rate-limit-01',
    rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
    explicitConstraints: ['Preserve fair capacity across all users'],
    declaredTechStack: ['Redis'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.BOUNDED_RESOURCE,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['rate_limit', 'timing', 'eval'],
};

// 3. Concurrent Token Refresh (Scenario 3)
export const tokenRefreshRaceEvalCase: EvaluationCase = {
  id: 'eval-token-refresh-race-003',
  name: 'Concurrent Access-Token Refresh Race',
  description:
    'Evaluates that automated token refresh under parallel API calls triggers concurrency and shared mutable state concerns.',
  requirementIntent: {
    id: 'req-token-01',
    rawIntent:
      'When my access token expires automatically refresh it and retry the failed request.',
    explicitConstraints: ['Handle multiple simultaneous 401 Unauthorized responses gracefully'],
    declaredTechStack: ['TypeScript'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.SHARED_MUTABLE_STATE,
    WellKnownDimensions.RETRY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['auth', 'concurrency', 'eval'],
};

// 4. Database Connection Pool Starvation (Scenario 4)
export const dbConnectionPoolEvalCase: EvaluationCase = {
  id: 'eval-db-pool-starvation-004',
  name: 'Database Connection Pool Exhaustion Under Load',
  description:
    'Evaluates that mass database queries trigger bounded resource and connection pool starvation discovery.',
  requirementIntent: {
    id: 'req-db-pool-01',
    rawIntent:
      'Query user order history across 5,000 concurrent web requests without failing.',
    explicitConstraints: ['Maintain fast response times under high concurrency'],
    declaredTechStack: ['PostgreSQL'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.DEPENDENCY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['database', 'concurrency', 'eval'],
};

// 5. Duplicate Payment Mutation (Scenario 5)
export const duplicatePaymentEvalCase: EvaluationCase = {
  id: 'eval-duplicate-payment-005',
  name: 'Non-Idempotent Payment Charge Mutation',
  description:
    'Evaluates that automated payment retries over uncertain networks trigger side-effect and idempotency concerns.',
  requirementIntent: {
    id: 'req-payment-01',
    rawIntent:
      'Charge the customer credit card and retry if the connection times out.',
    explicitConstraints: ['Customer must never be double charged'],
    declaredTechStack: ['PostgreSQL'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.SIDE_EFFECT,
    WellKnownDimensions.RETRY,
    WellKnownDimensions.DEPENDENCY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['payment', 'idempotency', 'eval'],
};

// 6. Retry Storm / Amplification (Scenario 6)
export const retryAmplificationEvalCase: EvaluationCase = {
  id: 'eval-retry-amplification-006',
  name: 'Downstream Service Retry Amplification',
  description:
    'Evaluates that aggressive retries against degraded dependencies trigger retry storm and thundering herd concerns.',
  requirementIntent: {
    id: 'req-retry-01',
    rawIntent:
      'Call downstream pricing API and aggressively retry up to 10 times on failure.',
    explicitConstraints: ['Do not crash downstream pricing service'],
    declaredTechStack: ['AWS'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.RETRY,
    WellKnownDimensions.DEPENDENCY,
    WellKnownDimensions.TIME_WINDOW,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['retry', 'cascading_failure', 'eval'],
};

// 7. Cache Stampede / Dogpiling (Scenario 7)
export const cacheStampedeEvalCase: EvaluationCase = {
  id: 'eval-cache-stampede-007',
  name: 'Discrete TTL Cache Stampede / Dogpile',
  description:
    'Evaluates that caching hot keys with fixed TTLs triggers concentration and dogpiling discovery.',
  requirementIntent: {
    id: 'req-cache-01',
    rawIntent:
      'Cache trending product catalog in Redis with 5 minute TTL for 100,000 concurrent readers.',
    explicitConstraints: ['Protect primary database from sudden load spikes'],
    declaredTechStack: ['Redis', 'PostgreSQL'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.SCALING_CONCENTRATION,
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.DEPENDENCY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['cache', 'thundering_herd', 'eval'],
};

// 8. Kafka Message Deduplication (Scenario 8)
export const duplicateQueueEvalCase: EvaluationCase = {
  id: 'eval-queue-dedup-008',
  name: 'At-Least-Once Queue Message Duplicate Delivery',
  description:
    'Evaluates that consumer message processing triggers ordering and duplicate side effect analysis.',
  requirementIntent: {
    id: 'req-queue-01',
    rawIntent:
      'Consume user registration events from Kafka queue and send welcome emails.',
    explicitConstraints: ['Ensure every registered user receives email notification'],
    declaredTechStack: ['Kafka'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.ORDERING,
    WellKnownDimensions.SIDE_EFFECT,
    WellKnownDimensions.CONCURRENCY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['queue', 'ordering', 'eval'],
};

// 9. Third-Party Timeout Resiliency (Scenario 9)
export const missingTimeoutEvalCase: EvaluationCase = {
  id: 'eval-timeout-resilience-009',
  name: 'Third-Party Dependency Timeout Resiliency',
  description:
    'Evaluates that synchronous external partner calls trigger timeout, latency, and socket resource concerns.',
  requirementIntent: {
    id: 'req-timeout-01',
    rawIntent:
      'Fetch external partner catalog on every user search request without freezing.',
    explicitConstraints: ['Maintain search page responsiveness even if partner API hangs'],
    declaredTechStack: ['TypeScript'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.DEPENDENCY,
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.BOUNDED_RESOURCE,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['resilience', 'timeout', 'eval'],
};

// 10. Concurrent Lost Update Race (Scenario 10)
export const lostUpdateRaceEvalCase: EvaluationCase = {
  id: 'eval-lost-update-010',
  name: 'Read-Modify-Write Concurrent Lost Update',
  description:
    'Evaluates that non-atomic balance or inventory decrements trigger shared mutable state race concerns.',
  requirementIntent: {
    id: 'req-lost-update-01',
    rawIntent:
      'Read current inventory quantity, decrement by 1, and save updated count back.',
    explicitConstraints: ['Accurate inventory count during simultaneous flash sale checkouts'],
    declaredTechStack: ['PostgreSQL'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.SHARED_MUTABLE_STATE,
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.PERSISTENCE,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['concurrency', 'transactions', 'eval'],
};

// Negative Assertion Case (Genuinely isolated computation)
export const strictlyIsolatedComputationEvalCase: EvaluationCase = {
  id: 'eval-isolated-compute-011',
  name: 'Strictly Isolated In-Memory Numeric Calculation',
  description:
    'Evaluates in-memory matrix computation where context unambiguously rules out network and persistence.',
  requirementIntent: {
    id: 'req-isolated-math-01',
    rawIntent:
      'Perform deterministic mathematical matrix multiplication on pre-allocated local buffers in memory.',
    explicitConstraints: [
      'Strictly offline and air-gapped calculation',
      'Zero external network listeners or socket bindings',
      'No disk persistence or file system I/O',
      'Single-threaded synchronous computation',
    ],
    declaredTechStack: ['TypeScript'],
    context: {
      network: 'none',
      persistence: 'none',
      concurrency: 'synchronous_single_thread',
      trust_domain: 'local_verified_sandbox',
    },
  },
  expectedDimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
  forbiddenDimensions: [
    WellKnownDimensions.ATTACKER_CONTROLLED_INPUT,
    WellKnownDimensions.PERSISTENCE,
    WellKnownDimensions.DEPENDENCY,
  ],
  requiredKnowledgeLevels: ['fundamental'],
  tags: ['compute', 'isolated', 'negative_eval'],
};

// False-Positive Eval Case: Offline single-image resize
export const offlineSingleImageResizeEvalCase: EvaluationCase = {
  id: 'eval-false-positive-offline-resize-012',
  name: 'Offline Single Image CLI Resize (False-Positive Prevention)',
  description:
    'Evaluates that an offline single-file CLI resize process does NOT over-retrieve or hallucinate network, authentication, payment, or database concerns.',
  requirementIntent: {
    id: 'req-offline-resize-01',
    rawIntent:
      'Resize a single local image once in an offline command-line process.',
    explicitConstraints: [
      'Single offline invocation',
      'No external network, database, or token services',
    ],
    declaredTechStack: ['Node.js'],
    context: {
      environment: 'offline_cli',
      network: 'none',
      database: 'none',
    },
  },
  expectedDimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
  forbiddenDimensions: [
    WellKnownDimensions.SHARED_MUTABLE_STATE,
    WellKnownDimensions.RETRY,
    WellKnownDimensions.ORDERING,
    WellKnownDimensions.DEPENDENCY,
    WellKnownDimensions.ATTACKER_CONTROLLED_INPUT,
  ],
  requiredKnowledgeLevels: ['fundamental'],
  tags: ['false_positive_prevention', 'offline_cli', 'eval'],
};

// Novel Scenario A: Multi-device document editing
export const novelCollaborativeDocEvalCase: EvaluationCase = {
  id: 'eval-novel-doc-collab-013',
  name: 'Novel A: Multi-Device Document Collaboration',
  description:
    'Infers shared mutable state and concurrency without requiring explicit engineering buzzwords.',
  requirementIntent: {
    id: 'req-novel-doc-01',
    rawIntent:
      'People may update the same document from their phones and laptops at nearly the same time.',
    explicitConstraints: [],
    declaredTechStack: ['TypeScript'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.SHARED_MUTABLE_STATE,
    WellKnownDimensions.CONCURRENCY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['novel', 'collaboration', 'concurrency'],
};

// Novel Scenario B: Stuck purchase button retry
export const novelStuckPurchaseButtonEvalCase: EvaluationCase = {
  id: 'eval-novel-purchase-retry-014',
  name: 'Novel B: Re-clicking Stuck Purchase Button',
  description:
    'Infers duplicate side effects and idempotency risks without requiring the word "retry".',
  requirementIntent: {
    id: 'req-novel-purchase-01',
    rawIntent:
      'A customer can click the purchase button again if the first request appears stuck.',
    explicitConstraints: [],
    declaredTechStack: ['Web Application'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.SIDE_EFFECT,
    WellKnownDimensions.RETRY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['novel', 'idempotency', 'side_effects'],
};

// Novel Scenario C: In-memory cache copy
export const novelInstanceCacheCopyEvalCase: EvaluationCase = {
  id: 'eval-novel-cache-copy-015',
  name: 'Novel C: Synchronized In-Memory Cache Expiry',
  description:
    'Recognizes cache, time window, and concentration concerns without the word "stampede".',
  requirementIntent: {
    id: 'req-novel-cache-01',
    rawIntent:
      'Every instance keeps a copy of popular data for five minutes before fetching it again.',
    explicitConstraints: [],
    declaredTechStack: ['Distributed System'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.SCALING_CONCENTRATION,
    WellKnownDimensions.TIME_WINDOW,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['novel', 'cache_expiration', 'concentration'],
};

// Novel Scenario D: Workers dying halfway
export const novelWorkerFailureMidwayEvalCase: EvaluationCase = {
  id: 'eval-novel-worker-crash-016',
  name: 'Novel D: Workers Failing Mid-Task',
  description:
    'Considers duplicate processing and recovery without requiring Kafka/SQS buzzwords.',
  requirementIntent: {
    id: 'req-novel-worker-01',
    rawIntent:
      'Workers receive jobs and occasionally die halfway through processing them.',
    explicitConstraints: [],
    declaredTechStack: ['Worker Queue'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.RETRY,
    WellKnownDimensions.SIDE_EFFECT,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['novel', 'worker_recovery', 'idempotency'],
};

// Novel Scenario E: Waiting for external supplier
export const novelExternalSupplierWaitEvalCase: EvaluationCase = {
  id: 'eval-novel-supplier-wait-017',
  name: 'Novel E: External Supplier Search Dependency',
  description:
    'Identifies dependency, timeout, and resource risks without requiring the word "timeout".',
  requirementIntent: {
    id: 'req-novel-supplier-01',
    rawIntent:
      'The app waits for an external supplier before showing search results.',
    explicitConstraints: [],
    declaredTechStack: ['HTTP Service'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.DEPENDENCY,
    WellKnownDimensions.TIME_WINDOW,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['novel', 'dependency_wait', 'timeout'],
};

export const allNovelEvalCases: EvaluationCase[] = [
  novelCollaborativeDocEvalCase,
  novelStuckPurchaseButtonEvalCase,
  novelInstanceCacheCopyEvalCase,
  novelWorkerFailureMidwayEvalCase,
  novelExternalSupplierWaitEvalCase,
];

export const allPrototypeEvalCases: EvaluationCase[] = [
  sampleNeutralEvalCase,
  rateLimitBoundaryEvalCase,
  tokenRefreshRaceEvalCase,
  dbConnectionPoolEvalCase,
  duplicatePaymentEvalCase,
  retryAmplificationEvalCase,
  cacheStampedeEvalCase,
  duplicateQueueEvalCase,
  missingTimeoutEvalCase,
  lostUpdateRaceEvalCase,
  strictlyIsolatedComputationEvalCase,
  offlineSingleImageResizeEvalCase,
  ...allNovelEvalCases,
];
