import { describe, it, expect } from 'vitest';
import {
  EngineeringContract,
  WellKnownDimensions,
} from '@architectai/domain';
import { DeterministicEvalRunner, sampleNeutralEvalCase } from './index.js';

describe('DeterministicEvalRunner', () => {
  const runner = new DeterministicEvalRunner();

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
        supportingKnowledgeIds: ['fundamental-bounded-memory-buffers'],
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

  it('passes when contract satisfies expected dimensions and contains no forbidden ones', () => {
    const result = runner.evaluateContract(sampleNeutralEvalCase, baseContract);
    expect(result.passed).toBe(true);
    expect(result.contractConformsToSchema).toBe(true);
    expect(result.missingExpectedDimensions).toHaveLength(0);
    expect(result.hallucinatedForbiddenDimensions).toHaveLength(0);
  });

  it('fails when an expected dimension is missing', () => {
    const incompleteContract: EngineeringContract = {
      ...baseContract,
      discoveredConcerns: [
        {
          ...baseContract.discoveredConcerns[0]!,
          dimensions: [WellKnownDimensions.BOUNDED_RESOURCE], // missing CONCURRENCY
        },
      ],
    };

    const result = runner.evaluateContract(sampleNeutralEvalCase, incompleteContract);
    expect(result.passed).toBe(false);
    expect(result.missingExpectedDimensions).toContain(WellKnownDimensions.CONCURRENCY);
  });

  it('fails when a forbidden dimension is hallucinated', () => {
    const hallucinatedContract: EngineeringContract = {
      ...baseContract,
      discoveredConcerns: [
        {
          ...baseContract.discoveredConcerns[0]!,
          dimensions: [
            WellKnownDimensions.BOUNDED_RESOURCE,
            WellKnownDimensions.CONCURRENCY,
            WellKnownDimensions.PERSISTENCE, // Forbidden!
          ],
        },
      ],
    };

    const result = runner.evaluateContract(sampleNeutralEvalCase, hallucinatedContract);
    expect(result.passed).toBe(false);
    expect(result.hallucinatedForbiddenDimensions).toContain(WellKnownDimensions.PERSISTENCE);
  });
});
