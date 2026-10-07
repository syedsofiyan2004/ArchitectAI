import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import type { Server } from 'node:http';
import { createServer } from '../../apps/web/server/server.js';
import { createDemoFixtureRepo, FixtureRepo } from '../../packages/application/src/test-helpers/fixture-repos.js';

describe('Milestone 6: Productization & Persistent Engineering Workspace End-to-End Test', () => {
  let tempDir: string;
  let dbPath: string;
  let artifactsDir: string;
  let server: Server;
  let baseUrl: string;
  let browser: Browser | null = null;
  let hasChromium = false;
  let fixtureRepo: FixtureRepo;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architectai-e2e-m6-'));
    dbPath = path.join(tempDir, 'product.db');
    artifactsDir = path.join(tempDir, 'artifacts');

    // Create Git fixture repository
    fixtureRepo = createDemoFixtureRepo('rate-limiter');

    // Start Server instance with persistent database
    const app = await createServer({ dbPath, artifactsDir });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    try {
      browser = await chromium.launch();
      hasChromium = true;
    } catch (err) {
      console.warn('[E2E Test] Chromium launch failed, skipping browser execution:', err);
      hasChromium = false;
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (fixtureRepo) {
      fixtureRepo.cleanup();
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('runs complete persistent lifecycle across browser reload and server restart', async () => {
    if (!hasChromium || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 1. Start fresh: Navigate to dashboard
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    expect(await page.textContent('.hero-title')).toContain('Engineering intelligence for AI-built software');

    // 2. Create Project via API
    const createProjectRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'API Gateway Service',
        description: 'Persistent API Gateway with rate limiting',
      }),
    });
    expect(createProjectRes.status).toBe(201);
    const { project } = await createProjectRes.json();
    expect(project.id).toBeDefined();

    // 3. Register fixture Git repository
    const regRepoRes = await fetch(`${baseUrl}/api/projects/${project.id}/repository`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoPath: fixtureRepo.repoPath,
      }),
    });
    expect(regRepoRes.status).toBe(200);
    const { repository } = await regRepoRes.json();
    expect(repository.canonicalLocalPath).toBe(path.resolve(fixtureRepo.repoPath));

    // 4. Start Analysis under the project
    const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
        declaredTechStack: ['Redis', 'Node.js'],
        context: { database: 'Redis', scale: '10,000 active users' },
      }),
    });
    expect(runRes.status).toBe(201);
    const runData = await runRes.json();
    const runId = runData.runId;
    expect(runData.state).toBe('ANALYSIS_COMPLETE');
    expect(runData.contract).toBeDefined();

    // 5. Navigate to the run URL in browser
    await page.goto(`${baseUrl}/runs/${runId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.review-hero', { timeout: 10000 });

    const reviewTitle = await page.textContent('.review-title');
    expect(reviewTitle).toMatch(/\d+ engineering risk/i);

    // 6. Reload browser and verify run and contract remain present
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.finding-row-card', { timeout: 15000 });
    expect(await page.textContent('.review-title')).toMatch(/\d+ engineering risk/i);

    // 7. Walk through Architecture, Verification, Implementation
    await page.waitForSelector('button:has-text("Continue to Architecture")', { timeout: 10000 });
    await page.click('button:has-text("Continue to Architecture")');
    await page.waitForURL(`**/runs/${runId}/architecture`, { timeout: 10000 });

    await page.waitForSelector('button:has-text("Continue to Verification")', { timeout: 10000 });
    await page.click('button:has-text("Continue to Verification")');
    await page.waitForURL(`**/runs/${runId}/verification`, { timeout: 10000 });

    await page.waitForSelector('button:has-text("Prepare Implementation")', { timeout: 10000 });
    await page.click('button:has-text("Prepare Implementation")');
    await page.waitForURL(`**/runs/${runId}/implementation`, { timeout: 10000 });

    // 8. Compile Implementation Plan on server
    const compilePlanRes = await fetch(`${baseUrl}/api/plan/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract: runData.contract,
        projectId: project.id,
        runId,
      }),
    });
    expect(compilePlanRes.status).toBe(200);
    const { plan } = await compilePlanRes.json();
    expect(plan.id).toBeDefined();

    // 9. Execute Implementation with explicit approval
    const execRes = await fetch(`${baseUrl}/api/plan/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        agentId: 'deterministic-agent',
        approved: true,
        contract: runData.contract,
        runId,
        projectId: project.id,
      }),
    });
    expect(execRes.status).toBe(200);
    const execData = await execRes.json();
    expect(execData.success).toBe(true);
    expect(execData.sessionId).toBeDefined();

    // 10. Verify that diff patch artifact was persisted to bounded storage
    const artifactRes = await fetch(`${baseUrl}/api/runs/${runId}/artifacts`);
    const { artifacts } = await artifactRes.json();
    expect(artifacts.length).toBeGreaterThanOrEqual(1);

    // =======================================================
    // 11. RESTART SERVER DEMONSTRATION
    // Stop server and launch a brand new Server instance on same SQLite db
    // =======================================================
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const newApp = await createServer({ dbPath, artifactsDir });
    await new Promise<void>((resolve) => {
      server = newApp.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    // 12. Reopen browser on new server URL and verify everything survived
    const checkRunRes = await fetch(`${baseUrl}/api/runs/${runId}`);
    expect(checkRunRes.status).toBe(200);
    const checkRunData = await checkRunRes.json();

    await page.goto(`${baseUrl}/runs/${runId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.finding-row-card', { timeout: 15000 });
    expect(await page.textContent('.review-title')).toMatch(/\d+ engineering risk/i);
    expect(checkRunData.run.id).toBe(runId);
    expect(checkRunData.run.projectId).toBe(project.id);
    expect(checkRunData.run.contract.id).toBe(runData.contract.id);
    expect(checkRunData.sessions.length).toBeGreaterThanOrEqual(1);
    expect(checkRunData.artifacts.length).toBeGreaterThanOrEqual(1);

    // Verify Project on restarted server
    const checkProjRes = await fetch(`${baseUrl}/api/projects/${project.id}`);
    expect(checkProjRes.status).toBe(200);
    const checkProjData = await checkProjRes.json();
    expect(checkProjData.project.name).toBe('API Gateway Service');

    await page.close();
    await context.close();
  });
});
