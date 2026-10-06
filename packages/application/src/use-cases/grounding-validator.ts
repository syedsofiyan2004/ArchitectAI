import {
  KnowledgeCandidate,
  ExtractedClaim,
  KnowledgeSource
} from '@architectai/domain';
import { ProviderAdapter } from '@architectai/providers';

export class GroundingValidator {
  constructor(_provider: ProviderAdapter) {}

  /**
   * Validates if a proposed candidate is sufficiently grounded in the provided claims.
   * Modifies candidate.state to 'GROUNDED' or 'REJECTED' appropriately.
   */
  async validateCandidate(
    candidate: KnowledgeCandidate,
    _source: KnowledgeSource,
    allClaims: ExtractedClaim[]
  ): Promise<KnowledgeCandidate> {
    const candidateClaims = candidate.sourceClaimIds
      .map(id => allClaims.find(c => c.id === id))
      .filter((c): c is ExtractedClaim => c !== undefined);

    // Rule 1: Must have at least one claim
    if (candidateClaims.length === 0) {
      candidate.state = 'REJECTED';
      return candidate;
    }

    // Rule 2: Must have at least one DIRECT_SOURCE_CLAIM
    const hasDirectSource = candidateClaims.some(c => c.claimType === 'DIRECT_SOURCE_CLAIM');
    if (!hasDirectSource) {
      candidate.state = 'REJECTED';
      return candidate;
    }

    // Rule 3: For L1, never auto-accept, keep it at GROUNDED (or reject if we strictly prohibit L1 creation)
    if (candidate.proposedLevel === 'fundamental') {
      candidate.state = 'REJECTED'; // L1 should be highly curated, reject auto-generation for now
      return candidate;
    }

    // Advanced: LLM-based grounding check could go here.
    // For Milestone 5, the strict deterministic rules of DIRECT_SOURCE_CLAIM + Source Tier evaluation
    // during CandidateReview will handle acceptance. This makes it GROUNDED.
    
    candidate.state = 'GROUNDED';
    return candidate;
  }
}
