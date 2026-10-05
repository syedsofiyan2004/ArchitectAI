import {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderRequest,
  ProviderResponse,
  StructuredProviderRequest,
  StructuredProviderResponse,
} from './types.js';

/**
 * Deterministic Demo Provider Adapter.
 * Enables zero-credential local evaluation and UI demonstration.
 * Complies with ProviderAdapter contract using deterministic reasoning.
 */
export class DeterministicDemoProviderAdapter implements ProviderAdapter {
  readonly id = 'deterministic-demo';
  readonly name = 'Deterministic Demo Reasoner (Zero-Key)';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsStructuredOutput: true,
      supportsStreaming: false,
      maxContextTokens: 32000,
    };
  }

  async generateText(request: ProviderRequest): Promise<ProviderResponse> {
    const userMessage =
      request.messages.find((m) => m.role === 'user')?.content || '';
    return {
      content: `[Deterministic Demo Mode] Processed requirement: "${userMessage.slice(0, 80)}"`,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }

  async generateStructured<T>(
    request: StructuredProviderRequest
  ): Promise<StructuredProviderResponse<T>> {
    // When schema has a default or mock generation mechanism, or returns dummy structured object
    // In actual architecture analysis, AnalyzeArchitectureUseCase uses the knowledge repository directly in deterministic mode.
    const text = await this.generateText(request);
    return {
      ...text,
      data: {} as T,
    };
  }
}
