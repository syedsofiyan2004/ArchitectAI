import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  InMemoryKnowledgeRepository,
} from '@architectai/knowledge';
import {
  OpenAICompatibleProviderAdapter,
  DeterministicDemoProviderAdapter,
  ProviderAdapter,
  CodingAgentGateway,
} from '@architectai/providers';
import {
  AnalyzeArchitectureUseCase,
  GitWorkspaceService,
  RepositoryContextBuilder,
  CompileImplementationPlanUseCase,
  ExecuteImplementationPlanUseCase,
  DiagnoseVerificationFailureUseCase,
  CompileRepairPlanUseCase,
  ExecuteRepairLoopUseCase,
  IsolatedWorktreeSession,
  NonGitRepositoryError,
  ProductDatabase,
  ProjectRepositoryStore,
  ProjectRegisteredRepositoryStore,
  ArchitectureRunStore,
  ImplementationSessionStore,
  RunArtifactStore,
  ProviderConfigurationStore,
  AgentConfigurationStore,
  WorkspaceSettingsStore,
  BoundedArtifactStorage,
  WorkspaceRootValidator,
  CrashRecoveryService,
  KnowledgeBootstrapService,
  SystemCapabilityService,
} from '@architectai/application';
import {
  EngineeringContractSchema,
  ImplementationPlanSchema,
  VerificationPlanSchema,
  VerificationRunResultSchema,
  Project,
  ArchitectureRun,
} from '@architectai/domain';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_HOST = '127.0.0.1';

export interface ServerOptions {
  dbPath?: string;
  artifactsDir?: string;
}

