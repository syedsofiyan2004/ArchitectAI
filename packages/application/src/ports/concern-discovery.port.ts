import { RequirementIntent, ConcernCandidate } from '@architectai/domain';
import { KnowledgeRepository } from '@architectai/knowledge';

export interface ConcernDiscoveryRequest {
  intent: RequirementIntent;
  targetDimensions?: string[];
  maxConcerns?: number;
}

export interface ConcernDiscoveryPort {
  discoverConcerns(
    request: ConcernDiscoveryRequest,
    knowledgeRepository: KnowledgeRepository
  ): Promise<ConcernCandidate[]>;
}
