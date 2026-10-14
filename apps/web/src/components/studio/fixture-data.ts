// ArchitectAI Architecture Studio Prototype — Structured Graph Fixture Data
// Canonical Fictional Enterprise Rate-Limiting Scenario (DEMO)

import { StudioNode, StudioEdge, TrustBoundary } from './types';

export const STUDIO_REQUIREMENT = {
  id: 'req-rate-limiter-enterprise',
  title: 'Multi-Tenant API Rate Limiter with Sliding Window & Burst Protection',
  rawIntent:
    'Rate limit each authenticated tenant to 100 API requests per minute with burst tolerance up to 20 requests over limit, dropping abusive traffic with HTTP 429 without degrading API latency.',
  project: 'Payments Gateway Platform',
  revision: 'v2.4 (Simulated)',
  contractId: 'contract-studio-demo-001',
};

export const TRUST_BOUNDARIES: TrustBoundary[] = [
  {
    id: 'tb-untrusted',
    label: 'Untrusted Internet Perimeter',
    description: 'Public clients, mobile applications, and external partner APIs.',
    tier: 'public',
    rect: { x: 3, y: 10, width: 20, height: 80 },
  },
  {
    id: 'tb-dmz',
    label: 'Ingress & Edge DMZ',
    description: 'TLS termination, edge rate limiting, and traffic policy enforcement.',
    tier: 'dmz',
    rect: { x: 26, y: 10, width: 22, height: 80 },
  },
  {
    id: 'tb-private-vpc',
    label: 'Private VPC Compute Tier',
    description: 'Internal microservices and business logic execution behind gateway shields.',
    tier: 'private_compute',
    rect: { x: 51, y: 10, width: 22, height: 80 },
  },
  {
    id: 'tb-state-tier',
    label: 'State & Storage Tier',
    description: 'Distributed cache coordination and persistent relational data storage.',
    tier: 'state',
    rect: { x: 76, y: 10, width: 21, height: 80 },
  },
];

