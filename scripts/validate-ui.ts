import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startServer } from '../src/server/app.ts';
import AxeBuilder from '@axe-core/playwright';

const dir = mkdtempSync(join(tmpdir(), 'greed-ui-'));
const server = await startServer({ port: 0, dataDir: dir });
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const errors: string[] = [], results = [];
const cases = [
  { name: 'desktop-light', width: 1440, height: 1100, scheme: 'light', motion: 'reduce', textZoom: 100 },
  { name: 'phone-dark-motion', width: 390, height: 844, scheme: 'dark', motion: 'no-preference', textZoom: 100 },
  { name: 'small-phone-light', width: 320, height: 740, scheme: 'light', motion: 'reduce', textZoom: 100 },
  { name: 'text-zoom-dark', width: 1280, height: 1000, scheme: 'dark', motion: 'reduce', textZoom: 200 },
] as const;
mkdirSync('.artifacts', { recursive: true });
try {
  for (const scenario of cases) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height },
      colorScheme: scenario.scheme, reducedMotion: scenario.motion });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${scenario.name}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${scenario.name}: ${message.text()}`); });
    await page.goto(`http://127.0.0.1:${server.port}`);
    if (scenario.textZoom !== 100) await page.addStyleTag({ content: `html { font-size: ${scenario.textZoom}% !important; }` });
    await page.getByRole('heading', { name: 'Play at this table' }).waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('href')), '#main');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Start game', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.locator('dice-tray canvas').waitFor();
    let coldLocalWorkerResponseMs = 0;
    for (let openingRoll = 0; openingRoll < 50; openingRoll++) {
      if (await page.locator('.screen').getAttribute('data-stage') !== 'opening') break;
      const revision = Number(await page.locator('.screen').getAttribute('data-revision'));
      const started = performance.now();
      await page.getByRole('button', { name: /^Roll 1 die/ }).click();
      await page.waitForFunction(r => { const table = document.querySelector<HTMLElement>('.screen'); return Number(table?.dataset['revision']) > r && table?.dataset['phase'] !== 'rolling'; }, revision);
      if (openingRoll === 0) coldLocalWorkerResponseMs = performance.now() - started;
    }
    const openingSeed = await page.locator('dice-tray').getAttribute('data-seed');
    await page.getByRole('button', { name: /^Roll 6 dice/ }).click();
    // Dice buttons appear after playback, so read the first recorded pose as soon as the new roll arrives.
    await page.waitForFunction(seed => { const tray = document.querySelector('dice-tray'); return tray?.hasAttribute('data-seed') && tray.getAttribute('data-seed') !== seed; }, openingSeed);
    const initialPoses = await page.locator('dice-tray').getAttribute('data-poses');
    await page.locator('dice-tray[data-settled="true"]').waitFor({ timeout: 20_000 });
    const finalPoses = await page.locator('dice-tray').getAttribute('data-poses');
    await page.locator('.die-button').first().waitFor();
    assert.equal(await page.locator('.die-button:not([hidden])').count(), 6);
    assert.equal(await page.getByRole('alert').count(), 0);
    if (scenario.motion === 'no-preference') assert.notEqual(initialPoses, finalPoses, 'Normal motion must advance the recorded poses.');
    const firstDie = page.locator('.die-button').first(); let keyboardDiceSelection = false;
    if (await firstDie.isEnabled()) {
      await firstDie.focus(); await page.keyboard.press('Space');
      assert.equal(await firstDie.getAttribute('aria-pressed'), 'true'); keyboardDiceSelection = true;
    }
    const layout = await page.evaluate(() => ({ width: innerWidth, contentWidth: document.documentElement.scrollWidth,
      canvas: { width: document.querySelector('canvas')?.width, height: document.querySelector('canvas')?.height },
      drawCalls: Number(document.querySelector<HTMLElement>('dice-tray')?.dataset['drawCalls']),
      smallTargets: [...document.querySelectorAll('button, input, textarea')].filter(element => {
        const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.width < 44 || rect.height < 44);
      }).map(element => element.textContent?.trim() || element.getAttribute('name')) }));
    await page.screenshot({ path: `.artifacts/ui-${scenario.name}.png`, fullPage: true });
    assert(layout.contentWidth <= layout.width + 1, `${scenario.name}: horizontal overflow ${JSON.stringify(layout)}`);
    assert.deepEqual(layout.smallTargets, [], `${scenario.name}: interactive targets must be at least 44px`);
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(accessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], `${scenario.name}: axe violations`);
    const seed = await page.locator('dice-tray').getAttribute('data-seed');
    await page.reload(); await page.locator('dice-tray[data-settled="true"]').waitFor();
    assert.equal(await page.locator('dice-tray').getAttribute('data-seed'), seed, 'Local save must restore the recorded roll.');
    results.push({ ...scenario, ...layout, coldLocalWorkerResponseMs, keyboardSkipLink: true, keyboardStart: true, keyboardDiceSelection,
      localWorkerRoll: true, localSaveRestored: true, axeViolations: 0, animation: scenario.motion === 'reduce' ? 'skipped' : 'observed' });
    await context.close();
  }
  assert.deepEqual(errors, []);
  const report = { measuredAt: new Date().toISOString(), browser: 'Chromium with software WebGL', results, errors,
    limits: 'Text enlargement is CSS root-font-size, not a native browser zoom test. Axe is automated evidence; manual screen reader, mobile GPU and cross-browser audits remain.' };
  writeFileSync('docs/generated/ui-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await browser.close(); await server.close(); rmSync(dir, { recursive: true, force: true }); }
