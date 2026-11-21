// Page registry — the single list every generated artefact is derived from:
// the HTML files under site/, the footer legal navigation, and sitemap.xml.
//
// slug ''      → site/index.html
// slug 'x'     → site/x/index.html
// navLabel     → included in the footer legal navigation (order preserved)
// updated      → sitemap <lastmod>; set by hand so builds stay deterministic
// priority     → sitemap <priority>
// unlisted     → kept out of sitemap.xml and marked noindex
// referrer     → <meta name="referrer"> value, for pages with secrets in the URL

export const SITE_URL = 'https://paulwerner.net';

export const pages = [
  {
    slug: '',
    file: 'index.ejs',
    title: 'Paul Werner — Software Engineer',
    description:
      'Paul Werner — independent software engineer in Hamburg. Ten years designing and building the systems behind financial services, from payments to regulatory reporting.',
    updated: '2026-11-21',
    priority: '1.0',
  },
  {
    slug: 'book',
    file: 'book.ejs',
    title: 'Book an Appointment — Paul Werner',
    description: 'Pick a free time for a call with Paul Werner.',
    updated: '2026-11-21',
    priority: '0.8',
  },
  {
    // Reached only through the link in a confirmation email, which carries
    // the booking's access token in the query string.
    slug: 'book/manage',
    file: 'book-manage.ejs',
    title: 'Your Appointment — Paul Werner',
    description: 'View or cancel your appointment.',
    unlisted: true,
    referrer: 'no-referrer',
  },
  {
    slug: 'imprint',
    file: 'imprint.ejs',
    title: 'Imprint — Paul Werner',
    description: 'Imprint (Impressum) for paulwerner.net.',
    navLabel: 'Imprint',
    updated: '2026-11-21',
    priority: '0.3',
  },
  {
    slug: 'privacy',
    file: 'privacy.ejs',
    title: 'Privacy Policy — Paul Werner',
    description: 'Privacy policy for paulwerner.net.',
    navLabel: 'Privacy',
    updated: '2026-11-21',
    priority: '0.3',
  },
  {
    slug: 'disclaimer',
    file: 'disclaimer.ejs',
    title: 'Disclaimer — Paul Werner',
    description: 'Disclaimer for paulwerner.net.',
    navLabel: 'Disclaimer',
    updated: '2026-11-21',
    priority: '0.3',
  },
  {
    slug: 'accessibility',
    file: 'accessibility.ejs',
    title: 'Accessibility — Paul Werner',
    description:
      'Accessibility statement for paulwerner.net: WCAG 2.1 AA status, known limitations, and how to report a barrier.',
    navLabel: 'Accessibility',
    updated: '2026-11-21',
    priority: '0.3',
  },
];

export const navPages = pages.filter((page) => page.navLabel);

export const sitemapPages = pages.filter((page) => !page.unlisted);

export const pageUrl = (page) => (page.slug ? `${SITE_URL}/${page.slug}/` : `${SITE_URL}/`);

export const pagePath = (page) => (page.slug ? `${page.slug}/index.html` : 'index.html');
