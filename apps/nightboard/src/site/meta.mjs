/* Build-time only (Node): everything a website needs besides its pages.
 *   headTags()   <head> for each page: title, description, icons, manifest, Open Graph, Twitter card
 *   jsonLd()     structured data for search engines (WebSite + VideoGame)
 *   siteFiles()  robots.txt, sitemap.xml, site.webmanifest, llms.txt, llms-full.txt
 *
 * `site` is the public origin without a trailing slash, from SITE_URL at build time, or ''.
 * Canonical links, og:url, og:image and the sitemap need absolute URLs, so without a site they
 * are left out rather than written wrong. Everything else uses relative paths, so a build also
 * works opened from disk. */
import { esc } from './handbook.mjs';

export const NAME = 'Flatline';
export const BLURB = 'A browser game where you run an emergency department at night as the charge nurse. Give out beds, call in teams and keep the hospital from jamming.';
export const THEME = '#0d1724';
export const OG_IMAGE = '/og.jpg';   // public/og.jpg, 1200x630

/** Every HTML page the build emits, keyed by file name. `path` is its public URL. */
export const PAGES = {
  'index.html': { path: '/', title: `${NAME}: run an emergency department tonight`, description: BLURB, sitemap: '1.0' },   // the game, with the start menu on top
  'play.html': { path: '/play', title: `${NAME}: run an emergency department tonight`, description: BLURB, noindex: true },   // old address, forwards to /
  'handbook.html': { path: '/handbook', title: `${NAME} Handbook: how to play, every control and condition`, description: `The complete manual for ${NAME}: the rules, the screen, vital signs and NEWS2, every action, every alert, every condition and a glossary.`, sitemap: '0.8' },
  '404.html': { path: '/404', title: `Not found · ${NAME}`, description: BLURB, noindex: true },
};

export function headTags(page, site = '') {
  const url = site && !page.noindex ? `${site}${page.path}` : '';
  const image = site ? `${site}${OG_IMAGE}` : '';
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    page.noindex && '<meta name="robots" content="noindex">',
    url && `<link rel="canonical" href="${url}">`,
    `<meta name="theme-color" content="${THEME}">`,
    '<meta name="color-scheme" content="dark light">',
    '<link rel="icon" href="favicon.ico" sizes="32x32">',
    '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="apple-touch-icon.png">',
    '<link rel="manifest" href="site.webmanifest">',
    `<meta property="og:site_name" content="${NAME}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    url && `<meta property="og:url" content="${url}">`,
    image && `<meta property="og:image" content="${image}">`,
    image && '<meta property="og:image:width" content="1200">',
    image && '<meta property="og:image:height" content="630">',
    image && `<meta property="og:image:alt" content="${NAME}: twelve hours, twenty-one beds, you decide who gets one.">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    `<meta name="twitter:description" content="${esc(page.description)}">`,
    image && `<meta name="twitter:image" content="${image}">`,
  ].filter(Boolean).join('\n');
}

export function jsonLd(site = '') {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: NAME, description: BLURB, inLanguage: 'en', ...(site && { url: `${site}/` }) },
      {
        '@type': 'VideoGame', name: NAME, description: BLURB, inLanguage: 'en',
        genre: ['Simulation', 'Strategy', 'Management'], gamePlatform: 'Web browser', applicationCategory: 'Game', operatingSystem: 'Any', playMode: 'SinglePlayer',
        ...(site && { url: `${site}/`, image: `${site}${OG_IMAGE}` }),
      },
    ],
  };
  // "<" is escaped so no string in the data can close the script element early
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** The non-HTML files, as { fileName: contents }. `handbookMarkdown` is compileHandbook().markdown. */
export function siteFiles(site, handbookMarkdown) {
  // absolute when the site is known, otherwise relative to the file, so it works from disk too
  const link = (path, file) => (site ? `${site}${path}` : file);
  const files = {
    'robots.txt': `User-agent: *\nAllow: /\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ''}`,
    'site.webmanifest': `${JSON.stringify({
      name: NAME, short_name: NAME, description: BLURB, start_url: './', scope: './', display: 'standalone', orientation: 'any', background_color: THEME, theme_color: THEME,
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }, null, 2)}\n`,
    // llms.txt (llmstxt.org): a plain summary for AI search and assistants, with the whole manual beside it
    'llms.txt': `# ${NAME}\n\n> ${BLURB}\n\nThe player is the charge nurse of Harbourside General's emergency department (a fictional hospital), from 19:00 to 07:00. They never treat patients. They decide who gets which bed, who goes first, what is held back, who is called in from home, and when two patients swap places. Two rules drive the simulation: a care step starts only when everything it needs is free at the same moment, and a patient keeps the place they are in until the next place is theirs. It runs in any modern browser, on desktop and on phones, with no account. Medical content is plausible game content and has not been reviewed by a clinician.\n\n## Play\n\n- [Play ${NAME}](${link('/', './')}): the game. For a different night add ?seed=ANYTHING.\n\n## Docs\n\n- [Handbook](${link('/handbook', 'handbook.html')}): how to play, every control, every condition, glossary.\n- [Full handbook as text](${link('/llms-full.txt', 'llms-full.txt')}): the same manual in Markdown.\n`,
    'llms-full.txt': `# ${NAME} Handbook\n\n> ${BLURB}\n\n${handbookMarkdown}`,
  };
  if (site) {
    const urls = Object.values(PAGES).filter((p) => p.sitemap).map((p) => `  <url><loc>${site}${p.path}</loc><priority>${p.sitemap}</priority></url>`);
    files['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  }
  return files;
}
