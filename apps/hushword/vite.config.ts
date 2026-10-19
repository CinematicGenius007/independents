import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base, so a built copy opens from a plain file as well as from a host.
export default defineConfig({
  base: './',
  plugins: [react()],
})
