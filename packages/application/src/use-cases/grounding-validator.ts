import {
  KnowledgeCandidate,
  ExtractedClaim,
  KnowledgeSource,
  CandidateStatement
} from '@architectai/domain';
import { ProviderAdapter } from '@architectai/providers';

export class GroundingValidator {
  constructor(_provider?: ProviderAdapter) {}

  /**
   * Validates if a proposed candidate and its individual factual statements
   * are sufficiently grounded in the provided claims.
   * Strips/downgrades unsupported factual claims (e.g. invented constraints).
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

    // Rule 1: Must have at least one valid claim
    if (candidateClaims.length === 0) {
      candidate.state = 'REJECTED';
      return candidate;
    }

    // Rule 2: Must have at least one DIRECT_SOURCE_CLAIM
    const directSourceClaims = candidateClaims.filter(c => c.claimType === 'DIRECT_SOURCE_CLAIM');
    if (directSourceClaims.length === 0) {
      candidate.state = 'REJECTED';
      return candidate;
    }

    // Rule 3: For L1 fundamental, never auto-accept
    if (candidate.proposedLevel === 'fundamental') {
      candidate.state = 'REJECTED';
      return candidate;
    }

    // Rule 4: Field-level Grounding
    // Factual fields: mechanism, officialMechanism, operationalConstraints, limits
    // Build or inspect fieldStatements
    if (!candidate.fieldStatements || candidate.fieldStatements.length === 0) {
      // Auto-populate initial field statements if not pre-populated
      candidate.fieldStatements = [];
      if (candidate.mechanism) {
        candidate.fieldStatements.push({
          field: 'mechanism',
          normalizedStatement: candidate.mechanism,
          supportingClaimIds: candidate.sourceClaimIds,
          supportType: 'DIRECT_SOURCE',
        });
      }
      if (candidate.officialMechanism) {
        candidate.fieldStatements.push({
          field: 'officialMechanism',
          normalizedStatement: candidate.officialMechanism,
          supportingClaimIds: candidate.sourceClaimIds,
          supportType: 'DIRECT_SOURCE',
        });
      }
      if (candidate.operationalConstraints) {
        for (const oc of candidate.operationalConstraints) {
          candidate.fieldStatements.push({
            field: 'operationalConstraints',
            normalizedStatement: oc,
            supportingClaimIds: candidate.sourceClaimIds,
            supportType: 'DIRECT_SOURCE',
          });
        }
      }
    }

    // Verify each factual statement in candidate.fieldStatements
    const verifiedStatements: CandidateStatement[] = [];
    const validOperationalConstraints: string[] = [];

    for (const stmt of candidate.fieldStatements) {
      // Resolve supporting claims for this specific statement
      const stmtClaims = stmt.supportingClaimIds
        .map(id => allClaims.find(c => c.id === id))
        .filter((c): c is ExtractedClaim => c !== undefined);

      const hasDirectClaim = stmtClaims.some(c => c.claimType === 'DIRECT_SOURCE_CLAIM');

      // Check if statement text has substantive semantic/keyword grounding in the claimed texts
      // If a candidate claims a specific limit/constraint that does not appear in any supporting claim:
      const stmtTextLower = stmt.normalizedStatement.toLowerCase();
      const claimTexts = stmtClaims.map(c => `${c.normalizedClaim} ${c.evidenceLocator}`.toLowerCase()).join(' ');

      // Check for specific numbers or guarantees invented by the model (e.g. "5000 messages/second", "maximum 100")
      const numberMatches = stmtTextLower.match(/\b\d+(\.\d+)?\b/g);
      let numbersSupported = true;
      if (numberMatches) {
        for (const num of numberMatches) {
          if (!claimTexts.includes(num)) {
            numbersSupported = false;
            break;
          }
        }
      }

      const isGrounded = hasDirectClaim && numbersSupported && stmt.supportType === 'DIRECT_SOURCE';

      if (isGrounded) {
        verifiedStatements.push(stmt);
        if (stmt.field === 'operationalConstraints') {
          validOperationalConstraints.push(stmt.normalizedStatement);
        }
      } else {
        // Mark statement as MODEL_INFERENCE or ungrounded
        stmt.supportType = 'MODEL_INFERENCE';
        // If it was an operational constraint or guarantee, do NOT store it as authoritative
        if (stmt.field === 'operationalConstraints') {
          // Excluded from validOperationalConstraints!
        }
      }
    }

    candidate.fieldStatements = verifiedStatements;
    if (candidate.operationalConstraints) {
      // Retain only grounded operational constraints
      candidate.operationalConstraints = validOperationalConstraints;
    }

    // If candidate's primary mechanism has zero supporting claims, reject
    const mechanismGrounded = verifiedStatements.some(s => s.field === 'mechanism' || s.field === 'officialMechanism');
    if (!mechanismGrounded && !directSourceClaims.some(c => candidate.mechanism.toLowerCase().includes(c.entities[0]?.toLowerCase() || ''))) {
      candidate.state = 'REJECTED';
      return candidate;
    }

    candidate.state = 'GROUNDED';
    return candidate;
  }
}
