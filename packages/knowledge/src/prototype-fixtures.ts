import {
  EngineeringKnowledgeItem,
  WellKnownDimensions,
} from '@architectai/domain';
import {
  neutralFundamentalKnowledge,
  neutralFailurePatternKnowledge,
  neutralTechnologySpecificKnowledge,
} from './fixtures.js';

// --- Scenario 1: API Rate Limiting Boundary Behavior ---

export const rateLimitFundamental: EngineeringKnowledgeItem = {
  id: 'fundamental-bounded-throughput',
  levels: ['fundamental'],
  title: 'Bounded Throughput and Arrival Rate Limits',
  description:
    'Every physical computing system has an upper bound on concurrent request processing capacity. Exceeding arrival rate thresholds causes latency degradation, buffer saturation, and service denial unless ingress traffic is governed.',
  dimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.TIME_WINDOW,
  ],
  triggers: ['unbounded client request volume', 'bursty incoming API traffic'],
  failureMechanisms: [
    'System throughput collapse',
    'Denial of service for fair clients',
  ],
  mitigations: [
    'Enforce rate limiting on client identity',
    'Windowed arrival rate quotas',
  ],
  verificationIdeas: [
    'Transmit bursts exceeding target quota and verify rejection percentage',
  ],
  evidence: [
    {
      id: 'ev-rl-fund-01',
      sourceType: 'manual_analysis',
      title: 'Analytical Model: Arrival Rate Boundaries and Queuing Limits',
      excerptOrClaim:
        'Without arrival rate limiting, unbounded client arrival rate causes queue growth and unbounded response latency.',
      qualityNotes: 'Synthetic analytical model for throughput bounds.',
      confidenceScore: 0.92,
    },
  ],
  relationships: [],
};

export const fixedWindowBurstPattern: EngineeringKnowledgeItem = {
  id: 'pattern-fixed-window-burst',
  levels: ['failure_pattern'],
  title: 'Fixed-Window Boundary Burst (2x Rate Spike)',
  description:
    'Fixed-window rate limiters reset their counters at discrete time boundaries. A client transmitting a full quota at the end of window N and another full quota at the start of window N+1 generates a 2x rate burst in a single window duration, potentially overwhelming backend resources.',
  dimensions: [
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.CONCURRENCY,
  ],
  triggers: [
    'clients synchronizing requests around minute or second clock boundaries',
    'naive fixed-window counter resets',
  ],
  failureMechanisms: [
    'Backend saturation from 2x rate spike across window boundary',
    'False compliance with nominal rate specification',
  ],
  mitigations: [
    'Sliding window counter or log algorithm',
    'Token bucket or leaky bucket algorithm with continuous refill',
  ],
  verificationIdeas: [
    'Send quota burst at timestamp T - 100ms and another quota at T + 100ms, measuring total requests admitted within a 1-minute rolling window',
  ],
  evidence: [
    {
      id: 'ev-rl-pattern-01',
      sourceType: 'manual_analysis',
      title: 'Pattern Analysis: Discrete Window Reset Burst Anomaly',
      excerptOrClaim:
        'Discrete window resets permit 2x configured capacity during the interval spanning window boundaries.',
      qualityNotes: 'Synthetic analysis of fixed-window rate limiter edge cases.',
      confidenceScore: 0.9,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-bounded-throughput',
      relationshipType: 'specializes',
      description: 'Concrete windowing failure mode for bounded arrival rates.',
    },
  ],
};

export const redisSlidingWindowTech: EngineeringKnowledgeItem = {
  id: 'tech-redis-sliding-window',
  levels: ['technology_specific'],
  title: 'Redis Sliding Window Log & Token Bucket Rate Limiting',
  description:
    'In distributed web architectures, multiple application nodes coordinate rate limits using Redis atomic operations (Lua script or sorted set ZSET timestamps) to compute rolling window usage and return HTTP 429 Too Many Requests with Retry-After headers.',
  dimensions: [
    WellKnownDimensions.SHARED_MUTABLE_STATE,
    WellKnownDimensions.TIME_WINDOW,
  ],
  triggers: [
    'multi-instance API gateway requiring coordinated client rate limits',
    'HTTP 429 response enforcement',
  ],
  failureMechanisms: [
    'Redis round-trip latency overhead adding latency to every API call',
    'Race conditions when counter check and increment are not atomic',
  ],
  mitigations: [
    'Atomic Redis Lua script combining check and increment',
    'Local in-memory sliding cache with periodic synchronization',
  ],
  verificationIdeas: [
    'Simulate multi-node API cluster querying shared Redis instance under concurrent client bursts',
  ],
  evidence: [
    {
      id: 'ev-rl-redis-01',
      sourceType: 'official_documentation',
      title: 'Redis Documentation: Generic Rate Limiter with Lua Scripting',
      technology: 'Redis',
      sourceUrlOrIdentifier: 'https://redis.io/docs/latest/develop/use/patterns/rate-limiter/',
      versionApplicability: '>=6.0.0',
      excerptOrClaim:
        'Atomic execution in Redis using Lua scripts ensures that check and decrement operations are isolated against concurrent clients.',
      qualityNotes: 'Authoritative Redis pattern guide for atomic rate limiting.',
      confidenceScore: 0.95,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-fixed-window-burst',
      relationshipType: 'mitigates',
      description: 'Provides rolling sliding window algorithm avoiding boundary bursts.',
    },
  ],
  technologyMetadata: {
    technology: 'Redis',
    runtimeEnvironment: 'In-Memory Key-Value Store',
    versionRange: '>=6.0.0',
  },
};

// --- Scenario 2: Concurrent Access Token Refresh ---

export const sharedMutableStateFundamental: EngineeringKnowledgeItem = {
  id: 'fundamental-shared-mutable-state',
  levels: ['fundamental'],
  title: 'Shared Mutable State and Concurrent State Transitions',
  description:
    'When multiple asynchronous execution contexts share mutable state without coordination, interleaved read-modify-write operations produce non-deterministic state transitions and race conditions.',
  dimensions: [
    WellKnownDimensions.SHARED_MUTABLE_STATE,
    WellKnownDimensions.CONCURRENCY,
  ],
  triggers: [
    'multiple asynchronous tasks modifying shared session, token, or counter state',
  ],
  failureMechanisms: [
    'Race condition producing stale or invalidated state',
    'Lost updates and unexpected session termination',
  ],
  mitigations: [
    'Mutual exclusion (mutex) locks',
    'Single-flight request coalescing',
    'Atomic compare-and-swap operations',
  ],
  verificationIdeas: [
    'Execute 50 concurrent requests needing state transition simultaneously and assert exactly one transition executes',
  ],
  evidence: [
    {
      id: 'ev-shared-state-01',
      sourceType: 'manual_analysis',
      title: 'Concurrency Analysis: Uncoordinated Asynchronous State Transitions',
      excerptOrClaim:
        'Concurrent uncoordinated execution flows sharing state experience race hazards during non-atomic transitions.',
      qualityNotes: 'Theoretical concurrency foundation.',
      confidenceScore: 0.94,
    },
  ],
  relationships: [],
};

