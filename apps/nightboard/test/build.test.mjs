/* Runs the real production build twice (with and without SITE_URL) and checks the website it
 * produces: every page and file is there, no placeholder is left, and every local link and
 * asset reference resolves to a file in the build. pnpm test */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { build } from 'vite';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'nightboard-build-'));
const HTML = ['index.html', 'play.html', 'handbook.html', '404.html'];

async function buildSite(name, site) {
  const outDir = join(tmp, name);
  const before = process.env.SITE_URL;
  if (site) process.env.SITE_URL = site; else delete process.env.SITE_URL;
  try {
    // vite.config.mjs is loaded fresh on each build, so it sees SITE_URL as set here
    await build({ root, logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  } finally {
    if (before === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = before;
  }
  return { dir: outDir, read: (f) => readFileSync(join(outDir, f), 'utf8') };
}

let plain, hosted;
beforeAll(async () => {
  plain = await buildSite('plain', '');
  hosted = await buildSite('hosted', 'https://example.org');
}, 60_000);
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('production build', () => {
  test('emits every page and site file', () => {
    for (const f of [...HTML, 'robots.txt', 'llms.txt', 'llms-full.txt', 'site.webmanifest', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'og.jpg']) {
      expect(existsSync(join(hosted.dir, f)), f).toBe(true);
    }
    expect(existsSync(join(hosted.dir, 'sitemap.xml'))).toBe(true);
    expect(existsSync(join(plain.dir, 'sitemap.xml'))).toBe(false);
  });

  test('leaves no placeholder behind', () => {
    for (const f of HTML) expect(hosted.read(f), f).not.toContain('<!--site:');
  });

  test('every local href and src points at a file in the build', () => {
    for (const f of HTML.filter((x) => x !== '404.html')) {   // 404.html links root-relative on purpose
      const html = plain.read(f);
      const refs = [...html.matchAll(/\s(?:href|src)="([^"#]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:|\/)/.test(u));
      expect(refs.length, f).toBeGreaterThan(0);
      for (const ref of refs) {
        const target = ref === './' ? 'index.html' : ref.replace(/^\.\//, '');
        expect(existsSync(join(plain.dir, dirname(f), target)), `${f} -> ${ref}`).toBe(true);
      }
    }
  });

  test('the 404 page links to the site root, since it is served at any path', () => {
    const page = plain.read('404.html');
    const refs = [...page.matchAll(/\s(?:href|src)="([^"#]+)"/g)].map((m) => m[1]);
    expect(refs).toContain('/favicon.svg');
    for (const ref of refs) expect(ref, ref).toMatch(/^(\/|https?:)/);
    for (const ref of refs.filter((r) => r.startsWith('/') && r.length > 1 && r !== '/play')) expect(existsSync(join(plain.dir, ref)), ref).toBe(true);
  });

  test('the game page loads its script and styles, and the styles find the photo', () => {
    const play = plain.read('play.html');
    expect(play).toMatch(/<script type="module"[^>]*src="\.\/assets\/play-[\w-]+\.js"/);
    const css = readdirSync(join(plain.dir, 'assets')).filter((f) => f.endsWith('.css')).map((f) => plain.read(`assets/${f}`)).join('\n');
    const photo = css.match(/url\((?:"|')?\.?\/?([\w./-]*er-floor-[\w-]+\.webp)/);
    expect(photo, 'er-floor.webp is referenced from the game css').not.toBeNull();
    expect(existsSync(join(plain.dir, 'assets', photo[1].split('/').pop()))).toBe(true);
  });

  test('the landing page starts the game, finds its photo and has no FAQ', () => {
    const page = plain.read('index.html');
    expect(page.match(/href="(?:\.\/)?play\.html"/g).length).toBeGreaterThanOrEqual(3);   // hero, phone hero, closing
    expect(page).toMatch(/<h1>Nightboard<\/h1>/);
    expect(page).not.toMatch(/<details|id="faq"/);
    const photo = page.match(/url\((?:"|')?\.?\/?([\w./-]*er-floor-[\w-]+\.webp)/);
    expect(photo, 'the hero photo is bundled').not.toBeNull();
    expect(existsSync(join(plain.dir, photo[1].replace(/^\.\//, '')))).toBe(true);
  });

  test('the handbook page carries every section', () => {
    const page = plain.read('handbook.html');
    for (const id of ['start', 'controls', 'cases', 'lens']) expect(page).toContain(`<section id="${id}">`);
  });

  test('SITE_URL turns on absolute canonical and social image URLs', () => {
    expect(hosted.read('index.html')).toContain('<link rel="canonical" href="https://example.org/">');
    expect(hosted.read('play.html')).toContain('content="https://example.org/og.jpg"');
    expect(plain.read('index.html')).not.toContain('canonical');
  });
});
