import { z } from 'zod';

/**
 * VerificationSpec defines an independent, executable verification procedure.
 */
export const VerificationSpecSchema = z.object({
  id: z.string().min(1),
  target: z.string().min(1, 'Target invariant, decision, or property identifier is required'),
  description: z.string().min(1),
  setup: z.string().min(1, 'Preconditions and setup steps are required'),
  action: z.string().min(1, 'Stimulus or action to execute is required'),
  expectedProperty: z.string().min(1, 'Expected measurable property is required'),
  evidenceToCollect: z.array(z.string()).min(1, 'Must specify what evidence to collect'),
  isAutomatable: z.boolean(),
});

export type VerificationSpec = z.infer<typeof VerificationSpecSchema>;
