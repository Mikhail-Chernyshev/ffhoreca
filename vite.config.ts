import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Для GitHub Pages (проектный сайт) задай при сборке VITE_BASE_PATH=/имя-репозитория/ или переменную репозитория в Actions.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  optimizeDeps: {
    /* react-map-gl v8 не экспортирует "." — только react-map-gl/maplibre; не включать корень. */
    include: ['maplibre-gl'],
  },
})
