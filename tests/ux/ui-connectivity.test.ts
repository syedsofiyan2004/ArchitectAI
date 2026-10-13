import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import type { Server } from 'node:http';
import { createServer } from '../../apps/web/server/server.js';
import { createDemoFixtureRepo, FixtureRepo } from '../../packages/application/src/test-helpers/fixture-repos.js';

describe('ArchitectAI Milestone 8: UI Control Connectivity & Lifecycle Suite', () => {
  let tempDir: string;
  let dbPath: string;
  let artifactsDir: string;
  let server: Server;
  let baseUrl: string;
  let browser: Browser | null = null;
  let hasChromium = false;
  let fixtureRepo: FixtureRepo;

  beforeAll(async () => {
    const distIndex = path.resolve(__dirname, '../../apps/web/dist/index.html');
    if (!fs.existsSync(distIndex)) {
      execSync('pnpm run web:build', { cwd: path.resolve(__dirname, '../..'), stdio: 'inherit' });
    }

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architectai-uiconnect-'));
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
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      hasChromium = true;
    } catch (err) {
      if (process.env.CI) {
        throw new Error(
          `[CI Failure] Playwright Chromium launch failed in CI: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      console.warn('[UI Connectivity Test] Chromium launch failed, skipping browser execution:', err);
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

  function ensureBrowser(): boolean {
    if (!hasChromium || !browser) {
      if (process.env.CI) {
        throw new Error('[CI Failure] Chromium is required in CI.');
      }
      return false;
    }
    return true;
  }

  it('proves complete UI control connectivity across project creation, decisions, build, repair, and artifacts', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.log('[PAGE ERROR]', err));
    page.on('console', (msg) => console.log('[PAGE CONSOLE]', msg.type(), msg.text()));
    page.on('requestfailed', (req) => console.log('[REQ FAILED]', req.url(), req.failure()));
    page.on('response', async (res) => {
      if (res.status() >= 400) {
        try {
          const body = await res.text();
          console.log('[PAGE RES ERROR]', res.status(), res.url(), body);
        } catch {
          console.log('[PAGE RES ERROR]', res.status(), res.url());
        }
      }
      if (res.url().includes('refresh-architecture')) {
        console.log('[REFRESH-ARCH RES STATUS]', res.status());
      }
    });

    // 1. Navigate to home
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    expect(await page.textContent('.hero-title')).toContain('Engineering intelligence for AI-built software');

    // 2. Item 1: Create Project "Payments" with registered repository via REAL Modal
    await page.waitForSelector('.add-project-btn', { timeout: 10000 });
    await page.click('.add-project-btn');

    await page.waitForSelector('.project-modal-box', { timeout: 10000 });
    await page.fill('#project-name-input', 'Payments');
    await page.fill('#project-desc-input', 'Payment gateway and rate limiter');
    await page.fill('#project-repo-input', fixtureRepo.repoPath);

    await page.click('button:has-text("Create Project")');
    await page.waitForSelector('.project-modal-box', { state: 'hidden', timeout: 10000 });

    // Assert via server API that "Payments" was created and repository belongs to it
    const projectsRes = await fetch(`${baseUrl}/api/projects`);
    const projectsData = await projectsRes.json();
    const paymentsProj = projectsData.projects.find((p: any) => p.name === 'Payments');
    expect(paymentsProj).toBeDefined();

    const repoRes = await fetch(`${baseUrl}/api/projects/${paymentsProj.id}/repository`);
    const repoData = await repoRes.json();
    expect(repoData.success).toBe(true);
    expect(repoData.repository).toBeDefined();
    expect(repoData.repository.projectId).toBe(paymentsProj.id);
    expect(repoData.repository.canonicalLocalPath).toBe(path.resolve(fixtureRepo.repoPath));

    // 3. Create a new architecture analysis
    await page.waitForSelector('a[href="/new"]', { timeout: 10000 });
    await page.click('a[href="/new"]');
    await page.waitForURL('**/new', { timeout: 10000 });

    await page.waitForSelector('#intent-input', { timeout: 10000 });
    await page.fill('#intent-input', 'Limit each authenticated user to 100 API requests per minute.');

    await page.click('button:has-text("Analyze Architecture")');

    // 4. Wait for analysis to complete and navigate to review page
    await page.waitForURL(/\/runs\/[^\/]+$/, { timeout: 20000 });
    const runUrl = page.url();
    const runIdMatch = runUrl.match(/\/runs\/([^\/]+)/);
    expect(runIdMatch).not.toBeNull();
    const runId = runIdMatch![1];

    // Assert run is in SQLite
    const runDbRes = await fetch(`${baseUrl}/api/runs/${runId}`);
    const runDbData = await runDbRes.json();
    expect(runDbData.success).toBe(true);
    expect(runDbData.run.contract).toBeDefined();

    // 5. Item 3: Answer decision in UserDecisionsView and refresh architecture
    await page.waitForSelector('.user-decisions-section', { timeout: 15000 });
    const optionBtn = await page.waitForSelector('.question-card .option-btn', { timeout: 10000 });
    expect(optionBtn).not.toBeNull();
    await optionBtn.click();

    // Verify "Recorded — architecture needs refresh" indicator appears
    await page.waitForSelector('text="Recorded — architecture needs refresh"', { timeout: 10000 });

    // Click "Apply Decisions & Refresh Architecture"
    await page.click('button:has-text("Apply Decisions & Refresh Architecture")');
    await page.waitForSelector('text="Architecture updated with your decisions. Ready to build."', { timeout: 15000 });

    // Verify contract revision in backend incremented
    const refreshedRunRes = await fetch(`${baseUrl}/api/runs/${runId}`);
    const refreshedRunData = await refreshedRunRes.json();
    expect(refreshedRunData.run.contractRevision).toBeGreaterThanOrEqual(2);

    // 6. Item 4 & 5: Navigate to Implementation Workspace
    await page.waitForSelector('a.step-link:has-text("4. Implement")', { timeout: 10000 });
    await page.click('a.step-link:has-text("4. Implement")');
    await page.waitForURL(`**/runs/${runId}/implementation`, { timeout: 10000 });

    // Verify NO editable repo input exists
    const editableRepoInput = await page.$('input#repo-input');
    expect(editableRepoInput).toBeNull();

    // Verify read-only repository status shows "Connected"
    const connectedBadge = await page.waitForSelector('text="Connected"', { timeout: 10000 });
    expect(connectedBadge).not.toBeNull();

    // Prepare Implementation Plan
    const prepareBtn = await page.waitForSelector('button:has-text("Prepare Implementation Plan")', { timeout: 10000 });
    await prepareBtn.click();

    // 7. Verify BuildPlanView is the canonical presentation
    await page.waitForSelector('.canonical-build-plan-section', { timeout: 15000 });
    await page.waitForSelector('.build-plan-title:has-text("Implementation Tasks")', { timeout: 10000 });

    // Item 6: Select vulnerable agent from real agent dropdown to provoke verification failure
    await page.waitForSelector('#plan-agent-select', { timeout: 10000 });
    await page.selectOption('#plan-agent-select', 'vulnerable-agent');

    // Click Start Build -> opens approval modal
    await page.click('button.start-build-cta');
    await page.waitForSelector('.approval-modal', { timeout: 10000 });

    // Check safety acknowledgement checkbox
    await page.click('.approval-modal input[type="checkbox"]');

    // Confirm Start Build in modal
    await page.click('.approval-modal button:has-text("Start Build")');

    // 8. Item 7: Observe real BuildTimeline stages
    await page.waitForSelector('.build-timeline-panel', { timeout: 10000 });
    expect(await page.textContent('.timeline-heading')).toContain('Building in isolated workspace');

    // Wait for execution to finish (status transitions to VERIFICATION_FAILED)
    await page.waitForSelector('text="Verification check failed"', { timeout: 35000 });

    // 9. Item 8 & 9: Navigate to Verification and execute real repair
    await page.click('button:has-text("Go to Verification & Fix")');
    await page.waitForURL(`**/runs/${runId}/verification`, { timeout: 10000 });

    await page.waitForSelector('.proof-status-card.failed-card', { timeout: 15000 });
    expect(await page.textContent('.proof-result-heading')).toContain('behavior that does not satisfy the architecture');

    // Click "Prepare Fix"
    await page.click('button:has-text("Prepare Fix")');
    await page.waitForSelector('.repair-proposal-card', { timeout: 15000 });
    expect(await page.textContent('.repair-title')).toContain('ArchitectAI can fix this');

    // Click "Approve Fix" -> executes real repair loop in worktree
    await page.click('button:has-text("Approve Fix")');

    // Wait for repair loop and re-verification to succeed
    await page.waitForSelector('.proof-status-card.verified-card', { timeout: 45000 });
    const verifiedHeading = await page.textContent('.proof-result-heading');
    expect(verifiedHeading).toContain('Repaired and independently verified');

    // 10. Item 10: Open Changes page and inspect unified diff
    await page.click('button:has-text("View Changes")');
    await page.waitForURL(`**/runs/${runId}/changes`, { timeout: 10000 });

    await page.waitForSelector('.diff-content-section', { timeout: 15000 });
    const diffText = await page.textContent('.diff-content-section');
    expect(diffText).toContain('diff --git');

    // 11. Assert diff survives page reload
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.diff-content-section', { timeout: 15000 });
    const diffAfterReload = await page.textContent('.diff-content-section');
    expect(diffAfterReload).toContain('diff --git');

    // 12. Assert diff survives backend server restart
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

    await page.goto(`${baseUrl}/runs/${runId}/changes`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.diff-content-section', { timeout: 15000 });
    const diffAfterRestart = await page.textContent('.diff-content-section');
    expect(diffAfterRestart).toContain('diff --git');

    await page.close();
  }, 120000);

  it('proves Settings modal loads real backend capabilities, tests provider, and consolidates status', async () => {
    if (!ensureBrowser() || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Open Settings from Sidebar
    await page.waitForSelector('.sidebar-settings-btn', { timeout: 10000 });
    await page.click('.sidebar-settings-btn');

    await page.waitForSelector('.settings-modal-box', { timeout: 10000 });

    // Test Provider Tab
    await page.click('button[role="tab"]:has-text("AI Provider")');
    await page.waitForSelector('button:has-text("Test Connection")', { timeout: 10000 });
    await page.click('button:has-text("Test Connection")');

    await page.waitForSelector('.test-result-msg', { timeout: 10000 });
    const testMsg = await page.textContent('.test-result-msg');
    expect(testMsg).toContain('operational');

    // Knowledge Tab loads real counts
    await page.click('button[role="tab"]:has-text("Knowledge")');
    const knowSection = await page.textContent('.settings-tab-panel');
    expect(knowSection).toContain('Curated Primitives');
    expect(knowSection).toContain('items indexed');

    // Advanced Tab contains real git version and diagnostics
    await page.click('button[role="tab"]:has-text("Advanced")');
    const advSection = await page.textContent('.settings-tab-panel');
    expect(advSection).toContain('Git Isolation Engine');
    expect(advSection).toContain('Verification Runtime');

    await page.close();
  }, 30000);
});