export const tokenRefreshRacePattern: EngineeringKnowledgeItem = {
  id: 'pattern-token-refresh-race',
  levels: ['failure_pattern'],
  title: 'Concurrent Access-Token Refresh Race & Sudden Invalidation',
  description:
    'When an access token expires while multiple client requests are executing in parallel, all concurrent requests detect the 401 response and independently attempt to refresh the token. Under OAuth 2.0 refresh token rotation, the first refresh revokes the old token, causing subsequent concurrent refresh requests to fail with invalid_grant, abruptly signing the user out.',
  dimensions: [
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.SHARED_MUTABLE_STATE,
    WellKnownDimensions.TRUST_BOUNDARY,
    WellKnownDimensions.RETRY,
  ],
  triggers: [
    'parallel HTTP requests executing when access token expires',
    'OAuth 2.0 refresh token rotation enabled',
  ],
  failureMechanisms: [
    'Unintended user logout and session invalidation',
    'Spike of redundant token refresh HTTP requests to auth server',
  ],
  mitigations: [
    'Single-flight token refresh promise deduplication',
    'Pre-emptive token refresh before expiration threshold',
    'Grace period on refreshed token revocation in auth server',
  ],
  verificationIdeas: [
    'Trigger 10 parallel API requests with expired access token; verify auth server receives exactly 1 refresh call and all 10 retry successfully',
  ],
  evidence: [
    {
      id: 'ev-token-pattern-01',
      sourceType: 'manual_analysis',
      title: 'OAuth 2.0 Client Concurrency Race Analysis',
      excerptOrClaim:
        'Parallel 401 responses trigger competing refresh calls, resulting in token rotation race invalidations without client-side locking.',
      qualityNotes: 'Synthetic analysis of OAuth2 client token synchronization.',
      confidenceScore: 0.9,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-shared-mutable-state',
      relationshipType: 'specializes',
      description: 'Manifests shared state mutation race in authentication tokens.',
    },
  ],
};

export const singleFlightTokenRefreshTech: EngineeringKnowledgeItem = {
  id: 'tech-single-flight-token-refresh',
  levels: ['technology_specific'],
  title: 'Single-Flight Mutex Locking in HTTP Client Interceptors',
  description:
    'In JavaScript/TypeScript HTTP clients (Fetch or Axios), an asynchronous interceptor queue or shared Promise reference coalesces concurrent 401 errors into a single in-flight refresh request. Pending requests wait on the single promise and re-issue with the new token.',
  dimensions: [
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.SHARED_MUTABLE_STATE,
  ],
  triggers: [
    'Axios or Fetch HTTP interceptors managing JWT or OAuth2 tokens',
  ],
  failureMechanisms: [
    'Deadlock if the refresh request itself triggers the 401 interceptor',
    'Stuck promise chain if refresh fails and does not reject waiting callers',
  ],
  mitigations: [
    'Clear shared refresh promise in finally block',
    'Bypass 401 interceptor on the refresh endpoint itself',
  ],
  verificationIdeas: [
    'Simulate network latency on refresh endpoint while launching 20 parallel client calls',
  ],
  evidence: [
    {
      id: 'ev-single-flight-01',
      sourceType: 'manual_analysis',
      title: 'HTTP Client Architecture: Interceptor Promise Coalescing',
      excerptOrClaim:
        'Maintaining a module-scoped refreshPromise reference allows concurrent callers to attach to the in-flight resolution.',
      qualityNotes: 'Client architecture pattern specification.',
      confidenceScore: 0.92,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-token-refresh-race',
      relationshipType: 'mitigates',
      description: 'Eliminates duplicate concurrent refresh calls via Promise coalescing.',
    },
  ],
  technologyMetadata: {
    technology: 'TypeScript',
    runtimeEnvironment: 'Browser / Node.js HTTP Client',
    versionRange: 'ES2020+',
  },
};

// --- Scenario 3: Database Connection Exhaustion ---

export const finiteConnectionsFundamental: EngineeringKnowledgeItem = {
  id: 'fundamental-finite-connection-capacity',
  levels: ['fundamental'],
  title: 'Finite Connection Capacity and Socket Allocation Bounds',
  description:
    'Network connections and file descriptors are bounded system resources. Operating systems and database servers enforce maximum open connection limits. Exceeding connection thresholds exhausts process file descriptors and socket pools.',
  dimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.DEPENDENCY,
  ],
  triggers: ['high concurrent request spikes', 'unpooled database connection creation'],
  failureMechanisms: [
    'Fatal socket allocation error (EMFILE/ENFILE)',
    'Database refusal of new client connections',
  ],
  mitigations: [
    'Fixed-size connection pool with wait timeouts',
    'Connection multiplexing proxies',
  ],
  verificationIdeas: [
    'Spawn connections past pool maximum and measure connection rejection latency',
  ],
  evidence: [
    {
      id: 'ev-conn-fund-01',
      sourceType: 'manual_analysis',
      title: 'Operating System Resource Bounds: Socket Descriptors',
      excerptOrClaim:
        'File descriptor and socket limits impose strict physical boundaries on concurrent transport connections.',
      qualityNotes: 'Systems engineering resource constraints model.',
      confidenceScore: 0.95,
    },
  ],
  relationships: [],
};

export const dbPoolExhaustionPattern: EngineeringKnowledgeItem = {
  id: 'pattern-db-connection-pool-exhaustion',
  levels: ['failure_pattern'],
  title: 'Database Connection Pool Exhaustion Under Query Latency Spikes',
  description:
    'When database queries suffer latency degradation (e.g. table lock, missing index, CPU spike), client connections remain held longer. The connection pool empties rapidly, causing incoming requests to block waiting for an available connection until pool timeout exceptions cascade across the service.',
  dimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.DEPENDENCY,
    WellKnownDimensions.CONCURRENCY,
  ],
  triggers: [
    'slow queries holding connections for seconds',
    'connection pool max size too low for burst traffic',
  ],
  failureMechanisms: [
    'Connection pool timeout errors across all endpoints',
    'Thread pool exhaustion in web servers waiting on db connections',
  ],
  mitigations: [
    'Tune connection pool size using Little\'s Law (Target QPS * P99 Latency)',
    'Enforce aggressive query statement timeouts (statement_timeout)',
    'Separate read-replica connection pools from write pools',
  ],
  verificationIdeas: [
    'Inject 2-second sleep in a database query and send 100 concurrent requests; verify pool timeout behavior and error rate',
  ],
  evidence: [
    {
      id: 'ev-pool-pattern-01',
      sourceType: 'manual_analysis',
      title: 'Failure Mode Analysis: Connection Pool Starvation Cascade',
      excerptOrClaim:
        'Downstream latency increases connection hold duration, exhausting available pool slots and starving unrelated requests.',
      qualityNotes: 'Database reliability pattern analysis.',
      confidenceScore: 0.91,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-finite-connection-capacity',
      relationshipType: 'specializes',
      description: 'Pool-level manifestation of finite connection bounds.',
    },
  ],
};

