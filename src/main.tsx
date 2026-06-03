import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { useAppStore } from './store'
import './index.css'
import './styles/wizard.css'

// ── PWA auto-update (web + PWA instalada) ──────────────────────────────────
// registerType:'prompt' → el SW nuevo queda en waiting; avisamos al usuario y
// recién al tap recargamos (skipWaiting + reload), sin romper estado mid-flow.
// NOTA: el build iOS nativo de Capacitor NO corre service worker (assets
// empaquetados, sin server.url) — se actualiza por rebuild + App Store. Acá
// `registerSW` simplemente no registra nada en ese entorno y no estorba.
const updateSW = registerSW({
  onNeedRefresh() {
    useAppStore.getState().setUpdateReady(true)
  },
  onRegisteredSW(_swUrl, r) {
    if (!r) return
    // Un PWA standalone casi nunca navega → chequeo activo de versión nueva:
    // cada 60 min y cada vez que el usuario vuelve a la app (tab visible).
    setInterval(() => { r.update() }, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') r.update()
    })
  },
})
useAppStore.getState().setTriggerUpdate(() => { updateSW(true) })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
