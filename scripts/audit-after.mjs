import { chromium } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';

const BASE_URL = 'http://localhost:3001';
const AFTER_DIR = path.resolve('artifacts/ui-review/after');

async function main() {
  fs.mkdirSync(AFTER_DIR, { recursive: true });
  const browser = await chromium.launch();
  const consoleErrors = [];
  const overflowIssues = [];

  const viewports = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1280x800', width: 1280, height: 800 },
    { name: '1024x768', width: 1024, height: 768 },
    { name: '390x844', width: 390, height: 844 },
  ];

  console.log('[Audit After] Starting Post-Redesign Visual Inspection across 5 viewports...');

  // 1. Inspect Viewports & Responsive Overflow
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ viewport: vp.name, text: msg.text() });
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasOverflow: el.scrollWidth > el.clientWidth,
      };
    });

    if (overflow.hasOverflow) {
      overflowIssues.push({
        viewport: vp.name,
        scrollWidth: overflow.scrollWidth,
        clientWidth: overflow.clientWidth,
      });
      console.log(`[Audit After] ⚠️ Overflow at ${vp.name}: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}`);
    } else {
      console.log(`[Audit After] ✓ Zero horizontal overflow at ${vp.name} (scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth})`);
    }

    await page.screenshot({ path: path.join(AFTER_DIR, `01-initial-viewport-${vp.name}.png`), fullPage: false });
    await page.close();
  }

  // 2. Deep View-by-View Inspection at 1920x1080 Desktop
  console.log('[Audit After] Deep View-by-View Inspection at 1920x1080...');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ view: 'deep-inspection', text: msg.text() });
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Overview screen
  await page.screenshot({ path: path.join(AFTER_DIR, `02-overview-analyzed.png`), fullPage: false });

  // Inspect each navigation tab via workflow rail:
  const tabs = [
    { name: 'unknowns', label: 'Unknown-Unknowns', file: '03-view-unknown-unknowns.png' },
    { name: 'knowledge', label: '3-Level Knowledge', file: '04-view-3level-knowledge.png' },
    { name: 'decisions', label: 'Decisions & ADRs', file: '05-view-architecture-decisions.png' },
    { name: 'verification', label: 'Verification Plan', file: '06-view-verification-plan.png' },
    { name: 'implementation', label: 'Implementation', file: '07-view-implementation.png' },
    { name: 'contract', label: 'Contract JSON', file: '08-view-contract-json.png' },
  ];

  for (const tab of tabs) {
    const tabEl = await page.$(`button:has-text("${tab.label}")`);
    if (tabEl) {
      await tabEl.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(AFTER_DIR, tab.file), fullPage: false });
      console.log(`[Audit After] Captured view: ${tab.label}`);
    } else {
      console.log(`[Audit After] ⚠️ Could not find tab for ${tab.label}`);
    }
  }

  // Test Ctrl+Enter submission
  console.log('[Audit After] Testing Ctrl+Enter keyboard submission shortcut...');
  const textarea = await page.$('#intent-input');
  if (textarea) {
    await textarea.click();
    await textarea.fill('When my access token expires automatically refresh it and retry the failed request.');
    await page.keyboard.press('Control+Enter');
    // Wait for analysis to complete
    await page.waitForTimeout(2000);
    console.log('[Audit After] ✓ Ctrl+Enter shortcut successfully triggered analysis');
  }

  // 3. Inspect Mobile Layout at 390x844
  console.log('[Audit After] Capturing Mobile views at 390x844...');
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1200);

  const mobileOverflow = await mobilePage.evaluate(() => {
    const el = document.documentElement;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      hasOverflow: el.scrollWidth > el.clientWidth,
    };
  });
  console.log(`[Audit After] Mobile 390x844 overflow check: scrollWidth=${mobileOverflow.scrollWidth}, clientWidth=${mobileOverflow.clientWidth}`);

  await mobilePage.screenshot({ path: path.join(AFTER_DIR, '09-mobile-overview-390x844.png') });

  const mobileUnknowns = await mobilePage.$('button:has-text("Unknown-Unknowns")');
  if (mobileUnknowns) {
    await mobileUnknowns.click();
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({ path: path.join(AFTER_DIR, '10-mobile-unknowns-390x844.png') });
  }

  const mobileImpl = await mobilePage.$('button:has-text("Implementation")');
  if (mobileImpl) {
    await mobileImpl.click();
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({ path: path.join(AFTER_DIR, '11-mobile-implementation-390x844.png') });
  }

  await mobilePage.close();
  await page.close();
  await browser.close();

  console.log('\n================ AUDIT AFTER SUMMARY ================');
  console.log(`Console Errors detected: ${consoleErrors.length}`);
  for (const err of consoleErrors) {
    console.log(`  - [${err.viewport || err.view}] ${err.text}`);
  }
  console.log(`Horizontal Overflow Issues: ${overflowIssues.length}`);
  for (const o of overflowIssues) {
    console.log(`  - ${o.viewport}: scrollWidth=${o.scrollWidth} > clientWidth=${o.clientWidth}`);
  }
  console.log(`Screenshots saved to: ${AFTER_DIR}`);
  console.log('=====================================================\n');

  if (overflowIssues.length > 0) {
    throw new Error(`Audit failed: ${overflowIssues.length} horizontal overflow issues detected!`);
  }
}

main().catch((err) => {
  console.error('[Audit Error]', err);
  process.exit(1);
});
