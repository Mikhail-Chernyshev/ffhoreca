import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Для GitHub Pages (проектный сайт) задай при сборке VITE_BASE_PATH=/имя-репозитория/ или переменную репозитория в Actions.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    // GitHub Pages: 404.html = index.html, чтобы работали прямые ссылки без hash-роутинга
    {
      name: 'gh-pages-spa-fallback',
      closeBundle() {
        copyFileSync(resolve('dist/index.html'), resolve('dist/404.html'))
      },
    },
  ],
  optimizeDeps: {
    /* react-map-gl v8 не экспортирует "." — только react-map-gl/maplibre; не включать корень. */
    include: ['maplibre-gl'],
  },
})
