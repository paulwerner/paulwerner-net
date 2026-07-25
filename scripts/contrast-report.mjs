#!/usr/bin/env node
// Contrast gate for the brand palette.
//
// Parses the colours straight out of src/styles/tokens.css — the same file
// Tailwind compiles — so the ratios checked here are provably the ratios that
// ship, not a copy that can drift.
//
// This is a gate, not a report: `npm run build` calls assertContrast() and
// fails if any text pair drops below WCAG AA (4.5:1) or any UI/focus pair
// below 3:1. The margins are thin — `muted` on `inset-bg` sits at 4.65 — so a
// token edit that looks harmless can cross the line without anyone noticing.
//
// Usage: npm run contrast   (prints the full table; exits non-zero on failure)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TOKENS = path.join(ROOT, 'src', 'styles', 'tokens.css');

export const AA_TEXT = 4.5;
export const AA_UI = 3.0;

// Exempt by name, with the reason stated. `border` is used for dividers and
// for inactive card outlines that also carry a background shift, so it is
// never the sole indicator of a control or of text — WCAG 1.4.3 and 1.4.11 do
// not apply to it. Anything added here needs the same justification.
export const DECORATIVE = {
  border: 'dividers and inactive card outlines that also carry a background shift',
};

const BACKGROUNDS = ['bg', 'card-bg', 'inset-bg'];
const FOREGROUNDS = ['text', 'link', 'gold', 'accent', 'hover', 'muted', 'border'];

// Pairs whose role is not body text, checked against the 3:1 non-text
// threshold, plus the two filled controls, which are text.
const NAMED_PAIRS = [
  { label: 'accent button: bg text on accent fill', a: 'bg', b: 'accent', threshold: AA_TEXT },
  { label: 'accent button hover: bg text on gold fill', a: 'bg', b: 'gold', threshold: AA_TEXT },
  { label: 'focus outline: accent against bg', a: 'accent', b: 'bg', threshold: AA_UI },
  { label: 'scrollbar thumb: hover against bg', a: 'hover', b: 'bg', threshold: AA_UI },
];

const channel = (value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

export function readTokens() {
  return Object.fromEntries(
    [...fs.readFileSync(TOKENS, 'utf8').matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map(
      ([, name, hex]) => [name, hex.toLowerCase()],
    ),
  );
}

export function evaluateContrast() {
  const colors = readTokens();
  const missing = [...BACKGROUNDS, ...FOREGROUNDS].filter((name) => !colors[name]);
  if (missing.length) {
    throw new Error(`src/styles/tokens.css is missing colour token(s): ${missing.join(', ')}`);
  }

  const textPairs = [];
  for (const fg of FOREGROUNDS) {
    for (const bg of BACKGROUNDS) {
      textPairs.push({
        label: `${fg} on ${bg}`,
        value: ratio(colors[fg], colors[bg]),
        threshold: AA_TEXT,
        exempt: DECORATIVE[fg] ? `${fg}: ${DECORATIVE[fg]}` : null,
      });
    }
  }

  const namedPairs = NAMED_PAIRS.map((pair) => ({
    label: pair.label,
    value: ratio(colors[pair.a], colors[pair.b]),
    threshold: pair.threshold,
    exempt: null,
  }));

  const all = [...textPairs, ...namedPairs];
  return {
    colors,
    textPairs,
    namedPairs,
    failures: all.filter((p) => !p.exempt && p.value < p.threshold),
  };
}

export function assertContrast() {
  const { failures } = evaluateContrast();
  if (failures.length) {
    const detail = failures
      .map((f) => `  ${f.label}: ${f.value.toFixed(2)} (needs ${f.threshold.toFixed(1)})`)
      .join('\n');
    throw new Error(
      `Contrast gate failed — ${failures.length} pair(s) below threshold:\n${detail}\n` +
        'Adjust the tokens in src/styles/tokens.css, or exempt a token by name in ' +
        'scripts/contrast-report.mjs with a written reason.',
    );
  }
  return failures;
}

function report() {
  const { colors, textPairs, namedPairs, failures } = evaluateContrast();
  const pad = (s, n) => String(s).padEnd(n);
  const mark = (p) =>
    p.exempt ? 'exempt' : p.value >= AA_TEXT ? 'AA' : p.value >= AA_UI ? 'AA-lg' : 'FAIL';

  console.log(`brand palette from ${path.relative(ROOT, TOKENS)}\n`);
  console.log(`${pad('foreground', 12)}${BACKGROUNDS.map((b) => pad(b, 12)).join('')}`);
  for (const fg of FOREGROUNDS) {
    const cells = BACKGROUNDS.map((bg) => {
      const pair = textPairs.find((p) => p.label === `${fg} on ${bg}`);
      return pad(`${pair.value.toFixed(2)} ${mark(pair)}`, 12);
    });
    console.log(`${pad(fg, 12)}${cells.join('')}`);
  }

  console.log('\nspecific pairs as used:');
  for (const pair of namedPairs) {
    console.log(
      `  ${pad(pair.label, 44)} ${pair.value.toFixed(2)}  (needs ${pair.threshold.toFixed(1)}) ${
        pair.value >= pair.threshold ? 'PASS' : 'FAIL'
      }`,
    );
  }

  console.log('\nexempt tokens:');
  for (const [name, reason] of Object.entries(DECORATIVE)) {
    console.log(`  ${name} (${colors[name]}) — ${reason}`);
  }

  const tightest = [...textPairs, ...namedPairs]
    .filter((p) => !p.exempt)
    .sort((a, b) => a.value - b.value)[0];
  console.log(`\ntightest margin: ${tightest.label} at ${tightest.value.toFixed(2)}`);

  if (failures.length) {
    console.error(`\nFAIL — ${failures.length} pair(s) below threshold`);
    process.exit(1);
  }
  console.log(`gate: PASS (text >= ${AA_TEXT.toFixed(1)}, ui/focus >= ${AA_UI.toFixed(1)})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  report();
}
