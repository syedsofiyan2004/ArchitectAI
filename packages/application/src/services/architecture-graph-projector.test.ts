// Unit & Adversarial Grounding Tests for ArchitectureGraphProjector & Graph Validation
import { describe, it, expect } from 'vitest';
import { ArchitectureGraphProjector } from './architecture-graph-projector';
import {
  validateArchitectureGraphProjection,
  ArchitectureGraphProjectionSchema,
  computeContractFingerprint,
  type EngineeringContract,
  type ArchitectureGraphProjection,
} from '@architectai/domain';
import { DeterministicDemoProviderAdapter } from '@architectai/providers';

describe('ArchitectureGraphProjector & Grounding Closure Suite', () => {
  const projector = new ArchitectureGraphProjector();

  const standardContract: EngineeringContract = {
    id: 'contract-standard-system',
    version: '1.0.0',
    requirement: {
      id: 'req-std',
      rawIntent: 'Build a secure API gateway with in-memory caching and relational database.',
      explicitConstraints: ['Max 100 req/s'],
      declaredTechStack: ['Node.js', 'Redis', 'PostgreSQL'],
      context: { title: 'Standard System' },
    },
    discoveredConcerns: [
      {
        id: 'concern-race',
        requirementId: 'req-std',
        title: 'Concurrent State Race Condition',
        description: 'Multi-instance concurrency requires distributed synchronization.',
        applicabilityReason: 'Independent API replicas.',
        dimensions: ['concurrency', 'shared_mutable_state'],
        supportingKnowledgeIds: [],
        confidence: 0.9,
        assumptions: [],
        unresolvedQuestions: [],
      },
    ],
    decisions: [
      {
        id: 'dec-gw',
        problemContext: 'API Ingress Gateway',
        consideredOptions: [{ id: 'opt-gw', name: 'Express Reverse Proxy Gateway', description: 'Ingress router' }],
        selectedOptionId: 'opt-gw',
        selectedOptionName: 'Express Reverse Proxy Gateway',
        rationale: 'Terminates untrusted client traffic at public perimeter.',
        evidence: [],
        assumptions: ['Clients connect via HTTPS'],
        risksAndTradeoffs: ['Reverse proxy latency hop'],
        verificationRequirements: [],
        reconsiderationTriggers: [],
      },
      {
        id: 'dec-cache',
        problemContext: 'In-Memory Redis Cache',
        consideredOptions: [{ id: 'opt-redis', name: 'Redis Key-Value Cache', description: 'Fast cache store' }],
        selectedOptionId: 'opt-redis',
        selectedOptionName: 'Redis Key-Value Cache',
        rationale: 'Caches frequently queried user sessions.',
        evidence: [],
        assumptions: ['Redis memory is monitored'],
        risksAndTradeoffs: ['Cache stampede on cold boot'],
        verificationRequirements: [],
        reconsiderationTriggers: [],
      },
      {
        id: 'dec-db',
        problemContext: 'Relational Database Datastore',
        consideredOptions: [{ id: 'opt-pg', name: 'PostgreSQL Relational DB', description: 'ACID persistence' }],
        selectedOptionId: 'opt-pg',
        selectedOptionName: 'PostgreSQL Relational DB',
        rationale: 'Persists user profiles and authoritative account records.',
        evidence: [],
        assumptions: [],
        risksAndTradeoffs: [],
        verificationRequirements: [],
        reconsiderationTriggers: [],
      },
    ],
    invariants: [
      {
        id: 'inv-throughput',
        property: 'System must sustain 100 req/s under peak client load.',
        severity: 'critical',
        blocksCompletion: true,
        rationale: 'Capacity requirement.',
      },
    ],
    verificationSpecs: [
      {
        id: 'spec-load',
        target: 'inv-throughput',
        description: 'Load test at 100 req/s.',
        setup: 'Spin up test containers.',
        action: 'Send 100 req/s for 60s.',
        expectedProperty: 'Zero 500 errors.',
        evidenceToCollect: ['status_codes'],
        isAutomatable: true,
      },
    ],
    assumptions: ['System runs on containerized Linux environment.'],
    unresolvedQuestions: ['What failover strategy is needed for PostgreSQL primary?'],
    metadata: {
      status: 'accepted',
      createdAt: '2026-10-14T08:00:00.000Z',
      tags: [],
    },
  };

  // 1. Schema Validation & Provenance
  it('1. projects valid schema with contract fingerprint and grounded provenance', () => {
    const projection = projector.projectSync(standardContract, { revision: 1 });
    expect(projection.status).toBe('valid');
    expect(projection.contractId).toBe(standardContract.id);
    expect(projection.contractRevision).toBe(1);
    expect(projection.contractFingerprint).toMatch(/^cfp_[a-f0-9]{16}$/);
    expect(projection.nodes.length).toBeGreaterThan(0);
    expect(projection.edges.length).toBeGreaterThan(0);

    const validation = validateArchitectureGraphProjection(projection, standardContract);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  // 2. Rejecting Dangling Edges
  it('2. detects and rejects dangling edges where target does not exist', () => {
    const projection = projector.projectSync(standardContract, { revision: 1 });
    projection.edges.push({
      id: 'edge-dangling-ghost',
      source: projection.nodes[0]!.id,
      target: 'node-nonexistent-ghost-target',
      label: 'Dangling Call',
      protocol: 'HTTPS',
      direction: 'unidirectional',
      isSelfLoop: false,
      origin: 'inferred_topology',
      confidence: 'inferred_proposed',
      sourceDecisionIds: [],
      sourceConcernIds: [],
      sourceInvariantIds: [],
      sourceSpecIds: [],
      purpose: 'Invalid call to non-existent node',
      whySelected: '',
      assumptions: [],
      evidenceReferences: [],
    });

    const validation = validateArchitectureGraphProjection(projection, standardContract);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('Dangling edge detected'))).toBe(true);
  });

  // 3. Rejecting Invalid Provenance Reference IDs
  it('3. rejects fabricated provenance references not present in the contract', () => {
    const projection = projector.projectSync(standardContract, { revision: 1 });
    projection.nodes[0]!.sourceDecisionIds = ['dec-hallucinated-id-999'];

    const validation = validateArchitectureGraphProjection(projection, standardContract);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('invalid/missing decision ID'))).toBe(true);
  });

  // 4. Incomplete Contract Graceful Fallback
  it('4. returns incomplete projection with useful next questions when contract has no decisions', () => {
    const incompleteContract: EngineeringContract = {
      id: 'contract-draft-001',
      version: '0.1.0',
      requirement: {
        id: 'req-draft',
        rawIntent: 'User wants an online store but gave no details.',
        explicitConstraints: [],
        declaredTechStack: [],
        context: {},
      },
      discoveredConcerns: [],
      decisions: [],
      invariants: [],
      verificationSpecs: [],
      assumptions: [],
      unresolvedQuestions: ['What payment gateways are supported?'],
      metadata: {
        status: 'draft',
        createdAt: '2026-10-14T08:00:00.000Z',
        tags: [],
      },
    };

    const projection = projector.projectSync(incompleteContract);
    expect(projection.status).toBe('incomplete');
    expect(projection.nodes).toHaveLength(0);
    expect(projection.edges).toHaveLength(0);
    expect(projection.missingSources).toContain('contract.decisions is empty');
    expect(projection.unresolvedQuestions.length).toBeGreaterThan(0);
  });

  // 5. Content-Fingerprint & Revision Stale Detection
  it('5. detects projection staleness when contract content changes even without revision bump', () => {
    const projection = projector.projectSync(standardContract, { revision: 1 });
    expect(projector.isProjectionStale(projection, standardContract, 1)).toBe(false);
    expect(projector.isProjectionStale(projection, standardContract, 2)).toBe(true);

    // Modify a contract decision without bumping revision number
    const mutatedContract = structuredClone(standardContract);
    mutatedContract.decisions[0]!.rationale = 'Changed rationale radically to Kafka event streaming.';
    expect(projector.isProjectionStale(projection, mutatedContract, 1)).toBe(true);
  });

  // 6. Adversarial Unseen Contract 1: Appointment Booking with Concurrent Seat Reservation
  it('6. unseen contract 1 (Appointment Booking) produces booking topology, NOT rate limiter graph', () => {
    const bookingContract: EngineeringContract = {
      id: 'contract-appointment-booking',
      version: '1.0.0',
      requirement: {
        id: 'req-booking',
        rawIntent: 'Build a doctor appointment booking service with concurrent seat and time slot reservations.',
        explicitConstraints: ['No double booking permitted'],
        declaredTechStack: ['Node.js', 'PostgreSQL', 'Redis'],
        context: { clientType: 'Patient & Clinic Portals' },
      },
      discoveredConcerns: [
        {
          id: 'concern-double-booking',
          requirementId: 'req-booking',
          title: 'Concurrent Appointment Slot Race Condition',
          description: 'Two patients booking the same appointment slot simultaneously.',
          applicabilityReason: 'Shared calendar state without atomic slot acquisition.',
          dimensions: ['concurrency', 'shared_mutable_state'],
          supportingKnowledgeIds: [],
          confidence: 0.95,
          assumptions: [],
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'dec-slot-mutex',
          problemContext: 'Distributed Slot Hold Mutex',
          consideredOptions: [{ id: 'opt-mutex', name: 'Redis Distributed Slot Lock (SETNX with 10m TTL)', description: 'Locks slot during checkout' }],
          selectedOptionId: 'opt-mutex',
          selectedOptionName: 'Redis Distributed Slot Lock (SETNX with 10m TTL)',
          rationale: 'Holds the appointment slot for 10 minutes to prevent double booking during checkout.',
          evidence: [],
          assumptions: ['Hold timeout releases slot if checkout abandoned.'],
          risksAndTradeoffs: ['Unused hold locks must expire gracefully.'],
          verificationRequirements: ['Assert second booking attempt on held slot receives 409 Conflict.'],
          reconsiderationTriggers: [],
        },
        {
          id: 'dec-booking-db',
          problemContext: 'PostgreSQL Relational Booking Ledger',
          consideredOptions: [{ id: 'opt-pg', name: 'PostgreSQL Relational DB with Row-Level Locking', description: 'ACID appointment calendar ledger' }],
          selectedOptionId: 'opt-pg',
          selectedOptionName: 'PostgreSQL Relational DB with Row-Level Locking',
          rationale: 'Guarantees ACID persistence for confirmed patient appointments with unique calendar constraints.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-no-double-booking',
          property: 'No appointment slot can ever be confirmed for two distinct patients.',
          severity: 'critical',
          blocksCompletion: true,
          rationale: 'Patient booking integrity.',
        },
      ],
      verificationSpecs: [],
      assumptions: ['Clinic hours are localized to doctor timezone.'],
      unresolvedQuestions: [],
      metadata: {
        status: 'accepted',
        createdAt: '2026-10-14T08:00:00.000Z',
        tags: [],
      },
    };

    const projection = projector.projectSync(bookingContract);
    expect(projection.status).toBe('valid');

    // Proves NO rate limiter nodes are produced!
    const nodeLabels = projection.nodes.map((n) => n.label.toLowerCase());
    expect(nodeLabels.some((l) => l.includes('rate limiting filter'))).toBe(false);
    expect(nodeLabels.some((l) => l.includes('atomic sliding window counters'))).toBe(false);
    expect(nodeLabels.some((l) => l.includes('slot lock') || l.includes('slot mutex') || l.includes('redis'))).toBe(true);
    expect(nodeLabels.some((l) => l.includes('booking') || l.includes('ledger') || l.includes('postgresql'))).toBe(true);
  });

  // 7. Adversarial Unseen Contract 2: Collaborative Document Editing
  it('7. unseen contract 2 (Collaborative Document Editing) produces CRDT / WebSocket topology, NOT rate limiter graph', () => {
    const collabContract: EngineeringContract = {
      id: 'contract-collab-docs',
      version: '1.0.0',
      requirement: {
        id: 'req-collab',
        rawIntent: 'Real-time collaborative document editing with presence awareness and CRDT state synchronization.',
        explicitConstraints: ['Eventual state convergence'],
        declaredTechStack: ['Node.js', 'WebSockets', 'SQLite'],
        context: { title: 'Collaborative Notes' },
      },
      discoveredConcerns: [],
      decisions: [
        {
          id: 'dec-ws-gateway',
          problemContext: 'WebSocket Real-Time Gateway Broker',
          consideredOptions: [{ id: 'opt-ws', name: 'WebSocket Presence & Operation Gateway', description: 'Bi-directional text stream' }],
          selectedOptionId: 'opt-ws',
          selectedOptionName: 'WebSocket Presence & Operation Gateway',
          rationale: 'Maintains persistent duplex WebSocket connections for real-time keystroke broadcasting.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: ['Connection state must survive node restarts.'],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
        {
          id: 'dec-crdt-store',
          problemContext: 'Conflict-Free Replicated Document Store',
          consideredOptions: [{ id: 'opt-crdt', name: 'CRDT Append-Only Operation Ledger', description: 'Yjs / Automerge state store' }],
          selectedOptionId: 'opt-crdt',
          selectedOptionName: 'CRDT Append-Only Operation Ledger',
          rationale: 'Stores commutative document mutations guaranteeing identical convergence across peers.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-convergence',
          property: 'All peers must converge to identical document text after all delta operations arrive.',
          severity: 'critical',
          blocksCompletion: true,
          rationale: 'CRDT convergence.',
        },
      ],
      verificationSpecs: [],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: {
        status: 'accepted',
        createdAt: '2026-10-14T08:00:00.000Z',
        tags: [],
      },
    };

    const projection = projector.projectSync(collabContract);
    expect(projection.status).toBe('valid');

    const nodeLabels = projection.nodes.map((n) => n.label.toLowerCase());
    expect(nodeLabels.some((l) => l.includes('rate limiting filter'))).toBe(false);
    expect(nodeLabels.some((l) => l.includes('websocket') || l.includes('operation gateway'))).toBe(true);
    expect(nodeLabels.some((l) => l.includes('crdt') || l.includes('document store'))).toBe(true);
  });

  // 8. Adversarial Unseen Contract 3: Minimal CRUD Application (Zero Queues, Zero Caches)
  it('8. unseen contract 3 (Minimal CRUD) produces service & DB ONLY, with zero queues and zero caches', () => {
    const crudContract: EngineeringContract = {
      id: 'contract-minimal-crud',
      version: '1.0.0',
      requirement: {
        id: 'req-crud',
        rawIntent: 'A simple contact book CRUD REST API with embedded SQLite database.',
        explicitConstraints: ['Single process, low memory footprint'],
        declaredTechStack: ['Node.js', 'SQLite'],
        context: { title: 'Contact Book' },
      },
      discoveredConcerns: [],
      decisions: [
        {
          id: 'dec-rest-api',
          problemContext: 'Express REST API Service',
          consideredOptions: [{ id: 'opt-api', name: 'Stateless REST HTTP Service', description: 'Standard JSON endpoints' }],
          selectedOptionId: 'opt-api',
          selectedOptionName: 'Stateless REST HTTP Service',
          rationale: 'Serves standard GET/POST/PUT/DELETE contact endpoints.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
        {
          id: 'dec-sqlite-db',
          problemContext: 'Embedded SQLite Datastore',
          consideredOptions: [{ id: 'opt-sqlite', name: 'Embedded SQLite Relational Database', description: 'Single-file ACID database' }],
          selectedOptionId: 'opt-sqlite',
          selectedOptionName: 'Embedded SQLite Relational Database',
          rationale: 'Persists contact entries in a local file-based SQLite database with zero network overhead.',
          evidence: [],
          assumptions: ['Single process access to SQLite file.'],
          risksAndTradeoffs: ['Concurrent writes are serialized.'],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-crud-persistence',
          property: 'Created contacts must be durable and readable until explicitly deleted.',
          severity: 'critical',
          blocksCompletion: true,
          rationale: 'Basic persistence.',
        },
      ],
      verificationSpecs: [],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: {
        status: 'accepted',
        createdAt: '2026-10-14T08:00:00.000Z',
        tags: [],
      },
    };

    const projection = projector.projectSync(crudContract);
    expect(projection.status).toBe('valid');

    // Proves NO queue, NO cache, and NO rate limiter nodes exist!
    const categories = projection.nodes.map((n) => n.category);
    expect(categories).not.toContain('queue');
    expect(categories).not.toContain('cache');
    expect(categories).not.toContain('worker');
    expect(categories).toContain('service');
    expect(categories).toContain('datastore');
  });

  // 9. Misleading Contract ID (Adversarial contract has id: "contract-rate-limiter" but content is Chess)
  it('9. contract with misleading ID does NOT produce rate-limiter graph in production extraction', () => {
    const trickyContract: EngineeringContract = {
      id: 'contract-rate-limiter', // Misleading ID!
      version: '1.0.0',
      requirement: {
        id: 'req-chess',
        rawIntent: 'Real-time multiplayer chess engine evaluating game positions with Stockfish UCI.',
        explicitConstraints: ['Sub-second engine analysis'],
        declaredTechStack: ['Node.js', 'Stockfish'],
        context: { title: 'Chess Game Server' },
      },
      discoveredConcerns: [],
      decisions: [
        {
          id: 'dec-chess-game-service',
          problemContext: 'Chess Move Validation & Game Loop Service',
          consideredOptions: [{ id: 'opt-chess', name: 'Stateful Chess Engine Service', description: 'Validates FEN and legal moves' }],
          selectedOptionId: 'opt-chess',
          selectedOptionName: 'Stateful Chess Engine Service',
          rationale: 'Coordinates player turns and executes legal move validation.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [],
      verificationSpecs: [],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: {
        status: 'accepted',
        createdAt: '2026-10-14T08:00:00.000Z',
        tags: [], // NOT tagged as curated-demo-fixture!
      },
    };

    // When allowCuratedTemplates is false (production default), it ignores the misleading ID!
    const projection = projector.projectSync(trickyContract, { allowCuratedTemplates: false });
    const nodeLabels = projection.nodes.map((n) => n.label.toLowerCase());
    expect(nodeLabels.some((l) => l.includes('rate limiting filter'))).toBe(false);
    expect(nodeLabels.some((l) => l.includes('redis distributed state'))).toBe(false);
    expect(nodeLabels.some((l) => l.includes('chess'))).toBe(true);
  });

  // 10. Unrelated Decision Reference (Valid ID in contract does NOT prove an arbitrary claim)
  it('10. catches and flags an ungrounded claim where node claims a decision ID that has zero relevance', () => {
    const projection = projector.projectSync(standardContract, { revision: 1 });

    // Adversarially introduce an unrelated node that cites dec-db ("PostgreSQL Relational DB")
    // but the node is a "Kafka Streaming Cluster"!
    projection.nodes.push({
      id: 'node-fabricated-kafka',
      label: 'Apache Kafka Event Streaming Cluster',
      sublabel: 'Partitioned Topic Log',
      category: 'queue',
      tier: 'private_compute',
      origin: 'contract_decision', // claiming decision origin!
      confidence: 'architectural_decision',
      sourceDecisionIds: ['dec-db'], // citing a valid decision ID in the contract!
      sourceConcernIds: [],
      sourceInvariantIds: [],
      sourceSpecIds: [],
      purpose: 'High-throughput event streaming broker across 3 availability zones.',
      whySelected: 'Fabricated selection with unrelated decision link.',
      tradeOffs: [],
      assumptions: [],
      unresolvedQuestions: [],
      evidenceReferences: [],
      targetFiles: [],
      technology: 'Apache Kafka 3.6',
      x: 700,
      y: 350,
    });

    const validation = validateArchitectureGraphProjection(projection, standardContract);
    expect(validation.valid).toBe(false);
    expect(
      validation.errors.some((e) => e.includes('no semantic relevance') || e.includes('not grounded in contract'))
    ).toBe(true);
  });

  // 11. Provider-Neutral Structured Topology Synthesis Path (async project with ProviderAdapter)
  it('11. synthesizes grounded projection through ProviderAdapter interface without domain bias', async () => {
    const provider = new DeterministicDemoProviderAdapter();
    const projection = await projector.project(standardContract, { provider, revision: 1 });

    expect(projection.status).toBe('valid');
    expect(projection.contractId).toBe(standardContract.id);
    expect(projection.nodes.length).toBeGreaterThan(0);
    expect(projection.edges.length).toBeGreaterThan(0);

    const validation = validateArchitectureGraphProjection(projection, standardContract);
    expect(validation.valid).toBe(true);
  });

  // 12. Concern Description Fingerprint Sensitivity
  it('12. detects fingerprint change and staleness when concern description changes without revision bump', () => {
    const projection = projector.projectSync(standardContract, { revision: 1 });
    const originalFingerprint = projection.contractFingerprint;

    const modified = structuredClone(standardContract);
    modified.discoveredConcerns[0]!.description = 'Editorial revision to race condition explanation.';
    const newFingerprint = computeContractFingerprint(modified);

    expect(newFingerprint).not.toBe(originalFingerprint);
    expect(projector.isProjectionStale(projection, modified, 1)).toBe(true);
  });

  // 13. Verification Spec Action Fingerprint Sensitivity
  it('13. detects fingerprint change and staleness when verification spec action changes without revision bump', () => {
    const projection = projector.projectSync(standardContract, { revision: 1 });
    const originalFingerprint = projection.contractFingerprint;

    const modified = structuredClone(standardContract);
    modified.verificationSpecs[0]!.action = 'Send 200 req/s with aggressive burst profile.';
    const newFingerprint = computeContractFingerprint(modified);

    expect(newFingerprint).not.toBe(originalFingerprint);
    expect(projector.isProjectionStale(projection, modified, 1)).toBe(true);
  });

  // 14. Missing Contract Fingerprint Rejection
  it('14. rejects projection with missing or empty canonical contractFingerprint', () => {
    const projection = projector.projectSync(standardContract, { revision: 1 });
    projection.contractFingerprint = '';

    const validation = validateArchitectureGraphProjection(projection, standardContract);
    expect(validation.valid).toBe(false);
    expect(
      validation.errors.some((e) => e.includes('Missing contractFingerprint'))
    ).toBe(true);
  });

  // 15. Honest Provider Failure & Timeout Handling
  it('15. returns honest status: unresolved and groundingStatus: needs_clarification on provider timeout or failure', async () => {
    const failingProvider = {
      async generateStructured() {
        throw new Error('Provider upstream gateway timeout after 30000ms');
      },
    } as any;

    const projection = await projector.project(standardContract, {
      provider: failingProvider,
      revision: 1,
    });

    expect(projection.status).toBe('unresolved');
    expect(projection.groundingStatus).toBe('needs_clarification');
    expect(projection.nodes).toHaveLength(0);
    expect(projection.edges).toHaveLength(0);
    expect(projection.missingSources.length).toBeGreaterThan(0);
    expect(
      projection.unresolvedQuestions.some((q) => q.includes('timeout'))
    ).toBe(true);
  });

  // 16. Candidate Edge Without Assumptions/Questions Rejection
  it('16. rejects inferred proposed edge that lacks both assumptions and questions for confirmation', () => {
    const projection = projector.projectSync(standardContract, { revision: 1 });
    const proposedEdge = projection.edges.find((e) => e.origin === 'inferred_topology');
    expect(proposedEdge).toBeDefined();

    if (proposedEdge) {
      proposedEdge.assumptions = [];
      proposedEdge.unresolvedQuestions = [];
    }

    const validation = validateArchitectureGraphProjection(projection, standardContract);
    expect(validation.valid).toBe(false);
    expect(
      validation.errors.some((e) => e.includes('does not carry the assumption or question needed'))
    ).toBe(true);
  });
});
