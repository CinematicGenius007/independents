import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Two suites, two environments.
 *
 * The engine is pure and runs in node. The app needs a document, and says so
 * itself with a `@vitest-environment jsdom` directive at the top of its file, so
 * neither suite pays for the other's setup.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['src/ui/setup.ts'],
    // A reveal is 300ms plus 190ms a cell, and the outcome lands after it, so a
    // test that plays three rows is mostly waiting for the board to finish.
    testTimeout: 15000,
    // jsdom refuses storage on an opaque origin, and Node 22 ships a competing
    // one; the setup file installs a plain store either way.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
  },
})
