import { describe, it, expect } from 'vitest';
import {
  ProductOperationFailureSchema,
  RepositoryFingerprintSchema,
  ApiResponseErrorSchema,
  DEFAULT_EXECUTION_TIME_BUDGETS,
  BoundedOutputSchema,
  LocalTelemetryEventSchema,
  FailureFingerprintSchema,
} from './hardening.js';

describe('Domain: Product Hardening Schemas & Contracts', () => {
  it('validates a schema-conforming ProductOperationFailure', () => {
    const failure = ProductOperationFailureSchema.parse({
      code: 'REPOSITORY_CHANGED',
      stage: 'IMPLEMENTATION',
      title: 'Repository HEAD Modified',
      message: 'The repository HEAD has changed since the implementation plan was compiled.',
      recoverable: true,
      retryable: false,
      userActionRequired: 'Recompile the implementation plan against the updated HEAD.',
      technicalDetails: 'Plan HEAD: a1b2c3d4, Current HEAD: e5f6g7h8',
      occurredAt: new Date().toISOString(),
      relatedRunId: 'run-12345',
      relatedSessionId: 'session-67890',
      causeCategory: 'REPOSITORY',
    });

    expect(failure.code).toBe('REPOSITORY_CHANGED');
    expect(failure.causeCategory).toBe('REPOSITORY');
    expect(failure.recoverable).toBe(true);
  });

  it('validates a RepositoryFingerprint object', () => {
    const fp = RepositoryFingerprintSchema.parse({
      repositoryId: 'repo-1',
      gitRoot: '/path/to/repo',
      headCommit: 'a1b2c3d4e5f6g7h8a1b2c3d4e5f6g7h8a1b2c3d4',
      branch: 'main',
      isClean: false,
      dirtyFilesCount: 3,
      initialCommit: '0011223344556677889900112233445566778899',
      fingerprintedAt: new Date().toISOString(),
    });

    expect(fp.isClean).toBe(false);
    expect(fp.dirtyFilesCount).toBe(3);
  });

  it('validates standard ApiResponseError schema', () => {
    const apiError = ApiResponseErrorSchema.parse({
      success: false,
      error: {
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Analysis provider is temporarily unreachable.',
        recoverable: true,
        userActionRequired: 'Check network connectivity or API key configuration.',
      },
    });

    expect(apiError.success).toBe(false);
    expect(apiError.error.code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('exposes default execution time budgets', () => {
    expect(DEFAULT_EXECUTION_TIME_BUDGETS.analysisMs).toBe(60000);
    expect(DEFAULT_EXECUTION_TIME_BUDGETS.codingTaskMs).toBe(180000);
    expect(DEFAULT_EXECUTION_TIME_BUDGETS.verificationCaseMs).toBe(30000);
  });

  it('validates bounded output metadata and failure fingerprint', () => {
    const bounded = BoundedOutputSchema.parse({
      preview: 'Process stdout...',
      totalBytes: 50000,
      truncated: true,
      artifactReference: 'artifacts/run-1/process.log',
    });
    expect(bounded.truncated).toBe(true);

    const fp = FailureFingerprintSchema.parse({
      invariantId: 'inv-rate-limiter',
      assertionName: 'assertWindowBound',
      observationCategory: 'BURST_FAILURE',
      errorDigest: 'Expected <= 100 requests but observed 150',
    });
    expect(fp.invariantId).toBe('inv-rate-limiter');
  });
});
