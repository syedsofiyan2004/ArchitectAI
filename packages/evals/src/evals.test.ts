import { describe, it, expect } from 'vitest';
import {
  EngineeringContract,
  WellKnownDimensions,
  KnowledgeLevel,
} from '@architectai/domain';
import {
  DeterministicEvalRunner,
  sampleNeutralEvalCase,
  strictlyIsolatedComputationEvalCase,
} from './index.js';

describe('DeterministicEvalRunner', () => {
  const runner = new DeterministicEvalRunner();

  // Mock knowledge resolver providing known levels
  const mockKnowledgeResolver = new Map<string, KnowledgeLevel[]>([
    ['fundamental-bounded-memory-buffers', ['fundamental']],
    ['pattern-unbounded-consumer-overflow', ['failure_pattern']],
    ['tech-nodejs-stream-backpressure', ['technology_specific']],
  ]);

  const baseContract: EngineeringContract = {
    id: 'contract-test-01',
    version: '1.0.0',
    requirement: sampleNeutralEvalCase.requirementIntent,
    discoveredConcerns: [
      {
        id: 'concern-01',
        requirementId: sampleNeutralEvalCase.requirementIntent.id,
        title: 'Buffer saturation',
        description: 'Buffers can fill up quickly during traffic bursts.',
        applicabilityReason: 'Ingestion is high frequency.',
        dimensions: [
          WellKnownDimensions.BOUNDED_RESOURCE,
          WellKnownDimensions.CONCURRENCY,
        ],
        supportingKnowledgeIds: [
          'fundamental-bounded-memory-buffers',
          'pattern-unbounded-consumer-overflow',
        ],
        assumptions: [],
        confidence: 0.95,
        unresolvedQuestions: [],
      },
    ],
    decisions: [],
    invariants: [],
    verificationSpecs: [],
    assumptions: [],
    unresolvedQuestions: [],
    metadata: {
      createdAt: '2026-09-30T00:00:00.000Z',
      status: 'draft',
      tags: [],
    },
  };

  it('passes when contract satisfies expected dimensions and required knowledge levels', async () => {
    const result = await runner.evaluateContract(
      sampleNeutralEvalCase,
      baseContract,
      mockKnowledgeResolver
    );
    expect(result.passed).toBe(true);
    expect(result.contractConformsToSchema).toBe(true);
    expect(result.missingExpectedDimensions).toHaveLength(0);
    expect(result.hallucinatedForbiddenDimensions).toHaveLength(0);
    expect(result.discoveredKnowledgeLevels).toContain('fundamental');
    expect(result.discoveredKnowledgeLevels).toContain('failure_pattern');
    expect(result.missingRequiredKnowledgeLevels).toHaveLength(0);
  });

  it('fails when an expected dimension is missing', async () => {
    const incompleteContract: EngineeringContract = {
      ...baseContract,
      discoveredConcerns: [
        {
          ...baseContract.discoveredConcerns[0]!,
          dimensions: [WellKnownDimensions.BOUNDED_RESOURCE], // missing CONCURRENCY
        },
      ],
    };

    const result = await runner.evaluateContract(
      sampleNeutralEvalCase,
      incompleteContract,
      mockKnowledgeResolver
    );
    expect(result.passed).toBe(false);
    expect(result.missingExpectedDimensions).toContain(WellKnownDimensions.CONCURRENCY);
  });

  describe('Knowledge Level Enforcement (Task 001A)', () => {
    it('passes when an eval requiring fundamental + failure_pattern has both represented', async () => {
      const result = await runner.evaluateContract(
        sampleNeutralEvalCase,
        baseContract,
        mockKnowledgeResolver
      );
      expect(result.passed).toBe(true);
      expect(result.missingRequiredKnowledgeLevels).toHaveLength(0);
    });

    it('fails if failure-pattern support is removed, even though expected dimensions match', async () => {
      // Contract has the exact expected dimensions (bounded_resource, concurrency),
      // but only references fundamental knowledge, omitting failure_pattern.
      const contractWithoutFailurePattern: EngineeringContract = {
        ...baseContract,
        discoveredConcerns: [
          {
            ...baseContract.discoveredConcerns[0]!,
            dimensions: [
              WellKnownDimensions.BOUNDED_RESOURCE,
              WellKnownDimensions.CONCURRENCY,
            ],
            supportingKnowledgeIds: ['fundamental-bounded-memory-buffers'], // only fundamental
          },
        ],
      };

      const result = await runner.evaluateContract(
        sampleNeutralEvalCase,
        contractWithoutFailurePattern,
        mockKnowledgeResolver
      );

      // Must fail because failure_pattern is missing
      expect(result.passed).toBe(false);
      expect(result.missingExpectedDimensions).toHaveLength(0); // Dimensions matched!
      expect(result.missingRequiredKnowledgeLevels).toContain('failure_pattern');
      expect(result.failureReasons).toContain(
        'Missing required knowledge level: failure_pattern'
      );
    });

    it('works with different knowledge resolver forms (function, repository object, or map)', async () => {
      // Function resolver
      const fnResolver = async (id: string) => mockKnowledgeResolver.get(id);
      const resFn = await runner.evaluateContract(
        sampleNeutralEvalCase,
        baseContract,
        fnResolver
      );
      expect(resFn.passed).toBe(true);

      // Object with getById
      const repoResolver = {
        getById: async (id: string) => {
          const levels = mockKnowledgeResolver.get(id);
          return levels ? { levels } : undefined;
        },
      };
      const resRepo = await runner.evaluateContract(
        sampleNeutralEvalCase,
        baseContract,
        repoResolver
      );
      expect(resRepo.passed).toBe(true);
    });
  });

  describe('Negative Eval Assertions (Task 001A)', () => {
    const isolatedContract: EngineeringContract = {
      id: 'contract-isolated-001',
      version: '1.0.0',
      requirement: strictlyIsolatedComputationEvalCase.requirementIntent,
      discoveredConcerns: [
        {
          id: 'concern-iso-01',
          requirementId: strictlyIsolatedComputationEvalCase.requirementIntent.id,
          title: 'Buffer allocation overhead',
          description: 'Local buffer memory must stay within heap limits.',
          applicabilityReason: 'In-memory matrix transformation requires heap buffers.',
          dimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
          supportingKnowledgeIds: ['fundamental-bounded-memory-buffers'],
          assumptions: ['Buffers are pre-allocated'],
          confidence: 0.9,
          unresolvedQuestions: [],
        },
      ],
      decisions: [],
      invariants: [],
      verificationSpecs: [],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: {
        createdAt: '2026-09-30T00:00:00.000Z',
        status: 'draft',
        tags: ['compute'],
      },
    };

    it('passes strictly isolated eval when no forbidden dimensions are hallucinated', async () => {
      const result = await runner.evaluateContract(
        strictlyIsolatedComputationEvalCase,
        isolatedContract,
        mockKnowledgeResolver
      );
      expect(result.passed).toBe(true);
      expect(result.hallucinatedForbiddenDimensions).toHaveLength(0);
    });

    it('fails when a genuinely forbidden dimension (e.g. attacker_controlled_input) is hallucinated', async () => {
      const hallucinatedContract: EngineeringContract = {
        ...isolatedContract,
        discoveredConcerns: [
          {
            ...isolatedContract.discoveredConcerns[0]!,
            dimensions: [
              WellKnownDimensions.BOUNDED_RESOURCE,
              WellKnownDimensions.ATTACKER_CONTROLLED_INPUT, // FORBIDDEN by explicit air-gapped context!
            ],
          },
        ],
      };

      const result = await runner.evaluateContract(
        strictlyIsolatedComputationEvalCase,
        hallucinatedContract,
        mockKnowledgeResolver
      );
      expect(result.passed).toBe(false);
      expect(result.hallucinatedForbiddenDimensions).toContain(
        WellKnownDimensions.ATTACKER_CONTROLLED_INPUT
      );
      expect(result.failureReasons).toContain(
        `Hallucinated forbidden dimension: ${WellKnownDimensions.ATTACKER_CONTROLLED_INPUT}`
      );
    });
  });
});
