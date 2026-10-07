import {
  EngineeringContract,
  EngineeringDimension,
  RequirementDecomposition,
  ImplementationPlan,
  ImplementationTask,
  RepositoryWorkspace,
  RepositoryContext,
  AgentExecutionResult,
  VerificationPlan,
  VerificationRunResult,
  FailureDiagnosis,
  RepairPlan,
  RepairAttempt,
  RepairRunResult,
  Project,
  ProjectRepository,
  WorkspaceSettings,
} from '@architectai/domain';

export type {
  FailureDiagnosis,
  RepairPlan,
  RepairAttempt,
  RepairRunResult,
  Project,
  ProjectRepository,
  WorkspaceSettings,
};

export interface AgentInfo {
  id: string;
  name: string;
  available: boolean;
  version?: string;
  reason?: string;
}

export interface PlanExecutionOutput {
  plan: ImplementationPlan;
  runId: string;
  agentId: string;
  agentName: string;
  isolatedBranch: string;
  originalBranch: string;
  originalHead: string;
  originalBranchUntouched: boolean;
  taskResults: AgentExecutionResult[];
  executionChecks: Array<{
    command: string;
    scriptName: string;
    passed: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
  }>;
  diffReport: {
    isClean: boolean;
    changedFiles: string[];
    diff: string;
    rawStatus: string;
  };
  allTasksCompleted: boolean;
  verificationPlan?: VerificationPlan;
  verificationRun?: VerificationRunResult;
  isVerified?: boolean;
  executedAt: string;
}

export interface AnalysisStageLog {
  stage: number;
  name: string;
  description: string;
  timestamp: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface AnalyzeArchitectureOutput {
  contract: EngineeringContract;
  stages: AnalysisStageLog[];
  dimensionsDetected: EngineeringDimension[];
  mode: 'remote-model' | 'deterministic-demo';
  decomposition: RequirementDecomposition;
}

export interface ScenarioPreset {
  id: string;
  tag: string;
  title: string;
  prompt: string;
  context: {
    language?: string;
    framework?: string;
    database?: string;
    cloud?: string;
    scale?: string;
    additionalConstraints?: string;
  };
}

export interface ServerConfig {
  mode: 'remote-model' | 'deterministic-demo';
  providerName: string;
  modelName: string;
  knowledgeItemsCount: number;
  csrfToken?: string;
}

export interface AnalysisRunRecord {
  id: string;
  projectId?: string;
  title: string;
  rawIntent: string;
  context: Record<string, string>;
  explicitConstraints: string[];
  declaredTechStack: string[];
  createdAt: string;
  status: 'analyzing' | 'completed' | 'failed';
  state?: string;
  error?: string;
  result?: AnalyzeArchitectureOutput;
  // Execution state for this run
  workspace?: RepositoryWorkspace;
  plan?: ImplementationPlan;
  execution?: PlanExecutionOutput;
  // User answers to unresolved questions
  userAnswers?: Record<string, string>;
  revisions?: unknown[];
  sessions?: unknown[];
  artifacts?: unknown[];
}
