import { z } from 'zod';
import { KnowledgeEvidenceSchema } from './knowledge.js';

export const DecisionOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  tradeoffs: z.string().optional(),
});

export type DecisionOption = z.infer<typeof DecisionOptionSchema>;

/**
 * ArchitectureDecision represents an explicit, grounded architectural choice.
 */
export const ArchitectureDecisionSchema = z.object({
  id: z.string().min(1),
  problemContext: z.string().min(1),
  consideredOptions: z.array(DecisionOptionSchema).min(1, 'Must consider at least one option'),
  selectedOptionId: z.string().optional(),
  selectedOptionName: z.string().optional(),
  rationale: z.string().min(1, 'Rationale must be documented'),
  evidence: z.array(KnowledgeEvidenceSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  risksAndTradeoffs: z.array(z.string()).default([]),
  verificationRequirements: z.array(z.string()).default([]),
  reconsiderationTriggers: z.array(z.string()).default([]),
});

export type ArchitectureDecision = z.infer<typeof ArchitectureDecisionSchema>;
