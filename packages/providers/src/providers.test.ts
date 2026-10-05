import { describe, it, expect, vi } from 'vitest';
import {
  OpenAICompatibleProviderAdapter,
  DeterministicDemoProviderAdapter,
} from './index.js';
import {
  RequirementDecomposition,
  RequirementDecompositionSchema,
  ConcernRelevanceEvaluationSchema,
} from '@architectai/domain';

describe('Providers Layer', () => {
  it('instantiates DeterministicDemoProviderAdapter with correct capabilities', () => {
    const adapter = new DeterministicDemoProviderAdapter();
    expect(adapter.id).toBe('deterministic-demo');
    const caps = adapter.getCapabilities();
    expect(caps.supportsStructuredOutput).toBe(true);
    expect(caps.maxContextTokens).toBeGreaterThan(1000);
  });

  it('instantiates OpenAICompatibleProviderAdapter with defaults', () => {
    const adapter = new OpenAICompatibleProviderAdapter({
      apiKey: 'test-key',
      baseURL: 'https://api.example.com/v1',
      modelName: 'custom-model',
    });
    expect(adapter.id).toBe('openai-compatible');
    const caps = adapter.getCapabilities();
    expect(caps.supportsStructuredOutput).toBe(true);
  });

  it('rejects generateText when API key is missing in remote adapter', async () => {
    const adapter = new OpenAICompatibleProviderAdapter({ apiKey: '' });
    await expect(
      adapter.generateText({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow('Missing API key');
  });

  it('generates text in deterministic adapter without credentials', async () => {
    const adapter = new DeterministicDemoProviderAdapter();
    const res = await adapter.generateText({
      messages: [{ role: 'user', content: 'Design a distributed system' }],
    });
    expect(res.content).toContain('Deterministic Demo Mode');
  });

  it('generates validated RequirementDecomposition in deterministic adapter without empty object', async () => {
    const adapter = new DeterministicDemoProviderAdapter();
    const res = await adapter.generateStructured<RequirementDecomposition>({
      messages: [
        {
          role: 'user',
          content: 'Limit each authenticated user to 100 API requests per minute.',
        },
      ],
      schema: RequirementDecompositionSchema,
      schemaName: 'RequirementDecomposition',
    });

    expect(res.data).toBeDefined();
    expect(Object.keys(res.data)).not.toHaveLength(0);
    const parsed = RequirementDecompositionSchema.parse(res.data);
    expect(parsed.operations.length).toBeGreaterThanOrEqual(1);
    expect(parsed.inferredEngineeringDimensions).toContain('bounded_resource');
    expect(parsed.inferredEngineeringDimensions).toContain('time_window');
  });

  it('generates validated ConcernRelevanceEvaluation in deterministic adapter', async () => {
    const adapter = new DeterministicDemoProviderAdapter();
    const res = await adapter.generateStructured({
      messages: [
        {
          role: 'user',
          content:
            'Requirement Intent: Limit each authenticated user to 100 API requests per minute.\nCandidate: ID: pattern-fixed-window-burst\nCandidate: ID: pattern-db-connection-pool-exhaustion',
        },
      ],
      schema: ConcernRelevanceEvaluationSchema,
      schemaName: 'ConcernRelevanceEvaluation',
    });

    expect(res.data).toBeDefined();
    const parsed = ConcernRelevanceEvaluationSchema.parse(res.data);
    expect(parsed.evaluations.length).toBe(2);

    const rateLimitEval = parsed.evaluations.find(
      (e) => e.candidateId === 'pattern-fixed-window-burst'
    );
    expect(rateLimitEval?.relevance).toBe('applicable');

    const dbEval = parsed.evaluations.find(
      (e) => e.candidateId === 'pattern-db-connection-pool-exhaustion'
    );
    expect(dbEval?.relevance).toBe('not_applicable');
  });

  describe('Remote Provider Error Handling & Schema Validation', () => {
    it('successfully parses structured JSON output from remote response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  actors: ['Client User'],
                  operations: ['Read data'],
                  inferredEngineeringDimensions: ['concurrency'],
                }),
              },
            },
          ],
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const adapter = new OpenAICompatibleProviderAdapter({
        apiKey: 'mock-key',
      });

      const res = await adapter.generateStructured({
        messages: [{ role: 'user', content: 'test prompt' }],
        schema: RequirementDecompositionSchema,
        schemaName: 'RequirementDecomposition',
      });

      expect(res.data).toBeDefined();
      expect(res.data).toHaveProperty('inferredEngineeringDimensions');

      vi.unstubAllGlobals();
    });

    it('fails safely when remote provider output violates Zod schema', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                // Missing required 'operations' field
                content: JSON.stringify({
                  actors: ['Client User'],
                  inferredEngineeringDimensions: ['concurrency'],
                }),
              },
            },
          ],
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const adapter = new OpenAICompatibleProviderAdapter({
        apiKey: 'mock-key',
      });

      await expect(
        adapter.generateStructured({
          messages: [{ role: 'user', content: 'test prompt' }],
          schema: RequirementDecompositionSchema,
          schemaName: 'RequirementDecomposition',
        })
      ).rejects.toThrow('Structured response failed schema validation');

      vi.unstubAllGlobals();
    });

    it('fails safely when remote provider returns malformed JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'I am not valid JSON at all!',
              },
            },
          ],
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const adapter = new OpenAICompatibleProviderAdapter({
        apiKey: 'mock-key',
      });

      await expect(
        adapter.generateStructured({
          messages: [{ role: 'user', content: 'test prompt' }],
          schema: RequirementDecompositionSchema,
          schemaName: 'RequirementDecomposition',
        })
      ).rejects.toThrow('Failed to parse model response as JSON');

      vi.unstubAllGlobals();
    });

    it('handles remote HTTP error status safely', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded on OpenAI endpoint',
      });

      vi.stubGlobal('fetch', mockFetch);

      const adapter = new OpenAICompatibleProviderAdapter({
        apiKey: 'mock-key',
      });

      await expect(
        adapter.generateText({
          messages: [{ role: 'user', content: 'test prompt' }],
        })
      ).rejects.toThrow('Provider HTTP 429');

      vi.unstubAllGlobals();
    });
  });
});
