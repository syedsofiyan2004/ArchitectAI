import { z } from 'zod';

export const ImplementationTaskRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export type ImplementationTaskRiskLevel = z.infer<typeof ImplementationTaskRiskLevelSchema>;

export const ImplementationTaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped',
]);
export type ImplementationTaskStatus = z.infer<typeof ImplementationTaskStatusSchema>;

export const ImplementationTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string(),
  sourceConcernIds: z.array(z.string()).default([]),
  sourceDecisionIds: z.array(z.string()).default([]),
  sourceInvariantIds: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  contextReferences: z.array(z.string()).default([]),
  allowedFiles: z.array(z.string()).default([]),
  excludedFiles: z.array(z.string()).default([]),
  requirements: z.array(z.string()).min(1),
  acceptanceCriteria: z.array(z.string()).min(1),
  verificationCommands: z.array(z.string()).default([]),
  expectedArtifacts: z.array(z.string()).default([]),
  riskLevel: ImplementationTaskRiskLevelSchema.default('medium'),
  status: ImplementationTaskStatusSchema.default('pending'),
});
export type ImplementationTask = z.infer<typeof ImplementationTaskSchema>;

export const ImplementationPlanSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  repositoryPath: z.string(),
  summary: z.string(),
  tasks: z.array(ImplementationTaskSchema).min(1),
  createdAt: z.string(),
});
export type ImplementationPlan = z.infer<typeof ImplementationPlanSchema>;

export const AgentExecutionCommandSchema = z.object({
  command: z.string(),
  exitCode: z.number(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number().default(0),
});
export type AgentExecutionCommand = z.infer<typeof AgentExecutionCommandSchema>;

export const AgentExecutionResultSchema = z.object({
  executionId: z.string(),
  taskId: z.string(),
  status: z.enum(['completed', 'failed', 'cancelled']),
  changedFiles: z.array(z.string()).default([]),
  commandsExecuted: z.array(AgentExecutionCommandSchema).default([]),
  logs: z.array(z.string()).default([]),
  agentSummary: z.string(),
  durationMs: z.number().default(0),
  failureReason: z.string().optional(),
});
export type AgentExecutionResult = z.infer<typeof AgentExecutionResultSchema>;
