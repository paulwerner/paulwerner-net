// Page registry — the single list every generated artefact is derived from:
// the HTML files under site/, the footer legal navigation, and sitemap.xml.
//
// slug ''      → site/index.html
// slug 'x'     → site/x/index.html
// navLabel     → included in the footer legal navigation (order preserved)
// updated      → sitemap <lastmod>; set by hand so builds stay deterministic
// priority     → sitemap <priority>

export const SITE_URL = 'https://paulwerner.net';

export const pages = [
  {
    slug: '',
    file: 'index.ejs',
    title: 'Paul Werner — Software Engineer',
    description:
      'Paul Werner — software engineer based in Berlin. Systems, craft, and quiet engineering.',
    updated: '2026-07-25',
    priority: '1.0',
  },
  {
    slug: 'imprint',
    file: 'imprint.ejs',
    title: 'Imprint — Paul Werner',
    description: 'Imprint (Impressum) for paulwerner.net.',
    navLabel: 'Imprint',
    updated: '2026-07-25',
    priority: '0.3',
  },
  {
    slug: 'privacy',
    file: 'privacy.ejs',
    title: 'Privacy Policy — Paul Werner',
    description: 'Privacy policy for paulwerner.net.',
    navLabel: 'Privacy',
    updated: '2026-07-25',
    priority: '0.3',
  },
  {
    slug: 'disclaimer',
    file: 'disclaimer.ejs',
    title: 'Disclaimer — Paul Werner',
    description: 'Disclaimer for paulwerner.net.',
    navLabel: 'Disclaimer',
    updated: '2026-07-25',
    priority: '0.3',
  },
];

export const navPages = pages.filter((page) => page.navLabel);

export const pageUrl = (page) => (page.slug ? `${SITE_URL}/${page.slug}/` : `${SITE_URL}/`);

export const pagePath = (page) => (page.slug ? `${page.slug}/index.html` : 'index.html');
