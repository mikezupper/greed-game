import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { PIP_PATTERNS } from '../src/rendering/die.ts';
const dice = Array.from({ length: 6 }, (_, i) => `<g transform="translate(${110 + i * 176} 435) rotate(${i % 2 ? 8 : -8})"><rect x="-58" y="-58" width="116" height="116" rx="12" fill="#eee5cd"/>${(PIP_PATTERNS[i + 1] ?? []).map(([x, y]) => `<circle cx="${x * 31}" cy="${y * 31}" r="8" fill="#173b34"/>`).join('')}</g>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><title>Greed — One more roll?</title><rect width="1200" height="630" fill="#173b34"/><rect x="24" y="24" width="1152" height="582" rx="8" fill="none" stroke="#91633f" stroke-width="20"/><text x="65" y="100" fill="#eee5cd" font-family="sans-serif" font-size="26" font-weight="bold" letter-spacing="8">GREED</text><text x="65" y="230" fill="#eee5cd" font-family="Georgia,serif" font-size="106">One more roll?</text><text x="68" y="290" fill="#d0d9ce" font-family="sans-serif" font-size="27">Six dice. Good company. Questionable decisions.</text>${dice}<text x="68" y="564" fill="#d0d9ce" font-family="sans-serif" font-size="23">Play with friends · Greed / Farkle</text></svg>`;
writeFileSync('public/social.svg', svg + '\n');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>body{margin:0}</style>${svg}`); await page.screenshot({ path: 'public/social.png' });
} finally { await browser.close(); }
