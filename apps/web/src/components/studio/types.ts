// ArchitectAI Architecture Studio Prototype — Type Definitions

export type ComponentCategory = 'client' | 'gateway' | 'compute' | 'cache' | 'datastore';

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
  operator: 'lte' | 'gte' | 'eq' | 'no_duplicate' | 'bounded_concurrency';
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

export interface StudioNode {
  id: string;
  label: string;
  sublabel: string;
  category: ComponentCategory;
  tierBadge: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  status: NodeStatus;
  
  // Systems Reasoning & Provenance
  purpose: string;
  whySelected: string;
  tradeOffs: string[];
  failureModes: ArchitectureFailureMode[];
  alternativesConsidered: ArchitectureAlternative[];
  implementation: ImplementationMapping;
  verification: InvariantVerificationSpec;
  
  // Simulated Live Metrics
  metrics: {
    label1: string;
    value1: string;
    label2: string;
    value2: string;
    label3: string;
    value3: string;
  };
}

export interface StudioEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  protocol: string;
  latencySla: string;
  direction: 'unidirectional' | 'bidirectional';
  
  // Systems Reasoning
  purpose: string;
  whySelected: string;
  tradeOffs: string[];
  failureModes: ArchitectureFailureMode[];
  alternativesConsidered: ArchitectureAlternative[];
  implementation: ImplementationMapping;
  verification: InvariantVerificationSpec;
}

export interface TrustBoundary {
  id: string;
  label: string;
  description: string;
  tier: 'public' | 'dmz' | 'private_compute' | 'state';
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

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
