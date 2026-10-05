import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { createServer } from '../../apps/web/server/server.js';
import type { Server } from 'node:http';

describe('ArchitectAI Product UI V2 End-to-End User Journey', () => {
  let server: Server;
  let baseUrl: string;
  let browser: Browser | null = null;
  let hasChromium = false;

  beforeAll(async () => {
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
      browser = await chromium.launch();
      hasChromium = true;
    } catch (err) {
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

  it('starts cleanly on product home without auto-running scenarios', async () => {
    if (!hasChromium || !browser) return;

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
    if (!hasChromium || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

    // Verify zero horizontal overflow on desktop
    const overflowDesktop = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowDesktop).toBe(false);

    await page.close();
  });

  it('guarantees zero horizontal overflow and responsive layout on mobile (390x844)', async () => {
    if (!hasChromium || !browser) return;

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
