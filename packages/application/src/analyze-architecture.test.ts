import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryKnowledgeRepository,
  prototypeKnowledgeFixtures,
} from '@architectai/knowledge';
import { DeterministicDemoProviderAdapter } from '@architectai/providers';
import { AnalyzeArchitectureUseCase } from './index.js';
import { WellKnownDimensions } from '@architectai/domain';

describe('AnalyzeArchitectureUseCase (Milestone 1)', () => {
  let repo: InMemoryKnowledgeRepository;
  let useCase: AnalyzeArchitectureUseCase;

  beforeEach(async () => {
    repo = new InMemoryKnowledgeRepository();
    await repo.load(prototypeKnowledgeFixtures);
    const provider = new DeterministicDemoProviderAdapter();
    useCase = new AnalyzeArchitectureUseCase(repo, provider);
  });

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

    const fixedWindowConcern = output.contract.discoveredConcerns.find((c) =>
      c.id.includes('pattern-fixed-window-burst')
    );
    expect(fixedWindowConcern).toBeDefined();
    expect(fixedWindowConcern?.dimensions).toContain(WellKnownDimensions.TIME_WINDOW);

    // Verify architecture decision exists
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

    const computeExhaustionConcern = output.contract.discoveredConcerns.find(
      (c) =>
        c.id.includes('pattern-parallel-compute-memory-exhaustion') ||
        c.id.includes('pattern-unbounded-consumer-overflow')
    );
    expect(computeExhaustionConcern).toBeDefined();
  });
});
