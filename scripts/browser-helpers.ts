import type { Page } from 'playwright';
export async function tableState(page: Page) {
  return page.locator('.table-layout').evaluate(element => ({ ...(element as HTMLElement).dataset }));
}
export async function move(page: Page, name: string | RegExp): Promise<void> {
  const before = Number((await tableState(page))['revision']);
  await page.getByRole('button', { name, exact: typeof name === 'string' }).click();
  await page.waitForFunction(revision => {
    const table = document.querySelector<HTMLElement>('.table-layout');
    return Number(table?.dataset['revision']) > revision && table?.dataset['phase'] !== 'rolling';
  }, before);
}
export async function activePage(a: Page, b: Page): Promise<Page> {
  const state = await tableState(a); return state['active'] === state['viewer'] ? a : b;
}
export async function opening(a: Page, b: Page): Promise<void> {
  await a.getByRole('button', { name: 'Ready to play', exact: true }).click();
  await b.getByRole('button', { name: 'Ready to play', exact: true }).click();
  await move(a, 'Start game');
  for (let i = 0; i < 50 && (await tableState(a))['stage'] === 'opening'; i++) {
    const page = await activePage(a, b); await move(page, 'Roll 1 die');
    const revision = (await tableState(page))['revision'];
    for (const other of [a, b]) await other.waitForFunction(r => Number(document.querySelector<HTMLElement>('.table-layout')?.dataset['revision']) >= Number(r), revision);
  }
}
export async function completeMatch(a: Page, b: Page): Promise<number> {
  let moves = 0;
  for (; moves < 1500 && (await tableState(a))['stage'] !== 'finished'; moves++) {
    const page = await activePage(a, b), state = await tableState(page);
    if (state['phase'] === 'ready') await move(page, /^Roll \d+ di(?:e|ce)$/);
    else if (state['phase'] === 'choosing') {
      await page.getByRole('button', { name: 'Select scoring dice', exact: true }).click();
      await move(page, /^Keep \d+ points$/);
    } else if (state['phase'] === 'kept') {
      const bank = page.getByRole('button', { name: /^Bank \d+$/ });
      await move(page, await bank.isEnabled() ? /^Bank \d+$/ : /^Roll \d+ di(?:e|ce)$/);
    } else if (state['phase'] === 'bust') await move(page, 'Next player');
    else throw new Error(`Unexpected phase ${JSON.stringify(state)}`);
    const revision = (await tableState(page))['revision'];
    for (const other of [a, b]) await other.waitForFunction(r => Number(document.querySelector<HTMLElement>('.table-layout')?.dataset['revision']) >= Number(r), revision);
  }
  if ((await tableState(a))['stage'] !== 'finished') throw new Error('The browser match did not finish.');
  return moves;
}
