#!/usr/bin/env node
// Static build: src/ (hand-written) -> site/ (generated, committed, served).
// The production server only runs `git pull`, so site/ must stay in sync.
// Usage: npm run build   (npm run dev for watch mode)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';

import { pages, navPages, pagePath, pageUrl } from './src/data/pages.js';
import { assertContrast, AA_TEXT, AA_UI } from './scripts/contrast-report.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'site');

// Caddy renders these at request time via the `templates` directive; they must
// survive EJS templating byte-for-byte.
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
      // .otf is the source for the woff2 beside it; only the web format ships.
      filter: (src) => !src.endsWith('.otf'),
    });
  }
  console.log(`  assets ${path.relative(ROOT, to)}`);
}

// Copied from the pinned @fontsource packages. Only faces the pages actually
// render are listed — see docs/learnings/004.
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

// Files served from the site root rather than /assets (robots.txt, favicons).
function copyStatic() {
  const from = path.join(SRC, 'static');
  for (const entry of fs.readdirSync(from)) {
    fs.copyFileSync(path.join(from, entry), path.join(OUT, entry));
    console.log(`  static site/${entry}`);
  }
}

function writeSitemap() {
  const urls = pages
    .map(
      (page) => `  <url>
    <loc>${pageUrl(page)}</loc>
    <lastmod>${page.updated}</lastmod>
    <priority>${page.priority}</priority>
  </url>`,
    )
    .join('\n');

  // lastmod comes from the registry, not the clock, so rebuilds are byte-stable.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED FILE — do not edit. Source: src/data/pages.js — rebuild with \`npm run build\`. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), xml);
  console.log(`  sitemap site/sitemap.xml (${pages.length} urls)`);
}

// /accessibility/ declares WCAG 2.1 AA, and the tightest pair has little
// margin. Run `npm run contrast` for the full table.
function assertPaletteContrast() {
  assertContrast();
  console.log(`  assert contrast (text >= ${AA_TEXT.toFixed(1)}, ui/focus >= ${AA_UI.toFixed(1)})`);
}

// A missing sr-only utility renders the skip link as visible text — invisible
// to accessibility linters, so it is asserted here.
function assertCriticalUtilities() {
  const css = fs.readFileSync(path.join(OUT, 'assets', 'css', 'main.css'), 'utf8');
  for (const utility of ['.sr-only', 'not-sr-only']) {
    if (!css.includes(utility)) {
      throw new Error(
        `Compiled CSS is missing the ${utility} utility — the skip link would render as visible text. ` +
          'Check the @source directives in src/styles/main.css.',
      );
    }
  }
  console.log('  assert skip-link utilities present');
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

// Clear directories the build owns outright so stale output cannot linger.
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
  copyStatic();
  writeSitemap();
  assertPaletteContrast();
  assertCriticalUtilities();
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
