import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { useAppStore } from './store'
import { initAnalytics } from './utils/analytics'
import './index.css'
import './styles/wizard.css'

// ── PWA auto-update (web + PWA instalada) ──────────────────────────────────
// registerType:'prompt' → el SW nuevo queda en waiting; avisamos al usuario y
// recién al tap recargamos (skipWaiting + reload), sin romper estado mid-flow.
// NOTA: el build iOS nativo de Capacitor NO corre service worker (assets
// empaquetados, sin server.url) — se actualiza por rebuild + App Store. Acá
// `registerSW` simplemente no registra nada en ese entorno y no estorba.
// Recarga explícita cuando el SW nuevo toma control. vite-plugin-pwa hace esto
// internamente vía `controllerchange`, pero en desktop a veces no dispara la
// recarga (su listener se registra tarde / el evento ya ocurrió) → el botón
// "Recargar" no hacía nada. Registramos NUESTRO listener primero.
let swRefreshing = false
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRefreshing) return
    swRefreshing = true
    window.location.reload()
  })
}

const updateSW = registerSW({
  onNeedRefresh() {
    // Auto-actualización: en cuanto se detecta una versión nueva, aplicamos el
    // SW (skipWaiting) y recargamos solos — sin banner ni botón. El controllerchange
    // de arriba dispara la recarga; el setTimeout es respaldo para desktop.
    Promise.resolve(updateSW(true)).catch(() => {})
    setTimeout(() => { if (!swRefreshing) window.location.reload() }, 3000)
  },
  onRegisteredSW(_swUrl, r) {
    if (!r) return
    // Un PWA standalone casi nunca navega → chequeo activo y agresivo para que
    // el aviso de "nueva versión" aparezca en segundos, no en horas:
    //  - una vez al cargar
    //  - cada 60s
    //  - al volver a la app (tab visible) o recuperar foco
    //  - al reconectar a internet
    const check = () => { r.update().catch(() => {}) }
    check()
    setInterval(check, 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
  },
})
useAppStore.getState().setTriggerUpdate(() => {
  // skipWaiting + activa el SW nuevo → dispara controllerchange (recarga arriba).
  Promise.resolve(updateSW(true)).catch(() => {})
  // Fallback: si en ~2.5s no recargó (algún desktop no dispara controllerchange
  // del worker en waiting), forzamos recarga — el skipWaiting ya corrió, así que
  // trae el bundle nuevo.
  setTimeout(() => { if (!swRefreshing) window.location.reload() }, 2500)
})

// Analítica: resuelve el proveedor (si pegaste el snippet de PostHog/Segment) y
// vacía los eventos encolados. No-op si no hay ninguno.
initAnalytics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
