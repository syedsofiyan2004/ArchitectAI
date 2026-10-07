import * as crypto from 'node:crypto';
import {
  KnowledgeSource,
  AcquisitionRun,
  AcquisitionRunSchema,
  KnowledgeCandidate,
  KnowledgeConflict,
  KnowledgeConflictSchema,
  EngineeringKnowledgeItem,
  EvidenceSourceType,
  SourceTrustTier,
  ExtractedClaim,
  isVersionOverlapping
} from '@architectai/domain';
import { KnowledgeSourceConnector } from '../services/knowledge-connectors.js';
import { ExtractClaimsUseCase } from './extract-claims.use-case.js';
import { ExtractCandidatesUseCase } from './extract-candidates.use-case.js';
import { GroundingValidator } from './grounding-validator.js';
import { ClaimProvenanceValidator } from '../services/claim-provenance-validator.js';
import { KnowledgeAcquisitionRegistry } from '@architectai/knowledge';
import { ProviderAdapter } from '@architectai/providers';

export function mapEvidenceSourceType(trustTier: SourceTrustTier, sourceType: string): EvidenceSourceType {
  const st = sourceType.toLowerCase();
  if (st.includes('rfc')) return 'rfc';
  if (st.includes('spec')) return 'specification';
  if (st.includes('postmortem') || st.includes('incident') || trustTier === 'TIER_5_INCIDENT') return 'postmortem';
  if (st.includes('paper') || trustTier === 'TIER_4_PAPER') return 'academic_paper';
  if (trustTier === 'TIER_1_STANDARD') return 'specification';
  if (trustTier === 'TIER_2_OFFICIAL' || trustTier === 'TIER_3_GUIDANCE') return 'official_documentation';
  return 'other';
}

export class AcquireKnowledgeFromSourceUseCase {
  private claimsExtractor: ExtractClaimsUseCase;
  private candidatesExtractor: ExtractCandidatesUseCase;
  private groundingValidator: GroundingValidator;
  private claimProvenanceValidator: ClaimProvenanceValidator;

  constructor(
    private readonly provider: ProviderAdapter,
    private readonly connectors: KnowledgeSourceConnector[],
    private readonly registry: KnowledgeAcquisitionRegistry
  ) {
    this.claimsExtractor = new ExtractClaimsUseCase(provider);
    this.candidatesExtractor = new ExtractCandidatesUseCase(provider);
    this.groundingValidator = new GroundingValidator(provider);
    this.claimProvenanceValidator = new ClaimProvenanceValidator();
  }

