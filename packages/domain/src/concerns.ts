import { z } from 'zod';
import { EngineeringDimensionSchema } from './dimensions.js';

/**
 * ConcernCandidate represents a potential engineering risk, property, or constraint
 * discovered for a specific user requirement.
 */
export const ConcernCandidateSchema = z.object({
  id: z.string().min(1),
  requirementId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  applicabilityReason: z.string().min(1, 'Must explain why this concern may apply'),
  dimensions: z.array(EngineeringDimensionSchema).min(1, 'Concern must map to at least one engineering dimension'),
  supportingKnowledgeIds: z.array(z.string()).default([]),
  groundingStatus: z.enum(['grounded', 'ungrounded_model_discovery']).default('grounded').optional(),
  assumptions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  unresolvedQuestions: z.array(z.string()).default([]),
});

export type ConcernCandidate = z.infer<typeof ConcernCandidateSchema>;