export const postgresqlPgBouncerTech: EngineeringKnowledgeItem = {
  id: 'tech-postgresql-pgbouncer-pool',
  levels: ['technology_specific'],
  title: 'PostgreSQL max_connections & PgBouncer Transaction Pooling',
  description:
    'PostgreSQL forks a dedicated OS backend process for each connection, consuming 5-10MB of RAM per connection. Setting max_connections above a few hundred degrades CPU cache and context-switching performance. PgBouncer transaction-mode pooling decouples thousands of client connections from a small pool of database backends.',
  dimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.DEPENDENCY,
  ],
  triggers: [
    'PostgreSQL server encountering connection count limits',
    'Serverless or multi-container architectures creating hundreds of database connections',
  ],
  failureMechanisms: [
    'PostgreSQL out of memory or process exhaustion from excess connections',
    'Prepared statements and session state lost in transaction pooling mode',
  ],
  mitigations: [
    'Deploy PgBouncer in transaction pooling mode',
    'Configure PostgreSQL statement_timeout and idle_in_transaction_session_timeout',
  ],
  verificationIdeas: [
    'Simulate 1,000 concurrent client connections through PgBouncer pointing to PostgreSQL with max_connections=50',
  ],
  evidence: [
    {
      id: 'ev-pg-pool-01',
      sourceType: 'official_documentation',
      title: 'PostgreSQL Documentation: Managing Connections and Resources',
      technology: 'PostgreSQL',
      sourceUrlOrIdentifier: 'https://www.postgresql.org/docs/current/runtime-config-connection.html',
      versionApplicability: '>=12.0',
      excerptOrClaim:
        'Determines the maximum number of concurrent connections to the database server. Each connection consumes shared memory and process resources.',
      qualityNotes: 'Authoritative PostgreSQL documentation on connection limits.',
      confidenceScore: 0.96,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-db-connection-pool-exhaustion',
      relationshipType: 'mitigates',
      description: 'Transaction-level pooling avoids PostgreSQL connection exhaustion.',
    },
  ],
  technologyMetadata: {
    technology: 'PostgreSQL',
    runtimeEnvironment: 'Relational Database Engine',
    versionRange: '>=12.0',
  },
};

// --- Scenario 4: Duplicate Payment / Side Effect ---

export const sideEffectNonIdempotencyFundamental: EngineeringKnowledgeItem = {
  id: 'fundamental-side-effect-non-idempotency',
  levels: ['fundamental'],
  title: 'Side Effect Non-Idempotency in Distributed Operations',
  description:
    'Mutating operations across trust and network boundaries are inherently non-idempotent by default. When an operation alters state (such as charging a card or transferring funds), executing it multiple times produces duplicate cumulative side effects unless idempotency semantics are enforced.',
  dimensions: [
    WellKnownDimensions.SIDE_EFFECT,
    WellKnownDimensions.ORDERING,
  ],
  triggers: ['financial transactions', 'external third-party API mutations', 'resource creation'],
  failureMechanisms: [
    'Double charging customer accounts',
    'Duplicate resource creation in downstream systems',
  ],
  mitigations: [
    'Cryptographic or UUID idempotency keys',
    'Atomic duplicate detection before execution',
  ],
  verificationIdeas: [
    'Execute identical mutating payload twice with identical idempotency key and verify second call returns cached result without re-executing',
  ],
  evidence: [
    {
      id: 'ev-side-fund-01',
      sourceType: 'manual_analysis',
      title: 'Distributed Systems Invariant: Non-Idempotent Mutations',
      excerptOrClaim:
        'In the presence of network unreliability, non-idempotent operations cannot be safely retried without idempotency tokens.',
      qualityNotes: 'Distributed systems mathematical foundations.',
      confidenceScore: 0.95,
    },
  ],
  relationships: [],
};

export const duplicatePaymentRetryPattern: EngineeringKnowledgeItem = {
  id: 'pattern-duplicate-side-effect-retry',
  levels: ['failure_pattern'],
  title: 'Duplicate Payment / Side Effect on Network Timeout Retry',
  description:
    'When a client submits a payment request, the server executes the charge successfully, but the network drops the HTTP response or the client times out prematurely. If the client retries the request without an idempotency key, the server processes a second independent charge, producing a double-charge incident.',
  dimensions: [
    WellKnownDimensions.SIDE_EFFECT,
    WellKnownDimensions.RETRY,
    WellKnownDimensions.DEPENDENCY,
  ],
  triggers: [
    'network timeout during checkout or payment processing',
    'client-side automated retries on transient 504 Gateway Timeout',
  ],
  failureMechanisms: [
    'Duplicate financial charges and refund administrative overhead',
    'Inconsistent distributed database records',
  ],
  mitigations: [
    'Require Idempotency-Key header on all mutating payment endpoints',
    'Store request hash, status, and response in an atomic store with TTL',
  ],
  verificationIdeas: [
    'Send payment request, drop server response packet, immediately retry; assert charge executed once only',
  ],
  evidence: [
    {
      id: 'ev-dup-pattern-01',
      sourceType: 'manual_analysis',
      title: 'Payment Gateway Failure Analysis: Two-Phase Commit Absence',
      excerptOrClaim:
        'Packet loss on response delivery turns blind retries into duplicate execution events.',
      qualityNotes: 'Financial system integration reliability analysis.',
      confidenceScore: 0.93,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-side-effect-non-idempotency',
      relationshipType: 'specializes',
      description: 'Concrete manifestation of side-effect duplication under network retry.',
    },
  ],
};