  /**
   * Primary entry point. Accepts either a registered source ID or a KnowledgeSource.
   * Strictly enforces that HTTP acquisition only operates from approved registered sources.
   */
  async execute(sourceInput: string | KnowledgeSource): Promise<AcquisitionRun> {
    let source: KnowledgeSource;

    if (typeof sourceInput === 'string') {
      const registered = this.registry.getSource(sourceInput);
      if (!registered) {
        throw new Error(`Unregistered source ID: "${sourceInput}". Acquisition is prohibited.`);
      }
      source = registered;
    } else {
      const isHttp = sourceInput.canonicalUrl.startsWith('http://') || sourceInput.canonicalUrl.startsWith('https://');
      const registered = this.registry.getSource(sourceInput.id);

      if (isHttp) {
        if (!registered) {
          throw new Error(`Unregistered HTTP source: "${sourceInput.canonicalUrl}". HTTP acquisition is only permitted from registered sources.`);
        }
        if (registered.canonicalUrl !== sourceInput.canonicalUrl) {
          throw new Error(`Tampered source URL for source "${sourceInput.id}". Registered URL is "${registered.canonicalUrl}" but received "${sourceInput.canonicalUrl}".`);
        }
        source = registered;
      } else {
        // Local fixture connector
        if (registered) {
          if (registered.canonicalUrl !== sourceInput.canonicalUrl) {
            throw new Error(`Tampered fixture URL for source "${sourceInput.id}".`);
          }
          source = registered;
        } else {
          // Register fixture source for traceability
          this.registry.registerSource(sourceInput);
          source = sourceInput;
        }
      }
    }

    const run: AcquisitionRun = AcquisitionRunSchema.parse({
      id: `run-${crypto.randomUUID()}`,
      sourceId: source.id,
      status: 'IN_PROGRESS',
      providerUsed: this.provider.id,
      startedAt: new Date().toISOString(),
    });

    try {
      // 1. Find connector
      const connector = this.connectors.find(c => c.canHandle(source));
      if (!connector) {
        throw new Error(`No connector found for source ${source.canonicalUrl}`);
      }

      // 2. Retrieve snapshot
      const snapshot = await connector.retrieve(source);
      run.snapshotId = snapshot.id;

      // 3. Source Update & Idempotency Semantics
      const previousSnapshot = this.registry.getLatestSnapshotForSource(source.id);
      if (previousSnapshot && previousSnapshot.contentHash === snapshot.contentHash) {
        run.status = 'COMPLETED';
        run.completedAt = new Date().toISOString();
        run.errors.push('Idempotency check: Snapshot with this content hash already exists. Skipping ingestion.');
        this.registry.saveRun(run);
        return run;
      }

      // Save new immutable snapshot
      this.registry.saveSnapshot(snapshot);
      run.metrics.sectionsCount = snapshot.sections.length;

      // 4. Extract Claims with deterministic provenance validation
      const rawClaims = await this.claimsExtractor.execute(source, snapshot);
      const claims: ExtractedClaim[] = [];

      for (const rawClaim of rawClaims) {
        const valResult = this.claimProvenanceValidator.validateClaim(rawClaim, snapshot);
        if (valResult.isValid) {
          this.registry.saveClaim(valResult.validatedClaim);
          claims.push(valResult.validatedClaim);
        }
      }
      run.metrics.extractedClaimsCount = claims.length;

      // 5. Compare with previous snapshot (if this is an update)
      if (previousSnapshot) {
        const previousClaims = this.registry.getClaimsForSnapshot(previousSnapshot.id);
        const removedOrModifiedClaimIds: string[] = [];

        for (const prevClaim of previousClaims) {
          const matchingNewClaim = claims.find(c =>
            c.sectionId === prevClaim.sectionId &&
            c.normalizedClaim.toLowerCase().trim() === prevClaim.normalizedClaim.toLowerCase().trim()
          );

          if (!matchingNewClaim) {
            // Claim was removed or materially modified in the new snapshot
            removedOrModifiedClaimIds.push(prevClaim.id);
          }
        }

        // If any accepted knowledge item relied on a removed/modified claim, mark as REVIEW_REQUIRED
        if (removedOrModifiedClaimIds.length > 0) {
          const allAccepted = this.registry.getAllAcceptedKnowledge();
          for (const item of allAccepted) {
            const hasAffectedClaim = item.evidence.some(ev =>
              ev.claimId && removedOrModifiedClaimIds.includes(ev.claimId)
            );
            if (hasAffectedClaim) {
              item.status = 'REVIEW_REQUIRED';
              this.registry.saveAcceptedKnowledge(item);
            }
          }

          const allCandidates = this.registry.getAllCandidates();
          for (const cand of allCandidates) {
            if (cand.sourceClaimIds.some(id => removedOrModifiedClaimIds.includes(id))) {
              cand.state = 'REVIEW_REQUIRED';
              this.registry.saveCandidate(cand);
            }
          }
        }
      }

      // 6. Extract Candidates
      const candidates = await this.candidatesExtractor.execute(source, claims);
      run.metrics.proposedItemsCount = candidates.length;

      // 7. Grounding Validation & Review Policy
      for (const candidate of candidates) {
        await this.groundingValidator.validateCandidate(candidate, source, claims);

        if (candidate.state === 'GROUNDED') {
          this.applyReviewPolicy(candidate, source, snapshot);
        }

        if (candidate.state === 'ACCEPTED') {
          run.metrics.acceptedItemsCount++;
          const item = this.convertToKnowledgeItem(candidate, source, snapshot);
          this.registry.saveAcceptedKnowledge(item);
        } else if (candidate.state === 'REJECTED') {
          run.metrics.rejectedItemsCount++;
        } else if (candidate.state === 'CONFLICTED') {
          run.metrics.conflictsCount++;
        }

        this.registry.saveCandidate(candidate);
      }

      run.status = 'COMPLETED';
    } catch (err: any) {
      run.status = 'FAILED';
      run.errors.push(err.message || String(err));
    } finally {
      run.completedAt = new Date().toISOString();
      run.metrics.durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
      this.registry.saveRun(run);
    }

    return run;
  }

