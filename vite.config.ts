import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt' (no 'autoUpdate'): el SW nuevo queda en waiting hasta que el
      // usuario acepta recargar (ver main.tsx + UpdatePrompt). Evita que la app
      // viva siga corriendo el bundle viejo tras un deploy sin avisar.
      // injectRegister:false → registramos vía virtual:pwa-register en main.tsx
      // (si no, el plugin inyecta un registerSW.js extra = doble registro).
      // OJO: esto SOLO aplica a web/PWA instalada. El build iOS nativo (Capacitor,
      // webDir bundled, sin server.url) NO corre service worker — se actualiza por
      // rebuild + App Store, no por este flow.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Healthy Space Club',
        short_name: 'Healthy Space',
        description: 'Tu espacio de bienestar — nutrición, entrenamiento y mentalidad',
        start_url: '/',
        display: 'standalone',
        background_color: '#F6F2EA',
        theme_color: '#153330',
        orientation: 'any',
        icons: [
          { src: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
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