export const idempotencyKeyHeaderTech: EngineeringKnowledgeItem = {
  id: 'tech-idempotency-key-header',
  levels: ['technology_specific'],
  title: 'IETF Idempotency-Key HTTP Specification and Atomic Database Storage',
  description:
    'Adopts the IETF draft standard Idempotency-Key header. The server performs an atomic transaction (e.g. INSERT ... ON CONFLICT DO NOTHING) on an idempotency table before processing. If a duplicate key is in-flight or completed, the server waits or returns the recorded response.',
  dimensions: [
    WellKnownDimensions.SIDE_EFFECT,
    WellKnownDimensions.PERSISTENCE,
  ],
  triggers: [
    'REST APIs performing financial mutations or resource creation',
  ],
  failureMechanisms: [
    'Re-using same idempotency key for different request payloads (payload mismatch)',
    'Race condition if duplicate check and insert are not executed in a single atomic transaction',
  ],
  mitigations: [
    'Verify SHA-256 hash of request body matches stored idempotency record',
    'Unique database index on (client_id, idempotency_key)',
  ],
  verificationIdeas: [
    'Simulate 10 simultaneous identical requests with matching Idempotency-Key; verify exactly 1 succeeds and 9 return 409 Conflict or identical payload',
  ],
  evidence: [
    {
      id: 'ev-idemp-ietf-01',
      sourceType: 'specification',
      title: 'IETF Draft: The Idempotency-Key HTTP Header Field',
      technology: 'HTTP',
      sourceUrlOrIdentifier: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/',
      excerptOrClaim:
        'The Idempotency-Key HTTP header field allows clients to safely retry requests without accidentally executing the same operation multiple times.',
      qualityNotes: 'Authoritative IETF specification draft.',
      confidenceScore: 0.96,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-duplicate-side-effect-retry',
      relationshipType: 'mitigates',
      description: 'Enforces idempotency at the HTTP and persistence layer.',
    },
  ],
  technologyMetadata: {
    technology: 'HTTP / PostgreSQL',
    runtimeEnvironment: 'REST API',
    versionRange: 'IETF Draft',
  },
};

// --- Scenario 5: Retry Amplification / Storm ---

export const failurePropagationFundamental: EngineeringKnowledgeItem = {
  id: 'fundamental-failure-propagation',
  levels: ['fundamental'],
  title: 'Failure Propagation and System Capacity Degradation',
  description:
    'In distributed dependency graphs, latency or error conditions in a downstream component propagate upstream. If upstream callers respond to degraded performance by increasing retry volume, the total system load increases while available capacity is diminishing.',
  dimensions: [
    WellKnownDimensions.DEPENDENCY,
    WellKnownDimensions.RETRY,
    WellKnownDimensions.BOUNDED_RESOURCE,
  ],
  triggers: ['transient errors in deep dependency chains', 'uncoordinated retry loops'],
  failureMechanisms: [
    'Cascading failure across the entire dependency graph',
    'Total collapse of downstream service',
  ],
  mitigations: [
    'Circuit breakers to fail fast when error thresholds are exceeded',
    'Token-bucket retry budgets at caller level',
  ],
  verificationIdeas: [
    'Throttle downstream service by 50% and observe whether upstream retry count amplifies load or sheds it',
  ],
  evidence: [
    {
      id: 'ev-fail-fund-01',
      sourceType: 'manual_analysis',
      title: 'System Dynamics: Positive Feedback Loops in Distributed Overload',
      excerptOrClaim:
        'Naively configured retries create positive feedback loops that amplify partial degradation into total system failure.',
      qualityNotes: 'Theoretical systems dynamics model.',
      confidenceScore: 0.92,
    },
  ],
  relationships: [],
};

export const retryAmplificationPattern: EngineeringKnowledgeItem = {
  id: 'pattern-retry-amplification-storm',
  levels: ['failure_pattern'],
  title: 'Retry Amplification Storm (Thundering Herd Cascade)',
  description:
    'When a microservice fails or slows down, multiple upstream callers retry simultaneously without delay or backoff. In multi-tier systems, retries multiply geometrically (N services retrying R times produces R^N load factor), creating an overwhelming thundering herd that keeps the dependency down indefinitely.',
  dimensions: [
    WellKnownDimensions.RETRY,
    WellKnownDimensions.SCALING_CONCENTRATION,
    WellKnownDimensions.DEPENDENCY,
    WellKnownDimensions.TIME_WINDOW,
  ],
  triggers: [
    'immediate retries without exponential backoff or jitter',
    'retries nested across multiple tiers of microservices',
  ],
  failureMechanisms: [
    'Service unable to recover after restarting because accumulated retry storm floods it immediately',
    'Resource exhaustion on client side holding open retry connections',
  ],
  mitigations: [
    'Exponential backoff with full jitter',
    'Limit total retries to 1 or 2 attempts maximum',
    'Global retry budget (e.g. maximum 10% of total requests may be retries)',
  ],
  verificationIdeas: [
    'Simulate 100 clients failing a request simultaneously; verify retry timestamps are uniformly distributed across time rather than synchronized',
  ],
  evidence: [
    {
      id: 'ev-retry-pattern-01',
      sourceType: 'manual_analysis',
      title: 'Reliability Engineering: Geometric Retry Expansion Analysis',
      excerptOrClaim:
        'Nested retries across N architectural layers multiply traffic exponentially under failure conditions.',
      qualityNotes: 'Reliability engineering analysis.',
      confidenceScore: 0.93,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-failure-propagation',
      relationshipType: 'specializes',
      description: 'Concrete failure pattern for retry amplification.',
    },
  ],
};

export const exponentialBackoffJitterTech: EngineeringKnowledgeItem = {
  id: 'tech-exponential-backoff-full-jitter',
  levels: ['technology_specific'],
  title: 'Exponential Backoff with Full Jitter & Circuit Breakers',
  description:
    'Implements Decorrelated Jitter / Full Jitter: wait_time = random_between(0, min(max_backoff, base * 2^attempt)). Coupled with a circuit breaker pattern (e.g.opossum in Node.js or Resilience4j in Java) that stops sending traffic to failing dependencies for a cooldown window.',
  dimensions: [
    WellKnownDimensions.RETRY,
    WellKnownDimensions.TIME_WINDOW,
  ],
  triggers: ['HTTP client or RPC client connecting to external services'],
  failureMechanisms: [
    'Failing to reset circuit breaker when dependency recovers',
    'Client timeouts firing before backoff delay elapses',
  ],
  mitigations: [
    'Half-open state probe requests in circuit breaker',
    'Bounded retry budget limiting retries to <= 10% of total request stream',
  ],
  verificationIdeas: [
    'Trigger 1,000 failed calls; assert retry distribution spreads across time and circuit breaker opens after 50 consecutive failures',
  ],
  evidence: [
    {
      id: 'ev-jitter-aws-01',
      sourceType: 'official_documentation',
      title: 'AWS Architecture Blog: Exponential Backoff And Jitter',
      technology: 'Distributed Systems',
      sourceUrlOrIdentifier: 'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/',
      excerptOrClaim:
        'Full Jitter significantly reduces the competitive load on recovering services compared to standard exponential backoff.',
      qualityNotes: 'Authoritative engineering guidance from AWS on backoff algorithms.',
      confidenceScore: 0.96,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-retry-amplification-storm',
      relationshipType: 'mitigates',
      description: 'Breaks synchronization of retrying clients to prevent retry storms.',
    },
  ],
  technologyMetadata: {
    technology: 'Distributed Systems / Node.js / Java',
    runtimeEnvironment: 'Client Networking Library',
  },
};

