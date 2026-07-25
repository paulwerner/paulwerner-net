#!/usr/bin/env node
// Contrast report for the brand palette.
//
// Parses the colours straight out of src/styles/tokens.css — the same file
// Tailwind compiles — so the ratios reported here are provably the ratios that
// ship, not a copy that can drift.
//
// Usage: npm run contrast

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TOKENS = path.join(ROOT, 'src', 'styles', 'tokens.css');

const colors = Object.fromEntries(
  [...fs.readFileSync(TOKENS, 'utf8').matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map(
    ([, name, hex]) => [name, hex.toLowerCase()],
  ),
);

const channel = (value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const BACKGROUNDS = ['bg', 'card-bg', 'inset-bg'];
const FOREGROUNDS = ['text', 'link', 'gold', 'accent', 'hover', 'muted', 'border'];
const AA_TEXT = 4.5;
const AA_LARGE_OR_UI = 3.0;

const pad = (s, n) => String(s).padEnd(n);

console.log(`brand palette from ${path.relative(ROOT, TOKENS)}\n`);
console.log(`${pad('foreground', 12)}${BACKGROUNDS.map((b) => pad(b, 12)).join('')}`);
for (const fg of FOREGROUNDS) {
  const cells = BACKGROUNDS.map((bg) => {
    const r = ratio(colors[fg], colors[bg]);
    const mark = r >= AA_TEXT ? 'AA' : r >= AA_LARGE_OR_UI ? 'AA-lg' : '--';
    return pad(`${r.toFixed(2)} ${mark}`, 12);
  });
  console.log(`${pad(fg, 12)}${cells.join('')}`);
}

console.log('\nspecific pairs as used:');
const pairs = [
  ['accent button: bg text on accent fill', 'bg', 'accent', AA_TEXT],
  ['accent button hover: bg text on gold fill', 'bg', 'gold', AA_TEXT],
  ['focus outline: accent against bg', 'accent', 'bg', AA_LARGE_OR_UI],
  ['scrollbar thumb: hover against bg', 'hover', 'bg', AA_LARGE_OR_UI],
];
for (const [label, a, b, threshold] of pairs) {
  const r = ratio(colors[a], colors[b]);
  console.log(`  ${pad(label, 44)} ${r.toFixed(2)}  (needs ${threshold.toFixed(1)}) ${r >= threshold ? 'PASS' : 'FAIL'}`);
}

console.log(
  '\nnote: `border` (#2a2420) is decorative only — dividers and inactive card' +
    '\noutlines that also carry a background shift. It is not the sole indicator' +
    '\nof any control, so the 3:1 non-text requirement does not apply to it.',
);
