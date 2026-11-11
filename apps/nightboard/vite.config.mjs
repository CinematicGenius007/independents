import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { nightboardSite } from './src/site/plugin.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));

// SITE_URL is the public origin (https://example.org). It turns on canonical links,
// og:image and sitemap.xml, which need absolute URLs. See src/site/meta.mjs.
const site = (process.env.SITE_URL || '').replace(/\/$/, '');

export default defineConfig({
  // Relative base, so the build works from any path on a host, not only the root.
  base: './',
  plugins: [nightboardSite({ root, site })],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',        // the game, start menu on top
        play: 'play.html',          // old address, forwards to /
        handbook: 'handbook.html',  // the manual as a page of its own
        notFound: '404.html',
      },
    },
  },
});
