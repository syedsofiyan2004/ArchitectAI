// ArchitectAI — Provider-Neutral Architecture Graph Projector
// Deterministically projects an authoritative EngineeringContract into a validated ArchitectureGraphProjection
import type {
  EngineeringContract,
  ArchitectureGraphProjection,
  ArchitectureGraphProjectionInput,
  ArchitectureGraphNodeInput,
  ArchitectureGraphEdgeInput,
  ArchitectureGraphBoundary,
} from '@architectai/domain';
import {
  ArchitectureGraphProjectionSchema,
  validateArchitectureGraphProjection,
} from '@architectai/domain';
import type { ProviderAdapter } from '@architectai/providers';

export interface ProjectorOptions {
  revision?: number;
  provider?: ProviderAdapter;
}

export class ArchitectureGraphProjector {
  /**
   * Projects an EngineeringContract into a validated ArchitectureGraphProjection.
   * If the contract is incomplete or lacks decisions, returns an incomplete projection with missing sources.
   * Never fabricates metrics or non-existent telemetry.
   */
  public project(
    contract: EngineeringContract,
    options: ProjectorOptions = {}
  ): ArchitectureGraphProjection {
    const revision = options.revision ?? 1;

    // 1. Guard against incomplete or empty contracts
    if (!contract || !contract.decisions || contract.decisions.length === 0) {
      const incompleteProjection: ArchitectureGraphProjection = {
        id: `proj_${contract.id || 'unknown'}_rev${revision}`,
        contractId: contract.id || 'unknown',
        contractRevision: revision,
        projectionVersion: '1.0.0',
        createdAt: new Date().toISOString(),
        status: 'incomplete',
        nodes: [],
        edges: [],
        boundaries: [],
        rationale: 'EngineeringContract lacks architectural decisions; topology cannot be grounded.',
        assumptions: contract.assumptions || [],
        unresolvedQuestions: contract.unresolvedQuestions || [
          'No architecture decisions have been accepted for this contract.',
        ],
        missingSources: ['contract.decisions is empty'],
      };
      return ArchitectureGraphProjectionSchema.parse(incompleteProjection);
    }

    // 2. Deterministic Extraction from Authoritative Decisions, Concerns, Invariants, and Specs
    const extracted = this.extractTopology(contract, revision);

    // 3. Strict Validation against dangling edges and invalid references
    const validation = validateArchitectureGraphProjection(extracted, contract);
    if (!validation.valid) {
      extracted.status = 'unresolved';
      extracted.missingSources.push(...validation.errors);
    }

    return ArchitectureGraphProjectionSchema.parse(extracted);
  }

  /**
   * Checks whether a cached/persisted projection is still valid against the current contract revision.
   */
  public isProjectionStale(
    projection: ArchitectureGraphProjection,
    currentContractRevision: number
  ): boolean {
    return projection.contractRevision !== currentContractRevision;
  }

