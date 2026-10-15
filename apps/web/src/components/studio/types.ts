// ArchitectAI Architecture Studio Prototype — Type Definitions
import type {
  ArchitectureGraphNode,
  ArchitectureGraphEdge,
  ArchitectureGraphBoundary,
  ArchitectureGraphProjection,
  GraphProjectionStatus,
  GraphEntityOrigin,
  GraphEntityConfidence,
  GraphNodeCategory,
  EngineeringContract,
} from '@architectai/domain';

export type {
  ArchitectureGraphNode,
  ArchitectureGraphEdge,
  ArchitectureGraphBoundary,
  ArchitectureGraphProjection,
  GraphProjectionStatus,
  GraphEntityOrigin,
  GraphEntityConfidence,
  GraphNodeCategory,
  EngineeringContract,
};

export type ComponentCategory = GraphNodeCategory;

export type NodeStatus = 'healthy' | 'active' | 'warning' | 'throttled' | 'overloaded';

export type SimulationAlgorithm = 'FIXED_WINDOW' | 'ROLLING_WINDOW';

export type TrafficScenario = 'STEADY' | 'BOUNDARY_SPIKE' | 'BURST_ATTACK';

export interface ArchitectureAlternative {
  title: string;
  verdict: 'REJECTED' | 'CONSIDERED' | 'ACCEPTED';
  reason: string;
}

export interface ArchitectureFailureMode {
  id: string;
  name: string;
  level: 'L1' | 'L2' | 'L3';
  description: string;
  consequence: string;
  mitigation: string;
}

export interface InvariantVerificationSpec {
  invariantId: string;
  title: string;
  formalProperty: string;
  operator: 'lte' | 'gte' | 'eq' | 'no_duplicate' | 'bounded_concurrency' | string;
  expected: string | number;
  testStrategy: string;
  verificationDescription: string;
  executableCommand?: string;
}

export interface ImplementationMapping {
  technology: string;
  packageTarget?: string;
  targetFiles: string[];
  configuration: Record<string, string>;
  codeSnippet?: string;
}

/**
 * StudioNode extends the authoritative domain ArchitectureGraphNode with
 * optional simulation and presentation-level properties.
 */
export interface StudioNode extends Partial<ArchitectureGraphNode> {
  id: string;
  label: string;
  sublabel: string;
  category: ComponentCategory;
  x: number;
  y: number;

  tierBadge?: string;
  status?: NodeStatus;

  // Systems Reasoning & Provenance
  purpose: string;
  whySelected?: string;
  tradeOffs?: string[];
  failureModes?: ArchitectureFailureMode[];
  alternativesConsidered?: ArchitectureAlternative[];
  implementation?: ImplementationMapping;
  verification?: InvariantVerificationSpec;

  // Metrics strip (real modeled properties or prototype metrics)
  metrics?: {
    label1: string;
    value1: string;
    label2: string;
    value2: string;
    label3?: string;
    value3?: string;
  };
}

/**
 * StudioEdge extends the authoritative domain ArchitectureGraphEdge with
 * presentation-level properties.
 */
export interface StudioEdge extends Partial<ArchitectureGraphEdge> {
  id: string;
  source: string;
  target: string;
  label: string;
  protocol: string;
  direction?: 'unidirectional' | 'bidirectional';
  latencySla?: string;

  // Systems Reasoning
  purpose?: string;
  whySelected?: string;
  tradeOffs?: string[];
  failureModes?: ArchitectureFailureMode[];
  alternativesConsidered?: ArchitectureAlternative[];
  implementation?: ImplementationMapping;
  verification?: InvariantVerificationSpec;
}

export type TrustBoundary = ArchitectureGraphBoundary;

export interface SimulationState {
  algorithm: SimulationAlgorithm;
  scenario: TrafficScenario;
  isRunning: boolean;
  speed: number; // 1, 2, 5
  timeInWindowSec: number; // 0 - 60
  totalRequests: number;
  allowedRequests: number;
  throttledRequests: number;
  currentRps: number;
  downstreamLoadPct: number;
  burstDetected: boolean;
  explanation: string;
}
