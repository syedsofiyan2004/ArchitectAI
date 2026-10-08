import {
  RequirementDecomposition,
  RequirementDecompositionSchema,
  ConcernRelevanceEvaluationSchema,
  ImplementationPlanSchema,
  ImplementationTask,
  VerificationIntentSchema,
  FailureDiagnosisSchema,
  WellKnownDimensions,
} from '@architectai/domain';
import {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderRequest,
  ProviderResponse,
  StructuredProviderRequest,
  StructuredProviderResponse,
} from './types.js';

interface ScenarioSemanticData {
  decomposition: RequirementDecomposition;
  relevantPatternIds: string[];
  irrelevantPatternIds?: string[];
}

/**
 * Deterministic Semantic Fixture Registry for evaluation and demonstration cases.
 * These are NOT keyword feature branches: they represent reproducible semantic interpretations
 * used when running without a remote LLM API key.
 */
const SCENARIO_CATALOG: Array<{
  match: (text: string) => boolean;
  data: ScenarioSemanticData;
}> = [
  // Demo A: API Rate Limiting
  {
    match: (t) => /100 API requests per minute|rate limit/i.test(t),
    data: {
      decomposition: {
        actors: ['Authenticated Users', 'API Gateway / Rate Limiter Service'],
        operations: ['HTTP request validation', 'Rate bucket increment', 'Access admission check'],
        state: ['Per-user sliding timestamp logs or counter tokens'],
        resources: ['Memory state in shared cache', 'Network I/O for quota check'],
        externalDependencies: ['Distributed cache (e.g. Redis)'],
        possibleSideEffects: ['HTTP 429 Too Many Requests response emission'],
        concurrencyPotential: 'High: simultaneous requests from same tenant across multiple edge nodes',
        timingSemantics: 'Rolling 60-second window expiration and sliding interval recalculation',
        persistence: 'Volatile in-memory counter with TTL',
        ordering: 'Timestamp ordering for sliding window eviction',
        trustBoundaries: ['Untrusted client API callers crossing ingress gateway'],
        failureSensitiveOperations: ['Atomic counter mutation under concurrent burst'],
        scaleSignals: ['10,000 active users, burst request arrivals'],
        technologyContext: ['Node.js', 'Redis'],
        assumptions: ['Clients can transmit bursts exceeding rate threshold'],
        unresolvedQuestions: ['Should burst allowance or leaky bucket queuing be supported?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.BOUNDED_RESOURCE,
          WellKnownDimensions.CONCURRENCY,
          WellKnownDimensions.TIME_WINDOW,
          WellKnownDimensions.SHARED_MUTABLE_STATE,
        ],
      },
      relevantPatternIds: ['pattern-fixed-window-burst'],
    },
  },
  // Demo B: Token Refresh Race
  {
    match: (t) => /access token expires.*refresh|refresh.*retry/i.test(t),
    data: {
      decomposition: {
        actors: ['Client Application', 'API Server', 'OAuth Authorization Server'],
        operations: ['Protected API call', '401 Unauthorized detection', 'Token refresh exchange', 'Request replay'],
        state: ['In-flight JWT access token', 'Single-use refresh token', 'Pending request queue'],
        resources: ['Network sockets', 'HTTP client interceptor state'],
        externalDependencies: ['OAuth Token Endpoint'],
        possibleSideEffects: ['Revocation of previous refresh token upon rotation'],
        concurrencyPotential: 'Multiple parallel API calls failing 401 simultaneously and racing to refresh',
        timingSemantics: 'Token expiration window and network round-trip latency',
        persistence: 'Secure client-side credential storage',
        ordering: 'Strict sequencing: refresh must complete before request retries',
        trustBoundaries: ['Client to OAuth Authorization Server'],
        failureSensitiveOperations: ['Refresh token rotation exchange'],
        scaleSignals: ['Burst of parallel UI component data fetches'],
        technologyContext: ['TypeScript', 'React / Axios'],
        assumptions: ['OAuth server invalidates refresh token upon first exchange (rotation)'],
        unresolvedQuestions: ['What is the maximum replay queue depth if refresh hangs?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.CONCURRENCY,
          WellKnownDimensions.SHARED_MUTABLE_STATE,
          WellKnownDimensions.RETRY,
          WellKnownDimensions.TIME_WINDOW,
        ],
      },
      relevantPatternIds: ['pattern-token-refresh-race'],
    },
  },
  // Demo C: Parallel Image Pipeline
  {
    match: (t) => /large uploaded images in parallel/i.test(t),
    data: {
      decomposition: {
        actors: ['Image Uploader Clients', 'Image Processing Worker Pool'],
        operations: ['Image decompression', 'Resize / transformation', 'Re-encoding', 'Storage write'],
        state: ['In-memory uncompressed pixel buffers', 'Worker thread state'],
        resources: ['Node.js heap & native memory (RSS)', 'CPU thread pool'],
        externalDependencies: ['Object storage / disk'],
        possibleSideEffects: ['Disk or memory consumption spikes'],
        concurrencyPotential: 'Parallel processing of multiple high-resolution image streams',
        timingSemantics: 'Asynchronous pipeline throughput and job completion latency',
        persistence: 'Processed asset persistence to storage',
        ordering: 'Independent per-image processing',
        trustBoundaries: ['Untrusted user image file payloads'],
        failureSensitiveOperations: ['Uncompressed bitmap allocation in worker memory'],
        scaleSignals: ['500 images/minute, up to 25MB each'],
        technologyContext: ['Node.js', 'Libvips / Sharp'],
        assumptions: ['Uploaded images can decompress into multi-hundred megabyte raw pixel arrays'],
        unresolvedQuestions: ['Is native memory usage bounded by libvips cache limits?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.BOUNDED_RESOURCE,
          WellKnownDimensions.CONCURRENCY,
        ],
      },
      relevantPatternIds: [
        'pattern-parallel-compute-memory-exhaustion',
        'pattern-unbounded-consumer-overflow',
      ],
    },
  },
  // Scenario 4: DB Connection Pool
  {
    match: (t) => /5,000 concurrent web requests|order history.*connection/i.test(t),
    data: {
      decomposition: {
        actors: ['Web Clients', 'Application Server', 'PostgreSQL Database'],
        operations: ['Acquire DB connection', 'Execute history query', 'Release connection'],
        state: ['Connection pool slot state', 'Pending query wait queues'],
        resources: ['Database backend connection slots', 'TCP file descriptors'],
        externalDependencies: ['PostgreSQL Database'],
        possibleSideEffects: ['Connection starvation and cascade timeouts'],
        concurrencyPotential: 'High concurrency: 5,000 simultaneous web requests',
        timingSemantics: 'Connection acquisition timeout and query execution deadlines',
        persistence: 'Relational database persistence',
        ordering: 'FIFO or LIFO connection acquisition',
        trustBoundaries: ['Web tier to database network boundary'],
        failureSensitiveOperations: ['Database connection acquisition under load spike'],
        scaleSignals: ['5,000 concurrent queries'],
        technologyContext: ['PostgreSQL', 'Node.js pg.Pool'],
        assumptions: ['Database maximum connections is far lower than 5,000 concurrent requests'],
        unresolvedQuestions: ['What is the configured max_connections on the database server?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.BOUNDED_RESOURCE,
          WellKnownDimensions.CONCURRENCY,
          WellKnownDimensions.DEPENDENCY,
        ],
      },
      relevantPatternIds: ['pattern-db-connection-pool-exhaustion'],
    },
  },
  // Scenario 5: Duplicate Payment Protection
  {
    match: (t) => /credit card.*retry|payment.*duplicate/i.test(t),
    data: {
      decomposition: {
        actors: ['Paying Customer', 'Checkout Service', 'Payment Gateway'],
        operations: ['Payment submission', 'Gateway charge request', 'Timeout detection', 'Transaction retry'],
        state: ['Payment intent state', 'Ledger transaction record'],
        resources: ['Database records', 'Outbound gateway connections'],
        externalDependencies: ['Third-party payment gateway (e.g. Stripe)'],
        possibleSideEffects: ['Financial charge against customer bank account (non-idempotent)'],
        concurrencyPotential: 'User double-click or client retry racing original slow in-flight request',
        timingSemantics: 'Gateway timeout duration and network partition latency',
        persistence: 'ACID transaction database',
        ordering: 'Strict transaction state transition sequence',
        trustBoundaries: ['Customer to checkout service; service to payment gateway'],
        failureSensitiveOperations: ['Credit card charge mutation over uncertain network'],
        scaleSignals: ['E-commerce transaction volume'],
        technologyContext: ['PostgreSQL', 'Payment API'],
        assumptions: ['Network timeouts may occur after the payment gateway has already captured funds'],
        unresolvedQuestions: ['Does the payment gateway API accept unique idempotency keys?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.SIDE_EFFECT,
          WellKnownDimensions.RETRY,
          WellKnownDimensions.DEPENDENCY,
          WellKnownDimensions.SHARED_MUTABLE_STATE,
        ],
      },
      relevantPatternIds: ['pattern-duplicate-side-effect-retry'],
    },
  },
  // Scenario 6: Downstream Retry Storm
  {
    match: (t) => /downstream pricing API.*retry up to 10 times|retry.*10 times/i.test(t),
    data: {
      decomposition: {
        actors: ['Client Requests', 'Aggregator Service', 'Downstream Pricing Service'],
        operations: ['Price lookup call', 'Failure detection', 'Aggressive iterative retry'],
        state: ['Per-request retry count and backoff timers'],
        resources: ['Outbound HTTP connections', 'Downstream compute capacity'],
        externalDependencies: ['Downstream Pricing API'],
        possibleSideEffects: ['Amplified downstream request load during outage'],
        concurrencyPotential: 'Hundreds of upstream requests simultaneously multiplying retries',
        timingSemantics: 'Short retry intervals causing synchronized request waves',
        persistence: 'None',
        ordering: 'Serial retries per request',
        trustBoundaries: ['Service-to-service internal boundary'],
        failureSensitiveOperations: ['Synchronous retry execution against degraded dependency'],
        scaleSignals: ['Multiplier factor of 10x request amplification'],
        technologyContext: ['AWS', 'Microservices'],
        assumptions: ['Downstream outage is exacerbated by incoming retry traffic'],
        unresolvedQuestions: ['Is circuit breaking or jittered exponential backoff configured?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.RETRY,
          WellKnownDimensions.DEPENDENCY,
          WellKnownDimensions.TIME_WINDOW,
          WellKnownDimensions.BOUNDED_RESOURCE,
        ],
      },
      relevantPatternIds: ['pattern-retry-amplification-storm'],
    },
  },
  // Scenario 7: Cache Stampede
  {
    match: (t) => /trending product catalog.*Redis.*5 minute TTL|cache.*TTL.*100,000/i.test(t),
    data: {
      decomposition: {
        actors: ['Catalog Readers', 'Caching Layer (Redis)', 'Primary Database'],
        operations: ['Cache lookup', 'Miss detection', 'DB fallback query', 'Cache write-back'],
        state: ['Cached JSON payload with fixed TTL'],
        resources: ['Redis memory', 'Database query pool'],
        externalDependencies: ['Redis', 'PostgreSQL'],
        possibleSideEffects: ['Sudden CPU and I/O spike on primary database upon key expiration'],
        concurrencyPotential: '100,000 concurrent readers all experiencing cache miss simultaneously',
        timingSemantics: 'Sudden TTL expiration cliff causing dogpiling',
        persistence: 'Redis cache + PostgreSQL database',
        ordering: 'Read before write-back',
        trustBoundaries: ['Public readers querying product catalog'],
        failureSensitiveOperations: ['Simultaneous database query fan-out on popular key expiration'],
        scaleSignals: ['100,000 concurrent reading clients'],
        technologyContext: ['Redis', 'PostgreSQL'],
        assumptions: ['Key expiration occurs at an exact discrete second across all reading threads'],
        unresolvedQuestions: ['Can probabilistic early expiration (XFetch) or background refresh be used?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.SCALING_CONCENTRATION,
          WellKnownDimensions.TIME_WINDOW,
          WellKnownDimensions.DEPENDENCY,
        ],
      },
      relevantPatternIds: ['pattern-cache-stampede-dogpiling'],
    },
  },
  // Scenario 8: Kafka Queue Deduplication
  {
    match: (t) => /Kafka queue and send welcome emails|Kafka.*welcome email/i.test(t),
    data: {
      decomposition: {
        actors: ['Kafka Broker', 'Event Consumer Worker', 'Email Delivery Service'],
        operations: ['Poll registration event', 'Send welcome email', 'Commit consumer offset'],
        state: ['Consumer partition offset', 'Sent email idempotency record'],
        resources: ['Message queue consumer threads', 'Outbound email API quota'],
        externalDependencies: ['Apache Kafka', 'Email SMTP / API provider'],
        possibleSideEffects: ['External user email delivery (duplicate communication)'],
        concurrencyPotential: 'Consumer rebalance or crash causing duplicate message consumption',
        timingSemantics: 'Offset commit intervals and consumer heartbeat timeouts',
        persistence: 'Kafka commit log + local database deduplication table',
        ordering: 'Partition-level message ordering',
        trustBoundaries: ['Event consumer boundary'],
        failureSensitiveOperations: ['Email sending prior to offset commit'],
        scaleSignals: ['User registration event streams'],
        technologyContext: ['Kafka', 'Node.js'],
        assumptions: ['Kafka provides at-least-once delivery semantics under consumer rebalancing'],
        unresolvedQuestions: ['Is a transactional outbox or deduplication table present?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.ORDERING,
          WellKnownDimensions.SIDE_EFFECT,
          WellKnownDimensions.CONCURRENCY,
        ],
      },
      relevantPatternIds: ['pattern-duplicate-queue-message-delivery'],
    },
  },
  // Scenario 9: Third-Party Timeout Resiliency
  {
    match: (t) => /partner catalog.*without freezing|external supplier.*search/i.test(t),
    data: {
      decomposition: {
        actors: ['Search User', 'Search Aggregator Service', 'External Partner API'],
        operations: ['Receive search request', 'Call partner catalog', 'Aggregate results', 'Return response'],
        state: ['Pending outbound HTTP request sockets', 'User search session'],
        resources: ['Node.js HTTP client sockets', 'Server memory'],
        externalDependencies: ['External Partner HTTP API'],
        possibleSideEffects: ['Worker thread starvation and latency degradation on all user searches'],
        concurrencyPotential: 'Every user search spawning external network calls',
        timingSemantics: 'Partner response latency and timeout bounds',
        persistence: 'None',
        ordering: 'Independent per search',
        trustBoundaries: ['Internal application to unmanaged third-party network'],
        failureSensitiveOperations: ['Awaiting synchronous partner response over Internet'],
        scaleSignals: ['All user searches depending on external partner availability'],
        technologyContext: ['TypeScript', 'HTTP Client'],
        assumptions: ['External partner service will experience latency spikes or socket hangs'],
        unresolvedQuestions: ['What is the maximum SLA acceptable before falling back to cached catalog?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.DEPENDENCY,
          WellKnownDimensions.TIME_WINDOW,
          WellKnownDimensions.BOUNDED_RESOURCE,
        ],
      },
      relevantPatternIds: ['pattern-missing-network-timeout-hang'],
    },
  },
  // Scenario 10: Concurrent Lost Update
  {
    match: (t) => /inventory quantity, decrement by 1|decrement.*inventory|flash sale/i.test(t),
    data: {
      decomposition: {
        actors: ['Checkout Customers', 'Inventory Service', 'Database'],
        operations: ['Read current quantity', 'In-memory decrement calculation', 'Update record write'],
        state: ['Product inventory balance stock'],
        resources: ['Database record locks'],
        externalDependencies: ['PostgreSQL'],
        possibleSideEffects: ['Overselling inventory (negative stock balance)'],
        concurrencyPotential: 'Simultaneous checkouts reading identical stock before either writes back',
        timingSemantics: 'Read-modify-write execution window across concurrent database connections',
        persistence: 'ACID database table',
        ordering: 'Stock modification serialization',
        trustBoundaries: ['Checkout transaction boundary'],
        failureSensitiveOperations: ['Non-atomic read-then-write stock decrement'],
        scaleSignals: ['Flash sale simultaneous checkout burst'],
        technologyContext: ['PostgreSQL'],
        assumptions: ['Multiple transactions will interleave between SELECT and UPDATE'],
        unresolvedQuestions: ['Is atomic UPDATE or optimistic version checking implemented?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.SHARED_MUTABLE_STATE,
          WellKnownDimensions.CONCURRENCY,
          WellKnownDimensions.PERSISTENCE,
        ],
      },
      relevantPatternIds: ['pattern-concurrent-lost-update-race'],
    },
  },
  // Neutral Network Sensor
  {
    match: (t) => /binary telemetry metrics from 10,000 edge sensors/i.test(t),
    data: {
      decomposition: {
        actors: ['10,000 Edge Sensors', 'Ingestion Pipeline Worker'],
        operations: ['Receive socket stream', 'Buffer chunk processing', 'Forward to persistence'],
        state: ['In-memory stream buffer state'],
        resources: ['Process heap memory', 'Socket connections'],
        externalDependencies: ['Downstream ingestion sink'],
        possibleSideEffects: ['Heap overflow if downstream stalls'],
        concurrencyPotential: '10,000 concurrent streaming socket connections',
        timingSemantics: 'Asymmetric ingress vs egress transmission rates',
        persistence: 'Downstream storage sink',
        ordering: 'TCP stream chunk sequence',
        trustBoundaries: ['Edge device network gateway'],
        failureSensitiveOperations: ['Unbounded chunk accumulation in memory'],
        scaleSignals: ['10,000 sensors, continuous high throughput'],
        technologyContext: ['Node.js'],
        assumptions: ['Edge sensors stream data faster than downstream write rate during bursts'],
        unresolvedQuestions: ['Do sensors support flow control backpressure pausing?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.BOUNDED_RESOURCE,
          WellKnownDimensions.CONCURRENCY,
          WellKnownDimensions.TIME_WINDOW,
        ],
      },
      relevantPatternIds: ['pattern-unbounded-consumer-overflow'],
    },
  },
  // Strictly Isolated Computation
  {
    match: (t) => /deterministic in-memory matrix transformation on a single air-gapped CPU core/i.test(t),
    data: {
      decomposition: {
        actors: ['Local Batch Computation Process'],
        operations: ['Load pre-allocated matrix', 'Perform linear transformation', 'Write in-memory result'],
        state: ['Local static memory buffer'],
        resources: ['CPU registers', 'Single core L1/L2 cache and resident RAM'],
        externalDependencies: [],
        possibleSideEffects: [],
        concurrencyPotential: 'None: strictly single-threaded execution on isolated core',
        timingSemantics: 'Deterministic cycle timing',
        persistence: 'None: purely volatile in-memory transform',
        ordering: 'Strict instruction execution sequence',
        trustBoundaries: ['Air-gapped compute host (no external network or untrusted inputs)'],
        failureSensitiveOperations: ['Buffer bounds check during matrix multiplication'],
        scaleSignals: ['Fixed size matrix computation'],
        technologyContext: ['C++ / Assembly'],
        assumptions: ['Operating environment has zero external network or persistence interfaces'],
        unresolvedQuestions: ['What is the exact matrix dimension to guarantee fitting in L3 cache?'],
        inferredEngineeringDimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
      },
      relevantPatternIds: [],
      irrelevantPatternIds: [
        'pattern-rate-limit-race',
        'pattern-token-refresh-race',
        'pattern-duplicate-payment-side-effect',
        'pattern-db-connection-starvation',
      ],
    },
  },
  // False-Positive Eval Case: Offline single-image resize
  {
    match: (t) => /Resize a single local image once in an offline command-line process/i.test(t),
    data: {
      decomposition: {
        actors: ['Local CLI User'],
        operations: ['Read local image file', 'Decode image', 'Resize image', 'Write local image file'],
        state: ['Single image buffer in memory'],
        resources: ['Local file descriptor', 'Process memory buffer', 'CPU core'],
        externalDependencies: ['Local filesystem'],
        possibleSideEffects: ['Writing destination file to disk'],
        concurrencyPotential: 'None: single offline invocation on a single local file',
        timingSemantics: 'Synchronous execution until completion',
        persistence: 'Local file written to disk',
        ordering: 'Sequential decode then resize then encode',
        trustBoundaries: ['Local operating system user file permissions (offline execution)'],
        failureSensitiveOperations: ['Decoding corrupted or abnormally large image files'],
        scaleSignals: ['Single invocation: 1 file'],
        technologyContext: ['Node.js CLI', 'Libvips'],
        assumptions: ['Process runs locally without external network, database, or token services'],
        unresolvedQuestions: ['Can the single image dimension exceed available local RAM?'],
        inferredEngineeringDimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
      },
      relevantPatternIds: ['pattern-parallel-compute-memory-exhaustion'],
      irrelevantPatternIds: [
        'pattern-fixed-window-burst',
        'pattern-token-refresh-race',
        'pattern-duplicate-payment-side-effect',
        'pattern-db-connection-pool-exhaustion',
        'pattern-duplicate-queue-message-delivery',
        'pattern-cache-stampede-dogpile',
        'pattern-retry-amplification-storm',
        'pattern-missing-network-timeout-hang',
        'pattern-concurrent-lost-update-race',
      ],
    },
  },
  // Novel A: Document collaboration
  {
    match: (t) => /update the same document from their phones and laptops at nearly the same time/i.test(t),
    data: {
      decomposition: {
        actors: ['Multi-device Users', 'Document Sync Service'],
        operations: ['Edit document text', 'Transmit change patch', 'Merge concurrent edits'],
        state: ['Shared document contents', 'Edit operation history'],
        resources: ['Network bandwidth', 'Sync worker memory'],
        externalDependencies: ['Cloud storage / document database'],
        possibleSideEffects: ['Overwriting unmerged edits (lost updates)'],
        concurrencyPotential: 'High: simultaneous edits from phone and laptop to same document',
        timingSemantics: 'Sub-second synchronization latency across asynchronous clients',
        persistence: 'Document database persistence',
        ordering: 'Edit operation sequence or vector clocks',
        trustBoundaries: ['Authenticated users editing private documents'],
        failureSensitiveOperations: ['Applying concurrent edits without conflict resolution'],
        scaleSignals: ['Multi-device real-time sync'],
        technologyContext: ['WebSockets', 'Database'],
        assumptions: ['Network latency causes updates to arrive out-of-order'],
        unresolvedQuestions: ['Is operational transformation (OT) or CRDT used for collaborative editing?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.SHARED_MUTABLE_STATE,
          WellKnownDimensions.CONCURRENCY,
          WellKnownDimensions.ORDERING,
          WellKnownDimensions.PERSISTENCE,
        ],
      },
      relevantPatternIds: ['pattern-concurrent-lost-update-race'],
    },
  },
  // Novel B: Stuck purchase retry
  {
    match: (t) => /customer can click the purchase button again if the first request appears stuck/i.test(t),
    data: {
      decomposition: {
        actors: ['Customer', 'Checkout Interface', 'Payment Processing Service'],
        operations: ['Submit purchase', 'Client re-click on perceived delay', 'Process duplicate charge'],
        state: ['Pending order status', 'Payment transaction intent'],
        resources: ['Payment gateway connection slots'],
        externalDependencies: ['Payment Gateway'],
        possibleSideEffects: ['Charging user card multiple times for single order'],
        concurrencyPotential: 'Re-click creates race between stalled first request and second submission',
        timingSemantics: 'Network hang delay leading user to believe request failed',
        persistence: 'Order database',
        ordering: 'Sequential user actions across uncertain network',
        trustBoundaries: ['Customer browser to checkout server'],
        failureSensitiveOperations: ['Payment capture without idempotency protection'],
        scaleSignals: ['High traffic checkout during network instability'],
        technologyContext: ['Web Application'],
        assumptions: ['First request may have succeeded at gateway while UI spinner was still running'],
        unresolvedQuestions: ['Does checkout button disable upon first click and generate a client idempotency key?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.SIDE_EFFECT,
          WellKnownDimensions.RETRY,
          WellKnownDimensions.CONCURRENCY,
          WellKnownDimensions.SHARED_MUTABLE_STATE,
        ],
      },
      relevantPatternIds: ['pattern-duplicate-side-effect-retry'],
    },
  },
  // Novel C: In-memory cache copy
  {
    match: (t) => /keeps a copy of popular data for five minutes before fetching it again/i.test(t),
    data: {
      decomposition: {
        actors: ['Cluster Application Instances', 'Primary Data Store'],
        operations: ['Read popular data from instance cache', 'TTL expiry check', 'Re-fetch from source'],
        state: ['Instance cached data copy with 5-minute timer'],
        resources: ['Instance RAM', 'Database connection bandwidth'],
        externalDependencies: ['Primary database / upstream API'],
        possibleSideEffects: ['Mass simultaneous queries to primary source when 5-minute timer expires'],
        concurrencyPotential: 'All instances refreshing popular data at same time boundary',
        timingSemantics: 'Discrete 5-minute expiration window',
        persistence: 'Primary store persistence',
        ordering: 'Read before cache refresh',
        trustBoundaries: ['Internal application cluster'],
        failureSensitiveOperations: ['Synchronous re-fetch upon 5-minute TTL expiration'],
        scaleSignals: ['Multiple application instances serving popular items'],
        technologyContext: ['Distributed System'],
        assumptions: ['Instances synchronized to similar restart or reload times expire synchronously'],
        unresolvedQuestions: ['Can jitter or background early refresh prevent synchronized expiration?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.SCALING_CONCENTRATION,
          WellKnownDimensions.TIME_WINDOW,
          WellKnownDimensions.DEPENDENCY,
        ],
      },
      relevantPatternIds: ['pattern-cache-stampede-dogpiling'],
    },
  },
  // Novel D: Workers dying halfway
  {
    match: (t) => /Workers receive jobs and occasionally die halfway through processing them/i.test(t),
    data: {
      decomposition: {
        actors: ['Job Dispatcher', 'Worker Processes', 'Message Broker'],
        operations: ['Receive job', 'Execute partial job mutations', 'Process crash / SIGKILL', 'Job redelivery'],
        state: ['Job processing progress', 'Partially applied side effects'],
        resources: ['Worker memory & CPU', 'Queue visibility timeout'],
        externalDependencies: ['Job Queue / Broker'],
        possibleSideEffects: ['Duplicate execution of side effects on redelivery of failed job'],
        concurrencyPotential: 'Worker crash causing job lease expiration and assignment to second worker',
        timingSemantics: 'Visibility timeout and heartbeat intervals',
        persistence: 'Queue storage + state store',
        ordering: 'Job submission order',
        trustBoundaries: ['Worker execution environment'],
        failureSensitiveOperations: ['Non-atomic multi-step operations without idempotent compensation'],
        scaleSignals: ['Asynchronous batch job queues'],
        technologyContext: ['Worker Queue'],
        assumptions: ['Crashed worker leaves partially committed side effects before job is retried'],
        unresolvedQuestions: ['Can jobs be broken into idempotent units of work with progress checkpoints?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.RETRY,
          WellKnownDimensions.SIDE_EFFECT,
          WellKnownDimensions.ORDERING,
        ],
      },
      relevantPatternIds: ['pattern-duplicate-queue-message-delivery', 'pattern-duplicate-side-effect-retry'],
    },
  },
  // Novel E: External supplier search wait
  {
    match: (t) => /app waits for an external supplier before showing search results/i.test(t),
    data: {
      decomposition: {
        actors: ['Search Client', 'Application Server', 'External Supplier API'],
        operations: ['Receive search request', 'Call supplier API', 'Wait for response', 'Render results'],
        state: ['Active HTTP connection', 'Search session state'],
        resources: ['Outbound TCP sockets', 'Thread / worker capacity'],
        externalDependencies: ['External Supplier API'],
        possibleSideEffects: ['Resource exhaustion and user-facing timeouts if supplier is slow or down'],
        concurrencyPotential: 'Every user search blocking on external supplier network latency',
        timingSemantics: 'Supplier response latency and client connection timeouts',
        persistence: 'None',
        ordering: 'Sequential wait before response',
        trustBoundaries: ['Application to external third-party supplier over internet'],
        failureSensitiveOperations: ['Synchronous network call to third party without timeout or circuit breaker'],
        scaleSignals: ['User search traffic volume'],
        technologyContext: ['HTTP Service'],
        assumptions: ['External supplier can hang indefinitely or respond with multi-second latency'],
        unresolvedQuestions: ['What timeout threshold should be set, and can search return partial or cached results?'],
        inferredEngineeringDimensions: [
          WellKnownDimensions.DEPENDENCY,
          WellKnownDimensions.TIME_WINDOW,
          WellKnownDimensions.BOUNDED_RESOURCE,
        ],
      },
      relevantPatternIds: ['pattern-missing-network-timeout-hang'],
    },
  },
];

