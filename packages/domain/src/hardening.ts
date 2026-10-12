import { z } from 'zod';

export const ProductFailureCodeSchema = z.enum([
  'USER_CANCELLED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_FAILED',
  'AGENT_UNAVAILABLE',
  'AGENT_FAILED',
  'REPOSITORY_CHANGED',
  'REPOSITORY_UNAVAILABLE',
  'REPOSITORY_DIRTY',
  'REPOSITORY_IDENTITY_MISMATCH',
  'DEPENDENCY_MISSING',
  'NATIVE_CHECK_FAILED',
  'NATIVE_CHECK_TAMPERED',
  'VERIFICATION_FAILED',
  'VERIFICATION_INCONCLUSIVE',
  'VERIFICATION_ERROR',
  'REPAIR_FAILED',
  'INTERRUPTED',
  'TIMED_OUT',
  'ARTIFACT_CORRUPTED',
  'COMMAND_FORBIDDEN',
  'SCOPE_VIOLATION',
]);
export type ProductFailureCode = z.infer<typeof ProductFailureCodeSchema>;

export const OperationStageSchema = z.enum([
  'ANALYSIS',
  'PLAN_COMPILATION',
  'IMPLEMENTATION',
  'NATIVE_CHECKS',
  'VERIFICATION',
  'REPAIR',
  'PERSISTENCE',
  'REGISTRATION',
]);
export type OperationStage = z.infer<typeof OperationStageSchema>;

export const FailureCauseCategorySchema = z.enum([
  'ENVIRONMENT',
  'USER_ACTION',
  'PROVIDER',
  'AGENT',
  'VERIFICATION',
  'REPOSITORY',
  'SYSTEM',
]);
export type FailureCauseCategory = z.infer<typeof FailureCauseCategorySchema>;

export const ProductOperationFailureSchema = z.object({
  code: ProductFailureCodeSchema,
  stage: OperationStageSchema,
  title: z.string().min(1),
  message: z.string().min(1),
  recoverable: z.boolean(),
  retryable: z.boolean(),
  userActionRequired: z.string().min(1),
  technicalDetails: z.string().optional(),
  occurredAt: z.string(),
  relatedRunId: z.string().min(1),
  relatedSessionId: z.string().optional(),
  causeCategory: FailureCauseCategorySchema,
});
export type ProductOperationFailure = z.infer<typeof ProductOperationFailureSchema>;

export const RepositoryFingerprintSchema = z.object({
  repositoryId: z.string().min(1),
  gitRoot: z.string().min(1),
  headCommit: z.string().min(1),
  branch: z.string().min(1),
  isClean: z.boolean(),
  dirtyFilesCount: z.number().int().nonnegative().default(0),
  initialCommit: z.string().min(1),
  remoteUrl: z.string().optional(),
  fingerprintedAt: z.string(),
});
export type RepositoryFingerprint = z.infer<typeof RepositoryFingerprintSchema>;

export const ApiErrorPayloadSchema = z.object({
  code: ProductFailureCodeSchema,
  message: z.string().min(1),
  recoverable: z.boolean().default(false),
  userActionRequired: z.string().optional(),
  technicalDetails: z.string().optional(),
});
export type ApiErrorPayload = z.infer<typeof ApiErrorPayloadSchema>;

export const ApiResponseErrorSchema = z.object({
  success: z.literal(false),
  error: z.union([z.string(), ApiErrorPayloadSchema]),
  code: ProductFailureCodeSchema.optional(),
  failure: ApiErrorPayloadSchema.optional(),
});
export type ApiResponseError = z.infer<typeof ApiResponseErrorSchema>;

export const ExecutionTimeBudgetsSchema = z.object({
  analysisMs: z.number().int().positive().default(60000),
  codingTaskMs: z.number().int().positive().default(180000),
  nativeCheckMs: z.number().int().positive().default(60000),
  verificationCaseMs: z.number().int().positive().default(30000),
  verificationRunMs: z.number().int().positive().default(90000),
  repairAttemptMs: z.number().int().positive().default(180000),
  implementationSessionMs: z.number().int().positive().default(600000),
});
export type ExecutionTimeBudgets = z.infer<typeof ExecutionTimeBudgetsSchema>;

export const DEFAULT_EXECUTION_TIME_BUDGETS: ExecutionTimeBudgets = {
  analysisMs: 60000,
  codingTaskMs: 180000,
  nativeCheckMs: 60000,
  verificationCaseMs: 30000,
  verificationRunMs: 90000,
  repairAttemptMs: 180000,
  implementationSessionMs: 600000,
};

export const BoundedOutputSchema = z.object({
  preview: z.string(),
  totalBytes: z.number().int().nonnegative(),
  truncated: z.boolean(),
  artifactReference: z.string().optional(),
});
export type BoundedOutput = z.infer<typeof BoundedOutputSchema>;

export const LocalTelemetryEventSchema = z.object({
  id: z.string().min(1),
  stage: OperationStageSchema,
  status: z.enum(['STARTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT']),
  durationMs: z.number().int().nonnegative(),
  failureCode: ProductFailureCodeSchema.optional(),
  attemptCount: z.number().int().positive().default(1),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).default({}),
});
export type LocalTelemetryEvent = z.infer<typeof LocalTelemetryEventSchema>;

export const FailureFingerprintSchema = z.object({
  invariantId: z.string().min(1),
  assertionName: z.string().min(1),
  observationCategory: z.string().min(1),
  errorDigest: z.string().min(1),
});
export type FailureFingerprint = z.infer<typeof FailureFingerprintSchema>;
