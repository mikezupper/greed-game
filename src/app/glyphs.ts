import { html } from '@gyral/core';

/** Pip cells on a 3×3 grid, row by row. */
const GRID: Readonly<Record<number, readonly number[]>> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

/** A small decorative die face; pair it with text that states the value. */
export const mini = (value: number) => html`<span class="mini" aria-hidden="true">${CELLS.map(cell =>
  html`<i class=${GRID[value]?.includes(cell) ? 'on' : ''}></i>`)}</span>`;
