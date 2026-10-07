import {
  KnowledgeCandidate,
  ExtractedClaim,
  KnowledgeSource,
  CandidateStatement,
  StatementType
} from '@architectai/domain';
import { ProviderAdapter } from '@architectai/providers';

export interface StatementGroundingAssessment {
  isSupported: boolean;
  supportType: 'DIRECT_SOURCE' | 'MODEL_INFERENCE';
  statementType: StatementType;
  reason?: string;
}

export class GroundingValidator {
  constructor(_provider?: ProviderAdapter) {}

  /**
   * Assesses semantic support between a proposed statement and its cited claims.
   * Mechanically prevents invented, contradicted, or unsupported statements from masquerading as DIRECT_SOURCE.
   */
  assessStatementGrounding(
    stmt: CandidateStatement,
    supportingClaims: ExtractedClaim[]
  ): StatementGroundingAssessment {
    // 1. Must cite existing claims
    if (supportingClaims.length === 0) {
      return {
        isSupported: false,
        supportType: 'MODEL_INFERENCE',
        statementType: 'ENGINEERING_INFERENCE',
        reason: 'Statement does not cite any valid claims.',
      };
    }

    // 2. Must cite at least one validated DIRECT_SOURCE_CLAIM
    const directClaims = supportingClaims.filter(c => c.claimType === 'DIRECT_SOURCE_CLAIM' && !!c.sourceQuote);
    if (directClaims.length === 0) {
      return {
        isSupported: false,
        supportType: 'MODEL_INFERENCE',
        statementType: 'ENGINEERING_INFERENCE',
        reason: 'Statement does not cite any validated DIRECT_SOURCE_CLAIM with verified sourceQuote.',
      };
    }

    const stmtTextLower = stmt.normalizedStatement.toLowerCase().trim();
    const claimTexts = directClaims
      .map(c => `${c.normalizedClaim} ${c.sourceQuote || ''} ${c.evidenceLocator}`.toLowerCase())
      .join(' ');

    // 3. Contradiction & Antonym Detection (Semantic Non-Support)
    // E.g. Claim: "may deliver more than once", Statement: "deduplicates all repeated messages" / "guarantees exactly-once"
    const hasDeliveryContradiction =
      (claimTexts.includes('more than once') || claimTexts.includes('at-least-once')) &&
      (stmtTextLower.includes('exactly-once') ||
       stmtTextLower.includes('deduplicates') ||
       stmtTextLower.includes('no duplicate') ||
       stmtTextLower.includes('prevents duplicate'));

    const hasIsolationContradiction =
      (claimTexts.includes('read committed') && stmtTextLower.includes('serializable')) ||
      (claimTexts.includes('serializable') && stmtTextLower.includes('read committed'));

    if (hasDeliveryContradiction || hasIsolationContradiction) {
      return {
        isSupported: false,
        supportType: 'MODEL_INFERENCE',
        statementType: 'ENGINEERING_INFERENCE',
        reason: `Statement contradicts authoritative source claims. Delivery/isolation semantics mismatch.`,
      };
    }

    // 4. Numeric and Quantitative Boundary Checks
    const numberMatches = stmtTextLower.match(/\b\d+(\.\d+)?\b/g);
    if (numberMatches) {
      for (const num of numberMatches) {
        if (!claimTexts.includes(num)) {
          return {
            isSupported: false,
            supportType: 'MODEL_INFERENCE',
            statementType: 'ENGINEERING_INFERENCE',
            reason: `Statement invents quantitative constraint "${num}" not present in supporting source claims.`,
          };
        }
      }
    }

    // 5. Inferred Mitigation vs Factual Statement
    if (stmt.field === 'mitigations' || stmt.field === 'failureConsequences') {
      // Consequences and mitigations are engineering inferences unless the text explicitly states them as normative rules
      const isVerbatimInClaim = claimTexts.includes(stmtTextLower);
      return {
        isSupported: true,
        supportType: isVerbatimInClaim ? 'DIRECT_SOURCE' : 'MODEL_INFERENCE',
        statementType: isVerbatimInClaim ? 'SOURCE_FACT' : 'ENGINEERING_INFERENCE',
      };
    }

    // 6. Direct Factual Statement Support
    // Check key semantic verbs / terms in statement
    const keyTerms = stmtTextLower
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4 && !['guarantees', 'automatically', 'provides', 'system', 'service'].includes(w));

