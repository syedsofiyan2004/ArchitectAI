import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { createServer } from '../../apps/web/server/server.js';
import type { Server } from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

describe('ArchitectAI Product UI V2 End-to-End User Journey', () => {
  let server: Server;
  let baseUrl: string;
  let browser: Browser | null = null;
  let hasChromium = false;

  beforeAll(async () => {
    const distIndex = path.resolve(__dirname, '../../apps/web/dist/index.html');
    if (!fs.existsSync(distIndex)) {
      execSync('pnpm run web:build', { cwd: path.resolve(__dirname, '../..'), stdio: 'inherit' });
    }

    const app = await createServer();
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
      if (process.env.CI || process.env.ARCHITECTAI_REQUIRE_BROWSER) {
        throw new Error(`Playwright Chromium launch failed in CI environment: ${err}`);
      }
      console.warn('[UX Test] Chromium launch failed, skipping:', err);
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
  });

  function ensureBrowserAvailable(): boolean {
    if (!hasChromium || !browser) {
      if (process.env.CI || process.env.ARCHITECTAI_REQUIRE_BROWSER) {
        throw new Error('Playwright Chromium is required in CI but was not available.');
      }
      return false;
    }
    return true;
  }

  it('starts cleanly on product home without auto-running scenarios', async () => {
    if (!ensureBrowserAvailable() || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Assert Brand & One-sentence value prop
    const heroTitle = await page.textContent('.hero-title');
    expect(heroTitle).toContain('Engineering intelligence for AI-built software');

    // Assert primary CTA exists
    const newAnalysisBtn = await page.$('text="New Architecture Analysis"');
    expect(newAnalysisBtn).not.toBeNull();

    // Verify Composer is NOT rendered globally on Home
    const composer = await page.$('.composer-hero-textarea');
    expect(composer).toBeNull();

    // Verify zero horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await page.close();
  });

  it('walks through complete user journey from / to /new, review, evidence, architecture, verification, and implementation', async () => {
    if (!ensureBrowserAvailable() || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (err) => console.log('[PAGE ERROR]', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[PAGE CONSOLE ERROR]', msg.text());
    });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // 1. Click New Architecture Analysis -> navigates to /new
    await page.click('text="New Architecture Analysis"');
    await page.waitForURL('**/new');
    expect(page.url()).toContain('/new');

    // 2. Enter requirement
    const textarea = await page.waitForSelector('#intent-input');
    expect(textarea).not.toBeNull();
    await textarea.fill('When my access token expires automatically refresh it and retry the failed request.');

    // 3. Submit via Analyze Architecture button
    await page.click('button:has-text("Analyze Architecture")');

    // 4. Verify immediate navigation to run screen and active analyzing state
    await page.waitForURL('**/runs/run_*');
    expect(page.url()).toMatch(/\/runs\/run_/);

    // 5. Wait for results to land on Architecture Review screen
    await page.waitForSelector('.review-hero', { timeout: 15000 });

    // 6. Verify high-priority findings visible
    const findingsCount = await page.textContent('.review-title');
    expect(findingsCount).toMatch(/\d+ engineering risk/i);

    const firstFinding = await page.$('.finding-row-card');
    expect(firstFinding).not.toBeNull();

    // 7. Open Technical Evidence Drawer
    const whyBtn = await page.$('button:has-text("[Why ArchitectAI found this]")');
    expect(whyBtn).not.toBeNull();
    await whyBtn?.click();
    await page.waitForSelector('.drawer-panel');

    const drawerTitle = await page.textContent('.drawer-panel h3');
    expect(drawerTitle).toContain('Technical Evidence');

    // 8. Close Evidence Drawer
    await page.click('button[aria-label="Close drawer"]');
    await page.waitForTimeout(300);

    // 9. Continue to Architecture
    await page.click('button:has-text("Continue to Architecture")');
    await page.waitForURL('**/architecture');
    const archTitle = await page.textContent('.architecture-title');
    expect(archTitle).toBe('Recommended Architecture');

    // 10. Continue to Verification
    await page.click('button:has-text("Continue to Verification")');
    await page.waitForURL('**/verification');
    const verifTitle = await page.textContent('.verification-title');
    expect(verifTitle).toBe('Independent Verification Plan');

    // 11. Continue to Implementation
    await page.click('button:has-text("Prepare Implementation")');
    await page.waitForURL('**/implementation');
    const implTitle = await page.textContent('.implementation-title');
    expect(implTitle).toBe('Implementation Workspace');

    // 12. Navigate to Changes & Diff view
    await page.click('button:has-text("View Changes & Diff")');
    await page.waitForURL('**/changes');
    const changesTitle = await page.textContent('.changes-title');
    expect(changesTitle).toBe('Unified Code Changes');

    // 13. Verify Summary Read Endpoint (Requirement 58)
    const runIdMatch = page.url().match(/\/runs\/(run_[^/]+)/);
    expect(runIdMatch).not.toBeNull();
    const runId = runIdMatch![1];

    const summaryRes = await fetch(`${baseUrl}/api/runs/${runId}/summary`);
    expect(summaryRes.status).toBe(200);
    const summaryData = await summaryRes.json();
    expect(summaryData.success).toBe(true);
    expect(summaryData.summary).toBeDefined();
    expect(summaryData.summary.runId).toBe(runId);
    expect(['READY_TO_BUILD', 'NEEDS_INPUT', 'HIGH_RISK']).toContain(summaryData.summary.readiness);
    expect(summaryData.summary.topRisks.length).toBeGreaterThan(0);
    expect(['High confidence', 'Moderate confidence', 'Needs confirmation']).toContain(
      summaryData.summary.topRisks[0].confidenceLabel
    );
    expect(summaryData.summary.topRisks[0].whyItMatters).toBeDefined();

    // Verify zero horizontal overflow on desktop
    const overflowDesktop = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowDesktop).toBe(false);

    await page.close();
  });

  it('tests keyboard shortcuts and workspace modals (Cmd+K, Escape, N, Settings)', async () => {
    if (!ensureBrowserAvailable() || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // 1. Press Cmd+K or Ctrl+K to open Command Palette
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.command-palette-backdrop', { timeout: 5000 });
    expect(await page.$('.command-palette-backdrop')).not.toBeNull();

    // 2. Press Escape to close Command Palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    expect(await page.$('.command-palette-backdrop')).toBeNull();

    // 3. Open Settings Modal via sidebar button
    const settingsBtn = await page.waitForSelector('.sidebar-settings-btn');
    await settingsBtn.click();
    await page.waitForSelector('.settings-modal-backdrop', { timeout: 5000 });
    expect(await page.$('.settings-modal-backdrop')).not.toBeNull();

    // Verify tabs in settings
    const generalTab = await page.$('button:has-text("General")');
    expect(generalTab).not.toBeNull();
    const agentTab = await page.$('button:has-text("Coding Agent")');
    expect(agentTab).not.toBeNull();

    // 4. Press Escape to close Settings Modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    expect(await page.$('.settings-modal-backdrop')).toBeNull();

    // 5. Press 'n' to trigger New Change shortcut
    await page.keyboard.press('n');
    await page.waitForURL('**/new', { timeout: 5000 });
    expect(page.url()).toContain('/new');

    await page.close();
  });

  it('guarantees zero horizontal overflow and responsive layout on mobile (390x844)', async () => {
    if (!ensureBrowserAvailable() || !browser) return;

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    const overflowHome = await page.evaluate(() => {
      const el = document.documentElement;
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasOverflow: el.scrollWidth > el.clientWidth,
      };
    });
    expect(overflowHome.hasOverflow).toBe(false);
    expect(overflowHome.scrollWidth).toBeLessThanOrEqual(390);

    // Navigate to /new on mobile
    await page.click('text="New Architecture Analysis"');
    await page.waitForURL('**/new');

    const overflowNew = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowNew).toBe(false);

    await page.close();
  });
});
