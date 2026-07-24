import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // sql.js ships a wasm file that we serve from /public and load lazily.
  optimizeDeps: { include: ['sql.js/dist/sql-wasm.js'] },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          net: ['trystero/nostr', 'trystero/mqtt'],
          db: ['sql.js/dist/sql-wasm.js'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
