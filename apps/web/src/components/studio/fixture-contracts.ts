// ArchitectAI Architecture Studio — Authoritative Fixture Engineering Contracts
// Three diverse, real-world architectural contracts grounded in decisions, invariants, concerns, and verification specs.
import type { EngineeringContract } from '@architectai/domain';
import { EngineeringContractSchema } from '@architectai/domain';

/**
 * Fixture 1: Multi-Replica API Rate Limiting
 * Intent: Edge rate limiting with atomic Redis sliding window to protect downstream compute from boundary burst defects.
 */
export const RATE_LIMITER_FIXTURE_CONTRACT: EngineeringContract = EngineeringContractSchema.parse({
  id: 'contract-rate-limiter',
  version: '1.2.0',
  requirement: {
    id: 'req-rate-limiter',
    rawIntent:
      'Build a multi-replica API ingress gateway with distributed sliding-window rate limiting using Redis atomic sorted sets to protect backend microservices from boundary spikes.',
    explicitConstraints: [
      'Strict quota limit of 100 requests per sliding 60-second window per tenant.',
      'Must return HTTP 429 Too Many Requests with standard Retry-After header on throttled requests.',
      'Modeled backend compute capacity is capped at 100 requests per minute.',
    ],
    declaredTechStack: ['Redis', 'Node.js', 'PostgreSQL', 'Envoy'],
    context: {
      title: 'Multi-Tenant Edge Rate Limiting with Distributed Sliding Window',
      businessGoal: 'Prevent downstream compute overload and defeat 2x boundary attack burst defects.',
    },
  },
  discoveredConcerns: [
    {
      id: 'concern-rl-oom',
      requirementId: 'req-rate-limiter',
      title: 'In-Memory Counter OOM & Memory Leakage',
      description: 'Local in-memory counter allocation causes worker OOM crashes under high tenant cardinality.',
      applicabilityReason: 'Tenant keys without TTL or bounded memory limits lead to process termination.',
      dimensions: ['bounded_resources', 'scaling_concentration'],
      supportingKnowledgeIds: ['kb-oom-leak-l2'],
      confidence: 0.95,
      assumptions: ['Tenant cardinality exceeds 10,000 active keys.'],
      unresolvedQuestions: [],
    },
    {
      id: 'concern-rl-boundary-defect',
      requirementId: 'req-rate-limiter',
      title: 'Fixed-Window Boundary Burst Amplification',
      description: 'Fixed-window counters allow 2x quota spike across the window boundary (e.g. 80 at t=59s, 80 at t=61s admits 160 requests).',
      applicabilityReason: 'Fixed window resets counters at integer boundary minutes regardless of recent arrival history.',
      dimensions: ['time_windows', 'failure_of_dependencies'],
      supportingKnowledgeIds: ['kb-boundary-burst-l2'],
      confidence: 0.98,
      assumptions: ['Attackers or automated jobs synchronize requests around boundary edges.'],
      unresolvedQuestions: [],
    },
    {
      id: 'concern-rl-distributed-race',
      requirementId: 'req-rate-limiter',
      title: 'Distributed Token Split-Brain & Lost Updates',
      description: 'Multi-instance gateway replicas racing on counter increments without atomic primitives allow excess traffic.',
      applicabilityReason: 'Non-atomic GET then SET operations result in lost updates during concurrency spikes.',
      dimensions: ['shared_mutable_state', 'concurrency'],
      supportingKnowledgeIds: ['kb-lost-update-l2'],
      confidence: 0.92,
      assumptions: ['Gateways run across multiple independent processes/containers.'],
      unresolvedQuestions: [],
    },
  ],
  decisions: [
    {
      id: 'dec-rl-algorithm',
      problemContext: 'Rate Limiting Algorithm & Boundary Defense',
      consideredOptions: [
        {
          id: 'opt-fixed-window',
          name: 'Fixed Window Counter',
          description: 'Integer modulo 60-second counter reset.',
          tradeoffs: 'Vulnerable to 2x burst defect across boundary seconds; admits 160 requests on 100 quota.',
        },
        {
          id: 'opt-sliding-window',
          name: 'Exact Sliding Window (Redis Sorted Set)',
          description: 'Atomic ZADD / ZREMRANGEBYSCORE keeping exact timestamp logs in sliding 60s window.',
          tradeoffs: 'Requires ~64 bytes per request record in Redis; strictly enforces 100 requests per 60s.',
        },
      ],
      selectedOptionId: 'opt-sliding-window',
      selectedOptionName: 'Exact Sliding Window (Redis Sorted Set)',
      rationale:
        'Sliding window with millisecond timestamp entries completely eliminates boundary burst amplification and guarantees downstream compute protection.',
      evidence: [],
      assumptions: ['Redis sorted set memory footprint is bounded by automatic expiration and eviction.'],
      risksAndTradeoffs: ['Network round-trip to Redis state store (~1.5ms per ingress evaluation).'],
      verificationRequirements: ['Verify 80 req at t=59s followed by 80 req at t=61s admits exactly 100 and throttles 60.'],
      reconsiderationTriggers: ['Tenant request volume exceeds 100k rps where token bucket approximation is required.'],
    },
    {
      id: 'dec-rl-redis-cluster',
      problemContext: 'Distributed State Synchronization',
      consideredOptions: [
        {
          id: 'opt-local-memory',
          name: 'Local Process In-Memory Map',
          description: 'Store counters in Node.js process heap.',
          tradeoffs: 'Does not synchronize across auto-scaled gateway instances; allows N x quota leaks.',
        },
        {
          id: 'opt-redis-sentinel',
          name: 'Centralized Redis Sentinel Cluster',
          description: 'Atomic distributed in-memory data store with automatic failover.',
          tradeoffs: 'Introduces a network dependency, but guarantees globally coherent quotas.',
        },
      ],
      selectedOptionId: 'opt-redis-sentinel',
      selectedOptionName: 'Centralized Redis Sentinel Cluster',
      rationale:
        'A shared Redis cluster provides atomic primitives and guarantees identical quota enforcement regardless of which gateway replica receives the request.',
      evidence: [],
      assumptions: ['Redis cluster network latency is < 2ms within the DMZ private network.'],
      risksAndTradeoffs: ['Gateway must have an explicit fail-closed or fail-open policy during Redis network partitions.'],
      verificationRequirements: ['Inject simulated Redis partition and verify fallback behavior.'],
      reconsiderationTriggers: [],
    },
    {
      id: 'dec-rl-gateway-tier',
      problemContext: 'Perimeter Ingress Gateway Filter',
      consideredOptions: [
        {
          id: 'opt-reverse-proxy',
          name: 'Edge Reverse Proxy Gateway',
          description: 'Inspects HTTP Authorization header and rate limits before routing to microservices.',
          tradeoffs: 'Central point of ingress routing; requires high throughput network interfaces.',
        },
      ],
      selectedOptionId: 'opt-reverse-proxy',
      selectedOptionName: 'Edge Reverse Proxy Gateway',
      rationale: 'Terminates public TLS connections and drops throttled 429 requests before reaching compute.',
      evidence: [],
      assumptions: ['Gateway processes requests statelessly.'],
      risksAndTradeoffs: [],
      verificationRequirements: ['Verify 429 status code includes Retry-After header with non-zero backoff.'],
      reconsiderationTriggers: [],
    },
    {
      id: 'dec-rl-downstream-compute',
      problemContext: 'Downstream Service Compute Isolation',
      consideredOptions: [
        {
          id: 'opt-node-cluster',
          name: 'Clustered Node.js Compute Services',
          description: 'Backend application workers sized for modeled capacity.',
          tradeoffs: 'Protected from boundary traffic spikes by upstream gateway.',
        },
      ],
      selectedOptionId: 'opt-node-cluster',
      selectedOptionName: 'Clustered Node.js Compute Services',
      rationale: 'Sized to sustain 100 requests per minute with P99 latency < 25ms.',
      evidence: [],
      assumptions: ['Compute processes CPU-bound workloads.'],
      risksAndTradeoffs: [],
      verificationRequirements: [],
      reconsiderationTriggers: [],
    },
    {
      id: 'dec-rl-primary-db',
      problemContext: 'Authoritative Persistent Relational Database',
      consideredOptions: [
        {
          id: 'opt-postgres-pool',
          name: 'PostgreSQL Relational DB with Connection Pooling',
          description: 'ACID storage with strict pool max connections.',
          tradeoffs: 'Shielded from connection exhaustion by upstream rate limiter.',
        },
      ],
      selectedOptionId: 'opt-postgres-pool',
      selectedOptionName: 'PostgreSQL Relational DB with Connection Pooling',
      rationale: 'Protects DB connection pool from exhaustion during public traffic floods.',
      evidence: [],
      assumptions: [],
      risksAndTradeoffs: [],
      verificationRequirements: [],
      reconsiderationTriggers: [],
    },
  ],
  invariants: [
    {
      id: 'inv-rl-sliding-quota',
      property: 'Admitted request rate must never exceed 100 requests in any rolling 60-second interval per tenant.',
      severity: 'critical',
      blocksCompletion: true,
      rationale: 'Exceeding 100 req/60s violates downstream service capacity ceiling.',
    },
    {
      id: 'inv-rl-429-backoff-header',
      property: 'All throttled responses must return HTTP status 429 and a valid Retry-After header.',
      severity: 'high',
      blocksCompletion: true,
      rationale: 'Allows cooperative clients to pace retries and prevent retry storm amplification.',
    },
    {
      id: 'inv-rl-redis-atomic-update',
      property: 'Sliding window timestamp insertions and quota evaluations must execute atomically without lost updates.',
      severity: 'critical',
      blocksCompletion: true,
      rationale: 'Concurrency races across gateway replicas must not permit unauthorized admissions.',
    },
  ],
  verificationSpecs: [
    {
      id: 'spec-rl-boundary-spike',
      target: 'inv-rl-sliding-quota',
      description: 'Inject 80 requests at t=59s and 80 requests at t=61s. Assert exactly 100 admitted and 60 rejected.',
      setup: 'Initialize sliding window engine with limit 100 / 60s at virtual clock t=50s.',
      action: 'Dispatch synchronized boundary burst across virtual seconds 59 and 61.',
      expectedProperty: 'Exact admitted count = 100, exact throttled count = 60, downstream load capped at 100%.',
      evidenceToCollect: ['virtual_time_ms', 'admitted_count', 'throttled_count', 'status_codes'],
      isAutomatable: true,
    },
    {
      id: 'spec-rl-retry-after-header',
      target: 'inv-rl-429-backoff-header',
      description: 'Assert throttled response contains numeric Retry-After header with valid integer seconds >= 1.',
      setup: 'Exhaust quota for test tenant.',
      action: 'Send 101st request.',
      expectedProperty: 'Response status === 429 && parseInt(res.headers["retry-after"]) > 0',
      evidenceToCollect: ['response_headers', 'status_code'],
      isAutomatable: true,
    },
  ],
  assumptions: [
    'Tenant identity is extracted from validated JWT bearer token claims.',
    'Redis cluster clock synchronization is maintained via NTP within 10ms.',
  ],
  unresolvedQuestions: [
    'Should gateway fail open or fail closed if Redis cluster becomes completely partitioned?',
  ],
  metadata: {
    status: 'accepted',
    createdAt: '2026-10-14T08:00:00.000Z',
    author: 'ArchitectAI Systems Engine',
    tags: ['rate-limiter', 'traffic_management', 'distributed_systems', 'curated-demo-fixture'],
  },
});

