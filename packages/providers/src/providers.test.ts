import { describe, it, expect } from 'vitest';
import {
  OpenAICompatibleProviderAdapter,
  DeterministicDemoProviderAdapter,
} from './index.js';

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
});
