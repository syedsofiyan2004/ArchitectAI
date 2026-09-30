import { z } from 'zod';

/**
 * Standard reusable engineering dimensions identified in AGENTS.md and BOOTSTRAP_TASK_001.md.
 * These represent universal systems primitives and failure axes, NOT application features.
 */
export const WellKnownDimensions = {
  BOUNDED_RESOURCE: 'bounded_resource',
  SHARED_MUTABLE_STATE: 'shared_mutable_state',
  CONCURRENCY: 'concurrency',
  TIME_WINDOW: 'time_window',
  SIDE_EFFECT: 'side_effect',
  RETRY: 'retry',
  ORDERING: 'ordering',
  PERSISTENCE: 'persistence',
  DEPENDENCY: 'dependency',
  TRUST_BOUNDARY: 'trust_boundary',
  SCALING_CONCENTRATION: 'scaling_concentration',
  ATTACKER_CONTROLLED_INPUT: 'attacker_controlled_input',
} as const;

export type WellKnownDimension = (typeof WellKnownDimensions)[keyof typeof WellKnownDimensions];

/**
 * EngineeringDimension schema.
 * Reusable primitive/dimension. It supports all standard dimensions WITHOUT making
 * those values the only possible future values (i.e. open/extensible taxonomy).
 */
export const EngineeringDimensionSchema = z
  .string()
  .min(1, 'Dimension identifier cannot be empty')
  .regex(/^[a-z0-9_-]+$/i, 'Dimension identifier must contain only alphanumeric characters, dashes, or underscores');

export type EngineeringDimension = z.infer<typeof EngineeringDimensionSchema>;

export function isWellKnownDimension(dim: string): dim is WellKnownDimension {
  return Object.values(WellKnownDimensions).includes(dim as WellKnownDimension);
}
