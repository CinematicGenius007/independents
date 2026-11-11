/* Build-time only: the Vite plugin that turns four HTML pages into the website.
 *
 *   virtual:handbook        the compiled handbook, imported by src/ui/handbook.js and tutorial.js
 *   <!--site:head-->        each page's <head> tags, from PAGES in meta.mjs
 *   <!--site:jsonld-->      structured data (landing page)
 *   <!--site:mark-->        the logo, inlined from public/favicon.svg (landing page)
 *   <!--site:handbook-nav--> and <!--site:handbook-main-->   the manual as a static page
 *   robots.txt, sitemap.xml, site.webmanifest, llms.txt, llms-full.txt   emitted with the build
 *   404.html                its links rooted at /, since it is served at any missing path
 *
 * In `pnpm dev` the handbook reloads when docs/HANDBOOK.md or a diagram changes. A change to
 * guide-text.js or the case book reaches the handbook after restarting the dev server. */
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { compileHandbook, esc } from './handbook.mjs';
import { PAGES, headTags, jsonLd, siteFiles } from './meta.mjs';
import { GUIDE } from '../ui/guide-text.js';
import { CASES } from '../engine/casebook.mjs';
import { KINDS } from '../engine/hospital.mjs';

const VIRTUAL = 'virtual:handbook';
const RESOLVED = `\0${VIRTUAL}`;

/**
 * @param {object} o
 * @param {string} o.root  the app directory
 * @param {string} o.site  public origin without a trailing slash, or '' (see meta.mjs)
 */
export function nightboardSite({ root, site }) {
  const read = (f) => readFileSync(join(root, f), 'utf8');
  const diagram = (name) => read(`diagrams/${name}`);
  let compiled = null;
  const handbook = () => (compiled ??= compileHandbook({ markdown: read('docs/HANDBOOK.md'), guide: GUIDE, cases: CASES, kinds: KINDS, diagram }));
  const mark = () => read('public/favicon.svg').trim().replace(/<title>.*?<\/title>\s*/, '').replace('<svg ', '<svg aria-hidden="true" ');

  const main = {
    name: 'nightboard-site',

    configResolved(config) {
      if (config.command === 'build' && !site) config.logger.warn('SITE_URL is not set: canonical links, og:image and sitemap.xml are left out of this build.');
    },

    resolveId(id) { return id === VIRTUAL ? RESOLVED : undefined; },
    load(id) {
      if (id !== RESOLVED) return undefined;
      this.addWatchFile(join(root, 'docs/HANDBOOK.md'));
      // only what the game draws: the jam diagram is reused by Orientation
      return `export default ${JSON.stringify({ sections: handbook().sections, diagrams: { jam: diagram('jam.svg') } })};`;
    },
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('docs/HANDBOOK.md') && !file.includes('/diagrams/')) return undefined;
      compiled = null;
      const mod = server.moduleGraph.getModuleById(RESOLVED);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: 'full-reload' });
      return [];
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const file = basename(ctx.filename), page = PAGES[file];
        if (!page) throw new Error(`${file} is not listed in PAGES (src/site/meta.mjs)`);
        const { sections } = handbook();
        return html
          .replace('<!--site:head-->', () => headTags(page, site))
          .replace('<!--site:jsonld-->', () => jsonLd(site))
          .replace('<!--site:mark-->', mark)
          .replace('<!--site:handbook-nav-->', () => sections.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join(''))
          .replace('<!--site:handbook-main-->', () => sections.map((s) => `<section id="${s.id}">${s.html}</section>`).join('\n'));
      },
    },

    generateBundle() {
      for (const [fileName, source] of Object.entries(siteFiles(site, handbook().markdown))) this.emitFile({ type: 'asset', fileName, source });
    },
  };

  // 404.html is served at whatever path was missing (/a/b/c), so relative links on it would
  // point nowhere. After Vite has resolved its URLs (relative, since base is './'), root them.
  const rootNotFound = {
    name: 'nightboard-site:404',
    transformIndexHtml: {
      order: 'post',
      handler: (html, ctx) => (basename(ctx.filename) === '404.html'
        ? html.replace(/\b(href|src)="(?![a-z][a-z0-9+.-]*:|\/|#)(?:\.\/)?/gi, '$1="/')
        : html),
    },
  };

  return [main, rootNotFound];
}
