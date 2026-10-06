import { z } from 'zod';

/**
 * VerificationSpec defines an independent, executable verification procedure.
 */
export const VerificationSpecSchema = z.object({
  id: z.string().min(1),
  target: z.string().min(1, 'Target invariant, decision, or property identifier is required'),
  description: z.string().min(1),
  setup: z.string().min(1, 'Preconditions and setup steps are required'),
  action: z.string().min(1, 'Stimulus or action to execute is required'),
  expectedProperty: z.string().min(1, 'Expected measurable property is required'),
  evidenceToCollect: z.array(z.string()).min(1, 'Must specify what evidence to collect'),
  isAutomatable: z.boolean(),
});

export type VerificationSpec = z.infer<typeof VerificationSpecSchema>;

/**
 * VerificationRecipe: Reusable verification knowledge pattern linking
 * failure modes and engineering dimensions to concrete verification strategies,
 * observations, assertion templates, and harness guidance.
 */
export const VerificationRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  applicableFailurePatterns: z.array(z.string()).min(1),
  applicableDimensions: z.array(z.string()).default([]),
  strategy: z.string().default('node_test_harness'),
  requiredCapabilities: z.array(z.string()).default([]),
  observationDefinitions: z.array(z.string()).default([]),
  assertionTemplates: z.array(z.lazy(() => VerificationAssertionSchema)).default([]),
  setupGuidance: z.string().default(''),
  stimulusGuidance: z.string().default(''),
  harnessTemplate: z.string().optional(),
  provenance: z.string().default('ArchitectAI Engineering Knowledge Base'),
});
export type VerificationRecipe = z.infer<typeof VerificationRecipeSchema>;

/**
 * VerificationIntent: Intermediate representation describing WHAT must be tested,
 * how the system under test should be stimulated, and what must be observed,
 * without the model assigning any pass/fail verdict.
 */
export const VerificationIntentSchema = z.object({
  id: z.string().min(1),
  invariantId: z.string().min(1),
  specId: z.string().optional(),
  failureHypothesis: z.string().min(1),
  systemOperationUnderTest: z.string().min(1),
  requiredSetup: z.string().default(''),
  adversarialStimulus: z.string().default(''),
  observations: z.array(z.string()).min(1),
  assertions: z.array(z.lazy(() => VerificationAssertionSchema)).min(1),
  targetFiles: z.array(z.string()).default([]),
  targetSymbols: z.array(z.string()).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.8),
  assumptions: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  isExecutable: z.boolean().default(true),
  inconclusiveReason: z.string().optional(),
  selectedRecipeId: z.string().optional(),
});
export type VerificationIntent = z.infer<typeof VerificationIntentSchema>;

/**
 * NodeVerificationArtifact: Bounded executable artifact specification
 * for the node_test_harness executor.
 */
export const NodeVerificationArtifactSchema = z.object({
  id: z.string().min(1),
  intentId: z.string().min(1),
  targetFile: z.string().min(1),
  targetModuleSymbol: z.string().optional(),
  harnessScript: z.string().min(1),
  timeoutMs: z.number().positive().default(10000),
  expectedEvidenceKeys: z.array(z.string()).min(1),
});
export type NodeVerificationArtifact = z.infer<typeof NodeVerificationArtifactSchema>;

/**
 * Verification strategy specifies which executor adapter runs the case.
 */
export const VerificationStrategySchema = z.enum([
  'node_test_harness',
  'http_probe',
  'process_monitor',
  'external_command',
  'custom',
]);
export type VerificationStrategy = z.infer<typeof VerificationStrategySchema>;

/**
 * Verdicts for an individual verification case.
 */
export const VerificationVerdictSchema = z.enum([
  'PASS',
  'FAIL',
  'INCONCLUSIVE',
  'ERROR',
  'SKIPPED',
]);
export type VerificationVerdict = z.infer<typeof VerificationVerdictSchema>;

/**
 * Overall verification status for a verification run.
 */
export const VerificationOverallStatusSchema = z.enum([
  'VERIFIED',
  'FAILED',
  'INCONCLUSIVE',
  'ERROR',
]);
export type VerificationOverallStatus = z.infer<typeof VerificationOverallStatusSchema>;

