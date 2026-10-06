import * as crypto from 'node:crypto';
import {
  KnowledgeSource,
  AcquisitionRun,
  AcquisitionRunSchema,
  KnowledgeCandidate,
  EngineeringKnowledgeItem
} from '@architectai/domain';
import { KnowledgeSourceConnector } from '../services/knowledge-connectors.js';
import { ExtractClaimsUseCase } from './extract-claims.use-case.js';
import { ExtractCandidatesUseCase } from './extract-candidates.use-case.js';
import { GroundingValidator } from './grounding-validator.js';
import { KnowledgeAcquisitionRegistry } from '@architectai/knowledge';
import { ProviderAdapter } from '@architectai/providers';

export class AcquireKnowledgeFromSourceUseCase {
  private claimsExtractor: ExtractClaimsUseCase;
  private candidatesExtractor: ExtractCandidatesUseCase;
  private groundingValidator: GroundingValidator;

  constructor(
    private readonly provider: ProviderAdapter,
    private readonly connectors: KnowledgeSourceConnector[],
    private readonly registry: KnowledgeAcquisitionRegistry
  ) {
    this.claimsExtractor = new ExtractClaimsUseCase(provider);
    this.candidatesExtractor = new ExtractCandidatesUseCase(provider);
    this.groundingValidator = new GroundingValidator(provider);
  }

  async execute(source: KnowledgeSource): Promise<AcquisitionRun> {
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

      // 3. Check idempotency
      const existing = this.registry.findSnapshotBySourceAndHash(source.id, snapshot.contentHash);
      if (existing) {
        run.status = 'COMPLETED';
        run.completedAt = new Date().toISOString();
        run.errors.push('Idempotency check: Snapshot with this content hash already exists. Skipping ingestion.');
        this.registry.saveRun(run);
        return run;
      }

      this.registry.saveSnapshot(snapshot);
      run.metrics.sectionsCount = snapshot.sections.length;

      // 4. Extract Claims
      const claims = await this.claimsExtractor.execute(source, snapshot);
      run.metrics.extractedClaimsCount = claims.length;
      for (const claim of claims) {
        this.registry.saveClaim(claim);
      }

      // 5. Extract Candidates
      const candidates = await this.candidatesExtractor.execute(source, claims);
      run.metrics.proposedItemsCount = candidates.length;

      // 6. Grounding Validation & Review Policy
      for (const candidate of candidates) {
        await this.groundingValidator.validateCandidate(candidate, source, claims);

        if (candidate.state === 'GROUNDED') {
          this.applyReviewPolicy(candidate, source);
        }

        if (candidate.state === 'ACCEPTED') {
          run.metrics.acceptedItemsCount++;
          // Convert to Canonical EngineeringKnowledgeItem
          const item = this.convertToKnowledgeItem(candidate, source);
          this.registry.saveAcceptedKnowledge(item);
        } else if (candidate.state === 'REJECTED') {
          run.metrics.rejectedItemsCount++;
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

  private applyReviewPolicy(candidate: KnowledgeCandidate, source: KnowledgeSource) {
    // Deduplication check
    const existingCandidates = this.registry.getAllCandidates();
    const isDuplicate = existingCandidates.some(c => 
      c.normalizedConcept.toLowerCase() === candidate.normalizedConcept.toLowerCase() &&
      c.technologyContext === candidate.technologyContext &&
      c.state === 'ACCEPTED'
    );

    if (isDuplicate) {
      candidate.state = 'SUPERSEDED';
      return;
    }

    // L3 automatic acceptance policy
    if (candidate.proposedLevel === 'technology_specific') {
      const allowedTiers = ['TIER_1_STANDARD', 'TIER_2_OFFICIAL', 'TIER_3_GUIDANCE', 'TIER_4_PAPER'];
      if (allowedTiers.includes(source.trustTier)) {
        candidate.state = 'ACCEPTED';
        return;
      }
    }

    // L2 requires manual review, leave as GROUNDED
  }

  private convertToKnowledgeItem(candidate: KnowledgeCandidate, source: KnowledgeSource): EngineeringKnowledgeItem {
    return {
      id: `know-${crypto.randomUUID()}`,
      levels: [candidate.proposedLevel],
      title: candidate.title,
      description: candidate.mechanism,
      dimensions: candidate.engineeringDimensions as any, // type matches
      triggers: candidate.applicabilityTriggers,
      failureMechanisms: candidate.failureConsequences,
      mitigations: candidate.mitigations,
      verificationIdeas: candidate.verificationIdeas,
      evidence: candidate.sourceClaimIds.map(claimId => {
        const claim = this.registry.getClaim(claimId);
        return {
          id: `ev-${crypto.randomUUID()}`,
          sourceType: 'official_documentation', // Simplified mapping
          sourceUrlOrIdentifier: source.canonicalUrl,
          title: source.publisher,
          technology: source.technology,
          versionApplicability: candidate.versionApplicability,
          excerptOrClaim: claim ? claim.normalizedClaim : 'Unknown claim',
          confidenceScore: claim ? claim.confidence : 0.8,
        };
      }),
      relationships: candidate.proposedRelationships.map(r => ({
        targetKnowledgeId: r.targetId,
        relationshipType: 'relates_to', // simplified
      })),
      technologyMetadata: {
        technology: candidate.exactTechnology || source.technology,
      },
    };
  }
}
