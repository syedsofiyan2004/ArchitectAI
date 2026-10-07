import { describe, it, expect } from 'vitest';
import {
  ProjectSchema,
  ProjectRepositorySchema,
  ArchitectureRunSchema,
  RunLifecycleStateSchema,
  isValidRunStateTransition,
  validateRunStateTransition,
  ImplementationSessionSchema,
  ProviderConfigurationSchema,
  WorkspaceSettingsSchema,
} from './product.js';

describe('Milestone 6 Domain Schemas & State Machine', () => {
  it('validates Project schema with mandatory timestamps and metadata', () => {
    const project = ProjectSchema.parse({
      id: 'proj_01',
      name: 'Payments API',
      description: 'High throughput checkout service',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { priority: 'P0' },
    });
    expect(project.id).toBe('proj_01');
    expect(project.name).toBe('Payments API');
    expect(project.metadata).toEqual({ priority: 'P0' });
  });

  it('validates ProjectRepository schema with derived git inspection signals', () => {
    const repo = ProjectRepositorySchema.parse({
      id: 'repo_01',
      projectId: 'proj_01',
      canonicalLocalPath: 'D:/repos/payments',
      repositoryName: 'payments',
      gitRoot: 'D:/repos/payments',
      defaultBranch: 'main',
      detectedLanguages: ['TypeScript'],
      detectedFrameworks: ['Express'],
      lastInspectedHead: 'abc1234',
      lastInspectedTimestamp: new Date().toISOString(),
    });
    expect(repo.canonicalLocalPath).toBe('D:/repos/payments');
    expect(repo.defaultBranch).toBe('main');
  });

  it('validates RunLifecycleState and strict state transition rules', () => {
    expect(RunLifecycleStateSchema.parse('DRAFT')).toBe('DRAFT');
    expect(RunLifecycleStateSchema.parse('ANALYZING')).toBe('ANALYZING');
    expect(RunLifecycleStateSchema.parse('VERIFIED')).toBe('VERIFIED');

    // Valid transitions
    expect(isValidRunStateTransition('DRAFT', 'ANALYZING')).toBe(true);
    expect(isValidRunStateTransition('ANALYZING', 'ANALYSIS_COMPLETE')).toBe(true);
    expect(isValidRunStateTransition('ANALYSIS_COMPLETE', 'ARCHITECTURE_ACCEPTED')).toBe(true);
    expect(isValidRunStateTransition('ARCHITECTURE_ACCEPTED', 'READY_FOR_IMPLEMENTATION')).toBe(true);
    expect(isValidRunStateTransition('READY_FOR_IMPLEMENTATION', 'IMPLEMENTING')).toBe(true);
    expect(isValidRunStateTransition('IMPLEMENTING', 'VERIFICATION_FAILED')).toBe(true);
    expect(isValidRunStateTransition('VERIFICATION_FAILED', 'REPAIR_PENDING')).toBe(true);
    expect(isValidRunStateTransition('REPAIR_PENDING', 'REPAIRING')).toBe(true);
    expect(isValidRunStateTransition('REPAIRING', 'VERIFIED')).toBe(true);

    // Invalid transition: DRAFT directly to VERIFIED must be rejected!
    expect(isValidRunStateTransition('DRAFT', 'VERIFIED')).toBe(false);
    expect(() => validateRunStateTransition('DRAFT', 'VERIFIED')).toThrow(/Invalid run state transition/);

    // Invalid transition: DRAFT to IMPLEMENTING must be rejected!
    expect(isValidRunStateTransition('DRAFT', 'IMPLEMENTING')).toBe(false);
  });

  it('validates ProviderConfiguration schema and credential reference separation (no raw secrets)', () => {
    const provider = ProviderConfigurationSchema.parse({
      id: 'prov_openai',
      type: 'OPENAI_COMPATIBLE',
      displayName: 'Corporate OpenAI Gateway',
      modelName: 'gpt-4o',
      credentialReference: 'ARCHITECTAI_API_KEY', // Reference only
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(provider.credentialReference).toBe('ARCHITECTAI_API_KEY');
    // Schema must not contain apiKey field
    expect((provider as Record<string, unknown>)['apiKey']).toBeUndefined();
  });

  it('validates WorkspaceSettings schema and allowed roots', () => {
    const settings = WorkspaceSettingsSchema.parse({
      allowedRepositoryRoots: ['D:/Projects', 'C:/Users/dev/code'],
      maxArtifactSizeBytes: 10 * 1024 * 1024,
    });
    expect(settings.allowedRepositoryRoots).toHaveLength(2);
    expect(settings.maxArtifactSizeBytes).toBe(10485760);
  });
});
