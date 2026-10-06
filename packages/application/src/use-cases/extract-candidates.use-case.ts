import { z } from 'zod';
import {
  ExtractedClaim,
  KnowledgeCandidate,
  KnowledgeCandidateSchema,
  KnowledgeSource
} from '@architectai/domain';
import { ProviderAdapter } from '@architectai/providers';
import * as crypto from 'node:crypto';

const ExtractCandidatesPrompt = `
You are an expert Software Architecture Knowledge Engineer for ArchitectAI.
Your task is to take extracted factual claims from a source and generate Candidate Engineering Knowledge Items.

Recall the ArchitectAI three-level knowledge model:
L1 - fundamental: primitive durable concepts (e.g., bounded resources, concurrency). Rarely create new L1s.
L2 - failure_pattern: reusable failure modes (e.g., retry amplification, connection exhaustion).
L3 - technology_specific: mechanisms and constraints for concrete technologies (e.g., PostgreSQL, Redis, Node.js).

Focus primarily on extracting L3 technology_specific and L2 failure_pattern candidates.
Provide candidates that are highly actionable for an engineering reasoning engine.
Each candidate MUST specify which claim IDs support its statements.

Output an array of candidates.
`;

const CandidateResponseSchema = z.object({
  candidates: z.array(z.object({
    title: z.string(),
    normalizedConcept: z.string(),
    proposedLevel: z.enum(['fundamental', 'failure_pattern', 'technology_specific']),
    engineeringDimensions: z.array(z.enum([
      'bounded_resources', 'shared_mutable_state', 'concurrency', 'time_and_windows',
      'retries', 'side_effects', 'queues', 'trust_boundaries', 'persistence',
      'ordering', 'distributed_ownership', 'dependency_failure', 'scaling_concentration',
      'attacker_controlled_input'
    ])),
    applicabilityTriggers: z.array(z.string()),
    mechanism: z.string(),
    failureConsequences: z.array(z.string()),
    mitigations: z.array(z.string()),
    assumptions: z.array(z.string()),
    technologyContext: z.string().optional(),
    sourceClaimIds: z.array(z.string()),
    verificationIdeas: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1),

    // L2
    reusableFailureMechanism: z.string().optional(),
    conditionsRequired: z.array(z.string()).optional(),
    technologyIndependenceLevel: z.string().optional(),

    // L3
    exactTechnology: z.string().optional(),
    officialMechanism: z.string().optional(),
    operationalConstraints: z.array(z.string()).optional(),
  }))
});

export class ExtractCandidatesUseCase {
  constructor(private readonly provider: ProviderAdapter) {}

  async execute(source: KnowledgeSource, claims: ExtractedClaim[]): Promise<KnowledgeCandidate[]> {
    if (claims.length === 0) return [];

    // Group claims by chunks of ~20 to avoid overwhelming the model context
    const allCandidates: KnowledgeCandidate[] = [];
    const chunkSize = 20;

    for (let i = 0; i < claims.length; i += chunkSize) {
      const chunk = claims.slice(i, i + chunkSize);
      const claimsText = chunk.map(c => `[ID: ${c.id}] ${c.normalizedClaim} (Type: ${c.claimType})`).join('\n');

      const userPrompt = `
Source Publisher: ${source.publisher}
Technology: ${source.technology || 'N/A'}

Extracted Claims:
${claimsText}

Extract Knowledge Candidates.
`;

      const response = await this.provider.generateStructured<z.infer<typeof CandidateResponseSchema>>({
        messages: [
          { role: 'system', content: ExtractCandidatesPrompt },
          { role: 'user', content: userPrompt }
        ],
        schema: CandidateResponseSchema,
        schemaName: 'ExtractKnowledgeCandidates',
        temperature: 0.2,
      });

      for (const c of response.data.candidates) {
        // Only keep candidates that actually map to our claims
        const validClaimIds = c.sourceClaimIds.filter((id: string) => chunk.some(cl => cl.id === id));
        if (validClaimIds.length === 0) continue; // Must be supported

        allCandidates.push(KnowledgeCandidateSchema.parse({
          id: `cand-${crypto.randomUUID()}`,
          state: 'PROPOSED',
          title: c.title,
          normalizedConcept: c.normalizedConcept,
          proposedLevel: c.proposedLevel,
          engineeringDimensions: c.engineeringDimensions,
          applicabilityTriggers: c.applicabilityTriggers,
          mechanism: c.mechanism,
          failureConsequences: c.failureConsequences,
          mitigations: c.mitigations,
          assumptions: c.assumptions,
          technologyContext: c.technologyContext,
          versionApplicability: source.versionApplicability,
          sourceClaimIds: validClaimIds,
          proposedRelationships: [],
          verificationIdeas: c.verificationIdeas || [],
          confidence: c.confidence,
          
          reusableFailureMechanism: c.reusableFailureMechanism,
          conditionsRequired: c.conditionsRequired,
          technologyIndependenceLevel: c.technologyIndependenceLevel,
          
          exactTechnology: c.exactTechnology || source.technology,
          officialMechanism: c.officialMechanism,
          operationalConstraints: c.operationalConstraints,
        }));
      }
    }

    return allCandidates;
  }
}
