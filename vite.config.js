import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5174, strictPort: false },
  test: {
    // Ensure vite config doesn't break vitest; actual config in vitest.config.ts
  }
})