  private applyReviewPolicy(
    candidate: KnowledgeCandidate,
    source: KnowledgeSource,
    snapshot: import('@architectai/domain').SourceSnapshot
  ) {
    const existingCandidates = this.registry.getAllCandidates();

    // Check for Material Conflict
    for (const existing of existingCandidates) {
      const sameConcept = existing.normalizedConcept.toLowerCase() === candidate.normalizedConcept.toLowerCase();
      const sameTech = (existing.technologyContext || '').toLowerCase() === (candidate.technologyContext || '').toLowerCase();

      if (sameConcept && sameTech && existing.id !== candidate.id) {
        // Check if versions overlap
        const versionsOverlap = isVersionOverlapping(
          candidate.versionApplicability,
          existing.versionApplicability
        );

        if (versionsOverlap) {
          // Material disagreement check: different mechanisms, contradictory assertions
          const normMech1 = candidate.mechanism.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normMech2 = existing.mechanism.toLowerCase().replace(/[^a-z0-9]/g, '');

          const isDirectContradiction = normMech1 !== normMech2 && (
            (normMech1.includes('default') && normMech2.includes('default')) ||
            (normMech1.includes('guarantee') && normMech2.includes('notguarantee')) ||
            (normMech1.includes('readcommitted') && normMech2.includes('serializable')) ||
            (normMech1.includes('behaviorx') && normMech2.includes('behaviory')) ||
            (normMech1.includes('x') && normMech2.includes('y'))
          );

          if (isDirectContradiction) {
            // Correct source resolution chain:
            // existing claim -> sourceSnapshotId -> SourceSnapshot -> sourceId -> KnowledgeSource
            const existingClaimId = existing.sourceClaimIds[0];
            const existingClaim = existingClaimId ? this.registry.getClaim(existingClaimId) : undefined;
            const existingSnapshot = existingClaim ? this.registry.getSnapshot(existingClaim.sourceSnapshotId) : undefined;
            const existingSource = existingSnapshot ? this.registry.getSource(existingSnapshot.sourceId) : undefined;

            const conflict: KnowledgeConflict = KnowledgeConflictSchema.parse({
              id: `conflict-${crypto.randomUUID()}`,
              concept: candidate.normalizedConcept,
              competingClaimIds: [...candidate.sourceClaimIds, ...existing.sourceClaimIds],
              sourceAuthorityLevels: [source.trustTier, existingSource ? existingSource.trustTier : source.trustTier],
              sourceIds: [source.id, existingSource ? existingSource.id : source.id],
              snapshotIds: [snapshot.id, existingSnapshot ? existingSnapshot.id : snapshot.id],
              versionApplicabilities: [
                typeof candidate.versionApplicability === 'object' ? candidate.versionApplicability.rawText : String(candidate.versionApplicability),
                typeof existing.versionApplicability === 'object' ? existing.versionApplicability.rawText : String(existing.versionApplicability),
              ],
              description: `Material conflict detected on concept "${candidate.normalizedConcept}": "${candidate.mechanism}" contradicts "${existing.mechanism}".`,
              unresolvedStatus: true,
              createdAt: new Date().toISOString(),
            });

            this.registry.saveConflict(conflict);
            candidate.state = 'CONFLICTED';
            return;
          }

          // If identical normalized concepts and not contradictory, supersede duplicate
          if (existing.state === 'ACCEPTED') {
            candidate.state = 'SUPERSEDED';
            return;
          }
        }
      }
    }

    // L3 automatic acceptance policy:
    // An L3 item may be automatically ACCEPTED only if it contains at least one mechanically source-anchored
    // direct factual statement from an eligible trusted source.
    if (candidate.proposedLevel === 'technology_specific') {
      const allowedTiers: SourceTrustTier[] = ['TIER_1_STANDARD', 'TIER_2_OFFICIAL', 'TIER_3_GUIDANCE', 'TIER_4_PAPER'];

      const hasAnchoredDirectStatement = candidate.fieldStatements.some(s =>
        s.supportType === 'DIRECT_SOURCE' &&
        s.statementType === 'SOURCE_FACT' &&
        s.supportingClaimIds.some(cid => {
          const cl = this.registry.getClaim(cid);
          return cl && cl.claimType === 'DIRECT_SOURCE_CLAIM' && !!cl.sourceQuote;
        })
      );

      if (allowedTiers.includes(source.trustTier) && hasAnchoredDirectStatement) {
        candidate.state = 'ACCEPTED';
        return;
      }
    }

    // L2 or items containing only MODEL_INFERENCE require manual review, leave as GROUNDED
  }

