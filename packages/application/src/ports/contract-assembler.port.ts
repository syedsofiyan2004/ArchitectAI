import {
  RequirementIntent,
  ConcernCandidate,
  ArchitectureDecision,
  EngineeringInvariant,
  VerificationSpec,
  EngineeringContract,
} from '@architectai/domain';

export interface AssembleContractInput {
  requirement: RequirementIntent;
  discoveredConcerns?: ConcernCandidate[];
  decisions?: ArchitectureDecision[];
  invariants?: EngineeringInvariant[];
  verificationSpecs?: VerificationSpec[];
  assumptions?: string[];
  unresolvedQuestions?: string[];
  author?: string;
  tags?: string[];
}

export interface ContractAssemblerPort {
  assembleContract(input: AssembleContractInput): Promise<EngineeringContract>;
}
