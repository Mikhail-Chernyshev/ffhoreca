import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    /* react-map-gl v8 не экспортирует "." — только react-map-gl/maplibre; не включать корень. */
    include: ['maplibre-gl'],
  },
})
