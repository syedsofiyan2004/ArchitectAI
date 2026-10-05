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
    explicitConstraints: [],
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

// 4. Database Connection Pool Exhaustion (Scenario 4)
export const dbConnectionPoolEvalCase: EvaluationCase = {
  id: 'eval-db-connection-pool-004',
  name: 'Database Connection Pool Exhaustion',
  description:
    'Evaluates that high-volume database queries trigger bounded resource and dependency concerns.',
  requirementIntent: {
    id: 'req-db-01',
    rawIntent:
      'Query the user profile and order history database across 5,000 concurrent web requests.',
    explicitConstraints: ['Do not crash during database latency spikes'],
    declaredTechStack: ['PostgreSQL'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.DEPENDENCY,
    WellKnownDimensions.CONCURRENCY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['database', 'connection_pool', 'eval'],
};

// 5. Duplicate Payment / Side Effect (Scenario 5)
export const duplicatePaymentEvalCase: EvaluationCase = {
  id: 'eval-duplicate-payment-005',
  name: 'Duplicate Payment and Side Effect Idempotency',
  description:
    'Evaluates that financial charging endpoints trigger side-effect and retry concerns.',
  requirementIntent: {
    id: 'req-payment-01',
    rawIntent:
      'Charge the customer credit card $50 and automatically retry if the gateway connection drops.',
    explicitConstraints: ['Never charge customer twice'],
    declaredTechStack: ['PostgreSQL'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.SIDE_EFFECT,
    WellKnownDimensions.RETRY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['payment', 'idempotency', 'eval'],
};

// 6. Retry Amplification / Storm (Scenario 6)
export const retryAmplificationEvalCase: EvaluationCase = {
  id: 'eval-retry-amplification-006',
  name: 'Retry Amplification Storm',
  description:
    'Evaluates that aggressive retrying against external microservices triggers failure propagation and concentration concerns.',
  requirementIntent: {
    id: 'req-retry-01',
    rawIntent:
      'Call downstream pricing service and immediately retry up to 10 times if it returns any 500 error.',
    explicitConstraints: [],
    declaredTechStack: [],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.RETRY,
    WellKnownDimensions.DEPENDENCY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['retry_storm', 'resilience', 'eval'],
};

// 7. Cache Stampede (Scenario 7)
export const cacheStampedeEvalCase: EvaluationCase = {
  id: 'eval-cache-stampede-007',
  name: 'Cache Stampede on Expiration',
  description:
    'Evaluates that caching hot query results triggers time window, shared state, and concurrency concerns.',
  requirementIntent: {
    id: 'req-cache-01',
    rawIntent:
      'Cache trending products in Redis with a 5 minute TTL for 100,000 concurrent shoppers.',
    explicitConstraints: ['Protect SQL database from load spikes'],
    declaredTechStack: ['Redis', 'PostgreSQL'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.SHARED_MUTABLE_STATE,
    WellKnownDimensions.CONCURRENCY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['cache', 'stampede', 'eval'],
};

// 8. Duplicate Message Processing (Scenario 8)
export const duplicateQueueEvalCase: EvaluationCase = {
  id: 'eval-duplicate-queue-008',
  name: 'Duplicate Queue Message Processing',
  description:
    'Evaluates that background queue consumers trigger ordering, side effect, and concurrency concerns.',
  requirementIntent: {
    id: 'req-queue-01',
    rawIntent:
      'Consume user registration events from Kafka queue and send welcome email and provision accounts.',
    explicitConstraints: ['Workers can restart or rebalance at any time'],
    declaredTechStack: ['Kafka', 'PostgreSQL'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.ORDERING,
    WellKnownDimensions.SIDE_EFFECT,
    WellKnownDimensions.CONCURRENCY,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['queue', 'kafka', 'eval'],
};

// 9. Missing Network Timeout (Scenario 9)
export const missingTimeoutEvalCase: EvaluationCase = {
  id: 'eval-missing-timeout-009',
  name: 'Missing Network Timeout and Socket Hang',
  description:
    'Evaluates that outbound external network requests trigger time window, dependency, and resource concerns.',
  requirementIntent: {
    id: 'req-timeout-01',
    rawIntent:
      'Fetch partner product catalog over HTTP on every user search query.',
    explicitConstraints: ['Do not freeze application if partner server becomes unresponsive'],
    declaredTechStack: ['Node.js'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.DEPENDENCY,
    WellKnownDimensions.BOUNDED_RESOURCE,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['timeout', 'networking', 'eval'],
};

// 10. Concurrent Lost Update Race (Scenario 10)
export const lostUpdateRaceEvalCase: EvaluationCase = {
  id: 'eval-lost-update-010',
  name: 'Concurrent Lost-Update Race Anomaly',
  description:
    'Evaluates that reading, modifying, and saving shared balances or inventory triggers concurrency and shared state concerns.',
  requirementIntent: {
    id: 'req-lost-update-01',
    rawIntent:
      'Read current item stock quantity, decrement by 1, and save updated count back to database.',
    explicitConstraints: ['Must handle simultaneous checkout from multiple customers'],
    declaredTechStack: ['PostgreSQL'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.SHARED_MUTABLE_STATE,
  ],
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['lost_update', 'database', 'eval'],
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
];