/**
 * Fixture 2: Payment Processing with Idempotent Webhooks & Transactional Outbox
 * Intent: Safe webhook ingestion, strict deduplication, atomic transactional outbox, and banking settlement.
 */
export const PAYMENT_OUTBOX_FIXTURE_CONTRACT: EngineeringContract = EngineeringContractSchema.parse({
  id: 'contract-payment-idempotency',
  version: '2.1.0',
  requirement: {
    id: 'req-payment-processing',
    rawIntent:
      'Build a payment processing service that handles external payment webhooks idempotently, records financial ledger debits atomically using a transactional outbox in PostgreSQL, and safely notifies external banking gateways.',
    explicitConstraints: [
      'Strictly zero duplicate account charges under concurrent duplicate webhook delivery.',
      'Must acknowledge external webhook requests within 2000ms with HTTP 200.',
      'Dual-writes between database and message queue are prohibited; outbox pattern required.',
    ],
    declaredTechStack: ['PostgreSQL 16', 'Redis', 'Kafka', 'Node.js Fastify'],
    context: {
      title: 'Idempotent Payment Ingestion & Transactional Outbox Event Publishing',
      businessGoal: 'Eliminate duplicate customer charges and prevent dual-write inconsistencies between database and message broker.',
    },
  },
  discoveredConcerns: [
    {
      id: 'concern-pay-duplicate-debit',
      requirementId: 'req-payment-processing',
      title: 'Duplicate Charge Race Condition',
      description: 'Concurrent arrival of identical webhook events causes two simultaneous charges to be authorized.',
      applicabilityReason: 'Payment gateways retry on network blips, resulting in simultaneous processing threads.',
      dimensions: ['concurrency', 'side_effects', 'shared_mutable_state'],
      supportingKnowledgeIds: ['kb-duplicate-side-effect-l2'],
      confidence: 0.99,
      assumptions: ['Identical webhook payloads arrive within 50ms of each other.'],
      unresolvedQuestions: [],
    },
    {
      id: 'concern-pay-dual-write',
      requirementId: 'req-payment-processing',
      title: 'Dual-Write Message Loss & Inconsistency',
      description: 'Writing to database then directly publishing to message broker fails if process crashes between the two steps.',
      applicabilityReason: 'Distributed non-transactional writes cannot guarantee atomicity across disparate storage systems.',
      dimensions: ['persistence', 'failure_of_dependencies', 'distributed_ownership'],
      supportingKnowledgeIds: ['kb-dual-write-l2'],
      confidence: 0.97,
      assumptions: ['Process crash or network timeout can happen after DB commit but before broker publish.'],
      unresolvedQuestions: [],
    },
    {
      id: 'concern-pay-banking-timeout',
      requirementId: 'req-payment-processing',
      title: 'Banking Partner Connection Pool Saturation',
      description: 'Slow upstream banking settlement ties up API server threads and exhausts connection pools.',
      applicabilityReason: 'Banking APIs experience latency spikes during peak clearing house windows.',
      dimensions: ['bounded_resources', 'latency', 'failure_of_dependencies'],
      supportingKnowledgeIds: ['kb-connection-exhaustion-l2'],
      confidence: 0.91,
      assumptions: ['Bank gateway response latency can exceed 10 seconds during degradation.'],
      unresolvedQuestions: [],
    },
  ],
  decisions: [
    {
      id: 'dec-pay-idempotency-key',
      problemContext: 'Deduplication & Concurrency Lock',
      consideredOptions: [
        {
          id: 'opt-pay-db-unique',
          name: 'Database Unique Constraint Only',
          description: 'Rely solely on PostgreSQL unique key constraint on payment_idempotency_key.',
          tradeoffs: 'Hits database write lock on every duplicate request; slow under high concurrency burst.',
        },
        {
          id: 'opt-pay-redis-lock',
          name: 'Distributed Redis Mutex with TTL Cache',
          description: 'Atomic SETNX with 24-hour expiration followed by cached response return.',
          tradeoffs: 'Guarantees fast in-memory rejection of concurrent duplicate webhooks within 5ms.',
        },
      ],
      selectedOptionId: 'opt-pay-redis-lock',
      selectedOptionName: 'Distributed Redis Mutex with TTL Cache',
      rationale:
        'Atomically locks the idempotency key upon arrival; subsequent identical requests wait or receive cached payload without executing duplicate financial side-effects.',
      evidence: [],
      assumptions: ['Idempotency keys are unique per payment event.'],
      risksAndTradeoffs: ['Redis failure falls back to database unique constraint.'],
      verificationRequirements: ['Send two identical charge webhooks within 5ms; assert exactly 1 debit is executed.'],
      reconsiderationTriggers: [],
    },
    {
      id: 'dec-pay-transactional-outbox',
      problemContext: 'Event Publishing & Dual-Write Elimination',
      consideredOptions: [
        {
          id: 'opt-pay-direct-publish',
          name: 'Direct Message Broker Publish',
          description: 'Commit to SQL then publish to RabbitMQ in application code.',
          tradeoffs: 'Subject to silent message loss if publisher process crashes between commit and publish.',
        },
        {
          id: 'opt-pay-outbox-table',
          name: 'Transactional Outbox Table in PostgreSQL',
          description: 'Insert payment ledger row and pending event payload into outbox table in one ACID transaction.',
          tradeoffs: 'Eliminates dual-write inconsistency; a separate relayer daemon reads outbox and publishes.',
        },
      ],
      selectedOptionId: 'opt-pay-outbox-table',
      selectedOptionName: 'Transactional Outbox Table in PostgreSQL',
      rationale:
        'Guarantees that event messages are persisted if and only if the ledger transaction commits. Zero lost payment events.',
      evidence: [],
      assumptions: ['PostgreSQL supports ACID multi-statement transactions.'],
      risksAndTradeoffs: ['Adds small polling/CDC delay (100–300ms) before message broker receives the event.'],
      verificationRequirements: ['Kill publisher daemon during transaction commit; verify message is delivered upon restart.'],
      reconsiderationTriggers: [],
    },
    {
      id: 'dec-pay-outbox-publisher',
      problemContext: 'Outbox Event Relayer Daemon',
      consideredOptions: [
        {
          id: 'opt-cdc-debezium',
          name: 'Change Data Capture (Debezium / WAL Reader)',
          description: 'Streams PostgreSQL WAL changes directly to message broker.',
          tradeoffs: 'Low latency, high reliability, zero table lock overhead.',
        },
      ],
      selectedOptionId: 'opt-cdc-debezium',
      selectedOptionName: 'Change Data Capture (Debezium / WAL Reader)',
      rationale: 'Non-blocking WAL log tailing ensures high throughput without polling the primary relational database table.',
      evidence: [],
      assumptions: [],
      risksAndTradeoffs: [],
      verificationRequirements: [],
      reconsiderationTriggers: [],
    },
    {
      id: 'dec-pay-circuit-breaker',
      problemContext: 'External Banking Network Resilience',
      consideredOptions: [
        {
          id: 'opt-circuit-breaker',
          name: 'Circuit Breaker with Jittered Exponential Backoff',
          description: 'Trips open after 5 consecutive 5xx errors; sheds load and rejects new probes until recovery.',
          tradeoffs: 'Protects gateway thread pool from cascading exhaustion during partner bank degradation.',
        },
      ],
      selectedOptionId: 'opt-circuit-breaker',
      selectedOptionName: 'Circuit Breaker with Jittered Exponential Backoff',
      rationale: 'Fails fast during banking outages and returns structured retry guidance to clients.',
      evidence: [],
      assumptions: [],
      risksAndTradeoffs: [],
      verificationRequirements: ['Simulate 5 consecutive bank 500 errors; verify circuit breaker trips to OPEN state.'],
      reconsiderationTriggers: [],
    },
  ],
  invariants: [
    {
      id: 'inv-pay-zero-duplicate-debit',
      property: 'Identical payment idempotency keys must never trigger more than one monetary ledger debit.',
      severity: 'critical',
      blocksCompletion: true,
      rationale: 'Duplicate customer charges create financial liability and compliance violations.',
    },
    {
      id: 'inv-pay-outbox-atomicity',
      property: 'Outbox event records must be written atomically within the same database transaction as the financial debit.',
      severity: 'critical',
      blocksCompletion: true,
      rationale: 'Guarantees at-least-once message delivery without dual-write loss.',
    },
    {
      id: 'inv-pay-bank-circuit-breaker',
      property: 'External banking client must trip circuit breaker to OPEN state within 5 consecutive connection failures.',
      severity: 'high',
      blocksCompletion: true,
      rationale: 'Prevents thread pool saturation during third-party banking downtime.',
    },
  ],
  verificationSpecs: [
    {
      id: 'spec-pay-duplicate-race',
      target: 'inv-pay-zero-duplicate-debit',
      description: 'Dispatch 2 concurrent HTTP requests with identical idempotency key within 5ms. Assert exactly 1 charge processed and 1 cached.',
      setup: 'Provision isolated test database and Redis cache.',
      action: 'Simultaneously invoke POST /api/webhooks/payment with key "pay_idem_tx_9981".',
      expectedProperty: 'Database ledger contains exactly 1 debit record; both HTTP responses report status 200.',
      evidenceToCollect: ['db_ledger_count', 'idempotency_cache_keys', 'http_status_codes'],
      isAutomatable: true,
    },
    {
      id: 'spec-pay-outbox-delivery',
      target: 'inv-pay-outbox-atomicity',
      description: 'Commit payment transaction and verify outbox table contains pending event payload.',
      setup: 'Start outbox relayer in paused state.',
      action: 'Execute payment transaction.',
      expectedProperty: 'Outbox table contains status="PENDING" message with matching paymentId.',
      evidenceToCollect: ['outbox_table_rows', 'transaction_status'],
      isAutomatable: true,
    },
  ],
  assumptions: [
    'External payment webhooks include cryptographic HMAC-SHA256 signatures in headers.',
    'Ledger amounts are stored as 64-bit integer minor currency units (cents) to avoid floating point error.',
  ],
  unresolvedQuestions: [
    'What is the maximum retention window for archived outbox records in PostgreSQL before partition pruning?',
  ],
  metadata: {
    status: 'accepted',
    createdAt: '2026-10-14T09:00:00.000Z',
    author: 'ArchitectAI Fintech Engine',
    tags: ['payments', 'fintech', 'idempotency', 'transactional_outbox', 'curated-demo-fixture'],
  },
});