/**
 * Deterministic assertion evaluated against collected observations.
 */
export const VerificationAssertionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  operator: z
    .enum(['lte', 'gte', 'eq', 'neq', 'contains', 'not_contains', 'matches', 'custom'])
    .default('eq'),
  expected: z.unknown(),
  unit: z.string().optional(),
});
export type VerificationAssertion = z.infer<typeof VerificationAssertionSchema>;

/**
 * Structured evidence captured during verification execution.
 */
export const VerificationEvidenceSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  kind: z.string().min(1),
  name: z.string().min(1),
  expected: z.unknown(),
  observed: z.unknown(),
  unit: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  artifactPath: z.string().optional(),
  capturedAt: z.string(),
});
export type VerificationEvidence = z.infer<typeof VerificationEvidenceSchema>;

/**
 * Executable Verification Case maintaining strict traceability to invariants and specs.
 */
export const VerificationCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  failureTarget: z.string().min(1, 'Failure mode to expose is required'),
  strategy: VerificationStrategySchema.default('node_test_harness'),
  targetInvariantId: z.string().min(1, 'Target invariant ID is required'),
  targetSpecId: z.string().optional(),
  sourceConcernIds: z.array(z.string()).default([]),
  sourceDecisionIds: z.array(z.string()).default([]),
  preconditions: z.string().default(''),
  stimulus: z.string().default(''),
  expectedProperty: z.string().min(1),
  assertions: z.array(VerificationAssertionSchema).min(1, 'At least one assertion is required'),
  evidenceRequirements: z.array(z.string()).default([]),
  timeoutMs: z.number().positive().default(10000),
  isAutomatable: z.boolean().default(true),
  harnessTemplate: z.string().optional(),
});
export type VerificationCase = z.infer<typeof VerificationCaseSchema>;

/**
 * VerificationPlan compiles adversarial cases for a specific implementation run.
 */
export const VerificationPlanSchema = z.object({
  id: z.string().min(1),
  contractId: z.string().min(1),
  implementationRunId: z.string().min(1),
  repositoryPath: z.string().min(1),
  baseHead: z.string().min(1),
  cases: z.array(VerificationCaseSchema).min(1, 'At least one verification case is required'),
  createdAt: z.string(),
});
export type VerificationPlan = z.infer<typeof VerificationPlanSchema>;

export const VerificationCaseAssertionResultSchema = z.object({
  name: z.string(),
  expected: z.unknown(),
  observed: z.unknown(),
  passed: z.boolean(),
  message: z.string().optional(),
});
export type VerificationCaseAssertionResult = z.infer<typeof VerificationCaseAssertionResultSchema>;

/**
 * Result of executing a single verification case.
 */
export const VerificationCaseResultSchema = z.object({
  caseId: z.string(),
  targetInvariantId: z.string(),
  verdict: VerificationVerdictSchema,
  isBlocking: z.boolean(),
  passed: z.boolean(),
  summary: z.string(),
  assertions: z.array(VerificationCaseAssertionResultSchema),
  evidence: z.array(VerificationEvidenceSchema),
  durationMs: z.number().default(0),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  artifactContent: z.string().optional(),
  errorDetails: z.string().optional(),
});
export type VerificationCaseResult = z.infer<typeof VerificationCaseResultSchema>;

/**
 * Result of a complete independent verification run.
 */
export const VerificationRunResultSchema = z.object({
  runId: z.string(),
  planId: z.string(),
  contractId: z.string(),
  overallStatus: VerificationOverallStatusSchema,
  isVerified: z.boolean(),
  summary: z.string(),
  caseResults: z.array(VerificationCaseResultSchema),
  totalCases: z.number(),
  passedCases: z.number(),
  failedCases: z.number(),
  inconclusiveCases: z.number(),
  errorCases: z.number(),
  skippedCases: z.number(),
  executedAt: z.string(),
  durationMs: z.number(),
});
export type VerificationRunResult = z.infer<typeof VerificationRunResultSchema>;