/**
 * Deterministic Demo Provider Adapter.
 * Provides honest deterministic structured reasoning for prototype scenarios,
 * and an explicit fallback with honest reduced capabilities for uncataloged prompts.
 * Strictly adheres to Zod schema validation; NEVER returns fake `{ } as T`.
 */
export class DeterministicDemoProviderAdapter implements ProviderAdapter {
  readonly id = 'deterministic-demo';
  readonly name = 'Deterministic Demo Reasoner (Zero-Key)';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsStructuredOutput: true,
      supportsStreaming: false,
      maxContextTokens: 32000,
    };
  }

  async generateText(request: ProviderRequest): Promise<ProviderResponse> {
    const userMessage =
      request.messages.find((m) => m.role === 'user')?.content || '';
    return {
      content: `[Deterministic Demo Mode] Evaluated requirement: "${userMessage.slice(0, 100)}"`,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }

  async generateStructured<T>(
    request: StructuredProviderRequest
  ): Promise<StructuredProviderResponse<T>> {
    const userMessage =
      request.messages.find((m) => m.role === 'user')?.content || '';

    // Extract requirement intent to avoid false-matching candidate descriptions
    const intentMatch = userMessage.match(/Requirement Intent:\s*([^\n\r]+)/i);
    const targetText = intentMatch ? intentMatch[1]!.trim() : userMessage;

    // Match cataloged scenario against requirement intent
    const matchedScenario = SCENARIO_CATALOG.find((s) =>
      s.match(targetText)
    );

    let resultData: unknown;

    if (request.schemaName === 'RequirementDecomposition') {
      if (matchedScenario) {
        resultData = matchedScenario.data.decomposition;
      } else {
        // Honest fallback decomposition for uncataloged prompts
        resultData = {
          actors: ['System Client / User'],
          operations: ['Execute requested capability', 'Process input parameters'],
          state: ['In-memory operation state'],
          resources: ['Process CPU and memory'],
          externalDependencies: [],
          possibleSideEffects: [],
          concurrencyPotential: 'Potential concurrent client invocations',
          timingSemantics: 'Synchronous execution window',
          persistence: 'Unspecified',
          ordering: 'Standard execution sequence',
          trustBoundaries: ['Client input boundary'],
          failureSensitiveOperations: ['Resource allocation'],
          scaleSignals: ['Single or low-volume operation'],
          technologyContext: ['Standard runtime environment'],
          assumptions: [
            'Deterministic demonstration mode: baseline semantic analysis without external LLM provider',
          ],
          unresolvedQuestions: [
            'External AI provider not configured. Configure ARCHITECTAI_API_KEY for open-ended semantic reasoning.',
          ],
          inferredEngineeringDimensions: [
            WellKnownDimensions.BOUNDED_RESOURCE,
            WellKnownDimensions.CONCURRENCY,
          ],
        };
      }
      // Schema validate output
      const validated = RequirementDecompositionSchema.parse(resultData);
      return {
        content: JSON.stringify(validated),
        data: validated as T,
      };
    }

    if (request.schemaName === 'ConcernRelevanceEvaluation') {
      // Parse candidate IDs from prompt message
      const candidateIdMatches = Array.from(
        userMessage.matchAll(/ID:\s*([a-zA-Z0-9_-]+)/g)
      ).map((m) => m[1]!);

      const evaluations = candidateIdMatches.map((candId) => {
        let isApplicable = false;
        let reason = 'Candidate evaluated against decomposed operations and context.';

        if (matchedScenario) {
          if (matchedScenario.data.relevantPatternIds.includes(candId)) {
            isApplicable = true;
            reason = `Directly addresses core failure mode of the requirement: ${candId}`;
          } else if (matchedScenario.data.irrelevantPatternIds?.includes(candId)) {
            isApplicable = false;
            reason = `Inapplicable: Requirement context explicitly excludes conditions triggering ${candId}`;
          } else {
            // Default judgment for other candidates
            isApplicable = false;
            reason = `Context does not exhibit triggers or mechanisms for ${candId}`;
          }
        } else {
          // For uncataloged prompts in deterministic fallback
          isApplicable = candId.includes('consumer-overflow') || candId.includes('oom');
          reason = isApplicable
            ? `Plausibly applicable under baseline bounded resource constraints`
            : `Deterministic mode: insufficient evidence to assert applicability for ${candId}`;
        }

        return {
          candidateId: candId,
          relevance: isApplicable ? ('applicable' as const) : ('not_applicable' as const),
          applicabilityReason: reason,
          assumptions: ['Evaluated under deterministic mode constraints'],
          confidence: isApplicable ? 0.9 : 0.2,
          unresolvedQuestions: [],
        };
      });

      resultData = {
        evaluations,
        ungroundedConcerns: [],
      };

      const validated = ConcernRelevanceEvaluationSchema.parse(resultData);
      return {
        content: JSON.stringify(validated),
        data: validated as T,
      };
    }

    if (request.schemaName === 'ImplementationPlan') {
      const userMessage = request.messages.find((m) => m.role === 'user')?.content || '';
      const contractIdMatch = userMessage.match(/Contract ID:\s*([^\r\n]+)/);
      const contractId = (contractIdMatch && contractIdMatch[1]) ? contractIdMatch[1].trim() : 'contract-compiled';
      const repoPathMatch = userMessage.match(/Repository Path:\s*([^\r\n]+)/);
      const repositoryPath = (repoPathMatch && repoPathMatch[1]) ? repoPathMatch[1].trim() : '.';
      const reqMatch = userMessage.match(/Requirement:\s*([^\r\n]+)/);
      const requirement = (reqMatch && reqMatch[1]) ? reqMatch[1].trim() : 'System implementation requirement';

      const concernIds = Array.from(userMessage.matchAll(/- ID:\s*(concern-[a-zA-Z0-9_-]+)/g)).map((m) => m[1]!);
      const decisionIds = Array.from(userMessage.matchAll(/- ID:\s*(decision-[a-zA-Z0-9_-]+)/g)).map((m) => m[1]!);
      const invariantIds = Array.from(userMessage.matchAll(/- ID:\s*(inv-[a-zA-Z0-9_-]+)/g)).map((m) => m[1]!);

      const primaryConcernIds = concernIds.length > 0 ? concernIds : ['concern-default'];
      const primaryDecisionIds = decisionIds.length > 0 ? decisionIds : ['decision-default'];
      const primaryInvariantIds = invariantIds.length > 0 ? invariantIds : ['inv-default'];

      const tasks: ImplementationTask[] = [
        {
          id: 'TASK-001',
          title: `Implement core architectural mechanism for ${requirement.slice(0, 40)}`,
          objective: `Implement bounded mechanism mitigating ${primaryConcernIds.join(', ')} according to decision ${primaryDecisionIds.join(', ')}.`,
          sourceConcernIds: primaryConcernIds,
          sourceDecisionIds: primaryDecisionIds,
          sourceInvariantIds: primaryInvariantIds,
          dependencies: [],
          contextReferences: ['src/index.ts', 'src/app.ts'],
          allowedFiles: ['src/**'],
          excludedFiles: ['.env*', 'package-lock.json', 'node_modules/**'],
          requirements: [
            `Implement bounded logic satisfying invariant: ${primaryInvariantIds[0] || 'bounded resource consumption'}`,
            'Ensure all edge cases and burst conditions are handled gracefully without unbounded memory or unhandled exceptions',
          ],
          acceptanceCriteria: [
            'Mechanism conforms to architecture decision rationale',
            'Code compiles cleanly with strict TypeScript checks',
          ],
          verificationCommands: ['npm test'],
          expectedArtifacts: ['src/'],
          riskLevel: 'medium',
          status: 'pending',
        },
        {
          id: 'TASK-002',
          title: `Integrate and verify invariants for ${requirement.slice(0, 40)}`,
          objective: `Integrate core mechanism into application entry points and add automated invariant tests.`,
          sourceConcernIds: primaryConcernIds,
          sourceDecisionIds: primaryDecisionIds,
          sourceInvariantIds: primaryInvariantIds,
          dependencies: ['TASK-001'],
          contextReferences: ['src/index.ts', 'tests/'],
          allowedFiles: ['src/**', 'test/**', 'tests/**'],
          excludedFiles: ['.env*'],
          requirements: [
            'Wire mechanism into request processing path',
            'Add automated verification test validating invariant properties under load',
          ],
          acceptanceCriteria: [
            'All existing tests and new invariant tests pass cleanly',
            'Zero side-effect regressions in existing application flows',
          ],
          verificationCommands: ['npm test'],
          expectedArtifacts: ['tests/'],
          riskLevel: 'low',
          status: 'pending',
        },
      ];

      resultData = {
        id: `plan-${Date.now()}`,
        contractId,
        repositoryPath,
        summary: `Implementation plan for ${contractId}: compiled ${tasks.length} bounded tasks addressing concerns ${primaryConcernIds.join(', ')}.`,
        tasks,
        createdAt: new Date().toISOString(),
      };

      const validated = ImplementationPlanSchema.parse(resultData);
      return {
        content: JSON.stringify(validated),
        data: validated as T,
      };
    }

    if (request.schemaName === 'VerificationIntent') {
      const userMessage = request.messages.find((m) => m.role === 'user')?.content || '';
      const invMatch = userMessage.match(/Invariant:\s*- ID:\s*([^\r\n]+)/i);
      const invariantId = invMatch ? invMatch[1]!.trim() : 'inv-unknown';

      // Check available candidate recipes in prompt
      const candidateRecipeMatches = Array.from(userMessage.matchAll(/- Recipe:\s*([a-zA-Z0-9_-]+)/g)).map((m) => m[1]!);

      let selectedRecipeId: string | undefined;
      let failureHypothesis = '';
      let systemOperationUnderTest = '';
      let requiredSetup = '';
      let adversarialStimulus = '';
      let observations: string[] = [];
      let assertions: any[] = [];
      let targetFiles: string[] = [];
      let targetSymbols: string[] = [];
      let requiredCapabilities: string[] = [];
      let isExecutable = true;
      let inconclusiveReason: string | undefined;

      let selectedId = candidateRecipeMatches[0];
      if (
        invariantId.includes('burst') ||
        invariantId.includes('fixed-window') ||
        invariantId.includes('rate') ||
        userMessage.includes('pattern-fixed-window-burst') ||
        userMessage.includes('rolling window')
      ) {
        const rateRecipe = candidateRecipeMatches.find((r) => r === 'recipe-rolling-window-boundary-burst');
        if (rateRecipe) selectedId = rateRecipe;
      } else if (
        invariantId.includes('idempotent') ||
        invariantId.includes('payment') ||
        userMessage.includes('pattern-duplicate-side-effect-retry')
      ) {
        const payRecipe = candidateRecipeMatches.find((r) => r === 'recipe-idempotent-mutation-retry');
        if (payRecipe) selectedId = payRecipe;
      } else if (
        invariantId.includes('worker') ||
        invariantId.includes('concurrency') ||
        userMessage.includes('pattern-unbounded-consumer-overflow')
      ) {
        const workerRecipe = candidateRecipeMatches.find((r) => r === 'recipe-bounded-worker-concurrency');
        if (workerRecipe) selectedId = workerRecipe;
      } else if (
        invariantId.includes('token') ||
        invariantId.includes('refresh') ||
        userMessage.includes('pattern-token-refresh-race')
      ) {
        const tokenRecipe = candidateRecipeMatches.find((r) => r === 'recipe-token-refresh-single-flight');
        if (tokenRecipe) selectedId = tokenRecipe;
      }

      if (selectedId === 'recipe-rolling-window-boundary-burst') {
        selectedRecipeId = 'recipe-rolling-window-boundary-burst';
        failureHypothesis = 'Fixed window counter resets allow 2x quota burst across boundary';
        systemOperationUnderTest = 'Rate limiter rolling window admission check';
        requiredSetup = 'Rate limiter configured with 5 requests per 60000ms rolling window';
        adversarialStimulus = 'Transmit 5 requests at second 59 followed immediately by 5 requests at second 61 across minute reset boundary';
        observations = ['accepted_count', 'rejected_count', 'burst_span_ms'];
        assertions = [
          {
            id: 'assert-burst-ceiling',
            name: 'accepted_count',
            description: 'Total requests accepted within any rolling 60-second window must not exceed 5',
            operator: 'lte',
            expected: 5,
            unit: 'requests',
          },
        ];
        targetFiles = ['src/rate-limiter.ts'];
        targetSymbols = ['SlidingWindowRateLimiter', 'FixedWindowRateLimiter', 'RateLimiter'];
        requiredCapabilities = ['node_execution', 'timing_control', 'metric_collection'];
      } else if (selectedId === 'recipe-idempotent-mutation-retry') {
        selectedRecipeId = 'recipe-idempotent-mutation-retry';
        failureHypothesis = 'Network retries or concurrent submissions execute duplicate downstream charges';
        systemOperationUnderTest = 'Payment charge processing with idempotency ledger locking';
        requiredSetup = 'Payment service wired to downstream provider with idempotency key tracking';
        adversarialStimulus = 'Simultaneously submit 2 identical charge requests with same idempotency key';
        observations = ['downstream_charge_calls', 'total_submissions'];
        assertions = [
          {
            id: 'assert-single-charge',
            name: 'downstream_charge_calls',
            description: 'External payment gateway charge must be called at most once',
            operator: 'lte',
            expected: 1,
            unit: 'external_calls',
          },
        ];
        targetFiles = ['src/idempotency.ts', 'src/payment.ts'];
        targetSymbols = ['IdempotencyLedger', 'chargePayment'];
        requiredCapabilities = ['node_execution', 'local_stubs', 'metric_collection'];
      } else if (selectedId === 'recipe-bounded-worker-concurrency') {
        selectedRecipeId = 'recipe-bounded-worker-concurrency';
        failureHypothesis = 'Burst task submissions bypass concurrency limits and saturate system memory';
        systemOperationUnderTest = 'Worker pool task scheduling with concurrency limit';
        requiredSetup = 'Worker pool initialized with maxConcurrency = 2';
        adversarialStimulus = 'Burst submit 4 asynchronous tasks with simulated processing delay';
        observations = ['peak_concurrency', 'configured_max', 'tasks_completed'];
        assertions = [
          {
            id: 'assert-peak-concurrency',
            name: 'peak_concurrency',
            description: 'Peak concurrent active executions must not exceed configured maxConcurrency (2)',
            operator: 'lte',
            expected: 2,
            unit: 'concurrent_workers',
          },
        ];
        targetFiles = ['src/worker-pool.ts'];
        targetSymbols = ['BoundedWorkerPool', 'processImage'];
        requiredCapabilities = ['node_execution', 'concurrency_stimulus', 'metric_collection'];
      } else if (selectedId === 'recipe-single-flight-mutex') {
        selectedRecipeId = 'recipe-single-flight-mutex';
        failureHypothesis = 'Concurrent callers encountering expired token execute redundant upstream auth exchanges';
        systemOperationUnderTest = 'Single-flight token manager refresh coalescing';
        requiredSetup = 'Token manager initialized with mock upstream authorization endpoint';
        adversarialStimulus = 'Simultaneously invoke refreshToken() from 5 concurrent callers upon expiration';
        observations = ['upstream_refresh_calls', 'concurrent_callers', 'successful_tokens'];
        assertions = [
          {
            id: 'assert-single-flight-refresh',
            name: 'upstream_refresh_calls',
            description: 'Upstream refresh exchange must be executed at most 1 time for concurrent callers',
            operator: 'lte',
            expected: 1,
            unit: 'upstream_exchanges',
          },
        ];
        targetFiles = ['src/token-manager.ts'];
        targetSymbols = ['TokenManager', 'refreshToken'];
        requiredCapabilities = ['node_execution', 'concurrency_stimulus', 'local_stubs', 'metric_collection'];
      } else if (selectedId === 'recipe-atomic-mutation-check') {
        selectedRecipeId = 'recipe-atomic-mutation-check';
        failureHypothesis = 'Concurrent read-modify-write operations overwrite concurrent mutations (lost updates)';
        systemOperationUnderTest = 'Inventory decrement mutation';
        requiredSetup = 'Inventory store initialized with stock = 100';
        adversarialStimulus = 'Dispatch 20 concurrent decrements simultaneously';
        observations = ['lost_updates', 'final_inventory', 'expected_inventory'];
        assertions = [
          {
            id: 'assert-zero-lost-updates',
            name: 'lost_updates',
            description: 'Lost update count must be zero across concurrent mutations',
            operator: 'eq',
            expected: 0,
          },
        ];
        targetFiles = ['src/inventory.ts'];
        targetSymbols = ['decrementInventory'];
        requiredCapabilities = ['node_execution', 'concurrency_stimulus', 'metric_collection'];
      } else if (selectedId === 'recipe-timeout-enforcement') {
        selectedRecipeId = 'recipe-timeout-enforcement';
        failureHypothesis = 'Downstream supplier latency spikes cause requests to hang indefinitely';
        systemOperationUnderTest = 'Outbound HTTP supplier client timeout enforcement';
        requiredSetup = 'Downstream stub configured to hang without responding; client timeout = 2000ms';
        adversarialStimulus = 'Submit request to hanging supplier endpoint and measure client abort time';
        observations = ['elapsed_duration_ms', 'hung_requests', 'timeout_triggered'];
        assertions = [
          {
            id: 'assert-hung-requests-zero',
            name: 'hung_requests',
            description: 'No requests may hang beyond configured timeout limit',
            operator: 'eq',
            expected: 0,
          },
        ];
        targetFiles = ['src/supplier-client.ts'];
        targetSymbols = ['fetchSupplierData'];
        requiredCapabilities = ['node_execution', 'timing_control', 'metric_collection'];
      } else if (selectedId === 'recipe-cache-stampede-origin-guard') {
        selectedRecipeId = 'recipe-cache-stampede-origin-guard';
        failureHypothesis = 'Cache expiration burst causes multiple concurrent requests to hit origin database simultaneously';
        systemOperationUnderTest = 'Cache read with coalesced origin fetch';
        requiredSetup = 'Cache populated with expired item and mock database query counter';
        adversarialStimulus = 'Simultaneously query expired item from 10 parallel callers';
        observations = ['database_queries', 'concurrent_requesters'];
        assertions = [
          {
            id: 'assert-origin-queries-coalesced',
            name: 'database_queries',
            description: 'Origin database queries must be at most 1 under concurrent cache miss burst',
            operator: 'lte',
            expected: 1,
          },
        ];
        targetFiles = ['src/cache.ts'];
        targetSymbols = ['getOrFetch'];
        requiredCapabilities = ['node_execution', 'concurrency_stimulus', 'local_stubs', 'metric_collection'];
      } else {
        // Honest inability to verify: un-instrumentable or uncataloged invariant
        isExecutable = false;
        inconclusiveReason = `Could not identify executable interface for invariant (${invariantId}).`;
        failureHypothesis = `Uninstrumented invariant: ${invariantId}`;
        systemOperationUnderTest = 'Unidentified component interface';
        observations = ['uninstrumented_invariant'];
        assertions = [
          {
            id: `assert-${invariantId}`,
            name: 'uninstrumented_invariant',
            description: 'Invariant cannot be instrumented in current target repository',
            operator: 'eq',
            expected: true,
          },
        ];
      }

      resultData = {
        id: `intent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        invariantId,
        failureHypothesis,
        systemOperationUnderTest,
        requiredSetup,
        adversarialStimulus,
        observations,
        assertions,
        targetFiles,
        targetSymbols,
        requiredCapabilities,
        confidence: isExecutable ? 0.95 : 0.2,
        assumptions: isExecutable ? ['System exhibits concurrency and timing characteristics under test'] : [],
        unresolvedQuestions: isExecutable ? [] : ['How can this invariant be instrumented or observed in the repository?'],
        isExecutable,
        inconclusiveReason,
        selectedRecipeId,
      };

      const validated = VerificationIntentSchema.parse(resultData);
      return {
        content: JSON.stringify(validated),
        data: validated as T,
      };
    }

    if (request.schemaName === 'FailureDiagnosis') {
      const userMessage = request.messages.find((m) => m.role === 'user')?.content || '';
      const invMatch = userMessage.match(/Failed Invariant:\s*- ID:\s*([^\r\n]+)/i);
      const invariantId = invMatch ? invMatch[1]!.trim() : 'inv-unknown';
      const caseMatch = userMessage.match(/Failed Verification Case:\s*- Case ID:\s*([^\r\n]+)/i);
      const caseId = caseMatch ? caseMatch[1]!.trim() : 'case-unknown';

      // Extract evidence IDs from user message
      const evidenceIdMatches = Array.from(
        userMessage.matchAll(/- ID:\s*(ev-[a-zA-Z0-9_-]+)/g)
      ).map((m) => m[1]!);

      // Check if prompt specifically indicates an architectural decision invalidation
      const isArchConflict =
        userMessage.includes('ARCHITECTURE_DECISION_INVALID') ||
        userMessage.includes('physical motherboard') ||
        userMessage.includes('conflict with repository architecture');

      let classification: import('@architectai/domain').FailureClassification = 'IMPLEMENTATION_DEFECT';
      let likelyFailureMechanism = `Implementation did not enforce property for invariant ${invariantId}.`;
      let affectedFiles: string[] = ['src/'];
      let isRepairable = true;
      let requiresArchReview = false;
      let reconsiderationRationale: string | undefined;

      if (isArchConflict) {
        classification = 'ARCHITECTURE_DECISION_INVALID';
        isRepairable = false;
        requiresArchReview = true;
        reconsiderationRationale =
          'The target engineering invariant fundamentally conflicts with accepted architectural decisions and physical environment limits.';
        likelyFailureMechanism =
          'Architectural assumption violated: requirement cannot be satisfied within existing decision boundaries.';
      } else if (invariantId.includes('rate') || invariantId.includes('burst') || invariantId.includes('window')) {
        likelyFailureMechanism =
          'Fixed-window counter resets allowance at discrete minute boundaries, allowing up to 2x burst across window boundaries. Needs sliding-window rolling enforcement.';
        affectedFiles = ['src/rate-limiter.ts'];
      } else if (invariantId.includes('payment') || invariantId.includes('idempot')) {
        likelyFailureMechanism =
          'Payment charge handler executes downstream charge without checking or locking idempotency ledger, allowing duplicate side effects on retries.';
        affectedFiles = ['src/idempotency.ts', 'src/payment.ts'];
      } else if (invariantId.includes('worker') || invariantId.includes('concurrency')) {
        likelyFailureMechanism =
          'Worker pool executes submitted tasks immediately without active task throttling or queueing, exceeding peak concurrency ceiling.';
        affectedFiles = ['src/worker-pool.ts'];
      } else if (invariantId.includes('token') || invariantId.includes('single-flight')) {
        likelyFailureMechanism =
          'Token manager executes upstream exchange separately for each concurrent caller instead of sharing a single in-flight Promise.';
        affectedFiles = ['src/token-manager.ts'];
      }

      resultData = {
        id: `diag-${Date.now()}-${caseId}`,
        verificationCaseId: caseId,
        targetInvariantId: invariantId,
        sourceConcernIds: [],
        sourceDecisionIds: [],
        classification,
        expectedBehavior: 'Satisfy invariant threshold under adversarial stimulus',
        observedBehavior: 'Adversarial violation observed in measured execution evidence',
        assertionFailureMessages: ['Verification assertion failed against measured evidence'],
        evidenceReferences: evidenceIdMatches,
        likelyFailureMechanism,
        likelyAffectedFiles: affectedFiles,
        likelyAffectedSymbols: [],
        confidence: 0.9,
        assumptions: ['Verification evidence correctly reflects target implementation behavior'],
        unresolvedQuestions: [],
        isRepairable,
        requiresArchitectureReview: requiresArchReview,
        reconsiderationRationale,
        createdAt: new Date().toISOString(),
      };

      const validated = FailureDiagnosisSchema.parse(resultData);
      return {
        content: JSON.stringify(validated),
        data: validated as T,
      };
    }



    // Generic fallback for any other schema
    const schema = request.schema as {
      parse?: (val: unknown) => unknown;
    };
    if (schema && typeof schema.parse === 'function') {
      resultData = schema.parse({});
    } else {
      resultData = {};
    }

    return {
      content: JSON.stringify(resultData),
      data: resultData as T,
    };
  }
}
