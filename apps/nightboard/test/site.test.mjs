/* The handbook compiler and the site metadata (src/site). pnpm test */
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { compileHandbook, md2html } from '../src/site/handbook.mjs';
import { PAGES, headTags, jsonLd, siteFiles } from '../src/site/meta.mjs';
import { GUIDE } from '../src/ui/guide-text.js';
import { CASES } from '../src/engine/casebook.mjs';
import { KINDS } from '../src/engine/hospital.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const real = () => compileHandbook({ markdown: read('docs/HANDBOOK.md'), guide: GUIDE, cases: CASES, kinds: KINDS, diagram: (n) => read(`diagrams/${n}`) });

describe('md2html', () => {
  test('renders each block type of the subset', () => {
    const html = md2html('## Two\n\nA **b** *i* `c` line\nwraps.\n\n| H | I |\n| --- | --- |\n| 1 | 2 |\n\n> note\n> more\n\n- a\n- b\n\n1. x\n\n![Cap](d.svg)', () => '<svg/>');
    expect(html).toContain('<h2>Two</h2>');
    expect(html).toContain('<p>A <b>b</b> <i>i</i> <code>c</code> line wraps.</p>');
    expect(html).toContain('<thead><tr><th>H</th><th>I</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody>');
    expect(html).toContain('<blockquote><p>note more</p></blockquote>');
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>');
    expect(html).toContain('<ol><li>x</li></ol>');
    expect(html).toContain('<figure><svg/><figcaption>Cap</figcaption></figure>');
  });
  test('escapes HTML in the text', () => {
    expect(md2html('a <script> & b')).toBe('<p>a &lt;script&gt; &amp; b</p>');
  });
});

describe('compileHandbook', () => {
  const tiny = (md) => compileHandbook({ markdown: md, guide: {}, cases: {}, kinds: {}, diagram: () => '' });

  test('the real handbook compiles, with the generated sections before the Engineer Lens', () => {
    const { sections, markdown } = real();
    const ids = sections.map((s) => s.id);
    expect(ids.indexOf('controls')).toBeGreaterThan(0);
    expect(ids.indexOf('cases')).toBe(ids.indexOf('controls') + 1);
    expect(ids.indexOf('lens')).toBeGreaterThan(ids.indexOf('cases'));
    expect(markdown).not.toMatch(/\{#/);   // ids are stripped from the plain-text copy
  });
  test('every Guide Mode entry and every condition appears in it', () => {
    const { sections } = real();
    const html = (id) => sections.find((s) => s.id === id).html;
    for (const [, title] of Object.values(GUIDE)) expect(html('controls')).toContain(title.replace(/&/g, '&amp;'));
    for (const c of Object.values(CASES)) expect(html('cases')).toContain(`<h2>${c.title}</h2>`);
  });
  test('rejects a section without an id, a duplicate id and a dangling Guide link', () => {
    expect(() => tiny('# No id\n\n# The Engineer Lens {#lens}\n')).toThrow(/needs an \{#id\}/);
    expect(() => tiny('# A {#a}\n\n# B {#a}\n\n# The Engineer Lens {#lens}\n')).toThrow(/duplicate/);
    expect(() => compileHandbook({ markdown: '# The Engineer Lens {#lens}\n', guide: { k: ['Top', 'X', '', '', 'nowhere'] }, cases: {}, kinds: {}, diagram: () => '' })).toThrow(/missing handbook section "nowhere"/);
    expect(() => tiny('# A {#a}\n')).toThrow(/Engineer Lens/);
  });
});

describe('meta', () => {
  test('without a site, nothing that needs an absolute URL is written', () => {
    const head = headTags(PAGES['play.html']);
    expect(head).not.toMatch(/canonical|og:url|og:image/);
    expect(head).toContain('<link rel="manifest" href="site.webmanifest">');
    expect(siteFiles('', '')).not.toHaveProperty('sitemap.xml');
    expect(siteFiles('', '')['llms.txt']).toContain('](play.html)');
  });
  test('with a site, canonical, og:image, sitemap and llms.txt use it', () => {
    const site = 'https://example.org';
    const head = headTags(PAGES['play.html'], site);
    expect(head).toContain('<link rel="canonical" href="https://example.org/play">');
    expect(head).toContain('<meta property="og:image" content="https://example.org/og.jpg">');
    const files = siteFiles(site, '');
    expect(files['sitemap.xml']).toContain('<loc>https://example.org/handbook</loc>');
    expect(files['sitemap.xml']).not.toContain('/404');
    expect(files['robots.txt']).toContain('Sitemap: https://example.org/sitemap.xml');
    expect(files['llms.txt']).toContain('](https://example.org/play)');
  });
  test('the 404 page is never indexed or canonical', () => {
    const head = headTags(PAGES['404.html'], 'https://example.org');
    expect(head).toContain('noindex');
    expect(head).not.toContain('canonical');
  });
  test('structured data is valid JSON that cannot close its script tag', () => {
    const tag = jsonLd('https://example.org/</script>');
    const json = tag.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(json).not.toContain('</');
    expect(JSON.parse(json)['@graph'][1]['@type']).toBe('VideoGame');
  });
  test('the manifest is valid JSON and points at icons that exist', () => {
    const manifest = JSON.parse(siteFiles('', '')['site.webmanifest']);
    for (const icon of manifest.icons) expect(() => read(`public/${icon.src}`)).not.toThrow();
  });
});
