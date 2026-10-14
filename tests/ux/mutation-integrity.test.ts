import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import type { Server } from 'node:http';
import { createServer } from '../../apps/web/server/server.js';
import { createDemoFixtureRepo, FixtureRepo } from '../../packages/application/src/test-helpers/fixture-repos.js';

describe('ArchitectAI Milestone 8: UI Mutation Integrity & Edge Case Suite', () => {
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

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architectai-mutation-integrity-'));
    dbPath = path.join(tempDir, 'product.db');
    artifactsDir = path.join(tempDir, 'artifacts');

    fixtureRepo = createDemoFixtureRepo('rate-limiter');

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
      console.warn('[Mutation Integrity Test] Chromium launch failed, skipping:', err);
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

  // 1. decision persistence delayed -> refresh waits
  it('decision persistence delayed -> refresh waits and refresh cannot execute using stale answers', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Create an initial project and run
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.add-project-btn', { timeout: 10000 });
    await page.click('.add-project-btn');
    await page.waitForSelector('.project-modal-box', { timeout: 10000 });
    await page.fill('#project-name-input', 'Decision Delayed Project');
    await page.fill('#project-repo-input', fixtureRepo.repoPath);
    await page.click('button:has-text("Create Project")');
    await page.waitForSelector('.project-modal-box', { state: 'hidden', timeout: 10000 });

    // Submit intent
    await page.click('a[href="/new"]');
    await page.waitForURL('**/new', { timeout: 10000 });
    await page.waitForSelector('#intent-input', { timeout: 10000 });
    await page.fill('#intent-input', 'Limit each authenticated user to 100 API requests per minute.');
    await page.click('button:has-text("Analyze Architecture")');
    await page.waitForURL(/\/runs\/[^\/]+$/, { timeout: 20000 });

    // Wait for decisions section
    await page.waitForSelector('.user-decisions-section', { timeout: 15000 });

    let answerResolve: (() => void) | null = null;
    const answerPromise = new Promise<void>((resolve) => {
      answerResolve = resolve;
    });

    // Deliberately delay the /answers API response
    await page.route('**/api/runs/*/answers', async (route) => {
      await answerPromise;
      await route.continue();
    });

    // Wait for option buttons to render
    await page.waitForSelector('.option-btn', { timeout: 15000 });

    // Locate the second option in the decisions card
    const optionBtn = page.locator('.option-btn').nth(1);
    await optionBtn.click();

    // While /answers is delayed:
    // 1) Saving indicator must be shown and "Recorded" must NOT be shown
    await page.waitForSelector('.saving-answer-indicator:has-text("Saving decision...")', { timeout: 5000 });
    const hasRecordedDuringSave = await page.locator('.saved-answer-indicator:has-text("Recorded")').isVisible();
    expect(hasRecordedDuringSave).toBe(false);

    // 2) Architecture refresh button must be disabled
    const refreshBtn = page.locator('button:has-text("Apply Decisions & Refresh Architecture")');
    expect(await refreshBtn.isDisabled()).toBe(true);

    // Attempting to click refresh while disabled must NOT trigger refresh-architecture
    let refreshAttempted = false;
    await page.route('**/api/runs/*/refresh-architecture', async (route) => {
      refreshAttempted = true;
      await route.continue();
    });

    await refreshBtn.click({ force: true }).catch(() => {});
    expect(refreshAttempted).toBe(false);

    // Release the delayed answer response
    if (answerResolve) {
      (answerResolve as () => void)();
    }

    // Now persistence succeeds:
    // 1) UI updates to "Recorded — architecture needs refresh"
    await page.waitForSelector('.saved-answer-indicator:has-text("Recorded — architecture needs refresh")', {
      timeout: 10000,
    });

    // 2) Refresh button becomes enabled
    expect(await refreshBtn.isDisabled()).toBe(false);

    // 3) Clicking refresh now triggers refresh-architecture
    await refreshBtn.click();
    await page.waitForSelector('text="Architecture updated with your decisions. Ready to build."', { timeout: 15000 });
    expect(refreshAttempted).toBe(true);

    await context.close();
  });

  // 2. provider healthy:false -> UI shows failure
  it('provider healthy:false -> UI shows failure and never shows connection verified successfully', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Open Settings Modal from sidebar
    await page.waitForSelector('.sidebar-settings-btn', { timeout: 10000 });
    await page.click('.sidebar-settings-btn');
    await page.waitForSelector('.settings-modal-box', { timeout: 10000 });

    // Switch to Provider tab
    await page.click('button[role="tab"]:has-text("AI Provider")');
    await page.waitForSelector('button:has-text("Test Connection")', { timeout: 10000 });

    // Mock provider test returning success: true, healthy: false, error: '401'
    await page.route('**/api/providers/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          healthy: false,
          error: '401 Unauthorized: Invalid API key',
          diagnostic: 'Authentication failed against provider endpoint.',
        }),
      });
    });

    // Click "Test Connection"
    await page.click('button:has-text("Test Connection")');

    // UI must display failure and the error message
    await page.waitForSelector('.test-result-msg.text-danger', { timeout: 10000 });
    const resultMsg = await page.textContent('.test-result-msg');
    expect(resultMsg).toContain('401');

    // UI must NEVER display "verified successfully"
    const modalContent = await page.textContent('.settings-tab-panel');
    expect(modalContent).not.toContain('verified successfully');
    expect(modalContent).not.toContain('Provider connection verified');

    await context.close();
  });

  // 3. cancel API rejection -> UI does not show Cancelled
  it('cancel API rejection -> UI does not show Cancelled and shows actual error banner', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Create project & run
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.add-project-btn', { timeout: 10000 });
    await page.click('.add-project-btn');
    await page.fill('#project-name-input', 'Cancel Rejection Project');
    await page.fill('#project-repo-input', fixtureRepo.repoPath);
    await page.click('button:has-text("Create Project")');
    await page.waitForSelector('.project-modal-box', { state: 'hidden', timeout: 10000 });

    // Start run
    await page.click('a[href="/new"]');
    await page.waitForURL('**/new', { timeout: 10000 });
    await page.waitForSelector('#intent-input', { timeout: 10000 });
    await page.fill('#intent-input', 'Limit rate to 100 rpm');
    await page.click('button:has-text("Analyze Architecture")');
    await page.waitForURL(/\/runs\/[^\/]+$/, { timeout: 20000 });

    const runIdMatch = page.url().match(/\/runs\/([^\/]+)/);
    const runId = runIdMatch![1];

    // Go to implementation
    await page.goto(`${baseUrl}/runs/${runId}/implementation`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button:has-text("Prepare Implementation Plan")', { timeout: 10000 });
    await page.click('button:has-text("Prepare Implementation Plan")');
    await page.waitForSelector('.canonical-build-plan-section', { timeout: 15000 });

    // Mock cancel endpoint returning failure (e.g. 400 Bad Request)
    await page.route('**/api/runs/*/cancel', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'No active cancellable operation for this run.',
        }),
      });
    });

    // Start build to render timeline
    await page.click('button.start-build-cta');
    await page.waitForSelector('.approval-modal', { timeout: 10000 });
    await page.click('.approval-modal input[type="checkbox"]');

    // Intercept plan/execute with a delay so it stays in executing state
    let executionDone = false;
    await page.route('**/api/plan/execute', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (!executionDone) {
        await route.continue();
      }
    });

    await page.click('.approval-modal button:has-text("Start Build")');
    await page.waitForSelector('button.cancel-build-btn', { timeout: 10000 });

    // Click Cancel Build
    await page.click('button.cancel-build-btn');

    // Assert that the error banner appears with the server error
    await page.waitForSelector('.error-alert-banner:has-text("No active cancellable operation")', { timeout: 10000 });

    // Assert the UI does NOT show the successful cancellation message
    const timelineContent = await page.textContent('.implementation-page-layout');
    expect(timelineContent).not.toContain('Build cancelled. Original branch untouched.');

    // Assert run status badge is not CANCELLED
    const statusBadge = await page.locator('.status-badge').first().textContent();
    expect(statusBadge?.toUpperCase()).not.toContain('CANCELLED');

    executionDone = true;
    await context.close();
  });

  // 4. project created + repo registration rejected -> partial-success state shown
  it('project created + repo registration rejected -> partial-success state shown with retry and continue actions', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.add-project-btn', { timeout: 10000 });
    await page.click('.add-project-btn');

    await page.waitForSelector('.project-modal-box', { timeout: 10000 });
    await page.fill('#project-name-input', 'Unregistered Git Project');
    await page.fill('#project-repo-input', '/invalid/nonexistent/git/repo');

    // Mock repo registration endpoint to reject with 400
    await page.route('**/api/projects/*/repository', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Directory is not a valid git repository or path does not exist.',
        }),
      });
    });

    // Click Create Project
    await page.click('button:has-text("Create Project")');

    // Modal must NOT close!
    await page.waitForSelector('.project-modal-box', { timeout: 10000 });

    // Partial success warning must be shown
    await page.waitForSelector('.partial-success-warning', { timeout: 10000 });
    const warningText = await page.textContent('.partial-success-warning');
    expect(warningText).toContain('Project was created, but repository was not connected');
    expect(warningText).toContain('Directory is not a valid git repository');

    // Both action buttons must be available
    const continueBtn = page.locator('button:has-text("Continue without repository")');
    const retryBtn = page.locator('button:has-text("Retry repository connection")');

    expect(await continueBtn.isVisible()).toBe(true);
    expect(await retryBtn.isVisible()).toBe(true);

    // Click "Continue without repository"
    await continueBtn.click();

    // Modal closes
    await page.waitForSelector('.project-modal-box', { state: 'hidden', timeout: 10000 });

    // Project was indeed created on backend and is now the selected project!
    await page.waitForSelector('.project-nav-item.active:has-text("Unregistered Git Project")', { timeout: 10000 });
    const activeProjectName = await page.textContent('.project-nav-item.active');
    expect(activeProjectName).toContain('Unregistered Git Project');

    await context.close();
  });
});
