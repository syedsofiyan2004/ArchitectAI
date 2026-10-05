import { describe, it, expect, beforeEach } from 'vitest';
import {
  EngineeringContract,
  WellKnownDimensions,
} from '@architectai/domain';
import {
  InMemoryKnowledgeRepository,
  prototypeKnowledgeFixtures,
} from '@architectai/knowledge';
import { DeterministicDemoProviderAdapter } from '@architectai/providers';
import { AnalyzeArchitectureUseCase } from '@architectai/application';
import {
  DeterministicEvalRunner,
  sampleNeutralEvalCase,
  strictlyIsolatedComputationEvalCase,
  offlineSingleImageResizeEvalCase,
  allNovelEvalCases,
  allPrototypeEvalCases,
} from './index.js';

describe('DeterministicEvalRunner & Prototype Evals (Milestone 1B)', () => {
  const runner = new DeterministicEvalRunner();
  let repo: InMemoryKnowledgeRepository;
  let useCase: AnalyzeArchitectureUseCase;

  beforeEach(async () => {
    repo = new InMemoryKnowledgeRepository();
    await repo.load(prototypeKnowledgeFixtures);
    const provider = new DeterministicDemoProviderAdapter();
    useCase = new AnalyzeArchitectureUseCase(repo, provider);
  });

  it('evaluates base contract against sampleNeutralEvalCase', async () => {
    const output = await useCase.execute({
      rawIntent: sampleNeutralEvalCase.requirementIntent.rawIntent,
      declaredTechStack: sampleNeutralEvalCase.requirementIntent.declaredTechStack,
    });

    const result = await runner.evaluateContract(
      sampleNeutralEvalCase,
      output.contract,
      repo
    );

    expect(result.passed).toBe(true);
    expect(result.contractConformsToSchema).toBe(true);
    expect(result.missingExpectedDimensions).toHaveLength(0);
    expect(result.missingRequiredKnowledgeLevels).toHaveLength(0);
  });

  it('evaluates all 10 prototype scenarios through the live semantic pipeline', async () => {
    for (const evalCase of allPrototypeEvalCases) {
      // Skip isolated/offline negative test cases from the standard positive loop
      if (
        evalCase.id === strictlyIsolatedComputationEvalCase.id ||
        evalCase.id === offlineSingleImageResizeEvalCase.id ||
        allNovelEvalCases.some((n) => n.id === evalCase.id)
      ) {
        continue;
      }

      const output = await useCase.execute({
        rawIntent: evalCase.requirementIntent.rawIntent,
        explicitConstraints: evalCase.requirementIntent.explicitConstraints,
        declaredTechStack: evalCase.requirementIntent.declaredTechStack,
        context: evalCase.requirementIntent.context,
      });

      const result = await runner.evaluateContract(evalCase, output.contract, repo);

      expect(
        result.passed,
        `Eval case failed: ${evalCase.name} (${evalCase.id}). Failures: ${result.failureReasons.join(
          ', '
        )}`
      ).toBe(true);

      expect(result.contractConformsToSchema).toBe(true);
      expect(result.missingExpectedDimensions).toHaveLength(0);
      expect(result.missingRequiredKnowledgeLevels).toHaveLength(0);
    }
  });

  describe('Novel / Paraphrase Requirements Evaluation (Requirement 8)', () => {
    it('evaluates all 5 novel scenarios (Novel A-E) through the semantic reasoning pipeline', async () => {
      for (const novelCase of allNovelEvalCases) {
        const output = await useCase.execute({
          rawIntent: novelCase.requirementIntent.rawIntent,
          explicitConstraints: novelCase.requirementIntent.explicitConstraints,
          declaredTechStack: novelCase.requirementIntent.declaredTechStack,
          context: novelCase.requirementIntent.context,
        });

        const result = await runner.evaluateContract(novelCase, output.contract, repo);

        expect(
          result.passed,
          `Novel case failed: ${novelCase.name} (${novelCase.id}). Failures: ${result.failureReasons.join(
            ', '
          )}`
        ).toBe(true);

        expect(result.contractConformsToSchema).toBe(true);
        expect(result.missingExpectedDimensions).toHaveLength(0);
        expect(result.missingRequiredKnowledgeLevels).toHaveLength(0);
      }
    });
  });

  describe('False-Positive Prevention Evaluation (Requirement 9)', () => {
    it('evaluates offline image resize and confirms zero over-retrieved concerns or forbidden dimensions', async () => {
      const output = await useCase.execute({
        rawIntent: offlineSingleImageResizeEvalCase.requirementIntent.rawIntent,
        explicitConstraints: offlineSingleImageResizeEvalCase.requirementIntent.explicitConstraints,
        declaredTechStack: offlineSingleImageResizeEvalCase.requirementIntent.declaredTechStack,
        context: offlineSingleImageResizeEvalCase.requirementIntent.context,
      });

      const result = await runner.evaluateContract(
        offlineSingleImageResizeEvalCase,
        output.contract,
        repo
      );

      expect(result.passed).toBe(true);
      expect(result.missingExpectedDimensions).toHaveLength(0);
      expect(result.hallucinatedForbiddenDimensions).toHaveLength(0);

      // Verify specific unrelated failure patterns were filtered out by Phase B
      const titles = output.contract.discoveredConcerns.map((c) => c.title.toLowerCase());
      expect(titles.some((t) => t.includes('token refresh'))).toBe(false);
      expect(titles.some((t) => t.includes('rate limit'))).toBe(false);
      expect(titles.some((t) => t.includes('connection pool'))).toBe(false);
      expect(titles.some((t) => t.includes('payment'))).toBe(false);
      expect(titles.some((t) => t.includes('kafka'))).toBe(false);
    });
  });

  describe('Negative Eval Assertions', () => {
    it('passes strictly isolated eval when context rules out network & persistence', async () => {
      const contract: EngineeringContract = {
        id: 'contract-isolated-math',
        version: '1.0.0',
        requirement: strictlyIsolatedComputationEvalCase.requirementIntent,
        discoveredConcerns: [
          {
            id: 'concern-math-alloc',
            requirementId: strictlyIsolatedComputationEvalCase.requirementIntent.id,
            title: 'Memory buffer allocation overhead',
            description: 'Static matrix buffers must fit in resident heap memory.',
            applicabilityReason: 'Local matrix multiplication requires memory buffers.',
            dimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
            supportingKnowledgeIds: ['fundamental-bounded-memory-buffers'],
            assumptions: ['Memory buffers are pre-allocated'],
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
          createdAt: new Date().toISOString(),
          status: 'accepted',
          tags: ['compute'],
        },
      };

      const result = await runner.evaluateContract(
        strictlyIsolatedComputationEvalCase,
        contract,
        repo
      );

      expect(result.passed).toBe(true);
      expect(result.hallucinatedForbiddenDimensions).toHaveLength(0);
    });

    it('fails when a forbidden dimension is hallucinated in an isolated context', async () => {
      const hallucinatedContract: EngineeringContract = {
        id: 'contract-hallucinated',
        version: '1.0.0',
        requirement: strictlyIsolatedComputationEvalCase.requirementIntent,
        discoveredConcerns: [
          {
            id: 'concern-hallucinated-attack',
            requirementId: strictlyIsolatedComputationEvalCase.requirementIntent.id,
            title: 'SQL injection and attacker input',
            description: 'Input from unknown attacker could exploit parsing.',
            applicabilityReason: 'Untrusted input vulnerability.',
            dimensions: [
              WellKnownDimensions.BOUNDED_RESOURCE,
              WellKnownDimensions.ATTACKER_CONTROLLED_INPUT, // FORBIDDEN!
            ],
            supportingKnowledgeIds: ['fundamental-bounded-memory-buffers'],
            assumptions: [],
            confidence: 0.8,
            unresolvedQuestions: [],
          },
        ],
        decisions: [],
        invariants: [],
        verificationSpecs: [],
        assumptions: [],
        unresolvedQuestions: [],
        metadata: {
          createdAt: new Date().toISOString(),
          status: 'accepted',
          tags: ['compute'],
        },
      };

      const result = await runner.evaluateContract(
        strictlyIsolatedComputationEvalCase,
        hallucinatedContract,
        repo
      );

      expect(result.passed).toBe(false);
      expect(result.hallucinatedForbiddenDimensions).toContain(
        WellKnownDimensions.ATTACKER_CONTROLLED_INPUT
      );
    });
  });

  describe('EvaluationCase.requiredKnowledgeLevels Enforcement (Task 001A)', () => {
    it('passes when required fundamental + failure_pattern levels are present', async () => {
      const contract: EngineeringContract = {
        id: 'contract-levels-pass',
        version: '1.0.0',
        requirement: sampleNeutralEvalCase.requirementIntent,
        discoveredConcerns: [
          {
            id: 'concern-01',
            requirementId: sampleNeutralEvalCase.requirementIntent.id,
            title: 'Buffer Saturation',
            description: 'Unbounded buffers cause OOM.',
            applicabilityReason: 'Asymmetric producer/consumer throughput.',
            dimensions: [WellKnownDimensions.BOUNDED_RESOURCE, WellKnownDimensions.CONCURRENCY],
            supportingKnowledgeIds: [
              'fundamental-bounded-memory-buffers',
              'pattern-unbounded-consumer-overflow',
            ],
            assumptions: [],
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
          createdAt: new Date().toISOString(),
          status: 'accepted',
          tags: ['network'],
        },
      };

      const result = await runner.evaluateContract(sampleNeutralEvalCase, contract, repo);
      expect(result.passed).toBe(true);
      expect(result.missingRequiredKnowledgeLevels).toHaveLength(0);
    });

    it('fails if failure_pattern is removed even when all dimensions match', async () => {
      const contractMissingPattern: EngineeringContract = {
        id: 'contract-missing-pattern',
        version: '1.0.0',
        requirement: sampleNeutralEvalCase.requirementIntent,
        discoveredConcerns: [
          {
            id: 'concern-01',
            requirementId: sampleNeutralEvalCase.requirementIntent.id,
            title: 'Buffer Saturation',
            description: 'Unbounded buffers cause OOM.',
            applicabilityReason: 'Asymmetric producer/consumer throughput.',
            dimensions: [WellKnownDimensions.BOUNDED_RESOURCE, WellKnownDimensions.CONCURRENCY],
            // ONLY fundamental, NO failure_pattern!
            supportingKnowledgeIds: ['fundamental-bounded-memory-buffers'],
            assumptions: [],
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
          createdAt: new Date().toISOString(),
          status: 'accepted',
          tags: ['network'],
        },
      };

      const result = await runner.evaluateContract(
        sampleNeutralEvalCase,
        contractMissingPattern,
        repo
      );

      expect(result.passed).toBe(false);
      expect(result.missingExpectedDimensions).toHaveLength(0); // Dimensions matched!
      expect(result.missingRequiredKnowledgeLevels).toContain('failure_pattern');
      expect(result.failureReasons).toContain(
        'Missing required knowledge level: failure_pattern'
      );
    });
  });
});
