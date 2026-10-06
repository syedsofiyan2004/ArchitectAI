import { z } from 'zod';
import { EngineeringDimensionSchema } from './dimensions.js';
import { KnowledgeLevelSchema } from './knowledge.js';

export const SourceTrustTierSchema = z.enum([
  'TIER_1_STANDARD',    // Official standards/specifications/RFCs
  'TIER_2_OFFICIAL',    // Official vendor/project documentation
  'TIER_3_GUIDANCE',    // Official engineering/security guidance
  'TIER_4_PAPER',       // Peer-reviewed papers / authoritative research
  'TIER_5_INCIDENT',    // Official production incident reports/postmortems
  'TIER_6_LITERATURE',  // Highly trusted engineering literature
  'TIER_7_SECONDARY',   // General secondary material
]);
export type SourceTrustTier = z.infer<typeof SourceTrustTierSchema>;

export const KnowledgeSourceSchema = z.object({
  id: z.string().min(1),
  publisher: z.string().min(1),
  sourceType: z.string().min(1),
  canonicalUrl: z.string().url(),
  technology: z.string().optional(),
  versionApplicability: z.string().default('UNKNOWN'),
  trustTier: SourceTrustTierSchema,
  retrievalPolicy: z.object({
    maxSizeBytes: z.number().positive(),
    allowJavascript: z.boolean().default(false),
  }).optional(),
  discoveredAt: z.string().datetime(),
  lastRetrievedAt: z.string().datetime().optional(),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

export const SourceSectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string(),
  content: z.string(),
  tokenCountEstimate: z.number().nonnegative().optional(),
  path: z.array(z.string()).default([]), // Breadcrumbs like ["H1", "H2"]
});
export type SourceSection = z.infer<typeof SourceSectionSchema>;

export const SourceSnapshotSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  url: z.string().url(),
  retrievedAt: z.string().datetime(),
  contentHash: z.string().min(1),
  title: z.string().optional(),
  version: z.string().optional(),
  documentMetadata: z.record(z.unknown()).default({}),
  normalizedTextContent: z.string(),
  sections: z.array(SourceSectionSchema).default([]),
});
export type SourceSnapshot = z.infer<typeof SourceSnapshotSchema>;

export const ExtractedClaimTypeSchema = z.enum([
  'DIRECT_SOURCE_CLAIM',
  'MODEL_INFERENCE'
]);
export type ExtractedClaimType = z.infer<typeof ExtractedClaimTypeSchema>;

export const ExtractedClaimSchema = z.object({
  id: z.string().min(1),
  sourceSnapshotId: z.string().min(1),
  sectionId: z.string().min(1),
  evidenceLocator: z.string().min(1), // Exact text span or quote
  normalizedClaim: z.string().min(1),
  claimType: ExtractedClaimTypeSchema,
  entities: z.array(z.string()).default([]),
  versionApplicability: z.string().default('UNKNOWN'),
  confidence: z.number().min(0).max(1).default(0.8),
  extractionModel: z.string(),
  extractedAt: z.string().datetime(),
});
export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;

export const KnowledgeCandidateStateSchema = z.enum([
  'PROPOSED',
  'GROUNDED',
  'ACCEPTED',
  'REJECTED',
  'CONFLICTED',
  'SUPERSEDED',
]);
export type KnowledgeCandidateState = z.infer<typeof KnowledgeCandidateStateSchema>;

export const KnowledgeCandidateSchema = z.object({
  id: z.string().min(1),
  state: KnowledgeCandidateStateSchema,
  title: z.string().min(1),
  normalizedConcept: z.string().min(1),
  proposedLevel: KnowledgeLevelSchema,
  engineeringDimensions: z.array(EngineeringDimensionSchema),
  applicabilityTriggers: z.array(z.string()).default([]),
  mechanism: z.string().min(1),
  failureConsequences: z.array(z.string()).default([]),
  mitigations: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  technologyContext: z.string().optional(),
  versionApplicability: z.string().default('UNKNOWN'),
  sourceClaimIds: z.array(z.string()).min(1),
  proposedRelationships: z.array(z.object({
    targetId: z.string(),
    type: z.string(),
  })).default([]),
  verificationIdeas: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),

  // L2 specific
  reusableFailureMechanism: z.string().optional(),
  conditionsRequired: z.array(z.string()).optional(),
  technologyIndependenceLevel: z.string().optional(),

  // L3 specific
  exactTechnology: z.string().optional(),
  officialMechanism: z.string().optional(),
  operationalConstraints: z.array(z.string()).optional(),
});
export type KnowledgeCandidate = z.infer<typeof KnowledgeCandidateSchema>;

export const KnowledgeConflictSchema = z.object({
  id: z.string().min(1),
  competingClaimIds: z.array(z.string()).min(2),
  sourceAuthorityLevels: z.array(SourceTrustTierSchema),
  versionApplicabilities: z.array(z.string()),
  description: z.string(),
  unresolvedStatus: z.boolean().default(true),
  createdAt: z.string().datetime(),
});
export type KnowledgeConflict = z.infer<typeof KnowledgeConflictSchema>;

export const AcquisitionRunStatusSchema = z.enum([
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'PARTIAL',
]);
export type AcquisitionRunStatus = z.infer<typeof AcquisitionRunStatusSchema>;

export const AcquisitionRunSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  snapshotId: z.string().optional(),
  status: AcquisitionRunStatusSchema,
  metrics: z.object({
    sectionsCount: z.number().nonnegative().default(0),
    extractedClaimsCount: z.number().nonnegative().default(0),
    proposedItemsCount: z.number().nonnegative().default(0),
    acceptedItemsCount: z.number().nonnegative().default(0),
    rejectedItemsCount: z.number().nonnegative().default(0),
    conflictsCount: z.number().nonnegative().default(0),
    durationMs: z.number().nonnegative().default(0),
  }).default({}),
  providerUsed: z.string(),
  errors: z.array(z.string()).default([]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type AcquisitionRun = z.infer<typeof AcquisitionRunSchema>;
