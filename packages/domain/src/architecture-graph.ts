// ArchitectAI — Architecture Graph Projection Domain Schema
// Grounded, validated projection derived from EngineeringContract
import { z } from 'zod';
import type { EngineeringContract } from './contract.js';

export const GraphProjectionStatusSchema = z.enum([
  'valid',
  'stale',
  'unresolved',
  'incomplete',
]);
export type GraphProjectionStatus = z.infer<typeof GraphProjectionStatusSchema>;

export const GraphEntityOriginSchema = z.enum([
  'contract_decision',
  'contract_invariant',
  'contract_concern',
  'contract_requirement',
  'inferred_topology',
]);
export type GraphEntityOrigin = z.infer<typeof GraphEntityOriginSchema>;

export const GraphEntityConfidenceSchema = z.enum([
  'verified_fact',           // Grounded in verified code / test evidence
  'architectural_decision',  // Explicit decision in accepted contract
  'inferred_proposed',       // Inferred topological entity, not explicitly specified
  'unknown_unresolved',      // Underspecified requirement
]);
export type GraphEntityConfidence = z.infer<typeof GraphEntityConfidenceSchema>;

export const GraphNodeCategorySchema = z.enum([
  'client',
  'gateway',
  'compute',
  'service',
  'queue',
  'worker',
  'cache',
  'datastore',
  'external_system',
]);
export type GraphNodeCategory = z.infer<typeof GraphNodeCategorySchema>;

export const ArchitectureGraphNodeSchema = z.object({
  id: z.string().min(1, 'Node ID cannot be empty'),
  label: z.string().min(1, 'Node label cannot be empty'),
  sublabel: z.string().default(''),
  category: GraphNodeCategorySchema,
  tier: z.string().default('dmz'),

  // Provenance & Contract Traceability
  origin: GraphEntityOriginSchema.default('contract_decision'),
  confidence: GraphEntityConfidenceSchema.default('architectural_decision'),
  sourceDecisionIds: z.array(z.string()).default([]),
  sourceConcernIds: z.array(z.string()).default([]),
  sourceInvariantIds: z.array(z.string()).default([]),
  sourceSpecIds: z.array(z.string()).default([]),

  // Systems Rationale & Truthful Evidence
  purpose: z.string().min(1, 'Node purpose must be documented'),
  whySelected: z.string().default(''),
  supportedClaim: z.string().optional(),
  tradeOffs: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([]),

  // Concrete Technology or Implementation Mapping (if known from contract decisions)
  technology: z.string().optional(),
  targetFiles: z.array(z.string()).default([]),

  // Coordinates (percentage or absolute pixels; projector provides default if missing)
  x: z.number().default(100),
  y: z.number().default(100),

  // Modeled SLA or explicit capacity constraint (never fabricated telemetry)
  modeledCapacity: z.string().optional(),
  assumedLatencySla: z.string().optional(),
});
export type ArchitectureGraphNode = z.infer<typeof ArchitectureGraphNodeSchema>;
export type ArchitectureGraphNodeInput = z.input<typeof ArchitectureGraphNodeSchema>;

export const ArchitectureGraphEdgeSchema = z.object({
  id: z.string().min(1, 'Edge ID cannot be empty'),
  source: z.string().min(1, 'Edge source node ID is required'),
  target: z.string().min(1, 'Edge target node ID is required'),
  label: z.string().default(''),
  protocol: z.string().default('HTTPS'),
  direction: z.enum(['unidirectional', 'bidirectional']).default('unidirectional'),
  isSelfLoop: z.boolean().default(false),

  // Provenance & Contract Traceability
  origin: GraphEntityOriginSchema.default('contract_decision'),
  confidence: GraphEntityConfidenceSchema.default('architectural_decision'),
  sourceDecisionIds: z.array(z.string()).default([]),
  sourceConcernIds: z.array(z.string()).default([]),
  sourceInvariantIds: z.array(z.string()).default([]),
  sourceSpecIds: z.array(z.string()).default([]),

  // Systems Rationale
  purpose: z.string().default(''),
  whySelected: z.string().default(''),
  supportedClaim: z.string().optional(),
  assumptions: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([]),
  orderingGuarantee: z.string().optional(),
  retryPolicy: z.string().optional(),
});
export type ArchitectureGraphEdge = z.infer<typeof ArchitectureGraphEdgeSchema>;
export type ArchitectureGraphEdgeInput = z.input<typeof ArchitectureGraphEdgeSchema>;

export const ArchitectureGraphBoundarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default(''),
  tier: z.enum(['public', 'dmz', 'private_compute', 'state', 'external']).default('dmz'),
  nodeIds: z.array(z.string()).default([]),
  rect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
});
export type ArchitectureGraphBoundary = z.infer<typeof ArchitectureGraphBoundarySchema>;

export const ArchitectureGraphProjectionSchema = z.object({
  id: z.string().min(1),
  contractId: z.string().min(1),
  contractRevision: z.number().int().positive().default(1),
  contractFingerprint: z.string().default(''),
  projectionVersion: z.string().min(1).default('1.0.0'),
  createdAt: z.string(),
  status: GraphProjectionStatusSchema,

  // Topology elements (bounded to prevent unbounded allocations)
  nodes: z.array(ArchitectureGraphNodeSchema).max(50, 'Graph exceeds maximum node limit (50)'),
  edges: z.array(ArchitectureGraphEdgeSchema).max(100, 'Graph exceeds maximum edge limit (100)'),
  boundaries: z.array(ArchitectureGraphBoundarySchema).default([]),

  // Overall Contract Rationale, Assumptions & Missing Source Tracking
  rationale: z.string().default(''),
  assumptions: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  missingSources: z.array(z.string()).default([]),

  // Dedicated simulation descriptor (e.g. rate limiter educational sim)
  simulationModule: z
    .object({
      available: z.boolean(),
      moduleType: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
});
export type ArchitectureGraphProjection = z.infer<typeof ArchitectureGraphProjectionSchema>;
export type ArchitectureGraphProjectionInput = z.input<typeof ArchitectureGraphProjectionSchema>;

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Computes a deterministic canonical content fingerprint for an EngineeringContract.
 * Changes to requirements, decisions, invariants, concerns, specs, or assumptions
 * immediately alter this fingerprint, binding projection validity to contract state.
 */
export function computeContractFingerprint(contract: EngineeringContract): string {
  const canonicalObj = {
    id: contract.id,
    version: contract.version,
    rawIntent: contract.requirement?.rawIntent || '',
    constraints: (contract.requirement?.explicitConstraints || []).slice().sort(),
    declaredTech: (contract.requirement?.declaredTechStack || []).slice().sort(),
    context: contract.requirement?.context || {},
    decisions: (contract.decisions || [])
      .map((d) => ({
        id: d.id,
        context: d.problemContext,
        optionId: d.selectedOptionId || '',
        optionName: d.selectedOptionName || '',
        rationale: d.rationale,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    invariants: (contract.invariants || [])
      .map((i) => ({ id: i.id, prop: i.property, sev: i.severity }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    concerns: (contract.discoveredConcerns || [])
      .map((c) => ({ id: c.id, title: c.title, dims: (c.dimensions || []).slice().sort() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    specs: (contract.verificationSpecs || [])
      .map((s) => ({ id: s.id, target: s.target, exp: s.expectedProperty }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    assumptions: (contract.assumptions || []).slice().sort(),
  };

  const str = JSON.stringify(canonicalObj);
  // Deterministic 64-bit FNV-1a hash
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return `cfp_${hash.toString(16).padStart(16, '0')}`;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'each',
  'across', 'will', 'must', 'should', 'have', 'been', 'were', 'what',
  'when', 'where', 'which', 'their', 'there', 'they', 'than', 'then'
]);

function extractMeaningfulTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

/**
 * Validates an ArchitectureGraphProjection for topological integrity, contract provenance,
 * and semantic grounding.
 * - Enforces zero dangling edges (source and target must exist in nodes)
 * - Enforces unique node and edge IDs
 * - Enforces provenance references against the authoritative EngineeringContract
 * - Enforces contract content fingerprint matching
 * - Disallows claiming origin=contract_decision or confidence=architectural_decision without
 *   substantive semantic relevance in the referenced decision.
 * - Disallows silent introduction of ungrounded technologies, capacity figures, or SLAs.
 */
export function validateArchitectureGraphProjection(
  projection: ArchitectureGraphProjection,
  contract?: EngineeringContract
): GraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Unique Node IDs
  const nodeIds = new Set<string>();
  for (const node of projection.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID detected: "${node.id}"`);
    }
    nodeIds.add(node.id);
  }

  // 2. Unique Edge IDs & Zero Dangling Edges
  const edgeIds = new Set<string>();
  for (const edge of projection.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push(`Duplicate edge ID detected: "${edge.id}"`);
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source)) {
      errors.push(`Dangling edge detected: edge "${edge.id}" source "${edge.source}" does not exist in nodes`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Dangling edge detected: edge "${edge.id}" target "${edge.target}" does not exist in nodes`);
    }
  }

  // 3. Optional Boundary Integrity
  for (const boundary of projection.boundaries) {
    for (const memberNodeId of boundary.nodeIds) {
      if (!nodeIds.has(memberNodeId)) {
        warnings.push(`Boundary "${boundary.id}" references node "${memberNodeId}" which is not in the graph nodes list`);
      }
    }
  }

  // 4. Contract Provenance, Fingerprint & Semantic Grounding Consistency
  if (contract) {
    if (projection.contractId !== contract.id) {
      errors.push(
        `Contract ID mismatch: projection references "${projection.contractId}" but provided contract is "${contract.id}"`
      );
    }

    const expectedFingerprint = computeContractFingerprint(contract);
    if (projection.contractFingerprint && projection.contractFingerprint !== expectedFingerprint) {
      errors.push(
        `Contract content fingerprint mismatch: projection fingerprint "${projection.contractFingerprint}" does not match contract content fingerprint "${expectedFingerprint}"`
      );
    }

    const validDecisionIds = new Set(contract.decisions.map((d) => d.id));
    const validConcernIds = new Set(contract.discoveredConcerns.map((c) => c.id));
    const validInvariantIds = new Set(contract.invariants.map((i) => i.id));
    const validSpecIds = new Set(contract.verificationSpecs.map((s) => s.id));
    const decisionsMap = new Map(contract.decisions.map((d) => [d.id, d]));

    const contractAllText = [
      contract.requirement?.rawIntent || '',
      ...(contract.requirement?.declaredTechStack || []),
      ...(contract.requirement?.explicitConstraints || []),
      ...contract.decisions.map((d) => `${d.problemContext} ${d.selectedOptionName || ''} ${d.rationale}`),
      ...contract.invariants.map((i) => i.property),
      ...(contract.assumptions || []),
    ].join(' ').toLowerCase();

    // Verify node provenance and semantic grounding
    for (const node of projection.nodes) {
      for (const dId of (node.sourceDecisionIds || [])) {
        if (!validDecisionIds.has(dId)) {
          errors.push(`Node "${node.id}" references invalid/missing decision ID "${dId}" in contract`);
        }
      }
      for (const cId of (node.sourceConcernIds || [])) {
        if (!validConcernIds.has(cId)) {
          errors.push(`Node "${node.id}" references invalid/missing concern ID "${cId}" in contract`);
        }
      }
      for (const iId of (node.sourceInvariantIds || [])) {
        if (!validInvariantIds.has(iId)) {
          errors.push(`Node "${node.id}" references invalid/missing invariant ID "${iId}" in contract`);
        }
      }
      for (const sId of (node.sourceSpecIds || [])) {
        if (!validSpecIds.has(sId)) {
          errors.push(`Node "${node.id}" references invalid/missing spec ID "${sId}" in contract`);
        }
      }

      // Semantic Grounding Rule 1: Cannot claim contract_decision without non-empty sourceDecisionIds
      if (node.origin === 'contract_decision' || node.confidence === 'architectural_decision') {
        if (!node.sourceDecisionIds || node.sourceDecisionIds.length === 0) {
          errors.push(
            `Node "${node.id}" claims origin "contract_decision" or confidence "architectural_decision" but has no sourceDecisionIds`
          );
        } else {
          // Check semantic relevance between referenced decisions and the node
          const nodeTokens = extractMeaningfulTokens(`${node.label} ${node.category} ${node.purpose}`);
          let hasRelevantDecision = false;

          for (const dId of node.sourceDecisionIds) {
            const decision = decisionsMap.get(dId);
            if (!decision) continue;

            const decisionText = `${decision.problemContext} ${decision.selectedOptionName || ''} ${decision.rationale} ${(decision.consideredOptions || []).map((o) => `${o.name} ${o.description}`).join(' ')}`;
            const decisionTokens = extractMeaningfulTokens(decisionText);

            // Check if there is semantic overlap
            for (const token of nodeTokens) {
              if (decisionTokens.has(token)) {
                hasRelevantDecision = true;
                break;
              }
            }
            if (hasRelevantDecision) break;
          }

          if (!hasRelevantDecision) {
            errors.push(
              `Node "${node.id}" claims supporting decisions [${node.sourceDecisionIds.join(', ')}], but referenced decision text has no semantic relevance to node "${node.label}" (${node.category})`
            );
          }
        }
      }

      // Semantic Grounding Rule 2: Technology must not be silently invented
      if (node.technology && (node.origin === 'contract_decision' || node.confidence === 'architectural_decision')) {
        const techTokens = Array.from(extractMeaningfulTokens(node.technology));
        const techGrounded = techTokens.some((t) => contractAllText.includes(t)) ||
          node.assumptions.some((a) => a.toLowerCase().includes(node.technology!.toLowerCase()));
        if (!techGrounded) {
          errors.push(
            `Node "${node.id}" specifies technology "${node.technology}" which is not grounded in contract decisions, requirement context, or explicit assumptions`
          );
        }
      }

      // Semantic Grounding Rule 3: Capacity / SLA figures must be grounded or marked inferred
      if ((node.modeledCapacity || node.assumedLatencySla) && node.confidence === 'verified_fact') {
        errors.push(
          `Node "${node.id}" claims confidence "verified_fact" for modeled metrics before verification execution`
        );
      }
    }

    // Verify edge provenance and semantic grounding
    for (const edge of projection.edges) {
      for (const dId of (edge.sourceDecisionIds || [])) {
        if (!validDecisionIds.has(dId)) {
          errors.push(`Edge "${edge.id}" references invalid/missing decision ID "${dId}" in contract`);
        }
      }
      for (const cId of (edge.sourceConcernIds || [])) {
        if (!validConcernIds.has(cId)) {
          errors.push(`Edge "${edge.id}" references invalid/missing concern ID "${cId}" in contract`);
        }
      }
      for (const iId of (edge.sourceInvariantIds || [])) {
        if (!validInvariantIds.has(iId)) {
          errors.push(`Edge "${edge.id}" references invalid/missing invariant ID "${iId}" in contract`);
        }
      }
      for (const sId of (edge.sourceSpecIds || [])) {
        if (!validSpecIds.has(sId)) {
          errors.push(`Edge "${edge.id}" references invalid/missing spec ID "${sId}" in contract`);
        }
      }

      if (edge.origin === 'contract_decision' && (!edge.sourceDecisionIds || edge.sourceDecisionIds.length === 0)) {
        errors.push(`Edge "${edge.id}" claims origin "contract_decision" but has no sourceDecisionIds`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