/**
 * Fixture 3: Image Uploads with Queues and Bounded Workers
 * Intent: Media ingestion with presigned S3 uploads, message queue buffering, and memory-bounded worker pool.
 */
export const IMAGE_PIPELINE_FIXTURE_CONTRACT: EngineeringContract = EngineeringContractSchema.parse({
  id: 'contract-image-pipeline',
  version: '1.4.0',
  requirement: {
    id: 'req-image-processing',
    rawIntent:
      'Build a media upload service where users upload photos directly to object storage via presigned URLs, and background worker processes resize images using libvips with strict memory bounds and message queue backpressure.',
    explicitConstraints: [
      'Raw image bytes must bypass the API server memory and stream directly to S3 storage.',
      'Individual worker process heap must never exceed 512MB RAM.',
      'Queue backlog exceeding 1000 items must trigger backpressure signals to ingestion API.',
    ],
    declaredTechStack: ['AWS S3', 'RabbitMQ', 'Node.js', 'libvips', 'Docker'],
    context: {
      title: 'Media Processing Pipeline with Presigned Uploads & Bounded Worker Concurrency',
      businessGoal: 'Scale image transformation reliably while preventing worker process OOM crashes from decompression bombs.',
    },
  },
  discoveredConcerns: [
    {
      id: 'concern-img-oom-decompression',
      requirementId: 'req-image-processing',
      title: 'Worker OOM Crash via Decompression Bomb',
      description: 'A compressed 20MB image expands to 800MB uncompressed bitmap in RAM, causing worker process termination.',
      applicabilityReason: 'Native image libraries allocate uncompressed pixel buffers proportional to width x height.',
      dimensions: ['bounded_resources', 'attacker_controlled_input'],
      supportingKnowledgeIds: ['kb-oom-decompression-l2'],
      confidence: 0.96,
      assumptions: ['Clients can upload arbitrary resolution images up to 100 megapixels.'],
      unresolvedQuestions: [],
    },
    {
      id: 'concern-img-queue-backpressure',
      requirementId: 'req-image-processing',
      title: 'Unbounded Queue Backlog & Worker Starvation',
      description: 'Upload rate exceeding worker throughput causes queue depth to grow without bound, saturating broker disk.',
      applicabilityReason: 'Image transcoding is CPU-intensive (~200ms per image), whereas API upload requests take <10ms.',
      dimensions: ['queues', 'scaling_concentration', 'capacity'],
      supportingKnowledgeIds: ['kb-backpressure-l2'],
      confidence: 0.94,
      assumptions: ['Viral events can generate 10,000 upload requests within 1 minute.'],
      unresolvedQuestions: [],
    },
    {
      id: 'concern-img-poison-pill',
      requirementId: 'req-image-processing',
      title: 'Corrupted File Infinite Retry Loop',
      description: 'A malformed image causes worker to crash, message is re-queued, and repeatedly crashes every worker.',
      applicabilityReason: 'Default queue retry policies re-deliver unacknowledged messages indefinitely.',
      dimensions: ['retries', 'failure_of_dependencies'],
      supportingKnowledgeIds: ['kb-poison-pill-l2'],
      confidence: 0.93,
      assumptions: ['Corrupted byte streams will fail during decoder initialization.'],
      unresolvedQuestions: [],
    },
  ],
  decisions: [
    {
      id: 'dec-img-presigned-upload',
      problemContext: 'Raw Byte Ingestion & Memory Shielding',
      consideredOptions: [
        {
          id: 'opt-api-multipart',
          name: 'Multipart Upload through API Server',
          description: 'Stream bytes through Express / Node API server into disk.',
          tradeoffs: 'Consumes API server bandwidth and RAM; easily saturates API server during traffic spikes.',
        },
        {
          id: 'opt-presigned-s3',
          name: 'Direct-to-Object-Storage Presigned URLs',
          description: 'API authenticates user and generates temporary signed S3 PUT URL; client uploads directly to S3.',
          tradeoffs: 'Zero API server memory overhead for raw image bytes; infinitely scalable storage edge.',
        },
      ],
      selectedOptionId: 'opt-presigned-s3',
      selectedOptionName: 'Direct-to-Object-Storage Presigned URLs',
      rationale:
        'Completely decouples API server throughput from file size. API server only deals with small JSON payloads.',
      evidence: [],
      assumptions: ['Client applications support direct HTTP PUT with presigned authorization headers.'],
      risksAndTradeoffs: ['Requires CORS configuration on S3 bucket.'],
      verificationRequirements: ['Verify client uploads payload directly to bucket without passing through API server process.'],
      reconsiderationTriggers: [],
    },
    {
      id: 'dec-img-worker-concurrency',
      problemContext: 'Bounded Worker Concurrency & Memory Ceiling',
      consideredOptions: [
        {
          id: 'opt-worker-bounded-pool',
          name: 'Bounded Worker Pool (Concurrency = CPU Cores * 1)',
          description: 'Each worker process prefetches exactly 1 job at a time and caps memory ceiling at 512MB.',
          tradeoffs: 'Strictly bounds memory usage regardless of queue depth; prevents OOM crashes.',
        },
      ],
      selectedOptionId: 'opt-worker-bounded-pool',
      selectedOptionName: 'Bounded Worker Pool (Concurrency = CPU Cores * 1)',
      rationale:
        'Protects host memory from exhaustion by ensuring libvips allocates memory for at most 1 active transformation per core.',
      evidence: [],
      assumptions: ['Host has 2 CPU cores and 2GB RAM.'],
      risksAndTradeoffs: ['Jobs queue up during bursts rather than processing concurrently.'],
      verificationRequirements: ['Flood worker with 20 concurrent 4K images; verify process heap remains under 512MB.'],
      reconsiderationTriggers: [],
    },
    {
      id: 'dec-img-queue-backpressure',
      problemContext: 'Queue Backlog Buffering & Backpressure',
      consideredOptions: [
        {
          id: 'opt-rabbitmq-dlq',
          name: 'Partitioned Message Queue with Dead Letter Exchange',
          description: 'RabbitMQ queue with max-length=1000 and x-dead-letter-exchange for failed jobs after 3 retries.',
          tradeoffs: 'Protects broker storage and isolates poison-pill files from blocking queue.',
        },
      ],
      selectedOptionId: 'opt-rabbitmq-dlq',
      selectedOptionName: 'Partitioned Message Queue with Dead Letter Exchange',
      rationale: 'Signals backpressure to API when queue exceeds 1,000 items and isolates unparseable media.',
      evidence: [],
      assumptions: [],
      risksAndTradeoffs: [],
      verificationRequirements: ['Push 1,001 items to queue; verify API signals backpressure to clients.'],
      reconsiderationTriggers: [],
    },
  ],
  invariants: [
    {
      id: 'inv-img-memory-ceiling',
      property: 'Worker process resident set size (RSS) must never exceed 512MB during image transcoding.',
      severity: 'critical',
      blocksCompletion: true,
      rationale: 'Prevents OOM kill by container runtime under large image decoding.',
    },
    {
      id: 'inv-img-backpressure-threshold',
      property: 'When queue depth exceeds 1,000 pending items, upload API must return HTTP 429 backpressure warning.',
      severity: 'high',
      blocksCompletion: true,
      rationale: 'Prevents runaway queue backlog and unbounded worker turnaround latency.',
    },
    {
      id: 'inv-img-dlq-quarantine',
      property: 'Corrupted image jobs must be quarantined to DLQ after exactly 3 failed processing attempts.',
      severity: 'high',
      blocksCompletion: true,
      rationale: 'Stops poison pill messages from crashing worker instances indefinitely.',
    },
  ],
  verificationSpecs: [
    {
      id: 'spec-img-memory-bound',
      target: 'inv-img-memory-ceiling',
      description: 'Stream 20 concurrent 50-megapixel test images into worker. Monitor process RSS memory usage.',
      setup: 'Launch bounded worker process with 512MB memory monitor.',
      action: 'Publish 20 concurrent high-res image transform jobs.',
      expectedProperty: 'Max process RSS <= 512MB throughout execution; zero worker crash exits.',
      evidenceToCollect: ['process_rss_bytes', 'exit_code', 'completed_transform_count'],
      isAutomatable: true,
    },
    {
      id: 'spec-img-dlq-routing',
      target: 'inv-img-dlq-quarantine',
      description: 'Publish corrupted byte payload into queue. Assert job routes to DLQ after 3 attempts.',
      setup: 'Attach DLQ consumer.',
      action: 'Publish corrupt image payload "img_corrupt_byte_seq".',
      expectedProperty: 'Queue retry count reaches 3, message appears on dead-letter queue, worker continues processing healthy jobs.',
      evidenceToCollect: ['dlq_message_id', 'retry_attempts', 'worker_health_status'],
      isAutomatable: true,
    },
  ],
  assumptions: [
    'Object storage generates unique object keys using UUIDv4.',
    'Thumbnail derivatives are saved in WebP format with quality 85.',
  ],
  unresolvedQuestions: [
    'Should thumbnail derivatives be cached in edge CDN with 30-day TTL?',
  ],
  metadata: {
    status: 'accepted',
    createdAt: '2026-10-14T09:30:00.000Z',
    author: 'ArchitectAI Media Systems Engine',
    tags: ['media', 'image_processing', 'queues', 'bounded_concurrency', 'curated-demo-fixture'],
  },
});

