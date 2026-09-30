import { z } from 'zod';

/**
 * RequirementIntent captures the incomplete natural-language intent from a builder,
 * along with any optional constraints or declared environment context.
 */
export const RequirementIntentSchema = z.object({
  id: z.string().min(1),
  rawIntent: z.string().min(1, 'Intent description cannot be empty'),
  explicitConstraints: z.array(z.string()).default([]),
  declaredTechStack: z.array(z.string()).default([]),
  context: z.record(z.string()).default({}),
  createdAt: z.string().datetime().optional(),
});

export type RequirementIntent = z.infer<typeof RequirementIntentSchema>;