// --- Scenario 6: Cache Stampede / Dogpiling ---

export const cacheCoherenceFundamental: EngineeringKnowledgeItem = {
  id: 'fundamental-cache-coherence-ttl',
  levels: ['fundamental'],
  title: 'Temporal Cache Invalidation and Recomputation Invariants',
  description:
    'Caches trade data recency for reduced compute latency. When a cached item expires, recomputation requires access to origin storage. Under high concurrency, cache miss events must not trigger uncoordinated parallel recomputation.',
  dimensions: [
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.SHARED_MUTABLE_STATE,
  ],
  triggers: ['hot keys with high query volume and finite TTLs'],
  failureMechanisms: [
    'Origin database saturation when key expires',
  ],
  mitigations: [
    'Mutex-locked recomputation',
    'Early background refresh before expiration',
  ],
  verificationIdeas: [
    'Expire hot cache key under 5,000 QPS load and verify origin database receives exactly 1 query',
  ],
  evidence: [
    {
      id: 'ev-cache-fund-01',
      sourceType: 'manual_analysis',
      title: 'Caching Invariant: Recomputation Concurrency Bounds',
      excerptOrClaim:
        'Concurrently observed cache misses require single-flight coordination to protect origin storage.',
      qualityNotes: 'Fundamental caching theory.',
      confidenceScore: 0.93,
    },
  ],
  relationships: [],
};

export const cacheStampedePattern: EngineeringKnowledgeItem = {
  id: 'pattern-cache-stampede-dogpiling',
  levels: ['failure_pattern'],
  title: 'Cache Stampede / Dogpiling on Key Expiration',
  description:
    'When a heavily requested cache key expires (e.g. homepage catalog or trending data), thousands of concurrent read requests encounter a cache miss at the exact same millisecond. All requests simultaneously query the underlying database, overwhelming it with identical expensive queries.',
  dimensions: [
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.DEPENDENCY,
    WellKnownDimensions.SCALING_CONCENTRATION,
  ],
  triggers: [
    'hot cache key expiration with hundreds of concurrent readers',
    'sudden cache flush or node restart',
  ],
  failureMechanisms: [
    'Database CPU spikes to 100% causing cascading timeouts',
    'Total site outage from single expired key',
  ],
  mitigations: [
    'XFetch probabilistic early expiration algorithm',
    'Distributed lock (Redis SETNX) so only one worker recomputes',
    'Serve stale data while background worker refreshes (stale-while-revalidate)',
  ],
  verificationIdeas: [
    'Simulate 500 concurrent requests during key expiration; assert database queries <= 1',
  ],
  evidence: [
    {
      id: 'ev-stampede-01',
      sourceType: 'academic_paper',
      title: 'Optimal Probabilistic Cache Stampede Prevention',
      sourceUrlOrIdentifier: 'http://www.vldb.org/pvldb/vol8/p886-vldb2015-vattani.pdf',
      excerptOrClaim:
        'Probabilistic early expiration (XFetch) computes keys before expiry with probability proportional to compute cost.',
      qualityNotes: 'VLDB academic paper on cache stampede mitigation.',
      confidenceScore: 0.97,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-cache-coherence-ttl',
      relationshipType: 'specializes',
      description: 'Failure mode of uncoordinated cache recomputation.',
    },
  ],
};

export const xfetchTech: EngineeringKnowledgeItem = {
  id: 'tech-xfetch-probabilistic-early-expiration',
  levels: ['technology_specific'],
  title: 'Probabilistic Early Expiration (XFetch) & Redis Mutex Locking',
  description:
    'XFetch algorithm determines whether a worker should recompute a key before its TTL expires: delta * beta * log(rand()) + expiry_time <= current_time. If true, the worker recomputes in background while other readers continue getting the current cached value.',
  dimensions: [
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.CONCURRENCY,
  ],
  triggers: ['high-read Redis caches with expensive SQL/API aggregations'],
  failureMechanisms: [
    'Stale value served indefinitely if background refresh crashes',
  ],
  mitigations: [
    'Fallback hard expiration TTL and Redis distributed lock (SET NX EX)',
  ],
  verificationIdeas: [
    'Monitor background refresh triggers across 1,000 reads leading up to key TTL expiration',
  ],
  evidence: [
    {
      id: 'ev-xfetch-tech-01',
      sourceType: 'academic_paper',
      title: 'VLDB XFetch Algorithm Specification',
      technology: 'Redis / In-Memory Cache',
      sourceUrlOrIdentifier: 'http://www.vldb.org/pvldb/vol8/p886-vldb2015-vattani.pdf',
      excerptOrClaim:
        'The XFetch algorithm completely eliminates cache stampede under arbitrary read concurrency with minimal compute overhead.',
      qualityNotes: 'Authoritative algorithm reference.',
      confidenceScore: 0.95,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-cache-stampede-dogpiling',
      relationshipType: 'mitigates',
      description: 'Prevents dogpiling by probabilistically refreshing keys prior to expiry.',
    },
  ],
  technologyMetadata: {
    technology: 'Redis',
    runtimeEnvironment: 'In-Memory Cache / Client Library',
  },
};

// --- Scenario 7: Duplicate Message Processing in Queues ---

export const atLeastOnceFundamental: EngineeringKnowledgeItem = {
  id: 'fundamental-at-least-once-delivery',
  levels: ['fundamental'],
  title: 'At-Least-Once Delivery Semantics in Distributed Queues',
  description:
    'Due to network unreliability and consumer failure detection delays, distributed message systems guarantee at-least-once delivery, not exactly-once delivery. Duplicate message delivery is an expected normal operating state, requiring consumer-side idempotency.',
  dimensions: [
    WellKnownDimensions.ORDERING,
    WellKnownDimensions.SIDE_EFFECT,
  ],
  triggers: ['distributed message brokers (Kafka, RabbitMQ, SQS)', 'worker node restarts'],
  failureMechanisms: [
    'Processing identical payload multiple times causing state corruption',
  ],
  mitigations: [
    'Idempotent consumer handlers with deduplication stores',
    'Transactional outbox pattern',
  ],
  verificationIdeas: [
    'Publish message twice with identical message ID; verify processing logic executes once only',
  ],
  evidence: [
    {
      id: 'ev-queue-fund-01',
      sourceType: 'manual_analysis',
      title: 'Distributed Queue Theorem: At-Least-Once Delivery Necessity',
      excerptOrClaim:
        'Two Generals problem prevents cost-effective exactly-once delivery over unreliable networks; consumers must handle duplicates.',
      qualityNotes: 'Distributed systems queue foundations.',
      confidenceScore: 0.95,
    },
  ],
  relationships: [],
};

