import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/healthyspaceclub/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Healthy Space Club',
        short_name: 'Healthy Space',
        description: 'Tu espacio de bienestar — nutrición, entrenamiento y mentalidad',
        start_url: '/',
        display: 'standalone',
        background_color: '#F6F2EA',
        theme_color: '#2E4A42',
        orientation: 'any',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ],
        categories: ['health', 'fitness', 'lifestyle'],
        lang: 'es',
        dir: 'ltr'
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  }
})
