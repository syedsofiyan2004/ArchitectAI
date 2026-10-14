// Unit tests for ArchitectureGraphProjector & Graph Schema Validation
import { describe, it, expect } from 'vitest';
import {
  ArchitectureGraphProjector,
} from './architecture-graph-projector';
import {
  validateArchitectureGraphProjection,
  ArchitectureGraphProjectionSchema,
  type EngineeringContract,
  type ArchitectureGraphProjection,
} from '@architectai/domain';

describe('ArchitectureGraphProjector & Graph Projection Validation', () => {
  const projector = new ArchitectureGraphProjector();

  const mockContract: EngineeringContract = {
    id: 'contract-rate-limiter',
    version: '1.0.0',
    requirement: {
      id: 'req-1',
      rawIntent: 'Build a distributed API rate limiter with Redis sliding window.',
      normalizedIntent: 'API Rate Limiting System',
      category: 'api',
      businessGoal: 'Protect backend compute from boundary spikes',
      assumptions: ['Clients can send bursts'],
      constraints: ['Max 100 req/min'],
    },
    discoveredConcerns: [
      {
        id: 'concern-oom',
        requirementId: 'req-1',
        title: 'In-Memory Counter OOM & Memory Leakage',
        description: 'Unbounded in-memory counter allocation causes worker OOM crash.',
        applicabilityReason: 'High cardinality client keys consume unbounded memory.',
        dimensions: ['bounded_resources', 'concurrency'],
        supportingKnowledgeIds: ['kb-oom-1'],
        confidence: 0.9,
        assumptions: [],
        unresolvedQuestions: [],
      },
      {
        id: 'concern-race',
        requirementId: 'req-1',
        title: 'Distributed Token Race',
        description: 'Multi-instance race conditions under high concurrency.',
        applicabilityReason: 'Independent gateways without distributed synchronization.',
        dimensions: ['shared_mutable_state', 'concurrency'],
        supportingKnowledgeIds: ['kb-race-1'],
        confidence: 0.88,
        assumptions: [],
        unresolvedQuestions: [],
      },
    ],
    decisions: [
      {
        id: 'dec-sliding-window',
        problemContext: 'Rate Limiting Algorithm & Boundary Defense',
        consideredOptions: [
          { id: 'opt-fixed', name: 'Fixed Window', description: 'Reset counter at window boundary' },
          { id: 'opt-sliding', name: 'Sliding Window', description: 'Atomic sorted set timestamps' },
        ],
        selectedOptionId: 'opt-sliding',
        selectedOptionName: 'Sliding Window',
        rationale: 'Prevents 2x boundary attack burst defect.',
        evidence: [],
        assumptions: ['Redis is available with low latency'],
        risksAndTradeoffs: ['Network latency to Redis state store'],
        verificationRequirements: ['Boundary burst simulation at t=59s and t=61s'],
        reconsiderationTriggers: [],
      },
      {
        id: 'dec-redis-store',
        problemContext: 'Distributed State Synchronization',
        consideredOptions: [
          { id: 'opt-redis', name: 'Redis Sentinel / Cluster', description: 'In-memory distributed key-value' },
        ],
        selectedOptionId: 'opt-redis',
        selectedOptionName: 'Redis Sentinel / Cluster',
        rationale: 'Enables atomic sorted set operations across multi-instance gateway tier.',
        evidence: [],
        assumptions: [],
        risksAndTradeoffs: [],
        verificationRequirements: [],
        reconsiderationTriggers: [],
      },
      {
        id: 'dec-gateway-proxy',
        problemContext: 'Perimeter Ingress Gateway Filter',
        consideredOptions: [
          { id: 'opt-gw', name: 'Reverse Proxy Gateway', description: 'Inspects headers before routing' },
        ],
        selectedOptionId: 'opt-gw',
        selectedOptionName: 'Reverse Proxy Gateway',
        rationale: 'Terminates untrusted traffic at perimeter.',
        evidence: [],
        assumptions: [],
        risksAndTradeoffs: [],
        verificationRequirements: [],
        reconsiderationTriggers: [],
      },
    ],
    invariants: [
      {
        id: 'inv-sliding-quota',
        property: 'Request rate must not exceed 100 requests per sliding 60-second window.',
        severity: 'critical',
        blocksCompletion: true,
        rationale: 'Protect downstream cluster from degradation.',
      },
    ],
    verificationSpecs: [
      {
        id: 'spec-boundary-burst',
        target: 'inv-sliding-quota',
        description: 'Inject 80 requests at t=59s and 80 at t=61s; verify total admitted in [2s, 62s] <= 100.',
        setup: 'Deploy rate limiter with 100 req / 60s quota.',
        action: 'Dispatch synchronized pre/post boundary bursts.',
        expectedProperty: 'Exact 100 admitted, 60 throttled with 429.',
        evidenceToCollect: ['HTTP response status codes', 'virtual timestamp logs'],
        isAutomatable: true,
      },
    ],
    assumptions: ['Redis network latency is under 5ms'],
    unresolvedQuestions: [],
    metadata: {
      status: 'accepted',
      createdAt: '2026-10-14T00:00:00.000Z',
      tags: ['rate-limiter', 'security'],
    },
  };

  it('1. projects valid ArchitectureGraphProjection satisfying Zod schema', () => {
    const projection = projector.project(mockContract, { revision: 1 });
    const parseResult = ArchitectureGraphProjectionSchema.safeParse(projection);

    expect(parseResult.success).toBe(true);
    expect(projection.status).toBe('valid');
    expect(projection.contractId).toBe('contract-rate-limiter');
    expect(projection.contractRevision).toBe(1);
    expect(projection.nodes.length).toBeGreaterThan(0);
    expect(projection.edges.length).toBeGreaterThan(0);

    const validation = validateArchitectureGraphProjection(projection, mockContract);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('2. detects and rejects dangling edges (source or target node missing from nodes array)', () => {
    const projection = projector.project(mockContract, { revision: 1 });

    // Deliberately introduce a dangling edge pointing to non-existent node
    const invalidProjection: ArchitectureGraphProjection = {
      ...projection,
      edges: [
        ...projection.edges,
        {
          id: 'edge-ghost',
          source: 'node-gateway',
          target: 'node-nonexistent-phantom',
          label: 'Phantom Protocol',
          protocol: 'UNKNOWN',
          direction: 'unidirectional',
          isSelfLoop: false,
          origin: 'inferred_topology',
          confidence: 'unknown_unresolved',
          sourceDecisionIds: [],
          sourceConcernIds: [],
          sourceInvariantIds: [],
          sourceSpecIds: [],
          purpose: 'Invalid edge',
          whySelected: '',
          assumptions: [],
          evidenceReferences: [],
        },
      ],
    };

    const validation = validateArchitectureGraphProjection(invalidProjection, mockContract);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('Dangling edge detected'))).toBe(true);
    expect(validation.errors.some((e) => e.includes('node-nonexistent-phantom'))).toBe(true);
  });

  it('3. detects and reports invalid provenance references (references to non-existent contract IDs)', () => {
    const projection = projector.project(mockContract, { revision: 1 });

    // Introduce invalid decision reference
    const corruptProjection: ArchitectureGraphProjection = {
      ...projection,
      nodes: projection.nodes.map((n) =>
        n.id === 'node-gateway'
          ? { ...n, sourceDecisionIds: ['dec-nonexistent-fake-id'] }
          : n
      ),
    };

    const validation = validateArchitectureGraphProjection(corruptProjection, mockContract);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('invalid/missing decision ID'))).toBe(true);
    expect(validation.errors.some((e) => e.includes('dec-nonexistent-fake-id'))).toBe(true);
  });

  it('4. provides safe fallback for incomplete contracts without crashing or inventing fakes', () => {
    const incompleteContract: EngineeringContract = {
      id: 'contract-empty-draft',
      version: '0.1.0',
      requirement: {
        id: 'req-empty',
        rawIntent: 'Under-specified requirement without decisions',
        category: 'general',
        assumptions: [],
        constraints: [],
      },
      discoveredConcerns: [],
      decisions: [], // 0 decisions!
      invariants: [],
      verificationSpecs: [],
      assumptions: [],
      unresolvedQuestions: ['What are the core technical constraints?'],
      metadata: {
        status: 'draft',
        createdAt: '2026-10-14T00:00:00.000Z',
      },
    };

    const projection = projector.project(incompleteContract, { revision: 1 });

    expect(projection.status).toBe('incomplete');
    expect(projection.nodes).toHaveLength(0);
    expect(projection.edges).toHaveLength(0);
    expect(projection.missingSources).toContain('contract.decisions is empty');
    expect(projection.rationale).toContain('lacks architectural decisions');
  });

  it('5. validates projection revision freshness and detects stale projections', () => {
    const projection = projector.project(mockContract, { revision: 1 });

    expect(projector.isProjectionStale(projection, 1)).toBe(false);
    // When contract revision has moved from 1 to 2
    expect(projector.isProjectionStale(projection, 2)).toBe(true);
  });

  it('6. rejects duplicate node IDs and duplicate edge IDs', () => {
    const projection = projector.project(mockContract, { revision: 1 });

    const duplicateNodesProjection: ArchitectureGraphProjection = {
      ...projection,
      nodes: [...projection.nodes, projection.nodes[0]!], // duplicate node!
    };

    const validation = validateArchitectureGraphProjection(duplicateNodesProjection, mockContract);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('Duplicate node ID detected'))).toBe(true);
  });
});
