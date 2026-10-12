import { redactSensitiveData } from './security-redaction.js';
import { ProductOperationFailure, ProductFailureCode } from '@architectai/domain';

export interface RetryPolicyOptions {
  maxRetries429?: number;
  maxRetries5xx?: number;
  maxRetriesNetwork?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

export interface ProviderExecutionResult<T> {
  success: boolean;
  data?: T;
  failure?: ProductOperationFailure;
  totalAttempts: number;
  durationMs: number;
}

export class ProviderResilienceService {
  private readonly defaultOptions: Required<RetryPolicyOptions> = {
    maxRetries429: 3,
    maxRetries5xx: 2,
    maxRetriesNetwork: 2,
    baseDelayMs: 50,
    maxDelayMs: 2000,
    timeoutMs: 45000,
  };

  /**
   * Executes a provider action with centralized retry semantics, jittered backoff,
   * credential redaction, and structured operation failure reporting.
   */
  async executeWithRetry<T>(
    runId: string,
    operationName: string,
    action: (attempt: number) => Promise<T>,
    options: RetryPolicyOptions = {}
  ): Promise<ProviderExecutionResult<T>> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    let attempt = 0;

    while (true) {
      attempt++;
      try {
        const data = await action(attempt);
        return {
          success: true,
          data,
          totalAttempts: attempt,
          durationMs: Date.now() - startTime,
        };
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime;
        const rawMessage = err instanceof Error ? err.message : String(err);
        const redactedMsg = redactSensitiveData(rawMessage);

        const statusMatch = redactedMsg.match(/HTTP\s+(\d{3})/i) || redactedMsg.match(/status[:\s]+(\d{3})/i);
        const statusCode = statusMatch ? parseInt(statusMatch[1]!, 10) : undefined;

        const is401or403 = statusCode === 401 || statusCode === 403 || /unauthorized|forbidden|invalid api key/i.test(redactedMsg);
        const is429 = statusCode === 429 || /rate limit|too many requests/i.test(redactedMsg);
        const is5xx = (statusCode !== undefined && statusCode >= 500 && statusCode < 600) || /internal server error|bad gateway|service unavailable/i.test(redactedMsg);
        const isNetwork = /fetch failed|econnreset|etimedout|enotfound|network error/i.test(redactedMsg);
        const isTimeout = /timeout|timed out|abort/i.test(redactedMsg);

        // 1. Authentication failures: NEVER retry
        if (is401or403) {
          return {
            success: false,
            totalAttempts: attempt,
            durationMs,
            failure: {
              code: 'PROVIDER_UNAVAILABLE',
              stage: 'ANALYSIS',
              title: 'Provider Authentication Failed',
              message: 'Authentication failed for the configured AI provider. Please verify credentials.',
              recoverable: true,
              retryable: false,
              userActionRequired: 'Update API key or authentication configuration in system settings.',
              technicalDetails: redactedMsg,
              occurredAt: new Date().toISOString(),
              relatedRunId: runId,
              causeCategory: 'PROVIDER',
            },
          };
        }

        // 2. Check retry eligibility
        let canRetry = false;
        let maxAllowedAttempts = 1;

        if (is429) {
          canRetry = attempt <= opts.maxRetries429;
          maxAllowedAttempts = opts.maxRetries429 + 1;
        } else if (is5xx) {
          canRetry = attempt <= opts.maxRetries5xx;
          maxAllowedAttempts = opts.maxRetries5xx + 1;
        } else if (isNetwork) {
          canRetry = attempt <= opts.maxRetriesNetwork;
          maxAllowedAttempts = opts.maxRetriesNetwork + 1;
        }

        // Check overall timeout budget
        if (durationMs >= opts.timeoutMs) {
          canRetry = false;
        }

        if (canRetry && attempt < maxAllowedAttempts) {
          // Exponential backoff with jitter
          const backoff = Math.min(
            opts.maxDelayMs,
            opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 50
          );
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        // Max retries reached or non-retryable failure
        let code: ProductFailureCode = 'PROVIDER_FAILED';
        let title = 'Provider Execution Failed';

        if (is429) {
          code = 'PROVIDER_RATE_LIMITED';
          title = 'Provider Rate Limit Exceeded';
        } else if (isTimeout) {
          code = 'TIMED_OUT';
          title = 'Provider Request Timed Out';
        } else if (isNetwork) {
          code = 'PROVIDER_UNAVAILABLE';
          title = 'Provider Network Connection Failed';
        }

        return {
          success: false,
          totalAttempts: attempt,
          durationMs,
          failure: {
            code,
            stage: 'ANALYSIS',
            title,
            message: `Provider request failed during ${operationName}: ${is429 ? 'Rate limit exceeded after retries.' : isTimeout ? 'Request exceeded timeout budget.' : 'Provider returned an unrecoverable error.'}`,
            recoverable: true,
            retryable: is429 || is5xx || isNetwork,
            userActionRequired: is429
              ? 'Wait a few moments before retrying, or switch to deterministic mode.'
              : 'Check provider endpoint status and network connectivity.',
            technicalDetails: redactedMsg,
            occurredAt: new Date().toISOString(),
            relatedRunId: runId,
            causeCategory: 'PROVIDER',
          },
        };
      }
    }
  }
}

export async function withProviderResilience<T>(
  action: (attempt: number) => Promise<T>,
  options?: RetryPolicyOptions
): Promise<T> {
  const service = new ProviderResilienceService();
  const res = await service.executeWithRetry('default-run', 'resilient-op', action, options);
  if (!res.success) {
    const err = new Error(res.failure?.message || 'Provider operation failed');
    (err as any).failure = res.failure;
    throw err;
  }
  return res.data!;
}