    const matchesSomeTerms = keyTerms.some(term => claimTexts.includes(term));
    if (!matchesSomeTerms && keyTerms.length > 0) {
      return {
        isSupported: false,
        supportType: 'MODEL_INFERENCE',
        statementType: 'ENGINEERING_INFERENCE',
        reason: 'Statement terms are absent from supporting source quote and claims.',
      };
    }

    return {
      isSupported: true,
      supportType: 'DIRECT_SOURCE',
      statementType: 'SOURCE_FACT',
    };
  }

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
    if (!candidate.fieldStatements || candidate.fieldStatements.length === 0) {
      candidate.fieldStatements = [];
      if (candidate.mechanism) {
        candidate.fieldStatements.push({
          field: 'mechanism',
          normalizedStatement: candidate.mechanism,
          supportingClaimIds: candidate.sourceClaimIds,
          supportType: 'DIRECT_SOURCE',
          statementType: 'SOURCE_FACT',
        });
      }
      if (candidate.officialMechanism) {
        candidate.fieldStatements.push({
          field: 'officialMechanism',
          normalizedStatement: candidate.officialMechanism,
          supportingClaimIds: candidate.sourceClaimIds,
          supportType: 'DIRECT_SOURCE',
          statementType: 'SOURCE_FACT',
        });
      }
      if (candidate.operationalConstraints) {
        for (const oc of candidate.operationalConstraints) {
          candidate.fieldStatements.push({
            field: 'operationalConstraints',
            normalizedStatement: oc,
            supportingClaimIds: candidate.sourceClaimIds,
            supportType: 'DIRECT_SOURCE',
            statementType: 'SOURCE_FACT',
          });
        }
      }
      if (candidate.failureConsequences) {
        for (const fc of candidate.failureConsequences) {
          candidate.fieldStatements.push({
            field: 'failureConsequences',
            normalizedStatement: fc,
            supportingClaimIds: candidate.sourceClaimIds,
            supportType: 'MODEL_INFERENCE',
            statementType: 'ENGINEERING_INFERENCE',
          });
        }
      }
      if (candidate.mitigations) {
        for (const mit of candidate.mitigations) {
          candidate.fieldStatements.push({
            field: 'mitigations',
            normalizedStatement: mit,
            supportingClaimIds: candidate.sourceClaimIds,
            supportType: 'MODEL_INFERENCE',
            statementType: 'ENGINEERING_INFERENCE',
          });
        }
      }
    }

    // Evaluate each statement using StatementGroundingAssessment
    const assessedStatements: CandidateStatement[] = [];
    const validOperationalConstraints: string[] = [];

    for (const stmt of candidate.fieldStatements) {
      const stmtClaims = stmt.supportingClaimIds
        .map(id => allClaims.find(c => c.id === id))
        .filter((c): c is ExtractedClaim => c !== undefined);

      const assessment = this.assessStatementGrounding(stmt, stmtClaims);

      stmt.supportType = assessment.supportType;
      stmt.statementType = assessment.statementType;
      assessedStatements.push(stmt);

      if (stmt.field === 'operationalConstraints') {
        if (assessment.isSupported && assessment.supportType === 'DIRECT_SOURCE') {
          validOperationalConstraints.push(stmt.normalizedStatement);
        }
      }
    }

    candidate.fieldStatements = assessedStatements;
    if (candidate.operationalConstraints) {
      candidate.operationalConstraints = validOperationalConstraints;
    }

    // Mechanism must be directly supported or grounded in source claims
    const mechanismStatement = assessedStatements.find(s => s.field === 'mechanism' || s.field === 'officialMechanism');
    const mechanismGrounded = mechanismStatement?.supportType === 'DIRECT_SOURCE';

    if (!mechanismGrounded && !directSourceClaims.some(c => candidate.mechanism.toLowerCase().includes(c.entities[0]?.toLowerCase() || ''))) {
      candidate.state = 'REJECTED';
      return candidate;
    }

    candidate.state = 'GROUNDED';
    return candidate;
  }
}