export const duplicateQueueMessagePattern: EngineeringKnowledgeItem = {
  id: 'pattern-duplicate-queue-message-delivery',
  levels: ['failure_pattern'],
  title: 'Duplicate Message Processing on Consumer Timeout or Rebalance',
  description:
    'When a message processing takes longer than the queue visibility timeout (in SQS) or a consumer group rebalance occurs (in Kafka), the broker assumes the consumer crashed and redelivers the message to a second consumer while the first is still running, causing duplicate concurrent execution.',
  dimensions: [
    WellKnownDimensions.ORDERING,
    WellKnownDimensions.SIDE_EFFECT,
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.TIME_WINDOW,
  ],
  triggers: [
    'slow worker exceeding queue ack timeout / visibility timeout',
    'Kafka consumer group rebalance during deployment',
  ],
  failureMechanisms: [
    'Duplicate side effects executed concurrently by two workers on same event',
    'Out of order updates overwriting newer state',
  ],
  mitigations: [
    'Message deduplication table with unique constraint on message_id',
    'Extend visibility timeout / heartbeat dynamically during long processing',
  ],
  verificationIdeas: [
    'Simulate worker pausing for 60 seconds; verify broker redelivers and second worker detects duplicate before executing side effect',
  ],
  evidence: [
    {
      id: 'ev-dup-queue-01',
      sourceType: 'manual_analysis',
      title: 'Message Queue Failure Analysis: Visibility Timeout Expiry',
      excerptOrClaim:
        'Exceeding message visibility timeout results in duplicate delivery and concurrent execution hazards.',
      qualityNotes: 'Queueing system architecture analysis.',
      confidenceScore: 0.92,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-at-least-once-delivery',
      relationshipType: 'specializes',
      description: 'Concrete manifestation of queue duplicate redelivery.',
    },
  ],
};

export const transactionalOutboxTech: EngineeringKnowledgeItem = {
  id: 'tech-transactional-outbox-dedup',
  levels: ['technology_specific'],
  title: 'Transactional Outbox & Inbound Message Deduplication Store',
  description:
    'In SQL databases, consumers maintain an inbox/dedup table. Within the business transaction: INSERT INTO processed_messages (message_id, created_at) VALUES ($1, NOW()) ON CONFLICT (message_id) DO NOTHING. If zero rows inserted, the transaction rolls back or skips execution.',
  dimensions: [
    WellKnownDimensions.PERSISTENCE,
    WellKnownDimensions.SIDE_EFFECT,
  ],
  triggers: ['Kafka, RabbitMQ, or AWS SQS message processing consumers in relational DB stacks'],
  failureMechanisms: [
    'Deduplication table unbounded growth without partition cleanup TTL',
  ],
  mitigations: [
    'Partitioned dedup table with automated retention cleanup',
  ],
  verificationIdeas: [
    'Send duplicate message batches; assert processed_messages table prevents duplicate domain side-effects',
  ],
  evidence: [
    {
      id: 'ev-outbox-tech-01',
      sourceType: 'manual_analysis',
      title: 'Enterprise Integration Patterns: Idempotent Consumer & Outbox',
      technology: 'PostgreSQL / Relational Database',
      excerptOrClaim:
        'Atomically recording processed message identifiers in the business database transaction ensures exact logical deduplication.',
      qualityNotes: 'Standard enterprise integration architectural pattern.',
      confidenceScore: 0.94,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-duplicate-queue-message-delivery',
      relationshipType: 'mitigates',
      description: 'Guarantees deduplication within consumer transaction.',
    },
  ],
  technologyMetadata: {
    technology: 'PostgreSQL / Kafka',
    runtimeEnvironment: 'Relational DB Transaction Engine',
  },
};

// --- Scenario 8: Missing Dependency / Network Timeout ---

export const unboundedWaitingFundamental: EngineeringKnowledgeItem = {
  id: 'fundamental-unbounded-waiting-failure',
  levels: ['fundamental'],
  title: 'Unbounded Waiting and Asynchronous Network Boundaries',
  description:
    'Network communication is inherently unreliable and asynchronous. Sockets without configured deadlines or timeouts will wait indefinitely if intermediate routers or upstream servers drop packets silently without sending TCP RST or FIN packets.',
  dimensions: [
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.DEPENDENCY,
  ],
  triggers: ['outbound HTTP or RPC requests to external dependencies'],
  failureMechanisms: [
    'Thread pool or socket starvation',
    'Process hangs indefinitely with zero throughput',
  ],
  mitigations: [
    'Strict connect, read, and global execution timeouts on every network call',
  ],
  verificationIdeas: [
    'Route outbound request to non-responsive blackhole IP and verify socket aborts within configured timeout',
  ],
  evidence: [
    {
      id: 'ev-timeout-fund-01',
      sourceType: 'manual_analysis',
      title: 'Networking Invariant: Packet Loss Indistinguishable from Server Hang',
      excerptOrClaim:
        'Silent packet drops without explicit timeouts lead to infinite blocking on TCP socket read calls.',
      qualityNotes: 'TCP/IP networking theoretical principles.',
      confidenceScore: 0.95,
    },
  ],
  relationships: [],
};

export const missingTimeoutHangPattern: EngineeringKnowledgeItem = {
  id: 'pattern-missing-network-timeout-hang',
  levels: ['failure_pattern'],
  title: 'Socket Hang & Thread Pool Depletion on Missing Timeout',
  description:
    'Default HTTP client configurations in many runtimes default to no timeout (infinite). When an external vendor or internal microservice experiences a network freeze, calling threads hang indefinitely in TCP read loops. The thread pool depletes, causing the caller to stop serving all traffic.',
  dimensions: [
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.DEPENDENCY,
  ],
  triggers: [
    'unconfigured default HTTP client timeouts',
    'third-party API degradation with dropped TCP packets',
  ],
  failureMechanisms: [
    'Complete web application freeze',
    'Health check failures causing orchestrators (Kubernetes) to restart healthy nodes',
  ],
  mitigations: [
    'Fail fast with 3-tier timeouts: connect timeout (e.g. 1s), read timeout (e.g. 5s), overall deadline (e.g. 10s)',
  ],
  verificationIdeas: [
    'Configure mock server to accept TCP handshake but never send response bytes; assert client terminates within 5000ms',
  ],
  evidence: [
    {
      id: 'ev-timeout-pattern-01',
      sourceType: 'manual_analysis',
      title: 'Incident Pattern: Default Timeout Thread Exhaustion',
      excerptOrClaim:
        'Unbounded read timeouts convert third-party network stalls into total caller paralysis.',
      qualityNotes: 'Site reliability engineering failure mode review.',
      confidenceScore: 0.93,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-unbounded-waiting-failure',
      relationshipType: 'specializes',
      description: 'Thread pool failure pattern resulting from unbounded waiting.',
    },
  ],
};