export async function createServer(options: ServerOptions = {}) {
  const app = express();

  // 1. Initialize Persistent Database
  const productDb = new ProductDatabase({ dbPath: options.dbPath });
  const projectStore = new ProjectRepositoryStore(productDb.getRawDb());
  const repoStore = new ProjectRegisteredRepositoryStore(productDb.getRawDb());
  const runStore = new ArchitectureRunStore(productDb.getRawDb());
  const sessionStore = new ImplementationSessionStore(productDb.getRawDb());
  const artifactStore = new RunArtifactStore(productDb.getRawDb());
  const providerStore = new ProviderConfigurationStore(productDb.getRawDb());
  const agentConfigStore = new AgentConfigurationStore(productDb.getRawDb());
  const settingsStore = new WorkspaceSettingsStore(productDb.getRawDb());

  // Artifact Storage
  const artifactStorage = new BoundedArtifactStorage({
    baseDir: options.artifactsDir || path.resolve(process.cwd(), 'data/artifacts'),
  });

  // 2. Initialize Knowledge Repository and Bootstrap
  const knowledgeRepo = new InMemoryKnowledgeRepository();
  const { KnowledgeAcquisitionRegistry } = await import('@architectai/knowledge');
  const acquisitionRegistry = new KnowledgeAcquisitionRegistry();
  const knowledgeBootstrapService = new KnowledgeBootstrapService(knowledgeRepo, acquisitionRegistry);
  const bootstrapReport = await knowledgeBootstrapService.bootstrap();

  // 3. Initialize Provider
  const apiKey = process.env['ARCHITECTAI_API_KEY'];
  let provider: ProviderAdapter;

  if (apiKey && apiKey.trim().length > 0) {
    provider = new OpenAICompatibleProviderAdapter({
      apiKey,
      baseURL: process.env['ARCHITECTAI_BASE_URL'],
      modelName: process.env['ARCHITECTAI_MODEL'],
    });
  } else {
    provider = new DeterministicDemoProviderAdapter();
  }

  // Seed default provider configuration if empty
  if (providerStore.list().length === 0) {
    providerStore.save({
      id: 'default_provider',
      type: provider.id === 'openai-compatible' ? 'OPENAI_COMPATIBLE' : 'DETERMINISTIC_DEMO',
      displayName: provider.name,
      modelName: provider.id === 'openai-compatible' ? (process.env['ARCHITECTAI_MODEL'] || 'gpt-4o') : 'Deterministic Kernel',
      credentialReference: provider.id === 'openai-compatible' ? 'ARCHITECTAI_API_KEY' : undefined,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // 4. Initialize Coding Agent Gateway and Services
  const agentGateway = new CodingAgentGateway();
  const gitWorkspaceService = new GitWorkspaceService();
  const contextBuilder = new RepositoryContextBuilder();
  const useCase = new AnalyzeArchitectureUseCase(knowledgeRepo, provider);
  const taskCompiler = new CompileImplementationPlanUseCase(provider);
  const planExecutor = new ExecuteImplementationPlanUseCase(agentGateway);
  const failureDiagnoser = new DiagnoseVerificationFailureUseCase(provider);
  const repairPlanCompiler = new CompileRepairPlanUseCase();
  const repairLoopUseCase = new ExecuteRepairLoopUseCase(agentGateway);
  const activeWorktreeSessions = new Map<string, IsolatedWorktreeSession>();

  // 5. Crash Recovery on Server Startup
  const crashRecoveryService = new CrashRecoveryService(sessionStore, runStore, repoStore);
  crashRecoveryService.reconcileInterruptedSessions();

  // 6. Capability Status Service
  const capabilityService = new SystemCapabilityService(provider, knowledgeRepo, agentGateway, repoStore);

  // 7. Session-specific local API Token for Anti-CSRF
  const serverSessionToken = crypto.randomUUID();
  (app as any).sessionToken = serverSessionToken;
  app.locals.sessionToken = serverSessionToken;

  // 8. Security Middlewares: Restricted CORS and Origin Verification
  const allowedOrigins = [
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.some((pattern) => pattern.test(origin));
        callback(null, isAllowed);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));

  // Origin & Anti-CSRF hardening middleware for mutating requests
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
      if (origin) {
        const isAllowed = allowedOrigins.some((pattern) => pattern.test(origin));
        if (!isAllowed) {
          return res.status(403).json({
            error: 'Forbidden: Mutating request rejected from untrusted external Origin.',
          });
        }
      }

      // Check session token on destructive execution, registration, and cleanup endpoints
      const isSensitivePath =
        req.path.startsWith('/api/plan/execute') ||
        req.path.startsWith('/api/repair/execute') ||
        req.path.startsWith('/api/worktrees/cleanup') ||
        (req.path.startsWith('/api/projects/') && req.path.includes('/repository')) ||
        (req.path.startsWith('/api/sessions/') && req.path.endsWith('/recover')) ||
        (req.path.startsWith('/api/settings') && ['POST', 'PATCH', 'PUT'].includes(req.method)) ||
        (req.path.startsWith('/api/agents/preferred') && req.method === 'POST');

      if (isSensitivePath) {
        const tokenHeader = req.headers['x-architectai-token'] || req.headers['x-csrf-token'];
        if (!tokenHeader) {
          return res.status(403).json({ error: 'Forbidden: Missing session security token.' });
        }
        if (tokenHeader !== serverSessionToken) {
          return res.status(403).json({ error: 'Forbidden: Invalid session security token.' });
        }
      }
    }
    next();
  });

  // Ensure default project exists
  function ensureDefaultProject(): Project {
    let defaultProj = projectStore.findById('default_project');
    if (!defaultProj) {
      defaultProj = {
        id: 'default_project',
        name: 'Default Workspace',
        description: 'Auto-created workspace for ad-hoc architecture runs',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {},
      };
      projectStore.create(defaultProj);
    }
    return defaultProj;
  }

  // --- API Config & Capabilities ---
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({
      mode: provider.id === 'deterministic-demo' ? 'deterministic-demo' : 'remote-model',
      providerName: provider.name,
      modelName:
        provider.id === 'deterministic-demo'
          ? 'Deterministic Architecture Kernel'
          : process.env['ARCHITECTAI_MODEL'] || 'gpt-4o-mini',
      knowledgeItemsCount: bootstrapReport.totalLoaded,
      csrfToken: serverSessionToken,
    });
  });

  app.get('/api/csrf-token', (_req: Request, res: Response) => {
    res.json({ token: serverSessionToken });
  });

  app.get('/api/system/capabilities', async (req: Request, res: Response) => {
    try {
      const projectId = req.query['projectId'] as string | undefined;
      const capabilities = await capabilityService.getCapabilities(projectId);
      res.json({ success: true, capabilities });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Project Management APIs ---
  app.get('/api/projects', (_req: Request, res: Response) => {
    try {
      const projects = projectStore.list();
      res.json({ success: true, projects });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/projects', (req: Request, res: Response) => {
    try {
      const { name, description, metadata } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Project name is required.' });
      }

      const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const project: Project = {
        id,
        name: name.trim(),
        description: description ? String(description).trim() : undefined,
        createdAt: now,
        updatedAt: now,
        metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
      };

      projectStore.create(project);
      return res.status(201).json({ success: true, project });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/projects/:id', (req: Request, res: Response) => {
    try {
      const project = projectStore.findById(req.params.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      const repository = project.repositoryId ? repoStore.findById(project.repositoryId) : repoStore.findByProjectId(project.id);
      return res.json({ success: true, project, repository });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.patch('/api/projects/:id', (req: Request, res: Response) => {
    try {
      const updated = projectStore.update(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      return res.json({ success: true, project: updated });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/projects/:id', (req: Request, res: Response) => {
    try {
      projectStore.archive(req.params.id);
      return res.json({ success: true, message: 'Project archived.' });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Project Repository Registration & Refresh ---
  app.post('/api/projects/:id/repository', async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const project = projectStore.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      const { repoPath } = req.body;
      if (!repoPath || typeof repoPath !== 'string' || repoPath.trim().length === 0) {
        return res.status(400).json({ error: 'Valid repository path is required.' });
      }

      const rawPath = repoPath.trim();
      const settings = settingsStore.get();

      // Workspace root restriction check
      WorkspaceRootValidator.assertPathAllowed(rawPath, settings.allowedRepositoryRoots);

      // Git inspection to derive metadata
      const workspace = await gitWorkspaceService.inspectRepository(rawPath);
      const canonicalLocalPath = path.resolve(rawPath);
      const repoId = `repo_${projectId}_${Date.now()}`;

      repoStore.register({
        id: repoId,
        projectId,
        canonicalLocalPath,
        repositoryName: path.basename(canonicalLocalPath),
        gitRoot: workspace.repositoryPath,
        defaultBranch: workspace.currentBranch || 'main',
        detectedLanguages: workspace.detectedLanguages,
        detectedFrameworks: workspace.detectedFrameworks,
        packageManifests: workspace.packageManifests,
        lastInspectedHead: workspace.headCommit,
        lastInspectedTimestamp: new Date().toISOString(),
      });

      const updatedProject = projectStore.findById(projectId);
      const registeredRepo = repoStore.findById(repoId);

      return res.json({
        success: true,
        project: updatedProject,
        repository: registeredRepo,
        workspace,
      });
    } catch (err: unknown) {
      if (err instanceof NonGitRepositoryError) {
        return res.status(400).json({ success: false, error: err.message, isNonGit: true });
      }
      return res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to register repository.',
      });
    }
  });

  app.get('/api/projects/:id/repository', (req: Request, res: Response) => {
    try {
      const repository = repoStore.findByProjectId(req.params.id);
      if (!repository) {
        return res.status(404).json({ error: 'No registered repository found for project.' });
      }
      return res.json({ success: true, repository });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/projects/:id/repository/refresh', async (req: Request, res: Response) => {
    try {
      const repository = repoStore.findByProjectId(req.params.id);
      if (!repository) {
        return res.status(404).json({ error: 'No registered repository found for project.' });
      }

      const workspace = await gitWorkspaceService.inspectRepository(repository.canonicalLocalPath);
      const updated = repoStore.update(repository.id, {
        defaultBranch: workspace.currentBranch || 'main',
        detectedLanguages: workspace.detectedLanguages,
        detectedFrameworks: workspace.detectedFrameworks,
        packageManifests: workspace.packageManifests,
        lastInspectedHead: workspace.headCommit,
        lastInspectedTimestamp: new Date().toISOString(),
      });

      return res.json({ success: true, repository: updated, workspace });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Runs APIs ---
  app.get('/api/projects/:id/runs', (req: Request, res: Response) => {
    try {
      const runs = runStore.listByProjectId(req.params.id);
      return res.json({ success: true, runs });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/projects/:id/runs', async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const project = projectStore.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      const { rawIntent, explicitConstraints, declaredTechStack, context } = req.body;
      if (!rawIntent || typeof rawIntent !== 'string' || rawIntent.trim().length === 0) {
        return res.status(400).json({ error: 'Please provide a non-empty requirement description.' });
      }

      const runId = (req.body.runId && typeof req.body.runId === 'string' && req.body.runId.trim().length > 0)
        ? req.body.runId.trim()
        : `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const title = rawIntent.trim().split(/[.?!]/)[0].slice(0, 57) || 'Architecture Run';
      const now = new Date().toISOString();

      // Persist run BEFORE analysis in ANALYZING state
      const newRun: ArchitectureRun = {
        id: runId,
        projectId,
        title,
        state: 'ANALYZING',
        rawIntent: rawIntent.trim(),
        explicitConstraints: Array.isArray(explicitConstraints) ? explicitConstraints : [],
        declaredTechStack: Array.isArray(declaredTechStack) ? declaredTechStack : [],
        context: typeof context === 'object' && context !== null ? context : {},
        contractRevision: 1,
        dimensionsDetected: [],
        analysisMode: 'heuristic',
        userAnswers: {},
        createdAt: now,
        updatedAt: now,
      };
      runStore.create(newRun);

      try {
        const output = await useCase.execute({
          rawIntent: newRun.rawIntent,
          explicitConstraints: newRun.explicitConstraints,
          declaredTechStack: newRun.declaredTechStack,
          context: newRun.context,
        });

        // Update run state to ANALYSIS_COMPLETE
        runStore.update(runId, {
          state: 'ANALYSIS_COMPLETE',
          contract: output.contract,
          decomposition: output.decomposition,
          dimensionsDetected: output.dimensionsDetected,
          analysisMode: output.mode,
          updatedAt: new Date().toISOString(),
        });

        return res.status(201).json({
          success: true,
          runId,
          state: 'ANALYSIS_COMPLETE',
          ...output,
        });
      } catch (analysisErr) {
        runStore.update(runId, {
          state: 'FAILED',
          error: analysisErr instanceof Error ? analysisErr.message : String(analysisErr),
          updatedAt: new Date().toISOString(),
        });
        throw analysisErr;
      }
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Architecture analysis failed.',
      });
    }
  });

  app.get('/api/runs/:runId', (req: Request, res: Response) => {
    try {
      const run = runStore.findById(req.params.runId);
      if (!run) {
        return res.status(404).json({ error: 'Architecture run not found.' });
      }
      const revisions = runStore.getContractRevisions(run.id);
      const answers = runStore.getUserAnswers(run.id);
      const sessions = sessionStore.findByRunId(run.id);
      const artifacts = artifactStore.findByRunId(run.id);

      return res.json({
        success: true,
        run,
        revisions,
        answers,
        sessions,
        artifacts,
      });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.patch('/api/runs/:runId', (req: Request, res: Response) => {
    try {
      const runId = req.params.runId;
      const { state, title } = req.body;
      const updates: Partial<ArchitectureRun> = {};
      if (title) updates.title = title;
      if (state) {
        const updated = runStore.updateState(runId, state);
        return res.json({ success: true, run: updated });
      }
      const updated = runStore.update(runId, updates);
      return res.json({ success: true, run: updated });
    } catch (err: unknown) {
      return res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/runs/:runId/answers', (req: Request, res: Response) => {
    try {
      const { question, answer } = req.body;
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Question is required.' });
      }
      const ansId = `ans_${Date.now()}`;
      runStore.recordUserAnswer({
        id: ansId,
        runId: req.params.runId,
        question: question.trim(),
        answer: String(answer || '').trim(),
        answeredAt: new Date().toISOString(),
      });
      return res.json({ success: true, answer: { question, answer } });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Artifacts APIs ---
  app.get('/api/runs/:runId/artifacts', (req: Request, res: Response) => {
    try {
      const artifacts = artifactStore.findByRunId(req.params.runId);
      return res.json({ success: true, artifacts });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/runs/:runId/artifacts/:filename', (req: Request, res: Response) => {
    try {
      const content = artifactStorage.readArtifact(req.params.runId, req.params.filename);
      return res.json({ success: true, content });
    } catch (err: unknown) {
      return res.status(404).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Legacy / Direct Analyze Endpoint (auto-persists into SQLite!) ---
  app.post('/api/analyze', async (req: Request, res: Response) => {
    try {
      const { rawIntent, explicitConstraints, declaredTechStack, context, projectId } = req.body;

      if (!rawIntent || typeof rawIntent !== 'string' || rawIntent.trim().length === 0) {
        return res.status(400).json({
          error: 'Please provide a non-empty requirement description.',
        });
      }

      const activeProject = projectId ? (projectStore.findById(projectId) || ensureDefaultProject()) : ensureDefaultProject();
      const runId = (req.body.runId && typeof req.body.runId === 'string' && req.body.runId.trim().length > 0)
        ? req.body.runId.trim()
        : `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const title = rawIntent.trim().split(/[.?!]/)[0].slice(0, 57) || 'Architecture Run';
      const now = new Date().toISOString();

      // Persist run in SQLite BEFORE analysis
      const newRun: ArchitectureRun = {
        id: runId,
        projectId: activeProject.id,
        title,
        state: 'ANALYZING',
        rawIntent: rawIntent.trim(),
        explicitConstraints: Array.isArray(explicitConstraints) ? explicitConstraints : [],
        declaredTechStack: Array.isArray(declaredTechStack) ? declaredTechStack : [],
        context: typeof context === 'object' && context !== null ? context : {},
        contractRevision: 1,
        dimensionsDetected: [],
        analysisMode: 'heuristic',
        userAnswers: {},
        createdAt: now,
        updatedAt: now,
      };
      runStore.create(newRun);

      try {
        const output = await useCase.execute({
          rawIntent: newRun.rawIntent,
          explicitConstraints: newRun.explicitConstraints,
          declaredTechStack: newRun.declaredTechStack,
          context: newRun.context,
        });

        // Update run state to ANALYSIS_COMPLETE
        runStore.update(runId, {
          state: 'ANALYSIS_COMPLETE',
          contract: output.contract,
          decomposition: output.decomposition,
          dimensionsDetected: output.dimensionsDetected,
          analysisMode: output.mode,
          updatedAt: new Date().toISOString(),
        });

        return res.json({
          success: true,
          runId,
          state: 'ANALYSIS_COMPLETE',
          ...output,
        });
      } catch (analysisErr) {
        runStore.update(runId, {
          state: 'FAILED',
          error: analysisErr instanceof Error ? analysisErr.message : String(analysisErr),
          updatedAt: new Date().toISOString(),
        });
        throw analysisErr;
      }
    } catch (err: unknown) {
      console.error('[ArchitectAI Server Error]', err);
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Internal analysis pipeline error.',
      });
    }
  });

  // Pre-configured Scenarios for one-click testing
  app.get('/api/scenarios', (_req: Request, res: Response) => {
    res.json([
      {
        id: 'demo-a',
        tag: 'DEMO A',
        title: 'API Rate Limiting',
        prompt: 'Limit each authenticated user to 100 API requests per minute.',
        context: {
          database: 'Redis',
          framework: 'Node.js',
          scale: '10,000 active users',
        },
      },
      {
        id: 'demo-b',
        tag: 'DEMO B',
        title: 'Token Refresh Race',
        prompt:
          'When my access token expires automatically refresh it and retry the failed request.',
        context: {
          language: 'TypeScript',
          framework: 'React / Axios',
        },
      },
      {
        id: 'demo-c',
        tag: 'DEMO C',
        title: 'Parallel Image Pipeline',
        prompt:
          'Process many large uploaded images in parallel as quickly as possible.',
        context: {
          framework: 'Node.js',
          scale: '500 images/minute, up to 25MB each',
        },
      },
      {
        id: 'scenario-db-pool',
        tag: 'SCENARIO 4',
        title: 'Database Connection Pool Exhaustion',
        prompt:
          'Query user order history across 5,000 concurrent web requests without failing.',
        context: {
          database: 'PostgreSQL',
          scale: '5,000 concurrent queries',
        },
      },
      {
        id: 'scenario-payment-idemp',
        tag: 'SCENARIO 5',
        title: 'Duplicate Payment Protection',
        prompt:
          'Charge the customer credit card and retry if the connection times out.',
        context: {
          database: 'PostgreSQL',
          additionalConstraints: 'Must strictly avoid duplicate charges',
        },
      },
      {
        id: 'scenario-retry-storm',
        tag: 'SCENARIO 6',
        title: 'Downstream Retry Storm',
        prompt:
          'Call downstream pricing API and aggressively retry up to 10 times on failure.',
        context: {
          cloud: 'AWS',
        },
      },
      {
        id: 'scenario-cache-stampede',
        tag: 'SCENARIO 7',
        title: 'Cache Stampede / Dogpiling',
        prompt:
          'Cache trending product catalog in Redis with 5 minute TTL for 100,000 concurrent readers.',
        context: {
          database: 'Redis + PostgreSQL',
        },
      },
      {
        id: 'scenario-queue-dedup',
        tag: 'SCENARIO 8',
        title: 'Kafka Queue Deduplication',
        prompt:
          'Consume user registration events from Kafka queue and send welcome emails.',
        context: {
          framework: 'Kafka Consumer',
        },
      },
      {
        id: 'scenario-timeout-hang',
        tag: 'SCENARIO 9',
        title: 'Third-Party Timeout Resiliency',
        prompt:
          'Fetch external partner catalog on every user search request without freezing.',
        context: {
          language: 'TypeScript',
        },
      },
      {
        id: 'scenario-lost-update',
        tag: 'SCENARIO 10',
        title: 'Concurrent Lost Update',
        prompt:
          'Read current inventory quantity, decrement by 1, and save updated count back.',
        context: {
          database: 'PostgreSQL',
          scale: 'Simultaneous flash sale checkouts',
        },
      },
    ]);
  });

  // Coding Agent detection & preference
  app.get('/api/agents', async (_req: Request, res: Response) => {
    try {
      const agents = await agentGateway.listAvailableAgents();
      res.json({
        success: true,
        agents: agents.map((a) => ({
          id: a.adapter.id,
          name: a.adapter.name,
          available: a.availability.available,
          version: a.availability.version,
          reason: a.availability.reason,
        })),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to query agents.',
      });
    }
  });

  app.post('/api/agents/preferred', (req: Request, res: Response) => {
    try {
      const { adapterId } = req.body;
      if (!adapterId || typeof adapterId !== 'string') {
        return res.status(400).json({ error: 'Adapter ID is required.' });
      }
      agentConfigStore.setPreferred(adapterId);
      return res.json({ success: true, preferredAdapterId: adapterId });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Providers API & Health Check
  app.get('/api/providers', (_req: Request, res: Response) => {
    try {
      const providers = providerStore.list();
      res.json({ success: true, providers });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/providers/test', async (_req: Request, res: Response) => {
    try {
      if (provider.id === 'deterministic-demo') {
        return res.json({
          success: true,
          healthy: true,
          providerId: provider.id,
          diagnostic: 'Deterministic Architecture Kernel is active and operational.',
        });
      }

      // Actually test remote provider with one tiny bounded ping request
      try {
        const testPromise = provider.generateText({
          messages: [{ role: 'user', content: 'Respond with exactly OK' }],
          maxTokens: 5,
          temperature: 0,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Provider request timed out after 5000ms.')), 5000)
        );
        const response = await Promise.race([testPromise, timeoutPromise]);
        return res.json({
          success: true,
          healthy: true,
          providerId: provider.id,
          diagnostic: `Remote model provider responsive: "${response.content.trim().slice(0, 50)}"`,
        });
      } catch (checkErr: unknown) {
        const rawMsg = checkErr instanceof Error ? checkErr.message : String(checkErr);
        // Ensure no API keys or credentials are leaked
        const safeMsg = rawMsg.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]').slice(0, 200);
        return res.json({
          success: true,
          healthy: false,
          providerId: provider.id,
          error: `Provider health check failed: ${safeMsg}`,
        });
      }
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Provider connection test failed.',
      });
    }
  });

  // Settings API
  app.get('/api/settings', (_req: Request, res: Response) => {
    try {
      const settings = settingsStore.get();
      res.json({ success: true, settings });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.patch('/api/settings', (req: Request, res: Response) => {
    try {
      const updated = settingsStore.update(req.body);
      res.json({ success: true, settings: updated });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Knowledge status API
  app.get('/api/knowledge/status', (_req: Request, res: Response) => {
    try {
      const status = knowledgeBootstrapService.getStatus();
      res.json({ success: true, status });
    } catch (err: unknown) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Worktree Cleanup API
  app.post('/api/worktrees/cleanup', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: 'Session ID is required.' });
      }
      const result = await crashRecoveryService.cleanupRecordedWorktree(sessionId);
      return res.json({ success: true, ...result });
    } catch (err: unknown) {
      return res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Interrupted Session Recovery API
  app.post('/api/sessions/:sessionId/recover', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { action, approved } = req.body;

      if (!approved) {
        return res.status(403).json({
          error: 'Execution rejected: Explicit user approval is required to recover an interrupted session.',
        });
      }

      if (!action || !['retry', 'cleanup'].includes(action)) {
        return res.status(400).json({
          error: "Invalid action. Supported recovery actions are 'retry' and 'cleanup'.",
        });
      }

      const session = sessionStore.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: `Session '${sessionId}' not found.` });
      }

      const run = runStore.findById(session.runId);

      if (action === 'retry') {
        // Safely clean up previous worktree if recorded
        if (session.worktreePath) {
          await crashRecoveryService.cleanupRecordedWorktree(sessionId).catch(() => {});
        }

        // Mark session as INTERRUPTED
        sessionStore.update(sessionId, {
          status: 'INTERRUPTED',
          completedAt: new Date().toISOString(),
        });

        // Reset run back to READY_FOR_IMPLEMENTATION
        if (run) {
          runStore.update(run.id, {
            state: 'READY_FOR_IMPLEMENTATION',
            error: undefined,
          });
        }

        return res.json({
          success: true,
          action: 'retry',
          sessionId,
          runId: session.runId,
          nextRunState: 'READY_FOR_IMPLEMENTATION',
          message: 'Interrupted session cleared. Run reset to READY_FOR_IMPLEMENTATION for a fresh implementation attempt.',
        });
      }

      if (action === 'cleanup') {
        if (session.worktreePath) {
          await crashRecoveryService.cleanupRecordedWorktree(sessionId).catch(() => {});
        }

        sessionStore.update(sessionId, {
          status: 'ORPHANED',
          completedAt: new Date().toISOString(),
        });

        return res.json({
          success: true,
          action: 'cleanup',
          sessionId,
          runId: session.runId,
          message: 'Interrupted session worktree cleaned up.',
        });
      }
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Session recovery failed.',
      });
    }
  });

  // Repository Inspection
  app.post('/api/repo/inspect', async (req: Request, res: Response) => {
    try {
      const { repoPath } = req.body;
      if (!repoPath || typeof repoPath !== 'string') {
        return res.status(400).json({ error: 'Please provide a valid repository path.' });
      }
      const raw = repoPath.trim();
      const settings = settingsStore.get();
      WorkspaceRootValidator.assertPathAllowed(raw, settings.allowedRepositoryRoots);

      const workspace = await gitWorkspaceService.inspectRepository(raw);
      return res.json({ success: true, workspace });
    } catch (err: unknown) {
      if (err instanceof NonGitRepositoryError) {
        return res.status(400).json({ success: false, error: err.message, isNonGit: true });
      }
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to inspect repository.',
      });
    }
  });

  // Compile Implementation Plan (resolves registered canonical path and blocks cross-project tampering!)
  app.post('/api/plan/compile', async (req: Request, res: Response) => {
    try {
      const { contract, runId, projectId } = req.body;
      if (!runId || typeof runId !== 'string' || runId.trim().length === 0) {
        return res.status(400).json({ error: 'runId is required for implementation plan compilation.' });
      }

      const run = runStore.findById(runId.trim());
      if (!run) {
        return res.status(404).json({ error: `Architecture run '${runId}' not found.` });
      }

      if (projectId && projectId !== run.projectId) {
        return res.status(400).json({
          error: `Project mismatch: Run belongs to project '${run.projectId}', cannot override with '${projectId}'.`,
        });
      }

      const project = projectStore.findById(run.projectId);
      if (!project) {
        return res.status(404).json({ error: `Project '${run.projectId}' not found.` });
      }

      const registeredRepo = repoStore.findByProjectId(project.id);
      if (!registeredRepo) {
        return res.status(400).json({
          error: `Project '${project.name}' has no registered repository. Repository registration is required before implementation.`,
        });
      }

      // Canonical local path resolved strictly server-side from registered repo
      const targetPath = registeredRepo.canonicalLocalPath;

      const effectiveContract = contract ? EngineeringContractSchema.parse(contract) : run.contract;
      if (!effectiveContract) {
        return res.status(400).json({ error: 'EngineeringContract is required.' });
      }

      const workspace = await gitWorkspaceService.inspectRepository(targetPath);
      const context = await contextBuilder.buildContext(effectiveContract, workspace);
      const plan = await taskCompiler.execute(effectiveContract, context);

      runStore.update(run.id, { state: 'READY_FOR_IMPLEMENTATION' });

      return res.json({
        success: true,
        plan,
        context,
        workspace,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to compile implementation plan.',
      });
    }
  });

  // Execute Implementation Plan (requires explicit user approval and persists session)
  app.post('/api/plan/execute', async (req: Request, res: Response) => {
    try {
      const { plan, agentId, approved, contract, context, runId, projectId } = req.body;
      if (!approved) {
        return res.status(403).json({
          success: false,
          error:
            'Execution rejected: Explicit user approval is strictly required before modifying files.',
        });
      }
      if (!runId || typeof runId !== 'string' || runId.trim().length === 0) {
        return res.status(400).json({ error: 'runId is required for implementation plan execution.' });
      }
      if (!plan) {
        return res.status(400).json({ error: 'ImplementationPlan is required.' });
      }

      const run = runStore.findById(runId.trim());
      if (!run) {
        return res.status(404).json({ error: `Architecture run '${runId}' not found.` });
      }

      if (projectId && projectId !== run.projectId) {
        return res.status(400).json({
          error: `Project mismatch: Run belongs to project '${run.projectId}', cannot override with '${projectId}'.`,
        });
      }

      const project = projectStore.findById(run.projectId);
      if (!project) {
        return res.status(404).json({ error: `Project '${run.projectId}' not found.` });
      }

      const registeredRepo = repoStore.findByProjectId(project.id);
      if (!registeredRepo) {
        return res.status(400).json({
          error: `Project '${project.name}' has no registered repository. Repository registration is required before execution.`,
        });
      }

      // Canonical local path resolved strictly server-side
      const resolvedRepoPath = registeredRepo.canonicalLocalPath;

      const validatedPlan = ImplementationPlanSchema.parse(plan);
      // Enforce server-resolved registered path over client plan's repositoryPath
      validatedPlan.repositoryPath = resolvedRepoPath;
      const validatedContract = contract ? EngineeringContractSchema.parse(contract) : run.contract;

      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();

      // Record Implementation Session in SQLite
      sessionStore.create({
        id: sessionId,
        runId: run.id,
        projectId: run.projectId,
        repositoryId: registeredRepo.id,
        implementationPlanId: validatedPlan.id,
        codingAgent: agentId || 'deterministic-agent',
        originalHead: 'HEAD',
        originalBranch: 'main',
        isolatedBranch: `architectai/${run.id}`,
        changedFiles: [],
        nativeCheckSummaries: [],
        status: 'IMPLEMENTING',
        createdAt: now,
        updatedAt: now,
      });

      runStore.updateState(run.id, 'IMPLEMENTING');

      const output = await planExecutor.execute(
        validatedPlan,
        agentId,
        validatedContract,
        context,
        { preserveWorktreeOnFailure: true }
      );

      if (output.worktreeSession) {
        activeWorktreeSessions.set(run.id, output.worktreeSession);
      }

      // Persist diff patch artifact if available
      if (output.diffReport?.diff) {
        const artifactRes = artifactStorage.storeArtifact(run.id, 'changes.diff', output.diffReport.diff);
        artifactStore.create({
          id: `art_${Date.now()}`,
          runId: run.id,
          sessionId,
          type: 'DIFF_PATCH',
          relativePath: artifactRes.relativePath,
          contentHash: artifactRes.contentHash,
          sizeBytes: artifactRes.sizeBytes,
          createdAt: new Date().toISOString(),
        });
      }

      const verification = output.verificationRun;
      const isVerified = verification?.isVerified ?? (verification?.overallStatus === 'PASSED');
      const isFailed = verification ? (!verification.isVerified || verification.overallStatus === 'FAILED') : false;

      // Update session status in SQLite
      const finalStatus = isVerified
        ? 'COMPLETED'
        : isFailed
        ? 'FAILED'
        : output.success
        ? 'COMPLETED'
        : 'FAILED';

      sessionStore.update(sessionId, {
        worktreePath: output.worktreeSession?.worktreePath,
        isolatedBranch: output.worktreeSession?.branch || `architectai/${run.id}`,
        originalHead: output.worktreeSession?.originalHead || 'HEAD',
        originalBranch: output.worktreeSession?.originalBranch || 'main',
        changedFiles: output.diffReport?.changedFiles || [],
        nativeCheckSummaries: output.checksSummary ? [output.checksSummary] : [],
        verificationRunResult: verification,
        status: finalStatus,
        completedAt: new Date().toISOString(),
      });

      if (isVerified) {
        runStore.updateState(run.id, 'VERIFIED');
      } else if (isFailed) {
        runStore.updateState(run.id, 'VERIFICATION_FAILED');
      } else if (!output.success) {
        runStore.updateState(run.id, 'FAILED');
      }

      return res.json({
        success: true,
        sessionId,
        execution: {
          ...output,
          verificationResult: verification,
        },
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Execution failed.',
      });
    }
  });

  // Diagnose verification failure and compile bounded repair plan
  app.post('/api/repair/diagnose', async (req: Request, res: Response) => {
    try {
      const { contract, plan, context, verificationPlan, verificationRun, diffReport, runId } = req.body;
      if (!contract || !plan || !verificationRun) {
        return res.status(400).json({ error: 'Contract, plan, and verificationRun are required.' });
      }

      const validatedContract = EngineeringContractSchema.parse(contract);
      const validatedPlan = ImplementationPlanSchema.parse(plan);
      const validatedVPlan = VerificationPlanSchema.parse(verificationPlan);
      const validatedVRun = VerificationRunResultSchema.parse(verificationRun);

      const diagnoses = await failureDiagnoser.execute({
        contract: validatedContract,
        implementationPlan: validatedPlan,
        repositoryContext: context || {
          repositoryPath: validatedPlan.repositoryPath,
          relevantFiles: [],
          relevantDirectories: [],
          relevantManifests: [],
          probableEntryPoints: [],
          existingTests: [],
          implementationObservations: [],
          unresolvedQuestions: [],
        },
        verificationPlan: validatedVPlan,
        verificationRun: validatedVRun,
        diffReport,
      });

      let repairPlan = undefined;
      const repairableDiagnoses = diagnoses.filter(
        (d) => d.isRepairable && !d.requiresArchitectureReview
      );
      if (repairableDiagnoses.length > 0) {
        repairPlan = await repairPlanCompiler.execute({
          diagnoses: repairableDiagnoses,
          contract: validatedContract,
          context: context || {
            repositoryPath: validatedPlan.repositoryPath,
            relevantFiles: [],
            relevantDirectories: [],
            relevantManifests: [],
            probableEntryPoints: [],
            existingTests: [],
            implementationObservations: [],
            unresolvedQuestions: [],
          },
          implementationPlan: validatedPlan,
          diffReport,
        });
      }

      if (runId) {
        runStore.update(runId, { state: 'REPAIR_PENDING' });
        try {
          const diagContent = JSON.stringify({ diagnoses, repairPlan }, null, 2);
          const artRes = artifactStorage.storeArtifact(runId, 'repair-diagnosis.json', diagContent);
          artifactStore.create({
            id: `art_diag_${Date.now()}`,
            runId,
            type: 'EXECUTION_EVIDENCE',
            relativePath: artRes.relativePath,
            contentHash: artRes.contentHash,
            sizeBytes: artRes.sizeBytes,
            createdAt: new Date().toISOString(),
          });
        } catch {
          // ignore artifact persistence errors if storage fails
        }
      }

      return res.json({
        success: true,
        runId,
        diagnoses,
        repairPlan,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to diagnose verification failure.',
      });
    }
  });

  // Execute Repair Loop (requires explicit user approval)
  app.post('/api/repair/execute', async (req: Request, res: Response) => {
    try {
      const {
        contract,
        plan,
        context,
        verificationPlan,
        verificationRun,
        diagnoses,
        repairPlan,
        maxAttempts,
        agentId,
        runId,
        approved,
      } = req.body;

      if (!approved) {
        return res.status(403).json({
          success: false,
          error:
            'Execution rejected: Explicit user approval is strictly required before starting autonomous repair.',
        });
      }

      if (!contract || !plan || !verificationRun) {
        return res.status(400).json({ error: 'Contract, plan, and verificationRun are required.' });
      }

      const validatedContract = EngineeringContractSchema.parse(contract);
      const validatedPlan = ImplementationPlanSchema.parse(plan);
      const validatedVPlan = VerificationPlanSchema.parse(verificationPlan);
      const validatedVRun = VerificationRunResultSchema.parse(verificationRun);

      const worktreeSession = runId ? activeWorktreeSessions.get(runId) : undefined;

      if (runId) {
        runStore.update(runId, { state: 'REPAIRING' });
      }

      const repairResult = await repairLoopUseCase.execute({
        contract: validatedContract,
        implementationPlan: validatedPlan,
        verificationPlan: validatedVPlan,
        initialVerificationRun: validatedVRun,
        context: context || {
          repositoryPath: validatedPlan.repositoryPath,
          relevantFiles: [],
          relevantDirectories: [],
          relevantManifests: [],
          probableEntryPoints: [],
          existingTests: [],
          implementationObservations: [],
          unresolvedQuestions: [],
        },
        worktreeSession,
        diagnoses,
        repairPlan,
        maxAttempts: typeof maxAttempts === 'number' ? maxAttempts : 3,
        agentId,
        cleanupWorktreeOnFinish: true,
      });

      if (runId) {
        activeWorktreeSessions.delete(runId);
        const sessions = sessionStore.findByRunId(runId);
        const latestSession = sessions[0];
        const isRepaired = repairResult.isRepaired || repairResult.status === 'REPAIRED';
        const finalStatus = isRepaired ? 'COMPLETED' : 'FAILED';
        const now = new Date().toISOString();

        if (latestSession) {
          sessionStore.update(latestSession.id, {
            repairRunResult: repairResult,
            verificationRunResult: repairResult.finalVerificationResult || latestSession.verificationRunResult,
            changedFiles: Array.from(
              new Set([
                ...latestSession.changedFiles,
                ...repairResult.attempts.flatMap((a) => a.changedFiles),
              ])
            ),
            status: finalStatus,
            completedAt: now,
          });
        }

        // Persist repair diff artifact if available
        const lastAttempt = repairResult.attempts[repairResult.attempts.length - 1];
        if (lastAttempt?.diffSummary) {
          const artifactRes = artifactStorage.storeArtifact(
            runId,
            'repair.diff',
            lastAttempt.diffSummary
          );
          artifactStore.create({
            id: `art_repair_${Date.now()}`,
            runId,
            sessionId: latestSession?.id,
            type: 'DIFF_PATCH',
            relativePath: artifactRes.relativePath,
            contentHash: artifactRes.contentHash,
            sizeBytes: artifactRes.sizeBytes,
            createdAt: now,
          });
        }

        // Update run state to agree with persisted repair outcome
        if (isRepaired) {
          runStore.updateState(runId, 'VERIFIED');
        } else if (
          repairResult.status === 'ARCHITECTURE_REVIEW_REQUIRED' ||
          repairResult.outcome === 'ARCHITECTURE_REVIEW_REQUIRED'
        ) {
          runStore.updateState(runId, 'ESCALATED');
        } else if (
          repairResult.outcome === 'MAX_ATTEMPTS_REACHED' ||
          repairResult.outcome === 'NEEDS_HUMAN_REVIEW'
        ) {
          runStore.updateState(runId, 'VERIFICATION_FAILED');
        } else {
          runStore.updateState(runId, 'FAILED');
        }
      }

      return res.json({
        success: true,
        repairResult,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Repair loop execution failed.',
      });
    }
  });

  // Serve static assets in production build if dist folder exists
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        res.status(200).send('ArchitectAI Server is running. In dev mode, open the Vite client.');
      }
    });
  });

  return app;
}
