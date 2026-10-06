import { z } from 'zod';
import { AgentExecutionResultSchema } from './execution.js';
import { VerificationRunResultSchema } from './verification.js';

/**
 * FailureClassification categorizes the root cause of a verification failure.
 * Only implementation-level classes (IMPLEMENTATION_DEFECT, INCOMPLETE_IMPLEMENTATION)
 * are eligible for automatic code repair.
 */
export const FailureClassificationSchema = z.enum([
  'IMPLEMENTATION_DEFECT',
  'INCOMPLETE_IMPLEMENTATION',
  'WRONG_ASSUMPTION',
  'ARCHITECTURE_DECISION_INVALID',
  'VERIFICATION_INTERFACE_MISSING',
  'VERIFIER_FAILURE',
  'ENVIRONMENT_LIMITATION',
  'DIAGNOSIS_UNAVAILABLE',
]);
export type FailureClassification = z.infer<typeof FailureClassificationSchema>;

/**
 * FailureDiagnosis represents an evidence-grounded diagnosis of a verification failure.
 * Must preserve exact measured evidence without model hallucination or value alterations.
 */
export const FailureDiagnosisSchema = z.object({
  id: z.string().min(1),
  verificationCaseId: z.string().min(1),
  targetInvariantId: z.string().min(1),
  targetSpecId: z.string().optional(),
  sourceConcernIds: z.array(z.string()).default([]),
  sourceDecisionIds: z.array(z.string()).default([]),
  classification: FailureClassificationSchema,
  expectedBehavior: z.string().min(1),
  observedBehavior: z.string().min(1),
  expectedMetricValue: z.unknown().optional(),
  observedMetricValue: z.unknown().optional(),
  assertionFailureMessages: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([]),
  likelyFailureMechanism: z.string().min(1),
  likelyAffectedFiles: z.array(z.string()).default([]),
  likelyAffectedSymbols: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.8),
  assumptions: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  isRepairable: z.boolean(),
  requiresArchitectureReview: z.boolean().default(false),
  reconsiderationRationale: z.string().optional(),
  createdAt: z.string(),
});
export type FailureDiagnosis = z.infer<typeof FailureDiagnosisSchema>;

/**
 * RepairTask represents a bounded implementation task targeted at fixing an evidence-proven failure.
 * Explains WHAT property is broken without prescribing arbitrary code or exposing raw test harnesses.
 */
export const RepairTaskSchema = z.object({
  id: z.string().min(1),
  objective: z.string().min(1),
  targetInvariantIds: z.array(z.string()).min(1),
  targetVerificationCaseIds: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([]),
  likelyFiles: z.array(z.string()).default([]),
  allowedFiles: z.array(z.string()).min(1, 'Allowed files list is required for bounded scope'),
  excludedFiles: z.array(z.string()).default([]),
  repairRequirements: z.array(z.string()).min(1),
  acceptanceCriteria: z.array(z.string()).min(1),
  dependencies: z.array(z.string()).default([]),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  maxScope: z.string().default('Fix implementation defect without modifying existing test suite or CI'),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']).default('pending'),
});
export type RepairTask = z.infer<typeof RepairTaskSchema>;

/**
 * RepairPlan bundles failure diagnoses and bounded repair tasks for an execution session.
 */
export const RepairPlanSchema = z.object({
  id: z.string().min(1),
  contractId: z.string().min(1),
  repositoryPath: z.string().min(1),
  diagnoses: z.array(FailureDiagnosisSchema).min(1),
  tasks: z.array(RepairTaskSchema).min(1),
  summary: z.string().min(1),
  createdAt: z.string(),
});
export type RepairPlan = z.infer<typeof RepairPlanSchema>;

/**
 * RepairProgress compares verification results between consecutive attempts.
 */
export const RepairProgressSchema = z.enum([
  'IMPROVED',
  'UNCHANGED',
  'REGRESSED',
  'VERIFIED',
]);
export type RepairProgress = z.infer<typeof RepairProgressSchema>;

/**
 * ExecutionCheckResultSchema describes individual build/test check outcomes.
 */
export const ExecutionCheckResultSchema = z.object({
  scriptName: z.string(),
  command: z.string(),
  exitCode: z.number(),
  passed: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number(),
});
export type ExecutionCheckResult = z.infer<typeof ExecutionCheckResultSchema>;

/**
 * RepairAttempt records a single cycle of diagnosis -> repair execution -> verification.
 */
export const RepairAttemptSchema = z.object({
  attemptNumber: z.number().int().positive(),
  diagnosisIds: z.array(z.string()).min(1),
  repairTaskIds: z.array(z.string()).min(1),
  agentExecutionResults: z.array(AgentExecutionResultSchema),
  changedFiles: z.array(z.string()),
  diffSummary: z.string(),
  nativeChecks: z.array(ExecutionCheckResultSchema),
  verificationResult: VerificationRunResultSchema,
  progress: RepairProgressSchema,
  durationMs: z.number(),
  checkpointRef: z.string().optional(),
  policyPassed: z.boolean().default(true),
  policyViolationReason: z.string().optional(),
  executedAt: z.string(),
});
export type RepairAttempt = z.infer<typeof RepairAttemptSchema>;

/**
 * RepairOutcome defines the final state of the repair loop.
 */
export const RepairOutcomeSchema = z.enum([
  'REPAIRED',
  'PARTIALLY_REPAIRED',
  'NEEDS_HUMAN_REVIEW',
  'ARCHITECTURE_REVIEW_REQUIRED',
  'VERIFICATION_BLOCKED',
  'AGENT_ERROR',
  'MAX_ATTEMPTS_REACHED',
]);
export type RepairOutcome = z.infer<typeof RepairOutcomeSchema>;

/**
 * RepairRunResult captures the full history and final verdict of an automatic repair run.
 */
export const RepairRunResultSchema = z.object({
  repairPlanId: z.string().min(1),
  contractId: z.string().min(1),
  outcome: RepairOutcomeSchema,
  attempts: z.array(RepairAttemptSchema),
  totalAttempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  isRepaired: z.boolean(),
  finalVerificationResult: VerificationRunResultSchema.optional(),
  repairedInvariants: z.array(z.string()).default([]),
  unresolvedInvariants: z.array(z.string()).default([]),
  escalationReason: z.string().optional(),
  architectureReviewContext: z
    .object({
      affectedDecisionIds: z.array(z.string()),
      rationale: z.string(),
      evidenceSummary: z.string(),
    })
    .optional(),
  durationMs: z.number(),
  completedAt: z.string(),
});
export type RepairRunResult = z.infer<typeof RepairRunResultSchema>;