/**
 * Fixture 4: Incomplete / Unresolved Contract
 * Intent: Tests safe handling of incomplete draft contracts without crashing or faking topology.
 */
export const INCOMPLETE_FIXTURE_CONTRACT: EngineeringContract = EngineeringContractSchema.parse({
  id: 'contract-incomplete-sample',
  version: '0.1.0-draft',
  requirement: {
    id: 'req-incomplete',
    rawIntent: 'User wants an analytics dashboard but has not specified database, latency, or scaling requirements.',
    explicitConstraints: [],
    declaredTechStack: [],
    context: {
      title: 'Underspecified Real-Time Analytics Dashboard',
      businessGoal: 'Collect product usage metrics in real time.',
    },
  },
  discoveredConcerns: [],
  decisions: [], // Empty decisions
  invariants: [],
  verificationSpecs: [],
  assumptions: ['Requirements are underspecified.'],
  unresolvedQuestions: [
    'What is the expected write frequency and query latency requirement?',
    'Should data be retained for 30 days or indefinitely?',
  ],
  metadata: {
    status: 'draft',
    createdAt: '2026-10-14T10:00:00.000Z',
    tags: ['incomplete', 'draft'],
  },
});

export const ALL_FIXTURE_CONTRACTS: Record<string, EngineeringContract> = {
  'contract-rate-limiter': RATE_LIMITER_FIXTURE_CONTRACT,
  'contract-payment-idempotency': PAYMENT_OUTBOX_FIXTURE_CONTRACT,
  'contract-image-pipeline': IMAGE_PIPELINE_FIXTURE_CONTRACT,
  'contract-incomplete-sample': INCOMPLETE_FIXTURE_CONTRACT,
};
