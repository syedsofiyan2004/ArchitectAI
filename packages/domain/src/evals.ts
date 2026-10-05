import { z } from 'zod';
import { RequirementIntentSchema } from './intent.js';
import { EngineeringDimensionSchema } from './dimensions.js';
import { KnowledgeLevelSchema } from './knowledge.js';

/**
 * EvaluationCase specifies deterministic expectations for architectural discovery.
 */
export const EvaluationCaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  requirementIntent: RequirementIntentSchema,
  expectedDimensions: z.array(EngineeringDimensionSchema).default([]),
  forbiddenDimensions: z.array(EngineeringDimensionSchema).default([]),
  requiredKnowledgeLevels: z.array(KnowledgeLevelSchema).default([]),
  tags: z.array(z.string()).default([]),
});

export type EvaluationCase = z.infer<typeof EvaluationCaseSchema>;

/**
 * EvaluationResult captures the outcome of evaluating concern discovery against an EvaluationCase.
 */
export const EvaluationResultSchema = z.object({
  evalCaseId: z.string().min(1),
  passed: z.boolean(),
  discoveredDimensions: z.array(EngineeringDimensionSchema),
  missingExpectedDimensions: z.array(EngineeringDimensionSchema),
  hallucinatedForbiddenDimensions: z.array(EngineeringDimensionSchema),
  discoveredKnowledgeLevels: z.array(KnowledgeLevelSchema).default([]),
  missingRequiredKnowledgeLevels: z.array(KnowledgeLevelSchema).default([]),
  contractConformsToSchema: z.boolean(),
  failureReasons: z.array(z.string()).default([]),
  evaluatedAt: z.string().datetime(),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
