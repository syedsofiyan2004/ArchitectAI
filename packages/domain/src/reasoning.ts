import { z } from 'zod';
import { EngineeringDimensionSchema } from './dimensions.js';

/**
 * RequirementDecomposition captures structured semantic analysis of user intent
 * across system, resource, concurrency, and trust dimensions without relying on keywords.
 */
export const RequirementDecompositionSchema = z.object({
  actors: z.array(z.string()).default([]),
  operations: z.array(z.string()).min(1, 'Must extract at least one semantic operation'),
  state: z.array(z.string()).default([]),
  resources: z.array(z.string()).default([]),
  externalDependencies: z.array(z.string()).default([]),
  possibleSideEffects: z.array(z.string()).default([]),
  concurrencyPotential: z.string().optional(),
  timingSemantics: z.string().optional(),
  persistence: z.string().optional(),
  ordering: z.string().optional(),
  trustBoundaries: z.array(z.string()).default([]),
  failureSensitiveOperations: z.array(z.string()).default([]),
  scaleSignals: z.array(z.string()).default([]),
  technologyContext: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  inferredEngineeringDimensions: z
    .array(EngineeringDimensionSchema)
    .min(1, 'Must infer at least one engineering dimension semantically'),
});

export type RequirementDecomposition = z.infer<typeof RequirementDecompositionSchema>;

/**
 * Individual candidate knowledge item relevance judgment.
 */
export const CandidateRelevanceItemSchema = z.object({
  candidateId: z.string().min(1),
  relevance: z.enum(['applicable', 'possibly_applicable', 'not_applicable']),
  applicabilityReason: z.string().min(1),
  assumptions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  unresolvedQuestions: z.array(z.string()).default([]),
});

export type CandidateRelevanceItem = z.infer<typeof CandidateRelevanceItemSchema>;

/**
 * Plausible engineering concern discovered by the model that does not yet have
 * an authoritative backing fixture in the knowledge repository.
 * Must NOT fabricate knowledge IDs.
 */
export const UngroundedConcernSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  applicabilityReason: z.string().min(1),
  dimensions: z.array(EngineeringDimensionSchema).min(1),
  assumptions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  unresolvedQuestions: z.array(z.string()).default([]),
});

export type UngroundedConcern = z.infer<typeof UngroundedConcernSchema>;

/**
 * ConcernRelevanceEvaluation represents Phase B evaluation:
 * Filtering broad candidate retrieval to only relevant or explicitly uncertain concerns.
 */
export const ConcernRelevanceEvaluationSchema = z.object({
  evaluations: z.array(CandidateRelevanceItemSchema),
  ungroundedConcerns: z.array(UngroundedConcernSchema).default([]),
});

export type ConcernRelevanceEvaluation = z.infer<typeof ConcernRelevanceEvaluationSchema>;