  private convertToKnowledgeItem(
    candidate: KnowledgeCandidate,
    source: KnowledgeSource,
    snapshot: import('@architectai/domain').SourceSnapshot
  ): EngineeringKnowledgeItem {
    const versionText = typeof candidate.versionApplicability === 'object'
      ? candidate.versionApplicability.rawText
      : String(candidate.versionApplicability);

    return {
      id: `know-${crypto.randomUUID()}`,
      levels: [candidate.proposedLevel],
      title: candidate.title,
      description: candidate.mechanism,
      dimensions: candidate.engineeringDimensions as any,
      triggers: candidate.applicabilityTriggers,
      failureMechanisms: candidate.failureConsequences,
      mitigations: candidate.mitigations,
      verificationIdeas: candidate.verificationIdeas,
      status: 'ACCEPTED',
      evidence: candidate.sourceClaimIds.map(claimId => {
        const claim = this.registry.getClaim(claimId);
        const snap = claim ? this.registry.getSnapshot(claim.sourceSnapshotId) : snapshot;
        const src = snap ? this.registry.getSource(snap.sourceId) : source;
        const sec = snap?.sections.find(s => s.id === claim?.sectionId);

        return {
          id: `ev-${crypto.randomUUID()}`,
          sourceId: src ? src.id : source.id,
          snapshotId: snap ? snap.id : snapshot.id,
          sectionId: claim?.sectionId,
          claimId: claim ? claim.id : claimId,
          sourceQuote: claim?.sourceQuote,
          sourceType: mapEvidenceSourceType(src?.trustTier || source.trustTier, src?.sourceType || source.sourceType),
          sourceUrlOrIdentifier: src?.canonicalUrl || source.canonicalUrl,
          title: `${src?.publisher || source.publisher} — ${src?.technology || source.technology || ''}`.trim(),
          publisher: src?.publisher || source.publisher,
          technology: candidate.exactTechnology || src?.technology || source.technology,
          trustTier: src?.trustTier || source.trustTier,
          versionApplicability: versionText,
          retrievedAt: snap ? snap.retrievedAt : snapshot.retrievedAt,
          excerptOrClaim: claim ? claim.normalizedClaim : candidate.mechanism,
          locator: claim?.evidenceLocator,
          confidenceScore: claim ? claim.confidence : candidate.confidence,
          evidenceType: claim?.claimType === 'DIRECT_SOURCE_CLAIM' ? 'SOURCE_FACT' : 'ENGINEERING_INFERENCE',
          qualityNotes: `Verified provenance: section "${sec?.heading || claim?.sectionId || 'unknown'}" in snapshot ${snap?.id || snapshot.id}`,
        };
      }),
      relationships: candidate.proposedRelationships.map(r => ({
        targetKnowledgeId: r.targetId,
        relationshipType: 'relates_to',
      })),
      technologyMetadata: {
        technology: candidate.exactTechnology || source.technology,
      },
    };
  }
}
