import { z } from 'zod';
import { PackageManifestSummarySchema } from './workspace.js';
import { EngineeringContractSchema } from './contract.js';
import { VerificationRunResultSchema } from './verification.js';
import { RepairRunResultSchema } from './repair.js';

export const WorkspaceSettingsSchema = z.object({
  allowedRepositoryRoots: z.array(z.string()).default([]),
  maxArtifactSizeBytes: z.number().default(5 * 1024 * 1024),
  defaultProviderConfigId: z.string().optional(),
  preferredAgentId: z.string().optional(),
});
export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  repositoryId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().optional(),
  lastOpenedAt: z.string().optional(),
  defaultProviderConfigId: z.string().optional(),
  preferredAgentId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectRepositorySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  canonicalLocalPath: z.string().min(1),
  repositoryName: z.string().min(1),
  gitRoot: z.string().min(1),
  defaultBranch: z.string().default('main'),
  detectedLanguages: z.array(z.string()).default([]),
  detectedFrameworks: z.array(z.string()).default([]),
  packageManifests: z.array(PackageManifestSummarySchema).default([]),
  lastInspectedHead: z.string().default('HEAD'),
  lastInspectedTimestamp: z.string(),
});
export type ProjectRepository = z.infer<typeof ProjectRepositorySchema>;

export const RunLifecycleStateSchema = z.enum([
  'DRAFT',
  'ANALYZING',
  'ANALYSIS_COMPLETE',
  'ARCHITECTURE_ACCEPTED',
  'READY_FOR_IMPLEMENTATION',
  'IMPLEMENTING',
  'VERIFICATION_FAILED',
  'VERIFIED',
  'REPAIR_PENDING',
  'REPAIRING',
  'ESCALATED',
  'FAILED',
  'CANCELLED',
]);
export type RunLifecycleState = z.infer<typeof RunLifecycleStateSchema>;

export const ALLOWED_RUN_STATE_TRANSITIONS: Record<RunLifecycleState, readonly RunLifecycleState[]> = {
  DRAFT: ['ANALYZING', 'CANCELLED'],
  ANALYZING: ['ANALYSIS_COMPLETE', 'FAILED', 'CANCELLED'],
  ANALYSIS_COMPLETE: ['ARCHITECTURE_ACCEPTED', 'READY_FOR_IMPLEMENTATION', 'ANALYZING', 'CANCELLED'],
  ARCHITECTURE_ACCEPTED: ['READY_FOR_IMPLEMENTATION', 'ANALYZING', 'CANCELLED'],
  READY_FOR_IMPLEMENTATION: ['IMPLEMENTING', 'CANCELLED'],
  IMPLEMENTING: ['VERIFIED', 'VERIFICATION_FAILED', 'FAILED', 'CANCELLED'],
  VERIFICATION_FAILED: ['REPAIR_PENDING', 'READY_FOR_IMPLEMENTATION', 'FAILED', 'CANCELLED'],
  REPAIR_PENDING: ['REPAIRING', 'ESCALATED', 'CANCELLED'],
  REPAIRING: ['VERIFIED', 'VERIFICATION_FAILED', 'ESCALATED', 'FAILED', 'CANCELLED'],
  ESCALATED: ['READY_FOR_IMPLEMENTATION', 'REPAIRING', 'CANCELLED'],
  FAILED: ['ANALYZING', 'READY_FOR_IMPLEMENTATION', 'DRAFT', 'CANCELLED'],
  VERIFIED: ['READY_FOR_IMPLEMENTATION', 'ANALYZING', 'CANCELLED'],
  CANCELLED: ['DRAFT'],
};

export function isValidRunStateTransition(fromState: RunLifecycleState, toState: RunLifecycleState): boolean {
  if (fromState === toState) {
    return true;
  }
  const allowed = ALLOWED_RUN_STATE_TRANSITIONS[fromState];
  return allowed ? allowed.includes(toState) : false;
}

export function validateRunStateTransition(fromState: RunLifecycleState, toState: RunLifecycleState): void {
  if (!isValidRunStateTransition(fromState, toState)) {
    throw new Error(`Invalid run state transition from '${fromState}' to '${toState}'.`);
  }
}

