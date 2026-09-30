export interface ProviderCapabilities {
  supportsStructuredOutput: boolean;
  supportsStreaming: boolean;
  maxContextTokens: number;
}

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderRequest {
  messages: ProviderMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StructuredProviderRequest<TSchema = unknown> extends ProviderRequest {
  schema: TSchema;
  schemaName?: string;
}

export interface StructuredProviderResponse<T> extends ProviderResponse {
  data: T;
}

/**
 * ProviderAdapter interface.
 * Core domain and application layers interact ONLY through this neutral interface,
 * shielding the engine from vendor-specific SDK changes.
 */
export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  getCapabilities(): ProviderCapabilities;
  generateText(request: ProviderRequest): Promise<ProviderResponse>;
  generateStructured<T>(request: StructuredProviderRequest): Promise<StructuredProviderResponse<T>>;
}
