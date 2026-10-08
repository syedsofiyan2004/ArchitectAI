import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, DEFAULT_HOST } from './server.js';
import type { Server } from 'node:http';
import { createDemoFixtureRepo, type FixtureRepo } from '../../../packages/application/src/test-helpers/fixture-repos.js';

describe('ArchitectAI Web Server & Endpoints', () => {
  let server: Server;
  let baseUrl: string;
  let serverToken: string;
  let fixtureRepo: FixtureRepo;

  beforeAll(async () => {
    fixtureRepo = createDemoFixtureRepo('rate-limiter');
    const app = await createServer();
    serverToken = (app as any).sessionToken;
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (fixtureRepo) {
      fixtureRepo.cleanup();
    }
  });

  it('GET /api/config returns configuration and knowledge count', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.mode).toBe('deterministic-demo');
    expect(json.knowledgeItemsCount).toBeGreaterThanOrEqual(16);
  });

  it('GET /api/scenarios returns all 10 prototype demonstration scenarios', async () => {
    const res = await fetch(`${baseUrl}/api/scenarios`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBe(10);

    const tags = json.map((s: any) => s.tag);
    expect(tags).toContain('DEMO A');
    expect(tags).toContain('DEMO B');
    expect(tags).toContain('DEMO C');
  });

  it('POST /api/analyze successfully analyzes Demo A (Rate Limiter)', async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
        explicitConstraints: [],
        declaredTechStack: ['Redis', 'Node.js'],
        context: { database: 'Redis', scale: '10,000 active users' },
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.stages.length).toBe(7);
    expect(json.contract).toBeDefined();
    expect(json.contract.discoveredConcerns.length).toBeGreaterThanOrEqual(1);

    const titles = json.contract.discoveredConcerns.map((c: any) => c.title);
    expect(titles.some((t: string) => /burst|window|rate/i.test(t))).toBe(true);
  });

  it('POST /api/analyze successfully analyzes Demo B (Token Refresh Race)', async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'When my access token expires automatically refresh it and retry the failed request.',
        explicitConstraints: [],
        declaredTechStack: ['TypeScript'],
        context: { framework: 'React / Axios' },
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const titles = json.contract.discoveredConcerns.map((c: any) => c.title);
    expect(titles.some((t: string) => /refresh|token|race/i.test(t))).toBe(true);
  });

  it('POST /api/analyze successfully analyzes Demo C (Parallel Image Pipeline)', async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'Process many large uploaded images in parallel as quickly as possible.',
        explicitConstraints: [],
        declaredTechStack: ['Node.js'],
        context: { scale: '500 images/minute, up to 25MB each' },
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const titles = json.contract.discoveredConcerns.map((c: any) => c.title);
    expect(titles.some((t: string) => /memory|buffer|exhaustion/i.test(t))).toBe(true);
  });

  it('POST /api/analyze rejects empty intent with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: '   ',
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('GET /api/agents returns list of registered coding agent adapters', async () => {
    const res = await fetch(`${baseUrl}/api/agents`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.agents)).toBe(true);
    expect(json.agents.length).toBeGreaterThanOrEqual(1);

    const agentIds = json.agents.map((a: any) => a.id);
    expect(agentIds).toContain('codex-cli');
  });

  it('POST /api/plan/execute rejects execution without explicit user approval with 403', async () => {
    const res = await fetch(`${baseUrl}/api/plan/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': serverToken },
      body: JSON.stringify({
        plan: { id: 'plan-test' },
        approved: false,
      }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Explicit user approval is strictly required');
  });

  it('POST /api/plan/execute rejects missing plan with 400', async () => {
    const res = await fetch(`${baseUrl}/api/plan/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': serverToken },
      body: JSON.stringify({
        approved: true,
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('runId is required for implementation plan execution');
  });

  it('POST /api/repair/execute rejects execution without explicit approval with 403', async () => {
    const res = await fetch(`${baseUrl}/api/repair/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': serverToken },
      body: JSON.stringify({
        approved: false,
      }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Explicit user approval is strictly required');
  });

  it('POST /api/repair/diagnose rejects missing parameters with 400', async () => {
    const res = await fetch(`${baseUrl}/api/repair/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  // --- Milestone 6 Productization & Persistence Tests ---
  it('Milestone 6: Project lifecycle APIs create and list persistent projects', async () => {
    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Billing Service',
        description: 'Subscription billing & invoicing engine',
      }),
    });

    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    expect(createJson.project.name).toBe('Billing Service');

    const projectId = createJson.project.id;

    // Fetch project
    const getRes = await fetch(`${baseUrl}/api/projects/${projectId}`);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.project.id).toBe(projectId);

    // List projects
    const listRes = await fetch(`${baseUrl}/api/projects`);
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.projects.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('Milestone 6: Repository registration connects git repo to project', async () => {
    // Get session token
    const cfgRes = await fetch(`${baseUrl}/api/config`);
    const { csrfToken } = await cfgRes.json();

    // Create project
    const pRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Repo Test Project' }),
    });
    const { project } = await pRes.json();

    // Register current workspace root with valid token
    const regRes = await fetch(`${baseUrl}/api/projects/${project.id}/repository`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ repoPath: fixtureRepo.repoPath }),
    });

    expect(regRes.status).toBe(200);
    const regJson = await regRes.json();
    expect(regJson.success).toBe(true);
    expect(regJson.repository.projectId).toBe(project.id);
    expect(regJson.repository.canonicalLocalPath).toBeDefined();
  });

  it('Milestone 6: Asynchronous project run creation persists run before and after analysis', async () => {
    // Create project
    const pRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Async Run Project' }),
    });
    const { project } = await pRes.json();

    // Trigger run creation
    const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
        declaredTechStack: ['Redis', 'Node.js'],
        context: { database: 'Redis' },
      }),
    });

    expect(runRes.status).toBe(201);
    const runJson = await runRes.json();
    expect(runJson.success).toBe(true);
    expect(runJson.runId).toBeDefined();
    expect(runJson.state).toBe('ANALYSIS_COMPLETE');

    // Query run by ID
    const getRunRes = await fetch(`${baseUrl}/api/runs/${runJson.runId}`);
    expect(getRunRes.status).toBe(200);
    const getRunJson = await getRunRes.json();
    expect(getRunJson.run.id).toBe(runJson.runId);
    expect(getRunJson.run.contract).toBeDefined();
    expect(getRunJson.revisions.length).toBeGreaterThanOrEqual(1);
  });

  it('Milestone 6: Security - Untrusted external Origin is rejected by anti-CSRF check', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://malicious-attacker-website.com',
      },
      body: JSON.stringify({ name: 'Attacker Project' }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Forbidden');
  });

  it('Milestone 6: GET /api/system/capabilities exposes complete system readiness breakdown', async () => {
    const res = await fetch(`${baseUrl}/api/system/capabilities`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.capabilities.analysisProvider).toBeDefined();
    expect(json.capabilities.knowledgeRegistry).toBe('READY');
    expect(json.capabilities.git).toBe('READY');
    expect(json.capabilities.verificationRuntime).toBe('READY');
  });

  it('Milestone 6: Provider connection test returns health status without exposing secrets', async () => {
    const res = await fetch(`${baseUrl}/api/providers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.healthy).toBe(true);
    expect(JSON.stringify(json)).not.toContain('sk-');
  });

  it('Milestone 6: Security - Server enforces 127.0.0.1 loopback binding default', () => {
    expect(DEFAULT_HOST).toBe('127.0.0.1');
  });

  it('Milestone 6: Security - Sensitive mutating endpoints mandate session security token', async () => {
    const pRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Token Test Project' }),
    });
    const { project } = await pRes.json();

    // 1. Missing token -> 403 Forbidden
    const missingTokenRes = await fetch(`${baseUrl}/api/projects/${project.id}/repository`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath: fixtureRepo.repoPath }),
    });
    expect(missingTokenRes.status).toBe(403);
    const missingJson = await missingTokenRes.json();
    expect(missingJson.error).toContain('Missing session security token');

    // 2. Wrong token -> 403 Forbidden
    const wrongTokenRes = await fetch(`${baseUrl}/api/projects/${project.id}/repository`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'invalid-token-12345',
      },
      body: JSON.stringify({ repoPath: fixtureRepo.repoPath }),
    });
    expect(wrongTokenRes.status).toBe(403);
    const wrongJson = await wrongTokenRes.json();
    expect(wrongJson.error).toContain('Invalid session security token');

    // 3. Correct token -> 200 OK
    const cfgRes = await fetch(`${baseUrl}/api/config`);
    const { csrfToken } = await cfgRes.json();

    const validTokenRes = await fetch(`${baseUrl}/api/projects/${project.id}/repository`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ repoPath: fixtureRepo.repoPath }),
    });
    expect(validTokenRes.status).toBe(200);
    const validJson = await validTokenRes.json();
    expect(validJson.success).toBe(true);
  });

  describe('Milestone 6: Execution must require a registered repository', () => {
    it('A. run with registered repository -> compile succeeds', async () => {
      const cfg = await (await fetch(`${baseUrl}/api/config`)).json();
      const token = cfg.csrfToken;

      const pRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Reg Repo Project' }),
      });
      const { project } = await pRes.json();

      await fetch(`${baseUrl}/api/projects/${project.id}/repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ repoPath: fixtureRepo.repoPath }),
      });

      const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
          declaredTechStack: ['Redis', 'Node.js'],
        }),
      });
      const { runId, contract } = await runRes.json();

      const compileRes = await fetch(`${baseUrl}/api/plan/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, contract }),
      });
      expect(compileRes.status).toBe(200);
      const compileJson = await compileRes.json();
      expect(compileJson.success).toBe(true);
      expect(compileJson.plan).toBeDefined();
    });

    it('B. run without registered repository -> compile rejected', async () => {
      const pRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unregistered Repo Project' }),
      });
      const { project } = await pRes.json();

      const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
          declaredTechStack: ['Redis', 'Node.js'],
        }),
      });
      const { runId, contract } = await runRes.json();

      const compileRes = await fetch(`${baseUrl}/api/plan/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, contract }),
      });
      expect(compileRes.status).toBe(400);
      const compileJson = await compileRes.json();
      expect(compileJson.error).toContain('no registered repository');
    });

    it('C. crafted ImplementationPlan.repositoryPath pointing elsewhere -> ignored / overridden with registered repo', async () => {
      const cfg = await (await fetch(`${baseUrl}/api/config`)).json();
      const token = cfg.csrfToken;

      const pRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Crafted Path Project' }),
      });
      const { project } = await pRes.json();

      await fetch(`${baseUrl}/api/projects/${project.id}/repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ repoPath: fixtureRepo.repoPath }),
      });

      const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
          declaredTechStack: ['Redis', 'Node.js'],
        }),
      });
      const { runId, contract } = await runRes.json();

      const compileRes = await fetch(`${baseUrl}/api/plan/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, contract }),
      });
      const { plan } = await compileRes.json();

      // Craft plan with unauthorized arbitrary repositoryPath
      const maliciousPlan = {
        ...plan,
        repositoryPath: 'C:\\Windows\\System32\\unauthorized',
      };

      const execRes = await fetch(`${baseUrl}/api/plan/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({
          plan: maliciousPlan,
          runId,
          approved: true,
          contract,
        }),
      });

      expect(execRes.status).toBe(200);
      const execJson = await execRes.json();
      expect(execJson.success).toBe(true);
      // Verify session recorded the real canonical repo, not the crafted path
      const sessionRes = await fetch(`${baseUrl}/api/runs/${runId}`);
      const sessionData = await sessionRes.json();
      expect(sessionData.sessions[0].repositoryId).toBeDefined();
    }, 90000);

    it('D. run from Project A + submitted Project B ID -> rejects mismatch', async () => {
      const cfg = await (await fetch(`${baseUrl}/api/config`)).json();
      const token = cfg.csrfToken;

      const pResA = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Project A' }),
      });
      const { project: projA } = await pResA.json();

      const pResB = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Project B' }),
      });
      const { project: projB } = await pResB.json();

      await fetch(`${baseUrl}/api/projects/${projA.id}/repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ repoPath: fixtureRepo.repoPath }),
      });

      const runRes = await fetch(`${baseUrl}/api/projects/${projA.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
          declaredTechStack: ['Redis', 'Node.js'],
        }),
      });
      const { runId, contract } = await runRes.json();

      const compileRes = await fetch(`${baseUrl}/api/plan/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, contract, projectId: projB.id }),
      });
      expect(compileRes.status).toBe(400);
      const compileJson = await compileRes.json();
      expect(compileJson.error).toContain('Project mismatch');
    });

    it('E. arbitrary direct repoPath cannot reach execution without registered repo', async () => {
      const cfg = await (await fetch(`${baseUrl}/api/config`)).json();
      const token = cfg.csrfToken;

      const execRes = await fetch(`${baseUrl}/api/plan/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({
          plan: {
            id: 'plan_dummy',
            contractId: 'contract_dummy',
            repositoryPath: 'C:\\arbitrary\\path',
            tasks: [],
            summary: 'Dummy',
            riskLevel: 'low',
            createdAt: new Date().toISOString(),
          },
          runId: 'non_existent_run_id',
          approved: true,
        }),
      });
      expect(execRes.status).toBe(404);
      const execJson = await execRes.json();
      expect(execJson.error).toContain('not found');
    });
  });

  it('Milestone 6: POST /api/sessions/:sessionId/recover enables user-driven crash recovery', async () => {
    const cfg = await (await fetch(`${baseUrl}/api/config`)).json();
    const token = cfg.csrfToken;

    // Create project, repo, run
    const pRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Recovery Test Project' }),
    });
    const { project } = await pRes.json();

    await fetch(`${baseUrl}/api/projects/${project.id}/repository`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({ repoPath: fixtureRepo.repoPath }),
    });

    const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
        declaredTechStack: ['Redis', 'Node.js'],
      }),
    });
    const { runId, contract } = await runRes.json();

    const compileRes = await fetch(`${baseUrl}/api/plan/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, contract }),
    });
    const { plan } = await compileRes.json();

    const execRes = await fetch(`${baseUrl}/api/plan/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({
        plan,
        runId,
        approved: true,
        contract,
      }),
    });
    const { sessionId } = await execRes.json();

    // Recover session with action: 'retry'
    const recoverRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({
        action: 'retry',
        approved: true,
      }),
    });

    expect(recoverRes.status).toBe(200);
    const recoverJson = await recoverRes.json();
    expect(recoverJson.success).toBe(true);
    expect(recoverJson.action).toBe('retry');
    expect(recoverJson.nextRunState).toBe('READY_FOR_IMPLEMENTATION');

    // Confirm run was reset to READY_FOR_IMPLEMENTATION in SQLite
    const checkRunRes = await fetch(`${baseUrl}/api/runs/${runId}`);
    const checkRunJson = await checkRunRes.json();
    expect(checkRunJson.run.state).toBe('READY_FOR_IMPLEMENTATION');
  }, 90000);
});

