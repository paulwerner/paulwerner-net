#!/usr/bin/env node
// Static build for the landing and legal pages.
//
//   src/  hand-written source (EJS templates, Tailwind entry, assets)
//   site/ generated output, committed to git and bind-mounted into Caddy
//
// The production server only runs `git pull` — nothing is compiled there — so
// site/ must always be committed in sync with src/.
//
// Usage: npm run build   (npm run dev for watch mode)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';

import { pages, navPages, pagePath } from './src/data/pages.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'site');

// Caddy renders these at request time via the `templates` directive (scoped to
// /imprint/*). EJS uses <% %>, so {{ }} passes through untouched — this build
// asserts that byte-for-byte rather than trusting it.
const CADDY_PLACEHOLDERS = ['{{env "IMPRINT_STREET"}}', '{{env "IMPRINT_CITY"}}'];

const banner = (page) =>
  `<!-- GENERATED FILE — do not edit. Source: src/pages/${page.file} — rebuild with \`npm run build\`. -->`;

function renderPages() {
  const layout = path.join(SRC, 'layouts', 'base.ejs');

  for (const page of pages) {
    const pageFile = path.join(SRC, 'pages', page.file);
    const body = ejs.render(fs.readFileSync(pageFile, 'utf8'), { page, navPages }, {
      filename: pageFile,
    });
    const html = ejs.render(fs.readFileSync(layout, 'utf8'), { page, navPages, body }, {
      filename: layout,
    });

    const outFile = path.join(OUT, pagePath(page));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, `<!DOCTYPE html>\n${banner(page)}\n${html}`);
    console.log(`  page   ${path.relative(ROOT, outFile)}`);
  }
}

function buildCss() {
  const input = path.join(SRC, 'styles', 'main.css');
  const output = path.join(OUT, 'assets', 'css', 'main.css');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'),
      '--input', input, '--output', output, '--minify'],
    { stdio: ['ignore', 'ignore', 'inherit'], cwd: ROOT },
  );
  console.log(`  css    ${path.relative(ROOT, output)} (${fs.statSync(output).size} bytes)`);
}

function copyAssets() {
  const from = path.join(SRC, 'assets');
  const to = path.join(OUT, 'assets');
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    fs.cpSync(path.join(from, entry.name), path.join(to, entry.name), {
      recursive: true,
      // TravelingTypewriter.otf is the source of truth for the woff2 beside it;
      // only the web format ships.
      filter: (src) => !src.endsWith('.otf'),
    });
  }
  console.log(`  assets ${path.relative(ROOT, to)}`);
}

// Self-hosted web fonts, copied from the @fontsource packages so the shipped
// files always match the pinned dependency. Only faces something actually
// renders are listed — see docs/decisions/002 for the per-face evidence.
const FONTSOURCE = [
  ['@fontsource/source-serif-4', 'source-serif-4-latin-400-normal.woff2'],
  ['@fontsource/source-serif-4', 'source-serif-4-latin-400-italic.woff2'],
  ['@fontsource/source-serif-4', 'source-serif-4-latin-600-normal.woff2'],
  ['@fontsource/source-serif-4', 'source-serif-4-latin-700-normal.woff2'],
];

function copyFonts() {
  const to = path.join(OUT, 'assets', 'fonts');
  fs.mkdirSync(to, { recursive: true });
  for (const [pkg, file] of FONTSOURCE) {
    fs.copyFileSync(path.join(ROOT, 'node_modules', pkg, 'files', file), path.join(to, file));
  }
  // OFL licence texts ship next to the fonts they cover.
  const licenses = path.join(to, 'licenses');
  fs.mkdirSync(licenses, { recursive: true });
  for (const pkg of new Set(FONTSOURCE.map(([p]) => p))) {
    const name = `${pkg.split('/')[1]}-OFL.txt`;
    fs.copyFileSync(path.join(ROOT, 'node_modules', pkg, 'LICENSE'), path.join(licenses, name));
  }
  console.log(`  fonts  ${FONTSOURCE.length} woff2 + licences`);
}


function assertCaddyPlaceholders() {
  const imprint = fs.readFileSync(path.join(OUT, 'imprint', 'index.html'), 'utf8');
  for (const placeholder of CADDY_PLACEHOLDERS) {
    if (!imprint.includes(placeholder)) {
      throw new Error(
        `site/imprint/index.html is missing the Caddy placeholder ${placeholder}. ` +
          'The address block would render empty in production — refusing to write a broken imprint.',
      );
    }
  }
  console.log('  assert Caddy imprint placeholders intact');
}

// Directories the build owns outright. Clearing them keeps stale output (a
// renamed asset, a font format that no longer ships) from lingering in site/.
function cleanGenerated() {
  for (const dir of ['assets/css', 'assets/fonts']) {
    fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
  }
}

function build() {
  console.log('building site/');
  cleanGenerated();
  renderPages();
  buildCss();
  copyAssets();
  copyFonts();
  assertCaddyPlaceholders();
  console.log('done');
}

build();

if (process.argv.includes('--watch')) {
  console.log('watching src/ …');
  let queued = null;
  fs.watch(SRC, { recursive: true }, () => {
    clearTimeout(queued);
    queued = setTimeout(() => {
      try {
        build();
      } catch (error) {
        console.error(error.message);
      }
    }, 50);
  });
}
