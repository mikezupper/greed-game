import { defineConfig } from 'vite';
import { gyralVitePreset } from '@gyral/core/vite';
import { SCORING_ROWS } from './src/game/rules.ts';
const preset = gyralVitePreset({ clientOnly: true });

export default defineConfig({
  ...preset,
  plugins: [preset.plugins, { name: 'static-rule-table', transformIndexHtml: (source: string) => source.replace(/<!-- scoring:start -->[\s\S]*?<!-- scoring:end -->/,
    `<!-- scoring:start -->${SCORING_ROWS.map(([label, points]) => `<tr><th scope="row">${label}</th><td>${points}</td></tr>`).join('')}<!-- scoring:end -->`) }],
  server: { proxy: { '/api': 'http://127.0.0.1:8787', '/ws': { target: 'ws://127.0.0.1:8787', ws: true } } },
  build: { manifest: true },
});
