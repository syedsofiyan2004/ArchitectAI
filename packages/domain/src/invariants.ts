import { z } from 'zod';

export const InvariantSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type InvariantSeverity = z.infer<typeof InvariantSeveritySchema>;

/**
 * EngineeringInvariant represents an enforceable, non-negotiable architectural property.
 */
export const EngineeringInvariantSchema = z.object({
  id: z.string().min(1),
  property: z.string().min(1, 'Enforceable property description cannot be empty'),
  severity: InvariantSeveritySchema,
  blocksCompletion: z.boolean(),
  rationale: z.string().optional(),
});

export type EngineeringInvariant = z.infer<typeof EngineeringInvariantSchema>;
