import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // En dev, /api est relayé vers NestJS : pas de souci de CORS.
    proxy: {
      // API_PROXY_TARGET permet de viser une autre API (ex. base de test).
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
    },
  },
})
