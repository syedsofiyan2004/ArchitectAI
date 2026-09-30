import { z } from 'zod';
import { RequirementIntentSchema } from './intent.js';
import { ConcernCandidateSchema } from './concerns.js';
import { ArchitectureDecisionSchema } from './decisions.js';
import { EngineeringInvariantSchema } from './invariants.js';
import { VerificationSpecSchema } from './verification.js';

export const ContractStatusSchema = z.enum([
  'draft',
  'proposed',
  'accepted',
  'verified',
  'rejected',
]);

export type ContractStatus = z.infer<typeof ContractStatusSchema>;

export const ContractMetadataSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  author: z.string().optional(),
  status: ContractStatusSchema,
  tags: z.array(z.string()).default([]),
});

export type ContractMetadata = z.infer<typeof ContractMetadataSchema>;

/**
 * EngineeringContract is the primary architectural artifact bridging user intent,
 * engineering concerns, decisions, enforceable invariants, and verification specs.
 */
export const EngineeringContractSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  requirement: RequirementIntentSchema,
  discoveredConcerns: z.array(ConcernCandidateSchema).default([]),
  decisions: z.array(ArchitectureDecisionSchema).default([]),
  invariants: z.array(EngineeringInvariantSchema).default([]),
  verificationSpecs: z.array(VerificationSpecSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  metadata: ContractMetadataSchema,
});

export type EngineeringContract = z.infer<typeof EngineeringContractSchema>;
