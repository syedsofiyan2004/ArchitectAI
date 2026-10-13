import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { createServer } from '../../apps/web/server/server.js';
import type { Server } from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

describe('ArchitectAI Visual Modals & Form System Validation', () => {
  let server: Server;
  let baseUrl: string;
  let browser: Browser | null = null;
  let hasChromium = false;

  beforeAll(async () => {
    const distIndex = path.resolve(__dirname, '../../apps/web/dist/index.html');
    if (!fs.existsSync(distIndex)) {
      execSync('pnpm run web:build', { cwd: path.resolve(__dirname, '../..'), stdio: 'inherit' });
    }

    const artifactsDir = path.resolve(__dirname, '../../artifacts/ui');
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
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
        throw new Error(`Playwright Chromium launch failed: ${err}`);
      }
      console.warn('[Visual Modals Test] Chromium launch failed, skipping:', err);
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

  it('validates Create Project modal and Settings modal on Desktop (1440x900)', async () => {
    if (!ensureBrowserAvailable() || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // 1. Open Create Project modal
    const addProjectBtn = await page.waitForSelector('.add-project-btn, .sidebar-empty-project-btn');
    await addProjectBtn.click();
    await page.waitForSelector('.project-modal-box', { timeout: 5000 });

    // Assert computed styles on Create Project modal
    const projectBoxStyles = await page.evaluate(() => {
      const modalBox = document.querySelector('.project-modal-box') as HTMLElement;
      const input = document.querySelector('#project-name-input') as HTMLElement;
      const field = document.querySelector('.ui-form-field') as HTMLElement;
      const cancelBtn = document.querySelector('.ui-modal-footer .ui-btn-secondary') as HTMLElement;
      const submitBtn = document.querySelector('.ui-modal-footer .ui-btn-primary') as HTMLElement;
      const closeBtn = document.querySelector('.ui-modal-header button') as HTMLElement;
      const footer = document.querySelector('.ui-modal-footer') as HTMLElement;

      const modalRect = modalBox.getBoundingClientRect();
      const inputStyles = window.getComputedStyle(input);
      const fieldStyles = window.getComputedStyle(field);
      const footerStyles = window.getComputedStyle(footer);

      return {
        modalWidth: modalRect.width,
        inputHeight: parseFloat(inputStyles.height),
        inputBgColor: inputStyles.backgroundColor,
        inputColor: inputStyles.color,
        fieldMarginBottom: parseFloat(fieldStyles.marginBottom),
        footerBorderTop: footerStyles.borderTopWidth,
        hasCancel: cancelBtn !== null,
        hasSubmit: submitBtn !== null,
        hasClose: closeBtn !== null,
      };
    });

    // Verify Create Project specs
    expect(projectBoxStyles.modalWidth).toBeLessThanOrEqual(560);
    expect(projectBoxStyles.inputHeight).toBeGreaterThanOrEqual(40);
    expect(projectBoxStyles.inputHeight).toBeLessThanOrEqual(44);
    expect(projectBoxStyles.inputBgColor).not.toBe('rgb(255, 255, 255)');
    expect(projectBoxStyles.fieldMarginBottom).toBeGreaterThanOrEqual(12);
    expect(projectBoxStyles.hasCancel).toBe(true);
    expect(projectBoxStyles.hasSubmit).toBe(true);
    expect(projectBoxStyles.hasClose).toBe(true);

    // Save screenshot
    await page.screenshot({
      path: path.resolve(__dirname, '../../artifacts/ui/create-project-1440.png'),
    });

    // Close Create Project modal
    await page.keyboard.press('Escape');
    await page.waitForSelector('.project-modal-box', { state: 'detached', timeout: 5000 });

    // 2. Open Settings modal
    const settingsBtn = await page.waitForSelector('.sidebar-settings-btn');
    await settingsBtn.click();
    await page.waitForSelector('.settings-modal-box', { timeout: 5000 });

    // Assert computed styles on Settings modal
    const settingsStyles = await page.evaluate(() => {
      const modalBox = document.querySelector('.settings-modal-box') as HTMLElement;
      const sidebar = document.querySelector('.settings-nav-sidebar') as HTMLElement;
      const bodyLayout = document.querySelector('.settings-modal-body-layout') as HTMLElement;
      const activeTab = document.querySelector('.ui-tab-trigger.active') as HTMLElement;

      const modalRect = modalBox.getBoundingClientRect();
      const sidebarRect = sidebar.getBoundingClientRect();
      const activeTabStyles = window.getComputedStyle(activeTab);
      const bodyStyles = window.getComputedStyle(bodyLayout);

      return {
        modalWidth: modalRect.width,
        sidebarWidth: sidebarRect.width,
        bodyDisplay: bodyStyles.display,
        activeTabBg: activeTabStyles.backgroundColor,
      };
    });

    // Verify Settings specs
    expect(settingsStyles.modalWidth).toBeGreaterThanOrEqual(760);
    expect(settingsStyles.modalWidth).toBeLessThanOrEqual(820);
    expect(settingsStyles.sidebarWidth).toBeGreaterThanOrEqual(180);
    expect(settingsStyles.sidebarWidth).toBeLessThanOrEqual(200);
    expect(settingsStyles.bodyDisplay).toBe('flex');
    expect(settingsStyles.activeTabBg).not.toBe('rgb(255, 255, 255)');

    // Save General Settings screenshot
    await page.screenshot({
      path: path.resolve(__dirname, '../../artifacts/ui/settings-general-1440.png'),
    });

    // Switch to AI Provider tab
    await page.click('button:has-text("AI Provider")');
    await page.waitForSelector('.section-title:has-text("AI Reasoning Provider")');

    // Save AI Provider Settings screenshot
    await page.screenshot({
      path: path.resolve(__dirname, '../../artifacts/ui/settings-provider-1440.png'),
    });

    // Close Settings modal
    await page.keyboard.press('Escape');
    await page.waitForSelector('.settings-modal-box', { state: 'detached', timeout: 5000 });

    await page.close();
  });

  it('validates Create Project modal and Settings modal on Mobile (390x844)', async () => {
    if (!ensureBrowserAvailable() || !browser) return;

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Open mobile sidebar
    await page.click('.mobile-sidebar-toggle');
    await page.waitForSelector('.workspace-sidebar.mobile-open');

    // Open Create Project modal
    const addProjectBtn = await page.waitForSelector('.add-project-btn, .sidebar-empty-project-btn');
    await addProjectBtn.click();
    await page.waitForSelector('.project-modal-box', { timeout: 5000 });

    // Check zero horizontal overflow
    const mobileProjectOverflow = await page.evaluate(() => {
      const el = document.documentElement;
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasOverflow: el.scrollWidth > el.clientWidth,
      };
    });
    expect(mobileProjectOverflow.hasOverflow).toBe(false);

    // Save mobile Create Project screenshot
    await page.screenshot({
      path: path.resolve(__dirname, '../../artifacts/ui/create-project-mobile.png'),
    });

    // Close Create Project modal
    await page.keyboard.press('Escape');
    await page.waitForSelector('.project-modal-box', { state: 'detached', timeout: 5000 });

    // Re-open mobile sidebar to access Settings
    await page.click('.mobile-sidebar-toggle');
    await page.waitForSelector('.workspace-sidebar.mobile-open');

    // Open Settings modal
    const settingsBtn = await page.waitForSelector('.sidebar-settings-btn');
    await settingsBtn.click();
    await page.waitForSelector('.settings-modal-box', { timeout: 5000 });

    // Check zero horizontal overflow on Settings mobile
    const mobileSettingsOverflow = await page.evaluate(() => {
      const el = document.documentElement;
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasOverflow: el.scrollWidth > el.clientWidth,
      };
    });
    expect(mobileSettingsOverflow.hasOverflow).toBe(false);

    // Save mobile Settings screenshot
    await page.screenshot({
      path: path.resolve(__dirname, '../../artifacts/ui/settings-mobile.png'),
    });

    // Close Settings modal
    await page.keyboard.press('Escape');
    await page.waitForSelector('.settings-modal-box', { state: 'detached', timeout: 5000 });

    await page.close();
  });
});
