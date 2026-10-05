import {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderRequest,
  ProviderResponse,
  StructuredProviderRequest,
  StructuredProviderResponse,
} from './types.js';

export interface OpenAICompatibleConfig {
  apiKey?: string;
  baseURL?: string;
  modelName?: string;
  timeoutMs?: number;
}

/**
 * OpenAI-compatible HTTP Provider Adapter.
 * Works with OpenAI, OpenRouter, Groq, LocalAI, vLLM, Ollama, etc.
 * Uses native fetch without third-party vendor SDKs.
 */
export class OpenAICompatibleProviderAdapter implements ProviderAdapter {
  readonly id = 'openai-compatible';
  readonly name = 'OpenAI-Compatible HTTP Provider';

  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly modelName: string;
  private readonly timeoutMs: number;

  constructor(config: OpenAICompatibleConfig = {}) {
    this.apiKey = config.apiKey || process.env['ARCHITECTAI_API_KEY'] || '';
    this.baseURL = (
      config.baseURL ||
      process.env['ARCHITECTAI_BASE_URL'] ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    this.modelName =
      config.modelName || process.env['ARCHITECTAI_MODEL'] || 'gpt-4o-mini';
    this.timeoutMs = config.timeoutMs || 45000;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsStructuredOutput: true,
      supportsStreaming: false,
      maxContextTokens: 128000,
    };
  }

  async generateText(request: ProviderRequest): Promise<ProviderResponse> {
    if (!this.apiKey) {
      throw new Error(
        'Missing API key for OpenAI-compatible provider. Please configure ARCHITECTAI_API_KEY or use deterministic mode.'
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
          max_tokens: request.maxTokens ?? 4000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Provider HTTP ${response.status} (${response.statusText}): ${errorText}`
        );
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const content = json.choices?.[0]?.message?.content || '';
      return {
        content,
        usage: json.usage
          ? {
              promptTokens: json.usage.prompt_tokens,
              completionTokens: json.usage.completion_tokens,
              totalTokens: json.usage.total_tokens,
            }
          : undefined,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Provider request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateStructured<T>(
    request: StructuredProviderRequest
  ): Promise<StructuredProviderResponse<T>> {
    // Augment request with explicit JSON formatting directive
    const structuredMessages = [
      ...request.messages,
      {
        role: 'system' as const,
        content:
          'CRITICAL: You must reply with raw, valid JSON only. Do not wrap in markdown fences (```json). Ensure the JSON matches the expected schema exactly.',
      },
    ];

    const response = await this.generateText({
      ...request,
      messages: structuredMessages,
    });

    // Clean any accidental markdown code fences
    let cleaned = response.content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e: unknown) {
      throw new Error(
        `Failed to parse model response as JSON: ${e instanceof Error ? e.message : String(e)}. Raw output: ${cleaned.slice(0, 200)}...`
      );
    }

    // Validate with Zod schema if schema exposes safeParse
    const schema = request.schema as {
      safeParse?: (val: unknown) => { success: boolean; data?: T; error?: { message: string } };
    };

    if (schema && typeof schema.safeParse === 'function') {
      const validation = schema.safeParse(parsed);
      if (!validation.success) {
        throw new Error(
          `Structured response failed schema validation: ${validation.error?.message}`
        );
      }
      return {
        ...response,
        data: validation.data as T,
      };
    }

    return {
      ...response,
      data: parsed as T,
    };
  }
}