export const httpClientTimeoutTech: EngineeringKnowledgeItem = {
  id: 'tech-http-connect-read-deadline-timeouts',
  levels: ['technology_specific'],
  title: 'Explicit Connect, Read, and Request Deadline Timeouts',
  description:
    'In modern HTTP runtimes, callers configure AbortSignal.timeout(ms) in Fetch or connectTimeout/headersTimeout/bodyTimeout in Node.js undici / axios, enforcing discrete deadlines across transport stages.',
  dimensions: [
    WellKnownDimensions.TIME_WINDOW,
    WellKnownDimensions.DEPENDENCY,
  ],
  triggers: ['Node.js HTTP clients (Fetch, Axios, Undici) calling microservices or partner APIs'],
  failureMechanisms: [
    'Catching timeout error and retrying without backoff, magnifying load',
  ],
  mitigations: [
    'Structured AbortSignal cancellation and fallback responses',
  ],
  verificationIdeas: [
    'Test with AbortSignal.timeout(500) against slow mock and verify AbortError is raised in exactly 500ms',
  ],
  evidence: [
    {
      id: 'ev-timeout-tech-01',
      sourceType: 'official_documentation',
      title: 'Node.js Documentation: AbortSignal.timeout() API',
      technology: 'Node.js',
      sourceUrlOrIdentifier: 'https://nodejs.org/api/globals.html#abortsignaltimeoutdelay',
      versionApplicability: '>=17.3.0',
      excerptOrClaim:
        'Returns an AbortSignal that will automatically abort after a specified number of milliseconds.',
      qualityNotes: 'Official Node.js global API documentation for timeout signals.',
      confidenceScore: 0.97,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-missing-network-timeout-hang',
      relationshipType: 'mitigates',
      description: 'Enforces deterministic cancellation bounds on network calls.',
    },
  ],
  technologyMetadata: {
    technology: 'Node.js',
    runtimeEnvironment: 'V8 Engine / Web Standards',
    versionRange: '>=17.3.0',
  },
};

// --- Scenario 9: Concurrent Lost-Update Race ---

export const readModifyWriteFundamental: EngineeringKnowledgeItem = {
  id: 'fundamental-read-modify-write-atomicity',
  levels: ['fundamental'],
  title: 'Read-Modify-Write Atomicity and Isolation Boundaries',
  description:
    'Transactions that read a record into application memory, perform a calculation, and write the updated state back to persistence without row locks or version checks are vulnerable to lost updates. If concurrent transactions interleave, the earlier write is completely obliterated.',
  dimensions: [
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.SHARED_MUTABLE_STATE,
  ],
  triggers: ['updating user balances, inventory counts, or document state under concurrency'],
  failureMechanisms: [
    'Silent data loss and financial discrepancy',
    'Race conditions that do not produce database errors',
  ],
  mitigations: [
    'Optimistic concurrency control with version column',
    'Pessimistic locking with SELECT ... FOR UPDATE',
    'Atomic in-database increments: UPDATE ... SET count = count - 1',
  ],
  verificationIdeas: [
    'Launch 10 concurrent threads decrementing inventory from 10; assert inventory reaches 0 and not 9',
  ],
  evidence: [
    {
      id: 'ev-rmw-fund-01',
      sourceType: 'manual_analysis',
      title: 'Database Systems Theory: Read-Modify-Write Anomaly (ANSI SQL)',
      excerptOrClaim:
        'Standard Read Committed isolation does not prevent lost updates on uncoordinated read-modify-write workflows.',
      qualityNotes: 'Relational database isolation level foundations.',
      confidenceScore: 0.96,
    },
  ],
  relationships: [],
};

export const lostUpdateRacePattern: EngineeringKnowledgeItem = {
  id: 'pattern-concurrent-lost-update-race',
  levels: ['failure_pattern'],
  title: 'Lost Update Race Condition in Application-Level Updates',
  description:
    'Two users or workers read an account balance of $100 simultaneously. Thread A deducts $20 (writing $80). Thread B deducts $30 (writing $70). Whichever write commits last overwrites the other, causing one deduction to vanish completely.',
  dimensions: [
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.SHARED_MUTABLE_STATE,
    WellKnownDimensions.PERSISTENCE,
  ],
  triggers: [
    'application logic reading record, modifying in memory, then saving back to database',
  ],
  failureMechanisms: [
    'Silent financial discrepancy and corrupted state',
    'Inventory over-selling in e-commerce applications',
  ],
  mitigations: [
    'Optimistic locking: UPDATE accounts SET balance = balance - 20, version = version + 1 WHERE id = 1 AND version = 5',
    'Pessimistic locking: SELECT balance FROM accounts WHERE id = 1 FOR UPDATE',
  ],
  verificationIdeas: [
    'Run 50 parallel balance updates and assert final balance matches exact sum of all deductions',
  ],
  evidence: [
    {
      id: 'ev-lost-pattern-01',
      sourceType: 'manual_analysis',
      title: 'Pattern Analysis: Lost Updates in Application Managed State',
      excerptOrClaim:
        'Application-tier read-modify-write operations fail under concurrent interleaving without persistence locks.',
      qualityNotes: 'Concurrency and database consistency pattern.',
      confidenceScore: 0.94,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-read-modify-write-atomicity',
      relationshipType: 'specializes',
      description: 'Application tier manifestation of lost-update anomaly.',
    },
  ],
};

export const optimisticLockingTech: EngineeringKnowledgeItem = {
  id: 'tech-optimistic-locking-version-check',
  levels: ['technology_specific'],
  title: 'Optimistic Concurrency Control via Version Column or SELECT FOR UPDATE',
  description:
    'In PostgreSQL or MySQL, records include a version integer or timestamp. Updates check version condition: UPDATE table SET val = $1, version = version + 1 WHERE id = $2 AND version = $3. If rows affected == 0, an OptimisticLockException is thrown, prompting the caller to retry with fresh data.',
  dimensions: [
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.PERSISTENCE,
  ],
  triggers: ['e-commerce inventory, account balances, document editing in relational databases'],
  failureMechanisms: [
    'High retry thrashing under extreme write contention on a single row',
  ],
  mitigations: [
    'Switch to atomic single-statement updates or queueing under high contention',
  ],
  verificationIdeas: [
    'Execute 20 concurrent updates targeting the same version; assert exactly 1 succeeds on initial try and 19 detect conflict',
  ],
  evidence: [
    {
      id: 'ev-opt-lock-01',
      sourceType: 'official_documentation',
      title: 'PostgreSQL Documentation: Explicit Locking & Concurrency Control',
      technology: 'PostgreSQL',
      sourceUrlOrIdentifier: 'https://www.postgresql.org/docs/current/explicit-locking.html',
      versionApplicability: '>=12.0',
      excerptOrClaim:
        'FOR UPDATE causes the rows retrieved by the SELECT statement to be locked as though for update, preventing them from being modified by other transactions until current transaction ends.',
      qualityNotes: 'Authoritative PostgreSQL documentation on row-level locking.',
      confidenceScore: 0.97,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-concurrent-lost-update-race',
      relationshipType: 'mitigates',
      description: 'Eliminates lost updates via optimistic conditional updates or row locks.',
    },
  ],
  technologyMetadata: {
    technology: 'PostgreSQL',
    runtimeEnvironment: 'Relational Database Engine',
    versionRange: '>=12.0',
  },
};

