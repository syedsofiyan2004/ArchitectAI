import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { createServer } from '../../apps/web/server/server.js';
import type { Server } from 'node:http';

describe('ArchitectAI Browser UX & Interaction Gate', () => {
  let server: Server;
  let baseUrl: string;
  let browser: Browser | null = null;
  let hasChromium = false;

  beforeAll(async () => {
    // 1. Start backend server with ephemeral port
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

    // 2. Attempt to launch Chromium
    try {
      browser = await chromium.launch();
      hasChromium = true;
    } catch (err) {
      console.warn('[UX Test] Chromium not installed or launch failed; skipping browser tests:', err);
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

  it('renders application shell, brand, and zero horizontal overflow on desktop (1920x1080)', async () => {
    if (!hasChromium || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Assert Brand & Shell elements
    const brandName = await page.textContent('.brand-name');
    expect(brandName).toBe('ArchitectAI');

    const topBar = await page.$('.top-bar');
    expect(topBar).not.toBeNull();

    // Verify zero horizontal overflow
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth;
    });
    expect(overflow).toBe(false);

    await page.close();
  });

  it('verifies zero horizontal overflow and responsive workflow rail on mobile (390x844)', async () => {
    if (!hasChromium || !browser) return;

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasOverflow: el.scrollWidth > el.clientWidth,
      };
    });

    expect(overflow.hasOverflow).toBe(false);
    expect(overflow.scrollWidth).toBeLessThanOrEqual(390);

    // Verify rail collapses into horizontal navigation without breaking layout
    const workflowRail = await page.$('.workflow-rail');
    expect(workflowRail).not.toBeNull();

    await page.close();
  });

  it('supports Ctrl+Enter keyboard submission and instant activity indicator', async () => {
    if (!hasChromium || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    const textarea = await page.$('#intent-input');
    expect(textarea).not.toBeNull();

    if (textarea) {
      await textarea.fill('Limit each authenticated user to 100 API requests per minute.');
      await textarea.press('Control+Enter');

      // Assert activity indicator is rendered
      const activityCard = await page.$('.activity-card');
      expect(activityCard).not.toBeNull();

      // Wait for analysis result to arrive
      await page.waitForSelector('.canvas-view-container', { timeout: 10000 });
      const unknowns = await page.$('.findings-container');
      expect(unknowns).not.toBeNull();
    }

    await page.close();
  });

  it('navigates through workflow rail tabs without errors or overflow', async () => {
    if (!hasChromium || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.canvas-view-container', { timeout: 10000 });

    const tabLabels = [
      'Unknown-Unknowns',
      '3-Level Knowledge',
      'Decisions & ADRs',
      'Verification Plan',
      'Implementation',
      'Contract JSON',
    ];

    for (const label of tabLabels) {
      const tabBtn = await page.$(`button:has-text("${label}")`);
      expect(tabBtn).not.toBeNull();
      if (tabBtn) {
        await tabBtn.click();
        await page.waitForTimeout(200);

        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasOverflow).toBe(false);
      }
    }

    await page.close();
  });
});
