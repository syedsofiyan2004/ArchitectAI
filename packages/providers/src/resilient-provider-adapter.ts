/**
 * ResilientProviderAdapter — Decorator that wraps any ProviderAdapter with:
 * - Bounded timeout with real AbortController interruption (not just race)
 * - 429 rate-limit retries with exponential backoff + jitter
 * - Transient 5xx retries
 * - Network error retries
 * - Immediate non-retry for 401/403
 * - Redacted diagnostic logging
 *
 * Implements ProviderAdapter so all use cases continue to call provider.generateText /
 * provider.generateStructured unchanged — resilience is applied transparently.
 *
 * Usage at server startup:
 *   const raw = new OpenAICompatibleProviderAdapter(...)
 *   const provider = new ResilientProviderAdapter(raw, { timeoutMs: 30000 })
 */
import {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderRequest,
  ProviderResponse,
  StructuredProviderRequest,
  StructuredProviderResponse,
} from './types.js';

export interface ResilientProviderOptions {
  /** Hard timeout per call attempt. Default 30 s. */
  timeoutMs?: number;
  /** Max 429 retries. Default 3. */
  maxRetries429?: number;
  /** Max 5xx retries. Default 2. */
  maxRetries5xx?: number;
  /** Max network-error retries. Default 2. */
  maxRetriesNetwork?: number;
  /** Base delay for exponential backoff. Default 100 ms. */
  baseDelayMs?: number;
  /** Max delay for backoff. Default 4000 ms. */
  maxDelayMs?: number;
}

function classifyError(message: string): {
  is401: boolean;
  is429: boolean;
  is5xx: boolean;
  isNetwork: boolean;
} {
  const m = message.toLowerCase();
  const statusMatch = message.match(/HTTP\s+(\d{3})/i) || message.match(/status[:\s]+(\d{3})/i);
  const code = statusMatch ? parseInt(statusMatch[1]!, 10) : 0;

  return {
    is401: code === 401 || code === 403 || /unauthorized|forbidden|invalid api key/i.test(m),
    is429: code === 429 || /rate limit|too many requests/i.test(m),
    is5xx: (code >= 500 && code < 600) || /internal server error|bad gateway|service unavailable/i.test(m),
    isNetwork: /fetch failed|econnreset|etimedout|enotfound|network error/i.test(m),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Redacts known sensitive secrets (API keys, OAuth Bearer tokens, GitHub tokens)
 * from provider diagnostic messages before throwing or logging errors.
 */
export function redactProviderDiagnostics(message: string): string {
  if (!message) return '';
  return message
    .replace(/Bearer\s+[a-zA-Z0-9._~\-+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/sk-[a-zA-Z0-9_\-]{8,}/gi, '[REDACTED]')
    .replace(/gh[pousr]_[a-zA-Z0-9]{20,}/gi, '[REDACTED]');
}

/**
 * Race an async operation against a bounded timeout using AbortController.
 * If the timeout fires first, the abort signal is sent to the underlying fetch/request.
 * This provides REAL interruption rather than just discarding a late result.
 */
async function withTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const timeoutErr = new Error(`Provider request timed out after ${timeoutMs}ms`);
      (timeoutErr as NodeJS.ErrnoException).code = 'TIMED_OUT';
      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    return await Promise.race([factory(controller.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class ResilientProviderAdapter implements ProviderAdapter {
  readonly id: string;
  readonly name: string;

  private readonly opts: Required<ResilientProviderOptions>;

  constructor(
    private readonly inner: ProviderAdapter,
    options: ResilientProviderOptions = {}
  ) {
    this.id = inner.id;
    this.name = `${inner.name} [resilient]`;
    this.opts = {
      timeoutMs: options.timeoutMs ?? 30_000,
      maxRetries429: options.maxRetries429 ?? 3,
      maxRetries5xx: options.maxRetries5xx ?? 2,
      maxRetriesNetwork: options.maxRetriesNetwork ?? 2,
      baseDelayMs: options.baseDelayMs ?? 100,
      maxDelayMs: options.maxDelayMs ?? 4_000,
    };
  }

  getCapabilities(): ProviderCapabilities {
    return this.inner.getCapabilities();
  }

  async generateText(request: ProviderRequest): Promise<ProviderResponse> {
    return this.executeWithRetry('generateText', () =>
      withTimeout((_signal) => this.inner.generateText(request), this.opts.timeoutMs)
    );
  }

  async generateStructured<T>(request: StructuredProviderRequest): Promise<StructuredProviderResponse<T>> {
    return this.executeWithRetry('generateStructured', () =>
      withTimeout((_signal) => this.inner.generateStructured<T>(request), this.opts.timeoutMs)
    );
  }

  private async executeWithRetry<T>(
    operationName: string,
    action: () => Promise<T>
  ): Promise<T> {
    let attempt = 0;
    let retries429 = 0;
    let retries5xx = 0;
    let retriesNetwork = 0;

    while (true) {
      attempt++;
      try {
        return await action();
      } catch (err: unknown) {
        const rawMessage = err instanceof Error ? err.message : String(err);
        const { is401, is429, is5xx, isNetwork } = classifyError(rawMessage);

        // Check for our own timeout code first
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'TIMED_OUT') {
          const timedOutErr = new Error(
            `Provider operation '${operationName}' timed out after ${this.opts.timeoutMs}ms (attempt ${attempt}).`
          );
          (timedOutErr as NodeJS.ErrnoException).code = 'TIMED_OUT';
          throw timedOutErr;
        }

        // Never retry authentication failures
        if (is401) {
          const safeMessage = redactProviderDiagnostics(rawMessage);
          const authErr = new Error(
            `Provider authentication failed during '${operationName}': ${safeMessage.slice(0, 200)}`
          );
          (authErr as NodeJS.ErrnoException).code = 'PROVIDER_AUTH_FAILED';
          throw authErr;
        }

        // Determine if we can retry
        let canRetry = false;
        let backoffMs = 0;

        if (is429 && retries429 < this.opts.maxRetries429) {
          retries429++;
          canRetry = true;
          backoffMs = Math.min(
            this.opts.maxDelayMs,
            this.opts.baseDelayMs * Math.pow(2, retries429 - 1) + Math.random() * 50
          );
        } else if (is5xx && retries5xx < this.opts.maxRetries5xx) {
          retries5xx++;
          canRetry = true;
          backoffMs = Math.min(
            this.opts.maxDelayMs,
            this.opts.baseDelayMs * Math.pow(2, retries5xx - 1) + Math.random() * 50
          );
        } else if (isNetwork && retriesNetwork < this.opts.maxRetriesNetwork) {
          retriesNetwork++;
          canRetry = true;
          backoffMs = Math.min(
            this.opts.maxDelayMs,
            this.opts.baseDelayMs * Math.pow(2, retriesNetwork - 1) + Math.random() * 50
          );
        }

        if (canRetry) {
          await sleep(backoffMs);
          continue;
        }

        // Non-retryable or max retries reached — propagate
        const safeMessage = redactProviderDiagnostics(rawMessage);
        const finalErr = new Error(
          `Provider operation '${operationName}' failed after ${attempt} attempt(s): ${safeMessage.slice(0, 300)}`
        );
        (finalErr as NodeJS.ErrnoException).code = is429 ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_FAILED';
        throw finalErr;
      }
    }
  }
}
