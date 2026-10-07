import { ExtractedClaim, SourceSection, SourceSnapshot } from '@architectai/domain';

export interface ClaimProvenanceValidationResult {
  isValid: boolean;
  validatedClaim: ExtractedClaim;
  action: 'ACCEPTED' | 'DOWNGRADED_TO_INFERENCE' | 'REJECTED';
  reason?: string;
}

export function canonicalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class ClaimProvenanceValidator {
  private readonly minQuoteLength = 10;
  private readonly maxQuoteLength = 600;

  /**
   * Mechanically verifies that an ExtractedClaim is anchored to real text in the referenced SourceSection.
   * If a DIRECT_SOURCE_CLAIM cannot be mechanically found in the section, it is rejected or downgraded to MODEL_INFERENCE.
   */
  validateClaim(
    claim: ExtractedClaim,
    snapshot: SourceSnapshot,
    section?: SourceSection
  ): ClaimProvenanceValidationResult {
    // 1. Snapshot correspondence
    if (claim.sourceSnapshotId !== snapshot.id) {
      return {
        isValid: false,
        validatedClaim: claim,
        action: 'REJECTED',
        reason: `Claim snapshot ID "${claim.sourceSnapshotId}" does not match provided snapshot ID "${snapshot.id}".`,
      };
    }

    // 2. Resolve section
    const targetSection = section || snapshot.sections.find(s => s.id === claim.sectionId);
    if (!targetSection) {
      return {
        isValid: false,
        validatedClaim: claim,
        action: 'REJECTED',
        reason: `Referenced section ID "${claim.sectionId}" does not exist in snapshot "${snapshot.id}".`,
      };
    }

    // 3. Handle DIRECT_SOURCE_CLAIM anchoring
    if (claim.claimType === 'DIRECT_SOURCE_CLAIM') {
      const quote = claim.sourceQuote?.trim();

      // Quote is mandatory for DIRECT_SOURCE_CLAIM
      if (!quote) {
        return {
          isValid: true,
          validatedClaim: {
            ...claim,
            claimType: 'MODEL_INFERENCE',
            sourceQuote: undefined,
          },
          action: 'DOWNGRADED_TO_INFERENCE',
          reason: 'DIRECT_SOURCE_CLAIM lacked mandatory sourceQuote. Downgraded to MODEL_INFERENCE.',
        };
      }

      // Check quote length boundaries
      if (quote.length < this.minQuoteLength || quote.length > this.maxQuoteLength) {
        return {
          isValid: true,
          validatedClaim: {
            ...claim,
            claimType: 'MODEL_INFERENCE',
          },
          action: 'DOWNGRADED_TO_INFERENCE',
          reason: `sourceQuote length (${quote.length}) outside acceptable bounds (${this.minQuoteLength}-${this.maxQuoteLength}). Downgraded to MODEL_INFERENCE.`,
        };
      }

      // Mechanical existence check inside targetSection.content
      const normSection = canonicalizeWhitespace(targetSection.content).toLowerCase();
      const normQuote = canonicalizeWhitespace(quote).toLowerCase();

      const existsInSection = normSection.includes(normQuote);

      if (!existsInSection) {
        // Check if quote mistakenly comes from another section
        const otherSectionMatch = snapshot.sections.find(s =>
          s.id !== targetSection.id &&
          canonicalizeWhitespace(s.content).toLowerCase().includes(normQuote)
        );

        const reason = otherSectionMatch
          ? `sourceQuote exists in section "${otherSectionMatch.id}" instead of referenced section "${targetSection.id}". Fabricated section alignment.`
          : `sourceQuote "${quote}" cannot be mechanically located in section "${targetSection.id}". Fabricated quote rejected.`;

        // Downgrade to MODEL_INFERENCE or reject (DIRECT authority cannot stand)
        return {
          isValid: true,
          validatedClaim: {
            ...claim,
            claimType: 'MODEL_INFERENCE',
            sourceQuote: undefined,
          },
          action: 'DOWNGRADED_TO_INFERENCE',
          reason,
        };
      }

      // Compute exact offsets if possible
      const rawIndex = targetSection.content.indexOf(quote);
      let startOffset = claim.sourceStartOffset;
      let endOffset = claim.sourceEndOffset;
      if (rawIndex !== -1) {
        startOffset = rawIndex;
        endOffset = rawIndex + quote.length;
      }

      return {
        isValid: true,
        validatedClaim: {
          ...claim,
          sourceStartOffset: startOffset,
          sourceEndOffset: endOffset,
        },
        action: 'ACCEPTED',
      };
    }

    // 4. MODEL_INFERENCE claims: must not masquerade as direct evidence
    return {
      isValid: true,
      validatedClaim: {
        ...claim,
        claimType: 'MODEL_INFERENCE',
      },
      action: 'ACCEPTED',
    };
  }
}
