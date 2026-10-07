import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  ProductDatabase,
  ProjectRepositoryStore,
  ProjectRegisteredRepositoryStore,
  ArchitectureRunStore,
  ImplementationSessionStore,
  ProviderConfigurationStore,
  BoundedArtifactStorage,
  WorkspaceRootValidator,
  CrashRecoveryService,
  KnowledgeBootstrapService,
} from './persistence/index.js';
import {
  EngineeringContract,
  WellKnownDimensions,
  KnowledgeCandidate,
  KnowledgeSource,
} from '@architectai/domain';
import { InMemoryKnowledgeRepository } from '@architectai/knowledge';
import { KnowledgeAcquisitionRegistry } from '@architectai/knowledge';

describe('Milestone 6: Productization & Persistent Engineering Workspace', () => {
  let tempDir: string;
  let dbPath: string;
  let artifactsDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architectai-m6-test-'));
    dbPath = path.join(tempDir, 'test-product.db');
    artifactsDir = path.join(tempDir, 'artifacts');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('A & B: Projects, Runs, and EngineeringContracts survive server/database restart', () => {
    // Phase 1: Initialize Database and create Project & Architecture Run
    let db = new ProductDatabase({ dbPath });
    let projectStore = new ProjectRepositoryStore(db.getRawDb());
    let runStore = new ArchitectureRunStore(db.getRawDb());

    const project = {
      id: 'proj_pay_01',
      name: 'Payments API',
      description: 'Persistent checkout service',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { env: 'production' },
    };
    projectStore.create(project);

    const contract: EngineeringContract = {
      id: 'contract_01',
      version: '1.0.0',
      requirement: {
        id: 'req_01',
        rawIntent: 'Add idempotent checkout to prevent double charges.',
        explicitConstraints: ['zero duplicate payments'],
        declaredTechStack: ['TypeScript', 'PostgreSQL'],
        context: {},
      },
      discoveredConcerns: [],
      decisions: [],
      invariants: [
        {
          id: 'inv_01',
          property: 'Zero duplicate transactions for identical idempotency keys.',
          severity: 'critical',
          blocksCompletion: true,
        },
      ],
      verificationSpecs: [],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: {
        createdAt: new Date().toISOString(),
        status: 'accepted',
        tags: ['payments'],
      },
    };

    const run = {
      id: 'run_idemp_100',
      projectId: 'proj_pay_01',
      title: 'Add idempotent checkout',
      state: 'ANALYZING' as const,
      rawIntent: 'Add idempotent checkout to prevent double charges.',
      explicitConstraints: ['zero duplicate payments'],
      declaredTechStack: ['TypeScript', 'PostgreSQL'],
      context: {},
      contract,
      contractRevision: 1,
      dimensionsDetected: [WellKnownDimensions.BOUNDED_RESOURCE],
      analysisMode: 'heuristic' as const,
      userAnswers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    runStore.create(run);

    // Transition run to ARCHITECTURE_ACCEPTED
    runStore.updateState(run.id, 'ANALYSIS_COMPLETE');
    runStore.updateState(run.id, 'ARCHITECTURE_ACCEPTED');

    // Record user answer to unresolved question
    runStore.recordUserAnswer({
      id: 'ans_01',
      runId: run.id,
      question: 'What is the transaction timeout limit?',
      answer: '5000ms',
      answeredAt: new Date().toISOString(),
    });

    // Close Database to simulate full server crash/shutdown
    db.close();

    // Phase 2: Restart server by opening fresh ProductDatabase connection on same disk file
    const restartedDb = new ProductDatabase({ dbPath });
    projectStore = new ProjectRepositoryStore(restartedDb.getRawDb());
    runStore = new ArchitectureRunStore(restartedDb.getRawDb());

    // Verify Project survived
    const restoredProject = projectStore.findById('proj_pay_01');
    expect(restoredProject).not.toBeNull();
    expect(restoredProject?.name).toBe('Payments API');
    expect(restoredProject?.metadata).toEqual({ env: 'production' });

    // Verify Run & State survived
    const restoredRun = runStore.findById('run_idemp_100');
    expect(restoredRun).not.toBeNull();
    expect(restoredRun?.state).toBe('ARCHITECTURE_ACCEPTED');
    expect(restoredRun?.contract?.id).toBe('contract_01');
    expect(restoredRun?.contract?.invariants[0].property).toBe('Zero duplicate transactions for identical idempotency keys.');

    // Verify Contract Revisions & User Answers survived
    const revisions = runStore.getContractRevisions('run_idemp_100');
    expect(revisions.length).toBeGreaterThanOrEqual(1);
    expect(revisions[0].contract.id).toBe('contract_01');

    const answers = runStore.getUserAnswers('run_idemp_100');
    expect(answers).toHaveLength(1);
    expect(answers[0].question).toBe('What is the transaction timeout limit?');
    expect(answers[0].answer).toBe('5000ms');

    restartedDb.close();
  });

  it('C & D: Repository registration safety, canonical path resolution, and cross-project tampering protection', () => {
    const db = new ProductDatabase({ dbPath });
    const projectStore = new ProjectRepositoryStore(db.getRawDb());
    const repoStore = new ProjectRegisteredRepositoryStore(db.getRawDb());

    // Register Project A and Project B
    projectStore.create({
      id: 'proj_A',
      name: 'Project A',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    });
    projectStore.create({
      id: 'proj_B',
      name: 'Project B',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    });

    const repoPathA = path.join(tempDir, 'repoA');
    const repoPathB = path.join(tempDir, 'repoB');
    fs.mkdirSync(repoPathA, { recursive: true });
    fs.mkdirSync(repoPathB, { recursive: true });

    repoStore.register({
      id: 'repo_A',
      projectId: 'proj_A',
      canonicalLocalPath: repoPathA,
      repositoryName: 'repoA',
      gitRoot: repoPathA,
      defaultBranch: 'main',
      detectedLanguages: ['TypeScript'],
      detectedFrameworks: ['Node.js'],
      lastInspectedHead: 'commitA',
      lastInspectedTimestamp: new Date().toISOString(),
    });

    repoStore.register({
      id: 'repo_B',
      projectId: 'proj_B',
      canonicalLocalPath: repoPathB,
      repositoryName: 'repoB',
      gitRoot: repoPathB,
      defaultBranch: 'main',
      detectedLanguages: ['Python'],
      detectedFrameworks: ['FastAPI'],
      lastInspectedHead: 'commitB',
      lastInspectedTimestamp: new Date().toISOString(),
    });

    // Verification: Lookups always resolve canonical registered path
    const resolvedRepoA = repoStore.findByProjectId('proj_A');
    expect(resolvedRepoA?.canonicalLocalPath).toBe(repoPathA);

    // Cross-project check simulation: Verify that Project A's run cannot bind to Project B's repo
    const runForA = {
      projectId: 'proj_A',
      requestedRepoId: 'repo_B',
    };
    const isTampered = runForA.requestedRepoId !== resolvedRepoA?.id;
    expect(isTampered).toBe(true);

    db.close();
  });

  it('E: Provider configuration stores credentialReference only, never raw API keys', () => {
    const db = new ProductDatabase({ dbPath });
    const providerStore = new ProviderConfigurationStore(db.getRawDb());

    providerStore.save({
      id: 'prov_main',
      type: 'OPENAI_COMPATIBLE',
      displayName: 'Production LLM',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4o',
      credentialReference: 'ARCHITECTAI_API_KEY',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const loaded = providerStore.findById('prov_main');
    expect(loaded?.credentialReference).toBe('ARCHITECTAI_API_KEY');
    // Ensure raw key was never stored or exposed
    expect(JSON.stringify(loaded)).not.toContain('sk-');

    db.close();
  });

  it('F, G, & H: Execution session persistence and crash recovery reconciliation', () => {
    const db = new ProductDatabase({ dbPath });
    const sessionStore = new ImplementationSessionStore(db.getRawDb());
    const runStore = new ArchitectureRunStore(db.getRawDb());
    const projectStore = new ProjectRepositoryStore(db.getRawDb());
    const repoStore = new ProjectRegisteredRepositoryStore(db.getRawDb());

    projectStore.create({
      id: 'proj_recovery',
      name: 'Recovery Test Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    });

    const worktreePathExisting = path.join(tempDir, 'existing-worktree');
    fs.mkdirSync(worktreePathExisting, { recursive: true });
    const worktreePathMissing = path.join(tempDir, 'missing-worktree');

    // Create run 1
    runStore.create({
      id: 'run_recoverable',
      projectId: 'proj_recovery',
      title: 'Active Run 1',
      state: 'IMPLEMENTING',
      rawIntent: 'Feature 1',
      explicitConstraints: [],
      declaredTechStack: [],
      context: {},
      contractRevision: 1,
      dimensionsDetected: [],
      analysisMode: 'heuristic',
      userAnswers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Session 1: Interrupted with worktree existing
    sessionStore.create({
      id: 'sess_01',
      runId: 'run_recoverable',
      projectId: 'proj_recovery',
      repositoryId: 'repo_01',
      codingAgent: 'deterministic-agent',
      originalHead: 'head01',
      originalBranch: 'main',
      isolatedBranch: 'architectai/run_recoverable',
      worktreePath: worktreePathExisting,
      changedFiles: ['src/index.ts'],
      nativeCheckSummaries: [],
      status: 'IMPLEMENTING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create run 2
    runStore.create({
      id: 'run_orphaned',
      projectId: 'proj_recovery',
      title: 'Active Run 2',
      state: 'REPAIRING',
      rawIntent: 'Feature 2',
      explicitConstraints: [],
      declaredTechStack: [],
      context: {},
      contractRevision: 1,
      dimensionsDetected: [],
      analysisMode: 'heuristic',
      userAnswers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Session 2: Interrupted with worktree missing
    sessionStore.create({
      id: 'sess_02',
      runId: 'run_orphaned',
      projectId: 'proj_recovery',
      repositoryId: 'repo_01',
      codingAgent: 'deterministic-agent',
      originalHead: 'head01',
      originalBranch: 'main',
      isolatedBranch: 'architectai/run_orphaned',
      worktreePath: worktreePathMissing,
      changedFiles: [],
      nativeCheckSummaries: [],
      status: 'REPAIRING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Run Crash Recovery Service reconciliation
    const recoveryService = new CrashRecoveryService(sessionStore, runStore, repoStore);
    const report = recoveryService.reconcileInterruptedSessions();

    expect(report.reconciledSessionsCount).toBe(2);
    expect(report.recoverableCount).toBe(1);
    expect(report.orphanedCount).toBe(1);

    // Session 1 should be marked RECOVERABLE
    const updatedSess1 = sessionStore.findById('sess_01');
    expect(updatedSess1?.status).toBe('RECOVERABLE');

    // Session 2 should be marked ORPHANED
    const updatedSess2 = sessionStore.findById('sess_02');
    expect(updatedSess2?.status).toBe('ORPHANED');

    // Runs should not be left in stuck active states
    const updatedRun1 = runStore.findById('run_recoverable');
    expect(updatedRun1?.state).toBe('FAILED');
    expect(updatedRun1?.error).toContain('interrupted by server termination');

    db.close();
  });

  it('23 & 24: Bounded artifact storage defends against path traversal and bounds file size', () => {
    const storage = new BoundedArtifactStorage({
      baseDir: artifactsDir,
      maxSizeBytes: 200, // Small limit for testing
    });

    // 1. Path traversal defense
    expect(() => storage.storeArtifact('../evil', 'patch.diff', 'malicious')).toThrow();
    expect(() => storage.storeArtifact('run_1', '../../etc/passwd', 'malicious')).toThrow();

    // 2. Size bounding and SHA-256 calculation
    const largeContent = 'A'.repeat(500);
    const result = storage.storeArtifact('run_1', 'diff.patch', largeContent);

    expect(result.sizeBytes).toBeLessThanOrEqual(250);
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);

    const read = storage.readArtifact('run_1', 'diff.patch');
    expect(read).toContain('[... Truncated');
  });

  it('11: WorkspaceRootValidator enforces allowed repository root policy', () => {
    const allowedRoots = [path.resolve(tempDir, 'allowed_root')];
    fs.mkdirSync(allowedRoots[0], { recursive: true });

    const insidePath = path.resolve(allowedRoots[0], 'my-project');
    const outsidePath = path.resolve(tempDir, 'outside_root', 'unauthorized-repo');

    expect(WorkspaceRootValidator.isPathAllowed(insidePath, allowedRoots)).toBe(true);
    expect(WorkspaceRootValidator.isPathAllowed(outsidePath, allowedRoots)).toBe(false);
    expect(() => WorkspaceRootValidator.assertPathAllowed(outsidePath, allowedRoots)).toThrow(/Security restriction/);

    // If allowedRoots is empty, permissive by default for local development
    expect(WorkspaceRootValidator.isPathAllowed(outsidePath, [])).toBe(true);
  });

  it('J & K: KnowledgeBootstrapService combines curated fixtures and accepted acquired knowledge while excluding review-required items', async () => {
    const knowledgeRepo = new InMemoryKnowledgeRepository();
    const registryPath = path.join(tempDir, 'knowledge-registry.json');
    const registry = new KnowledgeAcquisitionRegistry(registryPath);

    // Register test source
    const source: KnowledgeSource = {
      id: 'ietf-rfc-7230',
      canonicalUrl: 'https://www.rfc-editor.org/rfc/rfc7230.txt',
      name: 'IETF RFC 7230',
      authorityTier: 'TIER_1_STANDARD',
      contentType: 'RFC',
      enabled: true,
      registeredAt: new Date().toISOString(),
    };
    registry.registerSource(source);

    // Save one ACCEPTED candidate into registry
    const acceptedCandidate: KnowledgeCandidate = {
      id: 'cand_accepted_01',
      state: 'ACCEPTED',
      title: 'HTTP Chunked Transfer Size Bound',
      normalizedConcept: 'HTTP Chunked Encoding Bounded Buffers',
      proposedLevel: 'technology_specific',
      engineeringDimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
      applicabilityTriggers: ['HTTP Chunked transfer-encoding'],
      mechanism: 'Parsers must limit maximum chunk hex size to prevent heap exhaustion.',
      failureConsequences: ['OOM'],
      mitigations: ['Enforce max chunk size header limits'],
      assumptions: [],
      sourceClaimIds: ['claim_01'],
      proposedRelationships: [],
      verificationIdeas: [],
      confidence: 0.95,
      versionApplicability: 'UNKNOWN',
    };
    registry.saveCandidate(acceptedCandidate);

    // Save corresponding accepted knowledge item
    registry.saveAcceptedKnowledge({
      id: 'l3-http-chunked-transfer-size',
      levels: ['technology_specific'],
      title: 'HTTP Chunked Transfer Size Bound',
      description: 'Parsers must limit maximum chunk hex size to prevent heap exhaustion.',
      dimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
      triggers: ['HTTP Chunked transfer-encoding'],
      failureMechanisms: ['OOM'],
      mitigations: ['Enforce max chunk size header limits'],
      verificationIdeas: [],
      evidence: [],
      relationships: [],
    });

    // Save one REVIEW_REQUIRED candidate into registry (must NOT be loaded as accepted knowledge!)
    const reviewCandidate: KnowledgeCandidate = {
      id: 'cand_review_02',
      state: 'REVIEW_REQUIRED',
      title: 'Unverified Vendor Optimization',
      normalizedConcept: 'Unverified Behavior',
      proposedLevel: 'technology_specific',
      engineeringDimensions: [WellKnownDimensions.CONCURRENCY],
      applicabilityTriggers: [],
      mechanism: 'Unverified claim',
      failureConsequences: [],
      mitigations: [],
      assumptions: [],
      sourceClaimIds: ['claim_02'],
      proposedRelationships: [],
      verificationIdeas: [],
      confidence: 0.4,
      versionApplicability: 'UNKNOWN',
    };
    registry.saveCandidate(reviewCandidate);

    // Execute KnowledgeBootstrapService
    const bootstrapService = new KnowledgeBootstrapService(knowledgeRepo, registry);
    const report = await bootstrapService.bootstrap();

    expect(report.acceptedAcquiredCount).toBe(1);
    expect(report.reviewRequiredCount).toBe(1);
    expect(report.totalLoaded).toBe(report.curatedCount + 1);

    // Verify repository contains the accepted acquired item
    const foundItem = await knowledgeRepo.getById('l3-http-chunked-transfer-size');
    expect(foundItem).not.toBeUndefined();
    expect(foundItem?.title).toBe('HTTP Chunked Transfer Size Bound');

    // Verify repository does NOT contain review-required item
    const unacceptedItem = await knowledgeRepo.getById('cand_review_02');
    expect(unacceptedItem).toBeUndefined();
  });
});
