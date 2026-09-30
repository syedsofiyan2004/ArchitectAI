import {
  EngineeringKnowledgeItem,
  KnowledgeLevel,
  EngineeringDimension,
} from '@architectai/domain';

export interface KnowledgeQueryFilter {
  levels?: KnowledgeLevel[];
  dimensions?: EngineeringDimension[];
  technology?: string;
}

/**
 * KnowledgeRepository interface.
 * Generic knowledge repository capable of storing and querying knowledge items across
 * all three knowledge levels (L1 fundamental, L2 failure pattern, L3 technology-specific)
 * and multidimensional axes.
 */
export interface KnowledgeRepository {
  add(item: EngineeringKnowledgeItem): Promise<void>;
  load(items: EngineeringKnowledgeItem[]): Promise<void>;
  getById(id: string): Promise<EngineeringKnowledgeItem | undefined>;
  queryByLevel(level: KnowledgeLevel): Promise<EngineeringKnowledgeItem[]>;
  queryByDimensions(dimensions: EngineeringDimension[]): Promise<EngineeringKnowledgeItem[]>;
  queryByTechnology(technology: string): Promise<EngineeringKnowledgeItem[]>;
  query(filter: KnowledgeQueryFilter): Promise<EngineeringKnowledgeItem[]>;
  getAll(): Promise<EngineeringKnowledgeItem[]>;
  count(): Promise<number>;
}
