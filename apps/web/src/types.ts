import {
  EngineeringContract,
  EngineeringDimension,
  RequirementDecomposition,
} from '@architectai/domain';

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
}
