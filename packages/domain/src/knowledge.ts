import { z } from 'zod';
import { EngineeringDimensionSchema } from './dimensions.js';

/**
 * Three-level knowledge model defined in AGENTS.md:
 * - fundamental: durable engineering primitives
 * - failure_pattern: reusable failure modes/patterns across technologies
 * - technology_specific: current mechanisms and constraints for concrete technologies
 */
export const KnowledgeLevelSchema = z.enum([
  'fundamental',
  'failure_pattern',
  'technology_specific',
]);

export type KnowledgeLevel = z.infer<typeof KnowledgeLevelSchema>;

/**
 * Source type taxonomy for knowledge evidence.
 */
export const EvidenceSourceTypeSchema = z.enum([
  'official_documentation',
  'specification',
  'rfc',
  'benchmark',
  'postmortem',
  'source_code',
  'academic_paper',
  'manual_analysis',
  'other',
]);

export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;

/**
 * Structured provenance and evidence grounding.
 * Fields that may genuinely be unknown are optional.
 */
export const KnowledgeEvidenceSchema = z.object({
  id: z.string().min(1),
  sourceType: EvidenceSourceTypeSchema,
  sourceUrlOrIdentifier: z.string().optional(),
  title: z.string().min(1),
  technology: z.string().optional(),
  versionApplicability: z.string().optional(),
  retrievedAt: z.string().datetime().optional(),
  publishedAt: z.string().optional(),
  excerptOrClaim: z.string().min(1),
  confidenceScore: z.number().min(0).max(1).optional(),
  qualityNotes: z.string().optional(),
  sourceId: z.string().optional(),
  snapshotId: z.string().optional(),
  sectionId: z.string().optional(),
  claimId: z.string().optional(),
  trustTier: z.string().optional(),
  publisher: z.string().optional(),
  locator: z.string().optional(),
  sourceQuote: z.string().optional(),
  evidenceType: z.enum(['SOURCE_FACT', 'ENGINEERING_INFERENCE']).default('SOURCE_FACT').optional(),
});

export type KnowledgeEvidence = z.infer<typeof KnowledgeEvidenceSchema>;

/**
 * Cross-knowledge item relationship types.
 */
export const KnowledgeRelationshipTypeSchema = z.enum([
  'mitigates',
  'specializes',
  'causes',
  'relates_to',
  'replaces',
]);

export type KnowledgeRelationshipType = z.infer<typeof KnowledgeRelationshipTypeSchema>;

export const KnowledgeRelationshipSchema = z.object({
  targetKnowledgeId: z.string().min(1),
  relationshipType: KnowledgeRelationshipTypeSchema,
  description: z.string().optional(),
});

export type KnowledgeRelationship = z.infer<typeof KnowledgeRelationshipSchema>;

/**
 * EngineeringKnowledgeItem schema.
 * Represents an entry in the structured three-level knowledge repository.
 */
export const EngineeringKnowledgeItemSchema = z.object({
  id: z.string().min(1),
  levels: z.array(KnowledgeLevelSchema).min(1, 'Item must belong to at least one knowledge level'),
  title: z.string().min(1),
  description: z.string().min(1),
  dimensions: z.array(EngineeringDimensionSchema).min(1, 'Item must reference at least one engineering dimension'),
  triggers: z.array(z.string()).default([]),
  failureMechanisms: z.array(z.string()).default([]),
  mitigations: z.array(z.string()).default([]),
  verificationIdeas: z.array(z.string()).default([]),
  evidence: z.array(KnowledgeEvidenceSchema).default([]),
  relationships: z.array(KnowledgeRelationshipSchema).default([]),
  technologyMetadata: z
    .object({
      technology: z.string().optional(),
      versionRange: z.string().optional(),
      runtimeEnvironment: z.string().optional(),
    })
    .optional(),
  status: z.enum(['ACCEPTED', 'REVIEW_REQUIRED', 'DEPRECATED']).default('ACCEPTED').optional(),
});

export type EngineeringKnowledgeItem = z.infer<typeof EngineeringKnowledgeItemSchema>;
