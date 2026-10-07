import { defineConfig } from 'vitest/config'

// The browser client runs in plain Node with a fake socket; it never touches
// the Workers runtime, so it gets its own config without the Cloudflare plugin.
export default defineConfig({
  test: { include: ['client/**/*.test.ts'], environment: 'node' },
})