// --- Scenario 10: Image Processing Parallel Resource / CPU Exhaustion ---

export const parallelComputeExhaustionPattern: EngineeringKnowledgeItem = {
  id: 'pattern-parallel-compute-memory-exhaustion',
  levels: ['failure_pattern'],
  title: 'Unbounded Parallel Image / Compute Saturation & Process Death',
  description:
    'When processing many large uploaded media files simultaneously (e.g. resizing or converting images), concurrent unconstrained workers allocate gigabytes of decompressed bitmap memory in parallel. The process rapidly exceeds container memory limits and is killed by the OS OOM killer, dropping all pending tasks.',
  dimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.CONCURRENCY,
    WellKnownDimensions.TIME_WINDOW,
  ],
  triggers: [
    'parallel image upload endpoint accepting batch submissions',
    'Promise.all() executing unbounded image processing tasks',
  ],
  failureMechanisms: [
    'Sudden process SIGKILL by kernel OOM killer',
    'Thread pool exhaustion starving API responsiveness',
  ],
  mitigations: [
    'Concurrency-limited worker pool (e.g. p-limit or worker threads)',
    'Disk or stream-based memory-mapped buffers instead of full in-memory decompression',
    'Asynchronous queue-backed worker separation',
  ],
  verificationIdeas: [
    'Submit 100 simultaneous 15MB image processing jobs; verify concurrency is capped at worker limit and memory stays bounded',
  ],
  evidence: [
    {
      id: 'ev-img-pattern-01',
      sourceType: 'manual_analysis',
      title: 'Systems Analysis: Raw Bitmap Expansion and Memory Spikes',
      excerptOrClaim:
        'Compressed JPEG/PNG images expand to width * height * 4 bytes of raw RAM in memory during decompression; 100 parallel transforms easily exceed 4GB RAM.',
      qualityNotes: 'Media processing systems resource analysis.',
      confidenceScore: 0.95,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-bounded-memory-buffers',
      relationshipType: 'specializes',
      description: 'Compute and memory exhaustion manifestation in parallel image processing.',
    },
  ],
};

export const imageWorkerPoolTech: EngineeringKnowledgeItem = {
  id: 'tech-image-bounded-worker-pool',
  levels: ['technology_specific'],
  title: 'Bounded Concurrency Worker Threads & Stream Ingestion for Images',
  description:
    'In Node.js, uses sharp / libvips with native thread pool bounds, coupled with an explicit concurrency limiter (p-limit) or job queue (BullMQ/Redis) to ensure no more than N CPU cores perform image decompression simultaneously.',
  dimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.CONCURRENCY,
  ],
  triggers: ['Node.js backend with sharp or libvips processing uploaded media'],
  failureMechanisms: [
    'Memory fragmentation in native C++ libraries (libvips / glibc)',
  ],
  mitigations: [
    'Limit sharp concurrency to Math.max(1, os.cpus().length - 1)',
    'Stream uploads directly to temporary disk or S3 rather than buffering in Node.js RAM',
  ],
  verificationIdeas: [
    'Saturate image endpoint with 50 parallel image resize requests; monitor RSS memory stays flat',
  ],
  evidence: [
    {
      id: 'ev-sharp-tech-01',
      sourceType: 'official_documentation',
      title: 'sharp High Performance Node.js Image Processing Documentation',
      technology: 'Node.js / libvips',
      sourceUrlOrIdentifier: 'https://sharp.pixelplumbing.com/api-utility#concurrency',
      versionApplicability: '>=0.30.0',
      excerptOrClaim:
        'sharp.concurrency([threads]): Gets or sets the number of threads libvips uses for processing operations.',
      qualityNotes: 'Authoritative sharp library documentation.',
      confidenceScore: 0.96,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-parallel-compute-memory-exhaustion',
      relationshipType: 'mitigates',
      description: 'Bounds CPU and memory concurrency during parallel image operations.',
    },
  ],
  technologyMetadata: {
    technology: 'Node.js / sharp',
    runtimeEnvironment: 'V8 / libvips',
    versionRange: '>=0.30.0',
  },
};

// All prototype knowledge fixtures aggregated across the 10 scenarios
export const prototypeKnowledgeFixtures: EngineeringKnowledgeItem[] = [
  // Scenario 1: Memory / Resource Exhaustion (from bootstrap)
  neutralFundamentalKnowledge,
  neutralFailurePatternKnowledge,
  neutralTechnologySpecificKnowledge,

  // Scenario 2: Rate Limiting
  rateLimitFundamental,
  fixedWindowBurstPattern,
  redisSlidingWindowTech,

  // Scenario 3: Token Refresh
  sharedMutableStateFundamental,
  tokenRefreshRacePattern,
  singleFlightTokenRefreshTech,

  // Scenario 4: Database Connection Exhaustion
  finiteConnectionsFundamental,
  dbPoolExhaustionPattern,
  postgresqlPgBouncerTech,

  // Scenario 5: Duplicate Payment / Side Effect
  sideEffectNonIdempotencyFundamental,
  duplicatePaymentRetryPattern,
  idempotencyKeyHeaderTech,

  // Scenario 6: Retry Amplification
  failurePropagationFundamental,
  retryAmplificationPattern,
  exponentialBackoffJitterTech,

  // Scenario 7: Cache Stampede
  cacheCoherenceFundamental,
  cacheStampedePattern,
  xfetchTech,

  // Scenario 8: Duplicate Queue Processing
  atLeastOnceFundamental,
  duplicateQueueMessagePattern,
  transactionalOutboxTech,

  // Scenario 9: Missing Dependency / Timeout
  unboundedWaitingFundamental,
  missingTimeoutHangPattern,
  httpClientTimeoutTech,

  // Scenario 10: Lost Update Race
  readModifyWriteFundamental,
  lostUpdateRacePattern,
  optimisticLockingTech,

  // Scenario 11 (Image processing resource exhaustion specialization)
  parallelComputeExhaustionPattern,
  imageWorkerPoolTech,
];