export const ContractRevisionSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  contract: EngineeringContractSchema,
  reason: z.string().optional(),
  parentRevisionId: z.string().optional(),
  createdAt: z.string(),
});
export type ContractRevision = z.infer<typeof ContractRevisionSchema>;

export const UserAnswerRecordSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string(),
  answeredAt: z.string(),
});
export type UserAnswerRecord = z.infer<typeof UserAnswerRecordSchema>;

export const ArchitectureRunSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  state: RunLifecycleStateSchema,
  rawIntent: z.string(),
  explicitConstraints: z.array(z.string()).default([]),
  declaredTechStack: z.array(z.string()).default([]),
  context: z.record(z.string()).default({}),
  decomposition: z.unknown().optional(),
  contract: EngineeringContractSchema.optional(),
  contractRevision: z.number().int().default(1),
  dimensionsDetected: z.array(z.string()).default([]),
  analysisMode: z.enum(['heuristic', 'semantic', 'deterministic', 'deterministic-demo', 'remote-model']).default('heuristic'),
  error: z.string().optional(),
  userAnswers: z.record(z.string()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});
export type ArchitectureRun = z.infer<typeof ArchitectureRunSchema>;

export const ImplementationSessionStatusSchema = z.enum([
  'PENDING',
  'IMPLEMENTING',
  'VERIFYING',
  'REPAIRING',
  'COMPLETED',
  'FAILED',
  'RECOVERABLE',
  'ORPHANED',
  'CLEANUP_REQUIRED',
  'INTERRUPTED',
]);
export type ImplementationSessionStatus = z.infer<typeof ImplementationSessionStatusSchema>;

export const ImplementationSessionSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  projectId: z.string().min(1),
  repositoryId: z.string().min(1),
  implementationPlanId: z.string().optional(),
  codingAgent: z.string().min(1),
  originalHead: z.string().min(1),
  originalBranch: z.string().min(1),
  isolatedBranch: z.string().min(1),
  worktreePath: z.string().optional(),
  changedFiles: z.array(z.string()).default([]),
  nativeCheckSummaries: z.array(z.unknown()).default([]),
  verificationRunResult: VerificationRunResultSchema.optional(),
  repairRunResult: RepairRunResultSchema.optional(),
  status: ImplementationSessionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});
export type ImplementationSession = z.infer<typeof ImplementationSessionSchema>;

export const RunArtifactReferenceSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().optional(),
  type: z.enum(['DIFF_PATCH', 'VERIFICATION_HARNESS', 'LOG', 'EXECUTION_EVIDENCE']),
  relativePath: z.string().min(1),
  contentHash: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type RunArtifactReference = z.infer<typeof RunArtifactReferenceSchema>;

export const ProviderConfigurationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['OPENAI_COMPATIBLE', 'DETERMINISTIC_DEMO']),
  displayName: z.string().min(1),
  baseUrl: z.string().optional(),
  modelName: z.string().min(1),
  credentialReference: z.string().optional(),
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProviderConfiguration = z.infer<typeof ProviderConfigurationSchema>;

export const AgentConfigurationSchema = z.object({
  id: z.string().min(1),
  adapterId: z.string().min(1),
  displayName: z.string().min(1),
  preferred: z.boolean().default(false),
  lastDetectedVersion: z.string().optional(),
  lastDetectionTimestamp: z.string().optional(),
  isAvailable: z.boolean().default(true),
});
export type AgentConfiguration = z.infer<typeof AgentConfigurationSchema>;

export const SystemCapabilitiesSchema = z.object({
  analysisProvider: z.enum(['READY', 'DEGRADED', 'UNAVAILABLE', 'NOT_CONFIGURED']),
  knowledgeRegistry: z.enum(['READY', 'DEGRADED', 'UNAVAILABLE']),
  codingAgent: z.enum(['READY', 'DEGRADED', 'UNAVAILABLE']),
  git: z.enum(['READY', 'UNAVAILABLE']),
  verificationRuntime: z.enum(['READY', 'UNAVAILABLE']),
  repositoryAccess: z.enum(['READY', 'UNAVAILABLE']),
  details: z.record(z.unknown()).default({}),
});
export type SystemCapabilities = z.infer<typeof SystemCapabilitiesSchema>;
