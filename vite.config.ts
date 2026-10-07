import { defineConfig } from 'vite';
import { gyralVitePreset } from '@gyral/core/vite';
import { SCORING_ROWS } from './src/game/rules.ts';
import { BUST_CHANCE } from './src/game/odds.ts';
const preset = gyralVitePreset({ clientOnly: true });

export default defineConfig({
  ...preset,
  plugins: [preset.plugins, { name: 'static-rule-table', transformIndexHtml: (source: string) => source.replace(/<!-- scoring:start -->[\s\S]*?<!-- scoring:end -->/,
    `<!-- scoring:start -->${SCORING_ROWS.map(([label, points]) => `<tr><th scope="row">${label}</th><td>${points}</td></tr>`).join('')}<!-- scoring:end -->`)
    .replace(/<!-- odds:start -->[\s\S]*?<!-- odds:end -->/, `<!-- odds:start -->${[6, 5, 4, 3, 2, 1].map(dice => { const percent = (BUST_CHANCE[dice] ?? 0) * 100;
      return `<tr><th scope="row">${dice} ${dice === 1 ? 'die' : 'dice'}</th><td><span class="oddsbar" aria-hidden="true"><b style="--risk: ${percent.toFixed(1)}"></b></span></td><td>${percent.toFixed(1)}%</td></tr>`; }).join('')}<!-- odds:end -->`) }],
  server: { proxy: { '/api': 'http://127.0.0.1:8787', '/ws': { target: 'ws://127.0.0.1:8787', ws: true } } },
  build: { manifest: true },
});
