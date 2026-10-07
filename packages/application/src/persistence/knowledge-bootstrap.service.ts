import { KnowledgeRepository, prototypeKnowledgeFixtures } from '@architectai/knowledge';
import { KnowledgeAcquisitionRegistry } from '@architectai/knowledge';

export interface KnowledgeBootstrapReport {
  curatedCount: number;
  acceptedAcquiredCount: number;
  totalLoaded: number;
  reviewRequiredCount: number;
  conflictedCount: number;
}

export class KnowledgeBootstrapService {
  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    private readonly acquisitionRegistry: KnowledgeAcquisitionRegistry
  ) {}

  public async bootstrap(): Promise<KnowledgeBootstrapReport> {
    // 1. Load curated prototype knowledge fixtures
    await this.knowledgeRepo.load(prototypeKnowledgeFixtures);
    const curatedCount = prototypeKnowledgeFixtures.length;

    // 2. Load ACCEPTED acquired knowledge items only
    // Exclude REVIEW_REQUIRED, CONFLICTED, DEPRECATED
    const acceptedAcquired = this.acquisitionRegistry.getAllAcceptedKnowledge();
    if (acceptedAcquired.length > 0) {
      await this.knowledgeRepo.load(acceptedAcquired);
    }

    const allCandidates = this.acquisitionRegistry.getAllCandidates();
    const reviewRequiredCount = allCandidates.filter((c) => c.state === 'REVIEW_REQUIRED').length;
    const conflictedCount = this.acquisitionRegistry.getAllConflicts().length;

    return {
      curatedCount,
      acceptedAcquiredCount: acceptedAcquired.length,
      totalLoaded: curatedCount + acceptedAcquired.length,
      reviewRequiredCount,
      conflictedCount,
    };
  }

  public getStatus() {
    const acceptedAcquired = this.acquisitionRegistry.getAllAcceptedKnowledge();
    const allCandidates = this.acquisitionRegistry.getAllCandidates();
    const reviewRequired = allCandidates.filter((c) => c.state === 'REVIEW_REQUIRED');
    const conflicts = this.acquisitionRegistry.getAllConflicts();

    return {
      curatedCount: prototypeKnowledgeFixtures.length,
      acceptedAcquiredCount: acceptedAcquired.length,
      reviewRequiredCount: reviewRequired.length,
      conflictsCount: conflicts.length,
    };
  }
}