export const STUDIO_NODES: StudioNode[] = [
  {
    id: 'node-clients',
    label: 'Multi-Tenant Clients',
    sublabel: 'Web SPAs, Mobile & Partner APIs',
    category: 'client',
    tierBadge: 'Ingress Perimeter',
    x: 12,
    y: 50,
    status: 'active',
    purpose:
      'Origin of all inbound API traffic originating from external untrusted networks across distributed tenant accounts.',
    whySelected:
      'Representative of heterogeneous client profiles generating both steady background requests and synchronized boundary bursts.',
    tradeOffs: [
      'Clients cannot be trusted to self-throttle or honor local backoff headers reliably.',
      'IP-based rate limiting is insufficient due to corporate NAT proxies; tenant identity must be extracted via JWT or API key.',
    ],
    failureModes: [
      {
        id: 'fm-c1',
        name: 'Retry Amplification Storm',
        level: 'L2',
        description: 'Clients aggressively retry failed requests without jittered exponential backoff.',
        consequence: 'Cascading gateway saturation during transient backend degradation.',
        mitigation: 'Return standard Retry-After headers and enforce jittered backoff contracts in client SDKs.',
      },
    ],
    alternativesConsidered: [
      {
        title: 'Client-Side Self Rate Limiting',
        verdict: 'REJECTED',
        reason: 'Untrusted clients can bypass local limits; zero enforcement across multi-device tenant usage.',
      },
    ],
    implementation: {
      technology: 'HTTP/1.1 & HTTP/2 Client Standards',
      targetFiles: ['apps/sdk/src/client.ts'],
      configuration: {
        'default-timeout': '5000ms',
        'retry-strategy': 'exponential_jitter',
      },
      codeSnippet: `// Client respects standard 429 response
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
  await sleep(retryAfter * 1000 + Math.random() * 200);
}`,
    },
    verification: {
      invariantId: 'inv-client-backoff',
      title: 'Client SDK Retry Header Compliance',
      formalProperty: 'Client SDK honors Retry-After header with non-zero randomized jitter',
      operator: 'gte',
      expected: '50ms jitter',
      testStrategy: 'synthetic_burst_test',
      verificationDescription: 'Execute mock 429 flood and verify client delay interval exceeds Retry-After specification.',
    },
    metrics: {
      label1: 'Active Tenants',
      value1: '1,420',
      label2: 'Avg Request Rate',
      value2: '84 req/s',
      label3: 'Traffic Entropy',
      value3: 'High Burst',
    },
  },

  {
    id: 'node-gateway',
    label: 'API Ingress Gateway',
    sublabel: 'Envoy / NGINX Rate Limit Filter',
    category: 'gateway',
    tierBadge: 'Edge DMZ Layer',
    x: 37,
    y: 50,
    status: 'healthy',
    purpose:
      'First line of defense. Terminates TLS, validates tenant identity, executes token-bucket check against Redis, and returns immediate HTTP 429 before requests reach compute nodes.',
    whySelected:
      'Filtering at the ingress gateway shields the entire internal API fleet and database from abusive or burst traffic, saving 98% of compute CPU cycles.',
    tradeOffs: [
      'Adds a synchronous network hop to Redis on every inbound request (<1ms with keep-alive).',
      'Requires fail-open vs fail-closed policy declaration when Redis is temporarily unreachable.',
    ],
    failureModes: [
      {
        id: 'fm-gw1',
        name: 'Boundary Burst Oversubscription',
        level: 'L2',
        description: 'Fixed-window counters permit 200% quota when bursts straddle window boundary (t=59s and t=61s).',
        consequence: 'Downstream compute instances crash with OOM or thread starvation.',
        mitigation: 'Enforce Sliding-Window Log or Sliding-Window Counter with sub-second time slices.',
      },
      {
        id: 'fm-gw2',
        name: 'Coordination Latency Spike',
        level: 'L1',
        description: 'Synchronous Redis call latency degrades P99 API response time.',
        consequence: 'Legitimate traffic experiences latency degradation during peak traffic hours.',
        mitigation: 'Use connection pooling, persistent RESP3 sockets, and local memory short-circuit caches.',
      },
    ],
    alternativesConsidered: [
      {
        title: 'Application-Level Middleware (In-Process)',
        verdict: 'REJECTED',
        reason: 'Unprotected requests consume compute worker threads and JSON parsing buffers before being rejected.',
      },
      {
        title: 'DNS / CDN Level Rate Limiting',
        verdict: 'CONSIDERED',
        reason: 'Good for coarse DDoS mitigation by IP, but cannot inspect tenant JWT claims or custom enterprise quotas.',
      },
    ],
    implementation: {
      technology: 'Envoy Proxy Rate Limit Filter / Custom Express Middleware',
      targetFiles: ['apps/web/server/middleware/rate-limiter.ts', 'infra/envoy/rate-limit.yaml'],
      configuration: {
        'rate-limit-header': 'X-RateLimit-Remaining',
        'rejection-status': '429',
        'rejection-body': 'Too Many Requests — Quota Exceeded',
        'fail-mode': 'FAIL_OPEN_WITH_LOGGING',
      },
      codeSnippet: `// Fast gate check before routing to compute instances
const allowed = await rateLimitService.checkTenantQuota(tenantId, 100, 60);
if (!allowed) {
  res.setHeader('Retry-After', '60');
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', '0');
  return res.status(429).json({ error: 'Tenant rate limit exceeded.' });
}`,
    },
    verification: {
      invariantId: 'inv-gateway-shielding',
      title: 'Ingress Edge Rejection Guarantee',
      formalProperty: 'Requests over quota are rejected at gateway without invoking downstream microservices',
      operator: 'eq',
      expected: '0 compute invocations on 429',
      testStrategy: 'process_isolation_probe',
      verificationDescription: 'Dispatch 150 requests under 100 limit; assert downstream worker spy records exactly 100 calls.',
    },
    metrics: {
      label1: 'Gate Latency P99',
      value1: '0.8 ms',
      label2: 'Rejection Accuracy',
      value2: '100.0%',
      label3: 'CPU Utilization',
      value3: '14.2%',
    },
  },

  {
    id: 'node-compute',
    label: 'Stateless API Fleet',
    sublabel: '3x Node.js / TypeScript Instances',
    category: 'compute',
    tierBadge: 'Private VPC Compute',
    x: 62,
    y: 32,
    status: 'healthy',
    purpose:
      'Executes business logic, transactional operations, and core application workflows in a horizontally scalable stateless cluster.',
    whySelected:
      'Stateless architecture ensures instances can scale independently without sharing local mutable memory counters.',
    tradeOffs: [
      'Cannot store tenant rate-limit counters in local memory (e.g. Map or LRU cache) without cross-instance drift.',
      'Must rely on shared distributed state (Redis) for quota synchronization.',
    ],
    failureModes: [
      {
        id: 'fm-cp1',
        name: 'In-Memory Counter Drift',
        level: 'L1',
        description: 'Using local in-memory counters across N instances multiplies allowable traffic by N.',
        consequence: 'Tenant allocated 100 req/min sends 300 req/min (100 to each of 3 round-robin instances).',
        mitigation: 'Externalize all mutable quota state to a shared centralized Redis cluster.',
      },
      {
        id: 'fm-cp2',
        name: 'Worker Thread Starvation',
        level: 'L1',
        description: 'Heavy JSON payloads from abusive traffic saturate the Node.js V8 event loop.',
        consequence: 'Healthy tenants experience latency spikes due to head-of-line blocking.',
        mitigation: 'Bounded request body limits and edge rate limiting prior to body parsing.',
      },
    ],
    alternativesConsidered: [
      {
        title: 'Single Giant Stateful Server',
        verdict: 'REJECTED',
        reason: 'Single point of failure; vertical scaling ceiling; cannot survive node restarts without dropping traffic.',
      },
    ],
    implementation: {
      technology: 'Node.js 20 LTS / TypeScript Strict Mode',
      targetFiles: ['apps/api/src/server.ts', 'apps/api/src/routes/payments.ts'],
      configuration: {
        'cluster-size': '3 instances',
        'max-concurrency-per-node': '250 connections',
        'event-loop-lag-budget': '20ms max',
      },
      codeSnippet: `// Stateless request processing
app.post('/api/v1/charge', async (req, res) => {
  // Guaranteed by Gateway that tenant is within rate limits
  const result = await paymentService.processCharge(req.tenantId, req.body);
  return res.json({ success: true, transactionId: result.id });
});`,
    },
    verification: {
      invariantId: 'inv-stateless-fleet',
      title: 'Zero In-Memory Quota Drift',
      formalProperty: 'Sum of executed requests across all N instances strictly bounded by global limit',
      operator: 'lte',
      expected: '100 requests total',
      testStrategy: 'distributed_round_robin_test',
      verificationDescription: 'Distribute 150 requests round-robin across instances; verify total completed does not exceed 100.',
    },
    metrics: {
      label1: 'Active Pods',
      value1: '3 healthy',
      label2: 'Event Loop Lag',
      value2: '1.4 ms',
      label3: 'Memory Usage',
      value3: '142 MB / node',
    },
  },

  {
    id: 'node-redis',
    label: 'Redis Distributed State',
    sublabel: 'Redis 7.2 Cluster (Sliding Window)',
    category: 'cache',
    tierBadge: 'Distributed State',
    x: 87,
    y: 32,
    status: 'healthy',
    purpose:
      'Atomic in-memory counter and timestamp coordination store. Evaluates sliding-window token bucket quotas using atomic Lua scripts in < 1ms.',
    whySelected:
      'Sub-millisecond single-threaded atomicity eliminates lost updates and race conditions across concurrent multi-instance API requests.',
    tradeOffs: [
      'Memory footprint scales with active concurrent tenants (Sliding-Window Log requires storing timestamps per request).',
      'Requires volatile-lru eviction policy and TTL bounds on every key to prevent OOM.',
    ],
    failureModes: [
      {
        id: 'fm-rd1',
        name: 'Out of Memory (OOM) via Unbounded Keys',
        level: 'L2',
        description: 'Transient tenant keys accumulate without TTL expiration, filling maxmemory.',
        consequence: 'Redis stops accepting writes (OOM command error) or evicts critical session keys.',
        mitigation: 'Set strict key TTL matching window length (`EXPIRE 65`) and configure `maxmemory-policy volatile-lru`.',
      },
      {
        id: 'fm-rd2',
        name: 'Concurrent Read-Modify-Write Race Condition',
        level: 'L1',
        description: 'Executing GET -> CHECK -> INCR as separate network commands allows interleaved requests.',
        consequence: 'Tenants exceed quota during simultaneous microsecond bursts.',
        mitigation: 'Package evaluation into an atomic Redis Lua script (`EVALSHA`) executed in a single atomic cycle.',
      },
    ],
    alternativesConsidered: [
      {
        title: 'Relational Database (PostgreSQL) Counter Table',
        verdict: 'REJECTED',
        reason: 'Row lock contention on hot tenant records causes database connection pool starvation at > 50 rps.',
      },
      {
        title: 'Redis Fixed-Window (INCR + EXPIRE)',
        verdict: 'REJECTED',
        reason: 'Vulnerable to 200% boundary burst attack (100 req at t=59s + 100 req at t=61s = 200 req in 2 seconds).',
      },
    ],
    implementation: {
      technology: 'Redis 7.2 Enterprise / OSS + RESP3 + Lua 5.1 Script',
      targetFiles: ['packages/application/src/services/rate-limit-redis.ts', 'scripts/ratelimit.lua'],
      configuration: {
        'maxmemory': '256mb',
        'maxmemory-policy': 'volatile-lru',
        'key-prefix': 'rl:tenant:',
        'window-ttl': '65s',
      },
      codeSnippet: `-- Atomic sliding-window token bucket script
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local current = redis.call('ZCARD', key)
if current < limit then
  redis.call('ZADD', key, now, now)
  redis.call('EXPIRE', key, math.ceil(window / 1000) + 5)
  return 1
else
  return 0
end`,
    },
    verification: {
      invariantId: 'inv-sliding-window-boundary-burst',
      title: 'Sliding-Window Boundary Burst Suppression',
      formalProperty: 'No rolling 60-second window slice may ever observe more than 100 successful requests',
      operator: 'lte',
      expected: '100 req in any 60s span',
      testStrategy: 'adversarial_boundary_attack',
      verificationDescription:
        'Dispatch 80 requests at t=59s followed by 80 requests at t=61s. Assert total allowed across both is exactly 100 (60 rejected).',
    },
    metrics: {
      label1: 'Ops / Second',
      value1: '1,240 ops/s',
      label2: 'Memory In-Use',
      value2: '18.4 MB',
      label3: 'Hit Latency P99',
      value3: '0.42 ms',
    },
  },

  {
    id: 'node-postgres',
    label: 'Primary Datastore',
    sublabel: 'PostgreSQL 16 (Relational DB)',
    category: 'datastore',
    tierBadge: 'Persistent Storage',
    x: 87,
    y: 68,
    status: 'healthy',
    purpose:
      'Authoritative persistent storage for tenant account configurations, subscription tiers, enterprise custom quotas, and compliance audit logs.',
    whySelected:
      'Strong ACID consistency guarantees tenant quota definitions and billing tiers are never lost or corrupted.',
    tradeOffs: [
      'High latency and connection overhead compared to in-memory Redis (~5ms vs ~0.5ms).',
      'Must NEVER be in the hot-path of individual per-request rate limit checks.',
    ],
    failureModes: [
      {
        id: 'fm-pg1',
        name: 'Connection Pool Exhaustion',
        level: 'L1',
        description: 'Microservices opening direct database connections during traffic spikes exhaust PostgreSQL max_connections.',
        consequence: 'Database rejects all queries, bringing entire platform down.',
        mitigation: 'Shield with PgBouncer connection pooling and cache tenant tier configs in Redis.',
      },
    ],
    alternativesConsidered: [
      {
        title: 'Redis-Only Storage (No SQL Database)',
        verdict: 'REJECTED',
        reason: 'In-memory stores lack durability guarantees and relational integrity for financial billing quotas.',
      },
    ],
    implementation: {
      technology: 'PostgreSQL 16 with PgBouncer Pooling',
      targetFiles: ['infra/db/schema.sql', 'packages/application/src/persistence/tenant-quota.repo.ts'],
      configuration: {
        'max_connections': '100',
        'pool_mode': 'transaction',
        'default_statement_timeout': '3000ms',
      },
      codeSnippet: `// Tenant quota loaded once and cached in Redis
SELECT tenant_id, tier, max_requests_per_minute, burst_allowance
FROM tenant_rate_limits
WHERE tenant_id = $1 AND active = true;`,
    },
    verification: {
      invariantId: 'inv-db-hotpath-isolation',
      title: 'Database Hotpath Isolation Guarantee',
      formalProperty: 'Zero SQL queries executed during steady-state rate-limited API requests',
      operator: 'eq',
      expected: '0 SQL queries / req',
      testStrategy: 'db_connection_spy',
      verificationDescription: 'Execute 1,000 cached API requests; verify PostgreSQL query count strictly equals 0.',
    },
    metrics: {
      label1: 'Connection Pool',
      value1: '12 / 100 used',
      label2: 'Query Latency',
      value2: '2.1 ms',
      label3: 'Storage Size',
      value3: '4.2 GB',
    },
  },
];

