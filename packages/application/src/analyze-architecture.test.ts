import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InMemoryKnowledgeRepository,
  prototypeKnowledgeFixtures,
} from '@architectai/knowledge';
import {
  DeterministicDemoProviderAdapter,
  ProviderAdapter,
  StructuredProviderRequest,
} from '@architectai/providers';
import { AnalyzeArchitectureUseCase } from './index.js';
import {
  WellKnownDimensions,
  RequirementDecomposition,
  ConcernRelevanceEvaluation,
} from '@architectai/domain';

describe('AnalyzeArchitectureUseCase & Semantic Pipeline (Milestone 1B)', () => {
  let repo: InMemoryKnowledgeRepository;
  let useCase: AnalyzeArchitectureUseCase;
  let deterministicProvider: DeterministicDemoProviderAdapter;

  beforeEach(async () => {
    repo = new InMemoryKnowledgeRepository();
    await repo.load(prototypeKnowledgeFixtures);
    deterministicProvider = new DeterministicDemoProviderAdapter();
    useCase = new AnalyzeArchitectureUseCase(repo, deterministicProvider);
  });

  describe('Core Demos (Deterministic Provider)', () => {
    it('Demo A: Rate Limiter — discovers timing/window and bounded throughput without explicit keywords', async () => {
      const output = await useCase.execute({
        rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
        context: {
          database: 'Redis',
          framework: 'Node.js',
        },
      });

      expect(output.contract).toBeDefined();
      expect(output.stages).toHaveLength(7);
      expect(output.dimensionsDetected).toContain(WellKnownDimensions.TIME_WINDOW);
      expect(output.dimensionsDetected).toContain(WellKnownDimensions.BOUNDED_RESOURCE);
      expect(output.decomposition.operations.length).toBeGreaterThanOrEqual(1);

      const fixedWindowConcern = output.contract.discoveredConcerns.find((c) =>
        c.id.includes('pattern-fixed-window-burst')
      );
      expect(fixedWindowConcern).toBeDefined();
      expect(fixedWindowConcern?.groundingStatus).toBe('grounded');
      expect(fixedWindowConcern?.supportingKnowledgeIds.length).toBeGreaterThanOrEqual(1);

      expect(output.contract.decisions.length).toBeGreaterThanOrEqual(1);
      expect(output.contract.invariants.length).toBeGreaterThanOrEqual(1);
      expect(output.contract.verificationSpecs.length).toBeGreaterThanOrEqual(1);
    });

    it('Demo B: Token Refresh — discovers concurrency and shared state race hazards', async () => {
      const output = await useCase.execute({
        rawIntent:
          'When my access token expires automatically refresh it and retry the failed request.',
        context: {
          language: 'TypeScript',
        },
      });

      expect(output.contract).toBeDefined();
      expect(output.dimensionsDetected).toContain(WellKnownDimensions.CONCURRENCY);
      expect(output.dimensionsDetected).toContain(WellKnownDimensions.SHARED_MUTABLE_STATE);
      expect(output.dimensionsDetected).toContain(WellKnownDimensions.RETRY);

      const tokenRaceConcern = output.contract.discoveredConcerns.find((c) =>
        c.id.includes('pattern-token-refresh-race')
      );
      expect(tokenRaceConcern).toBeDefined();
      expect(tokenRaceConcern?.groundingStatus).toBe('grounded');
    });

    it('Demo C: Image Processing — discovers memory/resource exhaustion and concurrency bounds', async () => {
      const output = await useCase.execute({
        rawIntent: 'Process many large uploaded images in parallel as quickly as possible.',
        context: {
          framework: 'Node.js',
          scale: '500 images/minute',
        },
      });

      expect(output.contract).toBeDefined();
      expect(output.dimensionsDetected).toContain(WellKnownDimensions.BOUNDED_RESOURCE);
      expect(output.dimensionsDetected).toContain(WellKnownDimensions.CONCURRENCY);

      const computeExhaustionConcern = output.contract.discoveredConcerns.find((c) =>
        c.id.includes('pattern-parallel-compute-memory-exhaustion')
      );
      expect(computeExhaustionConcern).toBeDefined();
      expect(computeExhaustionConcern?.groundingStatus).toBe('grounded');
    });
  });

  describe('Semantic Provider Interactions & Boundary Invariants', () => {
    it('proves Phase A (Decomposition) and Phase B (Relevance) both call ProviderAdapter.generateStructured', async () => {
      const generateStructuredSpy = vi.spyOn(deterministicProvider, 'generateStructured');

      await useCase.execute({
        rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
      });

      expect(generateStructuredSpy).toHaveBeenCalledTimes(2);

      const firstCallRequest = generateStructuredSpy.mock.calls[0]![0];
      expect(firstCallRequest.schemaName).toBe('RequirementDecomposition');

      const secondCallRequest = generateStructuredSpy.mock.calls[1]![0];
      expect(secondCallRequest.schemaName).toBe('ConcernRelevanceEvaluation');
    });

    it('surfaces provider errors / timeouts safely when provider throws', async () => {
      const failingProvider: ProviderAdapter = {
        id: 'failing-provider',
        name: 'Failing Mock Provider',
        getCapabilities: () => ({
          supportsStructuredOutput: true,
          supportsStreaming: false,
          maxContextTokens: 4000,
        }),
        generateText: vi.fn(),
        generateStructured: vi.fn().mockRejectedValue(new Error('Provider connection timeout after 45000ms')),
      };

      const failingUseCase = new AnalyzeArchitectureUseCase(repo, failingProvider);

      await expect(
        failingUseCase.execute({
          rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
        })
      ).rejects.toThrow('Provider connection timeout after 45000ms');
    });

    it('fails safely when provider returns data that violates RequirementDecompositionSchema', async () => {
      const invalidSchemaProvider: ProviderAdapter = {
        id: 'invalid-schema-provider',
        name: 'Invalid Schema Provider',
        getCapabilities: () => ({
          supportsStructuredOutput: true,
          supportsStreaming: false,
          maxContextTokens: 4000,
        }),
        generateText: vi.fn(),
        generateStructured: vi.fn().mockResolvedValue({
          content: '{}',
          // Missing required 'operations' and 'inferredEngineeringDimensions'
          data: { actors: ['Some User'] },
        }),
      };

      const invalidUseCase = new AnalyzeArchitectureUseCase(repo, invalidSchemaProvider);

      await expect(
        invalidUseCase.execute({
          rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
        })
      ).rejects.toThrow();
    });

    it('prevents model-invented unsupported knowledge IDs from entering the contract', async () => {
      const fabricatingProvider: ProviderAdapter = {
        id: 'fabricating-provider',
        name: 'Fabricating Provider',
        getCapabilities: () => ({
          supportsStructuredOutput: true,
          supportsStreaming: false,
          maxContextTokens: 4000,
        }),
        generateText: vi.fn(),
        generateStructured: vi.fn().mockImplementation(async (req: StructuredProviderRequest) => {
          if (req.schemaName === 'RequirementDecomposition') {
            const dec: RequirementDecomposition = {
              actors: ['Client'],
              operations: ['Transfer funds'],
              inferredEngineeringDimensions: [WellKnownDimensions.SIDE_EFFECT],
              state: [],
              resources: [],
              externalDependencies: [],
              possibleSideEffects: [],
              trustBoundaries: [],
              failureSensitiveOperations: [],
              scaleSignals: [],
              technologyContext: [],
              assumptions: [],
              unresolvedQuestions: [],
            };
            return { content: JSON.stringify(dec), data: dec };
          }
          if (req.schemaName === 'ConcernRelevanceEvaluation') {
            const rel: ConcernRelevanceEvaluation = {
              evaluations: [
                {
                  // FABRICATED ID: not in repository!
                  candidateId: 'fabricated-fake-knowledge-id-999',
                  relevance: 'applicable',
                  applicabilityReason: 'Hallucinated reason',
                  assumptions: [],
                  confidence: 0.99,
                  unresolvedQuestions: [],
                },
              ],
              ungroundedConcerns: [],
            };
            return { content: JSON.stringify(rel), data: rel };
          }
          return { content: '{}', data: {} };
        }),
      };

      const groundedUseCase = new AnalyzeArchitectureUseCase(repo, fabricatingProvider);
      const output = await groundedUseCase.execute({
        rawIntent: 'Transfer money between accounts.',
      });

      // Fabricated knowledge ID MUST NOT be present in discovered concerns
      const fabricatedConcern = output.contract.discoveredConcerns.find(
        (c) => c.supportingKnowledgeIds.includes('fabricated-fake-knowledge-id-999')
      );
      expect(fabricatedConcern).toBeUndefined();
    });

    it('preserves ungrounded model-discovered concerns without fabricated IDs', async () => {
      const ungroundedProvider: ProviderAdapter = {
        id: 'ungrounded-provider',
        name: 'Ungrounded Provider',
        getCapabilities: () => ({
          supportsStructuredOutput: true,
          supportsStreaming: false,
          maxContextTokens: 4000,
        }),
        generateText: vi.fn(),
        generateStructured: vi.fn().mockImplementation(async (req: StructuredProviderRequest) => {
          if (req.schemaName === 'RequirementDecomposition') {
            const dec: RequirementDecomposition = {
              actors: ['Quantum Sensor'],
              operations: ['Measure qubit coherence'],
              inferredEngineeringDimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
              state: [],
              resources: [],
              externalDependencies: [],
              possibleSideEffects: [],
              trustBoundaries: [],
              failureSensitiveOperations: [],
              scaleSignals: [],
              technologyContext: [],
              assumptions: [],
              unresolvedQuestions: [],
            };
            return { content: JSON.stringify(dec), data: dec };
          }
          if (req.schemaName === 'ConcernRelevanceEvaluation') {
            const rel: ConcernRelevanceEvaluation = {
              evaluations: [],
              ungroundedConcerns: [
                {
                  title: 'Microarchitectural Thermal Decoherence',
                  description: 'Thermal fluctuations degrade qubit superposition before measurement completes.',
                  applicabilityReason: 'Cryogenic timing margins are narrow during measurement.',
                  dimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
                  assumptions: ['Operating below 15mK'],
                  confidence: 0.85,
                  unresolvedQuestions: ['What is the T2 dephasing time?'],
                },
              ],
            };
            return { content: JSON.stringify(rel), data: rel };
          }
          return { content: '{}', data: {} };
        }),
      };

      const ungroundedUseCase = new AnalyzeArchitectureUseCase(repo, ungroundedProvider);
      const output = await ungroundedUseCase.execute({
        rawIntent: 'Measure qubit coherence on a quantum sensor.',
      });

      expect(output.contract.discoveredConcerns).toHaveLength(1);
      const ungrounded = output.contract.discoveredConcerns[0]!;
      expect(ungrounded.groundingStatus).toBe('ungrounded_model_discovery');
      expect(ungrounded.supportingKnowledgeIds).toHaveLength(0); // STRICTLY EMPTY!
      expect(ungrounded.title).toBe('Microarchitectural Thermal Decoherence');
    });

    it('False-Positive Prevention: Offline image resize rejects unrelated failure patterns', async () => {
      const output = await useCase.execute({
        rawIntent: 'Resize a single local image once in an offline command-line process.',
      });

      const concernTitles = output.contract.discoveredConcerns.map((c) => c.title.toLowerCase());

      // MUST NOT contain unrelated network/auth/database concerns
      expect(concernTitles.some((t) => t.includes('token refresh'))).toBe(false);
      expect(concernTitles.some((t) => t.includes('rate limit'))).toBe(false);
      expect(concernTitles.some((t) => t.includes('connection pool'))).toBe(false);
      expect(concernTitles.some((t) => t.includes('payment'))).toBe(false);
      expect(concernTitles.some((t) => t.includes('kafka'))).toBe(false);
    });
  });
});
