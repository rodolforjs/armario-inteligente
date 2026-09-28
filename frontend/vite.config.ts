import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/prendas': 'http://127.0.0.1:8000',
      '/zonas': 'http://127.0.0.1:8000',
      '/recomendaciones': 'http://127.0.0.1:8000',
      '/eventos': 'http://127.0.0.1:8000',
      '/leds': 'http://127.0.0.1:8000',
      '/estado': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: '../app/static',
    emptyOutDir: true,
  },
})