export const STUDIO_EDGES: StudioEdge[] = [
  {
    id: 'edge-client-gw',
    source: 'node-clients',
    target: 'node-gateway',
    label: 'HTTPS / TLS 1.3 Ingress',
    protocol: 'HTTPS / TLS 1.3 (TCP 443)',
    latencySla: '< 15ms WAN',
    direction: 'unidirectional',
    purpose: 'Transports external encrypted client API requests to the edge ingress gateway.',
    whySelected: 'Industry-standard secure transport with HTTP/2 multiplexing for efficient connection reuse.',
    tradeOffs: [
      'TLS handshake computational overhead (mitigated via session resumption tokens).',
      'Client IP header spoofing risk when behind intermediate corporate proxies (requires trusted proxy whitelist).',
    ],
    failureModes: [
      {
        id: 'fm-e1',
        name: 'Header Spoofing via X-Forwarded-For',
        level: 'L3',
        description: 'Malicious clients forge X-Forwarded-For to rotate IP addresses and bypass IP-based limits.',
        consequence: 'Bypasses rate limiting when configured to trust raw headers.',
        mitigation: 'Strip untrusted XFF headers at edge; rate limit by verified cryptographic JWT claims.',
      },
    ],
    alternativesConsidered: [
      {
        title: 'Plain HTTP (Unencrypted)',
        verdict: 'REJECTED',
        reason: 'Exposes API keys, tenant credentials, and request payloads to network eavesdropping.',
      },
    ],
    implementation: {
      technology: 'TLS 1.3 with ALPN (h2, http/1.1)',
      targetFiles: ['infra/envoy/envoy.yaml'],
      configuration: {
        'cipher-suites': 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256',
        'trusted-hops': '1',
      },
    },
    verification: {
      invariantId: 'inv-edge-tls-enforcement',
      title: 'TLS 1.3 & Authenticated Ingress Enforcement',
      formalProperty: 'Plain HTTP traffic is immediately upgraded or rejected with 301/403',
      operator: 'eq',
      expected: '100% TLS coverage',
      testStrategy: 'port_scanner_probe',
      verificationDescription: 'Assert port 80 connections reject non-redirected payloads.',
    },
  },

  {
    id: 'edge-gw-redis',
    source: 'node-gateway',
    target: 'node-redis',
    label: 'Atomic Quota Check (RESP3)',
    protocol: 'Redis RESP3 (TCP 6379)',
    latencySla: '< 1.0ms Internal',
    direction: 'bidirectional',
    purpose: 'Executes sub-millisecond atomic sliding-window Lua check before request routing.',
    whySelected: 'Lowest latency synchronous coordination protocol with pipeline support.',
    tradeOffs: [
      'Adds a synchronized network round-trip to every inbound request.',
      'Network timeouts must be bounded strictly (5ms timeout) to avoid cascading gateway delays.',
    ],
    failureModes: [
      {
        id: 'fm-e2',
        name: 'Redis Connection Timeout Cascade',
        level: 'L1',
        description: 'Slow network or Redis CPU freeze causes gateway requests to stall waiting for quota reply.',
        consequence: 'Envoy request queues fill up, crashing the ingress gateway.',
        mitigation: 'Configure hard 3ms timeout on Redis calls with circuit-breaking fail-open fallback.',
      },
    ],
    alternativesConsidered: [
      {
        title: 'HTTP REST API to Quota Service',
        verdict: 'REJECTED',
        reason: 'HTTP serialization adds 5–15ms latency per request, unacceptable on the critical path.',
      },
    ],
    implementation: {
      technology: 'ioredis / RESP3 Binary Protocol with Connection Pool',
      targetFiles: ['packages/application/src/services/redis-pool.ts'],
      configuration: {
        'connect-timeout': '1000ms',
        'command-timeout': '3ms',
        'max-retries': '0', // No retries on critical path!
      },
    },
    verification: {
      invariantId: 'inv-quota-check-latency',
      title: 'Sub-Millisecond Quota Check SLA',
      formalProperty: '99th percentile Redis check latency must remain below 1.5ms under load',
      operator: 'lte',
      expected: '1.5ms P99',
      testStrategy: 'latency_benchmark_suite',
      verificationDescription: 'Benchmark 10,000 simulated checks; assert P99 latency <= 1.5ms.',
    },
  },

  {
    id: 'edge-gw-compute',
    source: 'node-gateway',
    target: 'node-compute',
    label: 'Shielded Routing (Internal HTTP/2)',
    protocol: 'Internal HTTP/2 VPC (TCP 8080)',
    latencySla: '< 2.0ms Internal',
    direction: 'unidirectional',
    purpose: 'Routes permitted requests directly to available compute workers across private VPC network.',
    whySelected: 'HTTP/2 multiplexing allows hundreds of concurrent requests over single persistent TCP connections.',
    tradeOffs: [
      'Requires load balancing across instances with health-check monitoring.',
    ],
    failureModes: [
      {
        id: 'fm-e3',
        name: 'Zombie Instance Forwarding',
        level: 'L2',
        description: 'Gateway forwards requests to a crashed or event-loop-blocked Node.js process.',
        consequence: 'Client requests time out despite healthy sibling instances being idle.',
        mitigation: 'Implement active Envoy HTTP health checks with 500ms failure eviction.',
      },
    ],
    alternativesConsidered: [
      {
        title: 'HTTP/1.1 Short-Lived Connections',
        verdict: 'REJECTED',
        reason: 'Port exhaustion and high CPU overhead from repeated TCP handshake cycles.',
      },
    ],
    implementation: {
      technology: 'Envoy Upstream Cluster with Least Request Balancing',
      targetFiles: ['infra/envoy/clusters.yaml'],
      configuration: {
        'lb-policy': 'LEAST_REQUEST',
        'health-check-interval': '1000ms',
        'max-pending-requests': '1000',
      },
    },
    verification: {
      invariantId: 'inv-gateway-compute-shielding',
      title: 'Zero Leakage of Throttled Requests to Compute',
      formalProperty: 'Permitted traffic received by compute matches exactly quota allocation',
      operator: 'lte',
      expected: '100 req/min',
      testStrategy: 'network_packet_counter',
      verificationDescription: 'Verify compute ingress traffic graph drops to zero when tenant hits limit.',
    },
  },

  {
    id: 'edge-compute-db',
    source: 'node-compute',
    target: 'node-postgres',
    label: 'Tenant Config & Audit SQL',
    protocol: 'PostgreSQL Wire Protocol / PgBouncer (TCP 5432)',
    latencySla: '< 5.0ms Internal',
    direction: 'bidirectional',
    purpose: 'Asynchronously records rate limit violation audit trails and loads tenant tier metadata.',
    whySelected: 'Guarantees reliable persistence of enterprise compliance audit logs without blocking request latency.',
    tradeOffs: [
      'Write throughput bound by disk I/O; audit events must be batched or queued asynchronously.',
    ],
    failureModes: [
      {
        id: 'fm-e4',
        name: 'Synchronous Audit Log Blocking',
        level: 'L1',
        description: 'Logging 429 rejections synchronously to PostgreSQL halts gateway throughput.',
        consequence: 'Attacker flood exhausts database connections through audit logging side effect.',
        mitigation: 'Buffer audit logs in memory or Kafka/Redis queue with batch flush to PostgreSQL.',
      },
    ],
    alternativesConsidered: [
      {
        title: 'Synchronous INSERT on Every 429 Event',
        verdict: 'REJECTED',
        reason: 'A rate limit attack would paradoxically take down the relational database via logging amplification.',
      },
    ],
    implementation: {
      technology: 'PgBouncer Connection Pooler with Batch Audit Queue',
      targetFiles: ['packages/application/src/services/audit-queue.ts'],
      configuration: {
        'batch-size': '100 events',
        'flush-interval': '2000ms',
        'pool-size': '20',
      },
    },
    verification: {
      invariantId: 'inv-audit-isolation',
      title: 'Audit Logging Backpressure Decoupling',
      formalProperty: 'Database downtime does not cause rate-limiter to reject or stall API requests',
      operator: 'eq',
      expected: 'Zero API degradation during DB outage',
      testStrategy: 'fault_injection_db_kill',
      verificationDescription: 'Terminate PostgreSQL during active traffic flood; verify rate limiter continues serving 429/200 cleanly.',
    },
  },
];