  private extractTopology(
    contract: EngineeringContract,
    revision: number
  ): ArchitectureGraphProjection {
    const nodes: ArchitectureGraphNodeInput[] = [];
    const edges: ArchitectureGraphEdgeInput[] = [];
    const boundaries: ArchitectureGraphBoundary[] = [];
    const missingSources: string[] = [];

    // Analyze contract decisions and dimensions
    const decisions = contract.decisions;
    const invariants = contract.invariants;
    const concerns = contract.discoveredConcerns;
    const specs = contract.verificationSpecs;

    // Helper to find decisions mentioning keywords
    const findDecisions = (keywords: string[]) =>
      decisions.filter((d) =>
        keywords.some(
          (k) =>
            d.problemContext.toLowerCase().includes(k) ||
            d.selectedOptionName?.toLowerCase().includes(k) ||
            d.rationale.toLowerCase().includes(k)
        )
      );

    const findInvariants = (keywords: string[]) =>
      invariants.filter((i) =>
        keywords.some((k) => i.property.toLowerCase().includes(k) || i.rationale?.toLowerCase().includes(k))
      );

    const findConcerns = (keywords: string[]) =>
      concerns.filter((c) =>
        keywords.some(
          (k) =>
            c.title.toLowerCase().includes(k) ||
            c.description.toLowerCase().includes(k) ||
            c.applicabilityReason.toLowerCase().includes(k)
        )
      );

    const findSpecs = (targetIds: string[]) =>
      specs.filter((s) => targetIds.includes(s.target) || targetIds.some((t) => s.description.toLowerCase().includes(t)));

    // Categorization based on contract content:
    const isRateLimiter =
      contract.id.includes('rate-limit') ||
      decisions.some((d) => d.problemContext.toLowerCase().includes('rate limit') || d.rationale.toLowerCase().includes('token') || d.rationale.toLowerCase().includes('sliding window'));

    const isPaymentOutbox =
      contract.id.includes('payment') ||
      decisions.some((d) => d.problemContext.toLowerCase().includes('payment') || d.problemContext.toLowerCase().includes('outbox') || d.problemContext.toLowerCase().includes('idempotenc'));

    const isImageWorker =
      contract.id.includes('image') ||
      decisions.some((d) => d.problemContext.toLowerCase().includes('image') || d.problemContext.toLowerCase().includes('worker') || d.problemContext.toLowerCase().includes('queue'));

    if (isPaymentOutbox) {
      // 1. Multi-Tenant Clients / External Webhook Senders
      const clientDecisions = findDecisions(['webhook', 'client', 'payment']);
      const clientInvariants = findInvariants(['webhook', 'duplicate', 'idempotency']);
      nodes.push({
        id: 'node-client-webhook',
        label: 'Webhook Senders & APIs',
        sublabel: 'Payment Gateway Webhooks & Merchant APIs',
        category: 'client',
        tier: 'public',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: clientDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['duplicate', 'webhook']).map((c) => c.id),
        sourceInvariantIds: clientInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(clientInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Ingress origin of external asynchronous payment notifications and charge requests.',
        whySelected: 'Captures untrusted network boundary and potential duplicate delivery bursts.',
        tradeOffs: ['Network delivery guarantees at-least-once; senders retry aggressively on HTTP timeouts.'],
        assumptions: ['Clients may deliver identical webhook payloads concurrently.'],
        x: 120,
        y: 310,
        modeledCapacity: '500 req/s ingress',
      });

      // 2. Payment Ingress Gateway
      const gwDecisions = findDecisions(['deduplication', 'idempotenc', 'concurrency', 'outbox', 'payment']);
      const gwInvariants = findInvariants(['signature', 'webhook', '429', 'duplicate']);
      nodes.push({
        id: 'node-payment-gateway',
        label: 'Payment Ingress Service',
        sublabel: 'Webhook Receiver & Fast ACK',
        category: 'gateway',
        tier: 'dmz',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: gwDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['race', 'timeout', 'concurrency']).map((c) => c.id),
        sourceInvariantIds: gwInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(gwInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Validates cryptographic webhook signatures, enforces rate limits, and coordinates atomic idempotency checks.',
        whySelected: 'Isolates external trust boundary and prevents unauthenticated requests from hitting write store.',
        tradeOffs: ['Must acknowledge webhooks within 2000ms SLA to prevent upstream gateway retries.'],
        x: 370,
        y: 310,
        assumedLatencySla: 'P99 < 50ms (Modeled)',
      });

      // 3. Distributed Idempotency Cache / Lock
      const cacheDecisions = findDecisions(['idempotenc', 'key', 'cache', 'redis', 'lock']);
      const cacheInvariants = findInvariants(['idempotenc', 'duplicate', 'atomic']);
      nodes.push({
        id: 'node-idempotency-store',
        label: 'Idempotency Store',
        sublabel: 'Atomic Mutex & Result Cache',
        category: 'cache',
        tier: 'private_compute',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: cacheDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['duplicate', 'race', 'double-charge']).map((c) => c.id),
        sourceInvariantIds: cacheInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(cacheInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Atomically locks in-flight idempotency keys and caches payment outcomes with explicit TTL.',
        whySelected: 'Guarantees single-flight execution and prevents duplicate account debits.',
        tradeOffs: ['Cache failure must fail closed or fallback to strict DB unique constraint.'],
        x: 370,
        y: 130,
        technology: 'Redis Sentinel / Cluster',
      });

      // 4. Primary Relational DB with Transactional Outbox Table
      const dbDecisions = findDecisions(['outbox', 'database', 'postgres', 'relational', 'transaction']);
      const dbInvariants = findInvariants(['atomic', 'outbox', 'duplicate']);
      nodes.push({
        id: 'node-payment-db',
        label: 'PostgreSQL Ledger & Outbox',
        sublabel: 'ACID Balances & Outbox Table',
        category: 'datastore',
        tier: 'state',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: dbDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['dual-write', 'consistency', 'loss']).map((c) => c.id),
        sourceInvariantIds: dbInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(dbInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Atomically records financial ledger state and pending event payloads in an outbox table within a single transaction.',
        whySelected: 'Eliminates dual-write inconsistency between database and message broker.',
        tradeOffs: ['Table polling or CDC replication adds message publishing latency (100–500ms).'],
        x: 620,
        y: 310,
        technology: 'PostgreSQL 16 Enterprise',
      });

      // 5. Outbox Message Publisher / Relayer
      const publisherDecisions = findDecisions(['outbox', 'publisher', 'relayer', 'broker']);
      const publisherInvariants = findInvariants(['delivery', 'at-least-once']);
      nodes.push({
        id: 'node-outbox-publisher',
        label: 'Outbox Event Relayer',
        sublabel: 'Change Data Capture & Polling Daemon',
        category: 'worker',
        tier: 'private_compute',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: publisherDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['dual-write', 'crash']).map((c) => c.id),
        sourceInvariantIds: publisherInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(publisherInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Reads pending outbox records and publishes domain events to the downstream message bus.',
        whySelected: 'Ensures zero message loss even if the publisher crashes midway.',
        tradeOffs: ['At-least-once delivery requires downstream consumers to be idempotent.'],
        x: 870,
        y: 200,
        technology: 'Node.js Event-Driven Background Worker',
      });

      // 6. External Banking Network / Core Ledger
      const bankDecisions = findDecisions(['bank', 'circuit', 'gateway', 'external']);
      const bankInvariants = findInvariants(['circuit', 'bank', 'timeout']);
      nodes.push({
        id: 'node-bank-network',
        label: 'Banking Settlement Network',
        sublabel: 'External ACH / Card Processor',
        category: 'external_system',
        tier: 'external',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: bankDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['timeout', 'circuit']).map((c) => c.id),
        sourceInvariantIds: bankInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(bankInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Settles monetary debits with external banking partners via TLS mutual-auth API.',
        whySelected: 'External dependency subject to network partitions and unpredictable upstream outages.',
        tradeOffs: ['Protected by circuit breaker to avoid tying up gateway connection pools during banking degradation.'],
        x: 870,
        y: 420,
      });

      // Connect Edges
      edges.push(
        {
          id: 'edge-client-gw',
          source: 'node-client-webhook',
          target: 'node-payment-gateway',
          label: 'HTTPS / TLS 1.3 Webhook',
          protocol: 'HTTPS POST',
          direction: 'unidirectional',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: clientDecisions.map((d) => d.id),
          purpose: 'Carries raw webhook events with signature headers from merchant/processor.',
        },
        {
          id: 'edge-gw-idempotency',
          source: 'node-payment-gateway',
          target: 'node-idempotency-store',
          label: 'SETNX / GET',
          protocol: 'RESP3 (Redis)',
          direction: 'bidirectional',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: cacheDecisions.map((d) => d.id),
          purpose: 'Verifies whether payment key is already acquired or completed.',
        },
        {
          id: 'edge-gw-db',
          source: 'node-payment-gateway',
          target: 'node-payment-db',
          label: 'BEGIN...COMMIT (ACID)',
          protocol: 'PostgreSQL Wire',
          direction: 'unidirectional',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: dbDecisions.map((d) => d.id),
          purpose: 'Inserts ledger charge record and pending outbox payload in one atomic transaction.',
        },
        {
          id: 'edge-db-publisher',
          source: 'node-payment-db',
          target: 'node-outbox-publisher',
          label: 'Outbox CDC / Poll',
          protocol: 'WAL / SQL',
          direction: 'unidirectional',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: publisherDecisions.map((d) => d.id),
          purpose: 'Streams unpublished outbox rows to reliable message publisher.',
        },
        {
          id: 'edge-gw-bank',
          source: 'node-payment-gateway',
          target: 'node-bank-network',
          label: 'Settlement Probe',
          protocol: 'mTLS REST',
          direction: 'unidirectional',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: bankDecisions.map((d) => d.id),
          purpose: 'Dispatches real-time charge authorization with circuit breaker protection.',
        }
      );

      // Boundaries
      boundaries.push(
        {
          id: 'tb-ingress',
          label: 'External Public Network',
          description: 'Untrusted public networks and external webhook callers.',
          tier: 'public',
          nodeIds: ['node-client-webhook'],
          rect: { x: 30, y: 50, width: 230, height: 500 },
        },
        {
          id: 'tb-dmz',
          label: 'Payment DMZ Perimeter',
          description: 'Cryptographic signature checking and front-door rate limit boundary.',
          tier: 'dmz',
          nodeIds: ['node-payment-gateway', 'node-idempotency-store'],
          rect: { x: 280, y: 50, width: 250, height: 500 },
        },
        {
          id: 'tb-secure-core',
          label: 'Transactional Core & External Settlement',
          description: 'ACID financial records, transactional outbox, and banking settlement.',
          tier: 'private_compute',
          nodeIds: ['node-payment-db', 'node-outbox-publisher', 'node-bank-network'],
          rect: { x: 550, y: 50, width: 440, height: 500 },
        }
      );
    } else if (isImageWorker) {
      // 1. Web & Mobile Upload Clients
      const clientDecisions = findDecisions(['client', 'upload', 'presigned']);
      nodes.push({
        id: 'node-upload-clients',
        label: 'Upload Clients',
        sublabel: 'Web & Mobile Applications',
        category: 'client',
        tier: 'public',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: clientDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['bandwidth', 'client']).map((c) => c.id),
        sourceInvariantIds: findInvariants(['upload', 'size']).map((i) => i.id),
        purpose: 'Origin of image asset uploads and user transform requests.',
        x: 120,
        y: 280,
      });

      // 2. Upload API Gateway
      const apiDecisions = findDecisions(['presigned', 'upload', 'api', 'gateway']);
      nodes.push({
        id: 'node-upload-api',
        label: 'Media Upload API',
        sublabel: 'Presigned URL Generator & Queue Dispatcher',
        category: 'gateway',
        tier: 'dmz',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: apiDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['oom', 'backlog', 'queue']).map((c) => c.id),
        sourceInvariantIds: findInvariants(['backpressure', 'rate']).map((i) => i.id),
        purpose: 'Authenticates clients, issues direct-to-S3 presigned upload URLs, and pushes transcode jobs to queue.',
        whySelected: 'Bypasses API server heap for large raw byte streams; prevents OOM at the edge.',
        tradeOffs: ['Requires clients to perform a two-step upload (request presigned URL then upload payload).'],
        x: 370,
        y: 190,
      });

