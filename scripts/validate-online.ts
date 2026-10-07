import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../src/server/app.ts';
import { activePage, completeMatch, move, opening } from './browser-helpers.ts';
const dir = mkdtempSync(join(tmpdir(), 'greed-online-'));
const server = await startServer({ port: 0, dataDir: dir, playbackMs: 0, actionRate: 1000 });
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const errors: string[] = []; mkdirSync('.artifacts', { recursive: true });
try {
  const a = await browser.newPage({ viewport: { width: 1440, height: 1100 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const b = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const page of [a, b]) {
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  }
  const base = `http://127.0.0.1:${server.port}`;
  await a.goto(base); await a.getByLabel('Your name').fill('Ada'); await a.getByRole('button', { name: 'Create room', exact: true }).click();
  await a.locator('.room-bar code').waitFor(); const room = await a.locator('.room-bar code').textContent(); assert(room);
  await b.goto(`${base}/?room=${room}`); assert.equal(await b.getByLabel('Room code').inputValue(), room);
  await b.getByLabel('Your name').fill('Ben'); await b.getByRole('button', { name: 'Join room', exact: true }).click();
  await a.getByText('online · 2 connected', { exact: true }).waitFor();
  assert.equal(await a.getByRole('button', { name: 'Start game', exact: true }).isDisabled(), true);
  await opening(a, b); const current = await activePage(a, b), other = current === a ? b : a;
  await move(current, 'Roll 6 dice');
  await other.locator('.die-button').first().waitFor();
  const state = async (page: typeof a) => ({ seed: await page.locator('dice-tray').getAttribute('data-seed'),
    values: await page.locator('.die-button').allTextContents(), poses: await page.locator('dice-tray').getAttribute('data-poses') });
  await current.locator('dice-tray[data-settled="true"]').waitFor(); await other.locator('dice-tray[data-settled="true"]').waitFor();
  const before = await state(current); assert.deepEqual(await state(other), before);
  assert.equal(await other.getByRole('button', { name: 'Roll 6 dice', exact: true }).isDisabled(), true);
  await a.screenshot({ path: '.artifacts/online-desktop.png', fullPage: true }); await b.screenshot({ path: '.artifacts/online-phone.png', fullPage: true });
  await current.reload(); await current.getByText('online · 2 connected', { exact: true }).waitFor();
  assert.deepEqual(await state(current), before);
  const moves = await completeMatch(a, b);
  await a.getByRole('heading', { name: 'Match complete', exact: false }).waitFor();
  await a.screenshot({ path: '.artifacts/online-victory.png', fullPage: true });
  await move(a, 'Play again'); await b.getByRole('heading', { name: 'Before the first roll' }).waitFor();
  assert.deepEqual(errors, []);
  const report = { measuredAt: new Date().toISOString(), browsers: 2, target: 10_000, moves, sharedRoll: true, sameFinalPoses: true,
    invitePrefilled: true, readinessRequired: true, reconnectRestoresRoll: true, completeMatch: true, rematch: true, wrongPlayerControlsDisabled: true,
    acceleratedHarness: 'Server playback delay disabled and command-rate limit increased; browsers use reduced motion. Real physical throws, sockets and game rules.', errors };
  writeFileSync('docs/generated/online-report.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} catch (error) {
  console.error(JSON.stringify({ errors }));
  for (const [index, context] of browser.contexts().entries()) for (const page of context.pages()) {
    await page.screenshot({ path: `.artifacts/online-failure-${index}.png`, fullPage: true }); console.error((await page.locator('body').innerText()).slice(0, 3000));
  }
  throw error;
} finally { await browser.close(); await server.close(); rmSync(dir, { recursive: true, force: true }); }