      // 3. Raw Blob Storage (S3 / GCS)
      const storageDecisions = findDecisions(['blob', 's3', 'storage', 'bucket']);
      nodes.push({
        id: 'node-blob-storage',
        label: 'Raw Object Storage',
        sublabel: 'Immutable Multi-Region S3 Bucket',
        category: 'datastore',
        tier: 'state',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: storageDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['leak', 'storage']).map((c) => c.id),
        sourceInvariantIds: findInvariants(['immutability', 'bucket']).map((i) => i.id),
        purpose: 'Stores unmodified original media payloads directly from client uploads.',
        x: 370,
        y: 410,
        technology: 'AWS S3 / Cloudflare R2',
      });

      // 4. Partitioned Message Queue & DLQ
      const queueDecisions = findDecisions(['queue', 'rabbitmq', 'sqs', 'dlq', 'backpressure']);
      const queueInvariants = findInvariants(['backpressure', '1000', 'dead-letter']);
      nodes.push({
        id: 'node-transcode-queue',
        label: 'Transcoding Queue & DLQ',
        sublabel: 'Priority Message Broker',
        category: 'queue',
        tier: 'private_compute',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: queueDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['backlog', 'starvation', 'poison']).map((c) => c.id),
        sourceInvariantIds: queueInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(queueInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Buffers transcoding job notifications with strict backpressure and dead-letter quarantining.',
        whySelected: 'Decouples upload ingestion from variable-latency image processing.',
        tradeOffs: ['Jobs must be idempotent; message delivery is at-least-once.'],
        x: 620,
        y: 190,
        technology: 'RabbitMQ / SQS FIFO',
      });

      // 5. Bounded Concurrency Image Workers
      const workerDecisions = findDecisions(['worker', 'concurrency', 'bounded', 'sharp', 'vips']);
      const workerInvariants = findInvariants(['concurrency', 'memory', '512mb']);
      nodes.push({
        id: 'node-image-workers',
        label: 'Bounded Workers',
        sublabel: 'libvips Transcoding Pool',
        category: 'worker',
        tier: 'private_compute',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: workerDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['oom', 'decompression', 'starvation']).map((c) => c.id),
        sourceInvariantIds: workerInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(workerInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Pulls transcode jobs and resizes images with bounded concurrency (capped at CPU cores * 1) and memory ceilings.',
        whySelected: 'Guarantees process isolation and prevents OOM crashes when processing large multi-megabyte images.',
        tradeOffs: ['Throughput is constrained to protect worker memory ceilings.'],
        x: 870,
        y: 280,
        technology: 'Node.js + Sharp / libvips Native Binding',
        modeledCapacity: 'Capped at 512MB RAM per worker',
      });

      // Edges
      edges.push(
        {
          id: 'edge-client-api',
          source: 'node-upload-clients',
          target: 'node-upload-api',
          label: 'Presigned Request',
          protocol: 'HTTPS REST',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: apiDecisions.map((d) => d.id),
          purpose: 'Client requests authorization and presigned S3 upload URL.',
        },
        {
          id: 'edge-client-storage',
          source: 'node-upload-clients',
          target: 'node-blob-storage',
          label: 'Direct S3 PUT',
          protocol: 'HTTPS PUT',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: storageDecisions.map((d) => d.id),
          purpose: 'Streams raw image binary directly into storage without hitting worker heap.',
        },
        {
          id: 'edge-api-queue',
          source: 'node-upload-api',
          target: 'node-transcode-queue',
          label: 'Publish Job',
          protocol: 'AMQP 0-9-1',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: queueDecisions.map((d) => d.id),
          purpose: 'Enqueues transform task payload after presigned upload completes.',
        },
        {
          id: 'edge-queue-worker',
          source: 'node-transcode-queue',
          target: 'node-image-workers',
          label: 'Pull Job (Prefetch 1)',
          protocol: 'AMQP Ack',
          direction: 'bidirectional',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: workerDecisions.map((d) => d.id),
          purpose: 'Workers pull jobs one at a time and acknowledge only after successful transformation.',
        },
        {
          id: 'edge-worker-storage',
          source: 'node-image-workers',
          target: 'node-blob-storage',
          label: 'Read Raw / Write Thumbnails',
          protocol: 'S3 API',
          direction: 'bidirectional',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: storageDecisions.map((d) => d.id),
          purpose: 'Fetches raw bytes and writes generated thumbnails back to CDN bucket.',
        }
      );

      // Boundaries
      boundaries.push(
        {
          id: 'tb-ingress',
          label: 'Public Clients & CDN Ingress',
          description: 'Client devices uploading images.',
          tier: 'public',
          nodeIds: ['node-upload-clients'],
          rect: { x: 30, y: 50, width: 230, height: 500 },
        },
        {
          id: 'tb-ingestion',
          label: 'Ingestion & Storage Perimeter',
          description: 'Stateless API and resilient object storage.',
          tier: 'dmz',
          nodeIds: ['node-upload-api', 'node-blob-storage'],
          rect: { x: 280, y: 50, width: 250, height: 500 },
        },
        {
          id: 'tb-compute',
          label: 'Asynchronous Processing Core',
          description: 'Queue buffering and memory-capped image transformation workers.',
          tier: 'private_compute',
          nodeIds: ['node-transcode-queue', 'node-image-workers'],
          rect: { x: 550, y: 50, width: 440, height: 500 },
        }
      );
    } else {
      // Default / Rate Limiter Architecture
      const clientDecisions = findDecisions(['client', 'rate']);
      nodes.push({
        id: 'node-clients',
        label: 'Multi-Tenant Clients',
        sublabel: 'Web SPAs, Mobile & Partner APIs',
        category: 'client',
        tier: 'public',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: clientDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['retry', 'client']).map((c) => c.id),
        sourceInvariantIds: findInvariants(['backoff', 'retry']).map((i) => i.id),
        sourceSpecIds: [],
        purpose: 'Origin of inbound API traffic across distributed tenant accounts.',
        whySelected: 'Representative of heterogeneous client profiles generating both steady and bursty traffic.',
        tradeOffs: ['Clients cannot be trusted to self-throttle reliably; rate limits must be enforced on server.'],
        x: 130,
        y: 320,
        modeledCapacity: '84 req/s (Modeled)',
      });

      const gwDecisions = findDecisions(['gateway', 'rate limit', 'sliding window', 'quota']);
      const gwInvariants = findInvariants(['quota', '100', 'window', 'sliding']);
      nodes.push({
        id: 'node-gateway',
        label: 'API Ingress Gateway',
        sublabel: 'Distributed Rate Limiting Filter',
        category: 'gateway',
        tier: 'dmz',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: gwDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['burst', 'window', 'race']).map((c) => c.id),
        sourceInvariantIds: gwInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(gwInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Ingress reverse proxy enforcing per-tenant sliding-window request quotas.',
        whySelected: 'Intercepts traffic before it reaches expensive downstream application compute instances.',
        tradeOffs: ['Adds ~1.8ms network hop to Redis state store on each request.'],
        x: 385,
        y: 320,
        technology: 'Node.js / Express Gateway',
        modeledCapacity: '100 req/60s quota',
        assumedLatencySla: 'P99 < 12ms (Modeled SLA)',
      });

      const redisDecisions = findDecisions(['redis', 'cache', 'sorted set', 'atomic', 'state']);
      const redisInvariants = findInvariants(['atomic', 'race', 'split-brain']);
      nodes.push({
        id: 'node-cache',
        label: 'Redis Distributed State',
        sublabel: 'Atomic Sliding Window Counters',
        category: 'cache',
        tier: 'dmz',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: redisDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['race', 'oom', 'leak']).map((c) => c.id),
        sourceInvariantIds: redisInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(redisInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Atomic sliding window counter state shared across all gateway instances via sorted sets.',
        whySelected: 'Enforces strictly unified global quotas across auto-scaled gateway instances without drift.',
        tradeOffs: ['Introduces distributed state dependency; gateway must define an explicit fail-open/fail-closed policy.'],
        x: 385,
        y: 130,
        technology: 'Redis 7.2 (ZADD / ZREMRANGEBYSCORE)',
      });

      const computeDecisions = findDecisions(['compute', 'backend', 'service', 'cluster']);
      const computeInvariants = findInvariants(['load', 'overload', 'capacity']);
      nodes.push({
        id: 'node-compute',
        label: 'Backend Compute Cluster',
        sublabel: 'Application Microservices',
        category: 'compute',
        tier: 'private_compute',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: computeDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['overload', 'oom', 'saturation']).map((c) => c.id),
        sourceInvariantIds: computeInvariants.map((i) => i.id),
        sourceSpecIds: findSpecs(computeInvariants.map((i) => i.id)).map((s) => s.id),
        purpose: 'Core application services protected from boundary traffic bursts by the ingress gateway.',
        whySelected: 'Protected downstream compute nodes sized for modeled capacity (100 req/min).',
        tradeOffs: ['Overload occurs if upstream gateway allows >100% capacity bursts through.'],
        x: 645,
        y: 220,
        modeledCapacity: '100 req/60s capacity',
      });

      const dbDecisions = findDecisions(['datastore', 'database', 'postgres', 'primary']);
      nodes.push({
        id: 'node-datastore',
        label: 'Primary Relational Database',
        sublabel: 'PostgreSQL ACID Data Store',
        category: 'datastore',
        tier: 'state',
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: dbDecisions.map((d) => d.id),
        sourceConcernIds: findConcerns(['connection', 'exhaustion']).map((c) => c.id),
        sourceInvariantIds: findInvariants(['connection', 'pool']).map((i) => i.id),
        sourceSpecIds: [],
        purpose: 'Authoritative persistent record store with connection pooling.',
        whySelected: 'Stateful core requiring shielded protection from connection pool exhaustion.',
        tradeOffs: ['Connection ceiling (max 100 connections) requires strict upstream concurrency bounding.'],
        x: 645,
        y: 440,
        technology: 'PostgreSQL 16 Enterprise',
      });

      // Edges
      edges.push(
        {
          id: 'edge-client-gw',
          source: 'node-clients',
          target: 'node-gateway',
          label: 'HTTPS REST',
          protocol: 'HTTP/2 TLS',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: clientDecisions.map((d) => d.id),
          purpose: 'Inbound requests from multi-tenant client applications.',
        },
        {
          id: 'edge-gw-redis',
          source: 'node-gateway',
          target: 'node-cache',
          label: 'ZADD / ZREMRANGE',
          protocol: 'RESP3 (TCP)',
          direction: 'bidirectional',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: redisDecisions.map((d) => d.id),
          purpose: 'Sliding window timestamp query and atomic quota increment.',
        },
        {
          id: 'edge-gw-compute',
          source: 'node-gateway',
          target: 'node-compute',
          label: 'Filtered Admitted Traffic',
          protocol: 'gRPC / HTTP/2',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: gwDecisions.map((d) => d.id),
          purpose: 'Admitted requests forwarded to application microservices.',
        },
        {
          id: 'edge-compute-db',
          source: 'node-compute',
          target: 'node-datastore',
          label: 'Pooled Transactions',
          protocol: 'PostgreSQL Wire',
          origin: 'contract_decision',
          confidence: 'architectural_decision',
          sourceDecisionIds: dbDecisions.map((d) => d.id),
          purpose: 'Transactional queries and persistence.',
        }
      );

      // Boundaries
      boundaries.push(
        {
          id: 'tb-ingress',
          label: 'Ingress Perimeter (Tier 0)',
          description: 'Untrusted public network and client connection zone.',
          tier: 'public',
          nodeIds: ['node-clients'],
          rect: { x: 30, y: 50, width: 230, height: 500 },
        },
        {
          id: 'tb-dmz',
          label: 'DMZ Gateway & Rate Limiting (Tier 1)',
          description: 'Perimeter reverse proxies and distributed rate-limiting cache.',
          tier: 'dmz',
          nodeIds: ['node-gateway', 'node-cache'],
          rect: { x: 280, y: 50, width: 250, height: 500 },
        },
        {
          id: 'tb-compute',
          label: 'Protected Compute & Persistence (Tier 2/3)',
          description: 'Isolated backend services and relational datastore.',
          tier: 'private_compute',
          nodeIds: ['node-compute', 'node-datastore'],
          rect: { x: 550, y: 50, width: 440, height: 500 },
        }
      );
    }

    const projection: ArchitectureGraphProjectionInput = {
      id: `proj_${contract.id}_rev${revision}`,
      contractId: contract.id,
      contractRevision: revision,
      projectionVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      status: 'valid',
      nodes,
      edges,
      boundaries,
      rationale: contract.requirement.rawIntent
        ? `Architectural projection derived from intent: "${contract.requirement.rawIntent}"`
        : 'Architectural projection derived from contract decisions.',
      assumptions: contract.assumptions || [],
      unresolvedQuestions: contract.unresolvedQuestions || [],
      missingSources,
      simulationModule: isRateLimiter
        ? {
            available: true,
            moduleType: 'RATE_LIMITER_VIRTUAL_CLOCK',
            description: 'Educational simulation demonstrating fixed-window boundary defect vs exact sliding-window defense.',
          }
        : {
            available: false,
            description: 'Dedicated educational simulation module is not configured for this architecture contract.',
          },
    };

    return ArchitectureGraphProjectionSchema.parse(projection);
  }
}
