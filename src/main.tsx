import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { lazyWithRetry } from './utils/lazyWithRetry'

// Panel admin del Club: raíz de render SEPARADA, montada solo cuando la URL
// empieza con /admin. Lazy → la PWA del socio nunca descarga el bundle del
// panel. El SPA fallback de Netlify (/* → index.html) hace que /admin/socios
// también sirva esta misma app.
const isAdminRoute = window.location.pathname.startsWith('/admin')
const AdminApp = lazyWithRetry(() => import('./admin/AdminApp'), 'AdminApp')
// Perfil público /u/<usuario>: árbol aparte SIN el gate de sesión, para que un
// extraño aterrice en el perfil real (prueba social + CTA de registro). Si ya hay
// sesión, PublicProfilePage redirige a la app y lo abre ahí (fase 1).
const isPublicProfileRoute = /^\/u\/[a-z0-9_.]{2,30}$/i.test(window.location.pathname)
const PublicProfilePage = lazyWithRetry(() => import('./public/PublicProfilePage'), 'PublicProfilePage')
import { useAppStore } from './store'
import { initAnalytics, track, errorKind } from './utils/analytics'
import { captureRefFromUrl } from './utils/referral'
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
    // Si el usuario está a mitad de un flujo sensible (onboarding, paywall o el modal
    // de pago abierto), NO recargamos solos — perderíamos el formulario de tarjeta de
    // Stripe / los campos de onboarding (estado React no persistido). Mostramos el
    // banner no-destructivo y él recarga cuando termine.
    const { currentScreen, activeModal, setUpdateReady } = useAppStore.getState()
    const sensitive = currentScreen === 'onboarding' || currentScreen === 'paywall' || activeModal === 'pay'
    if (sensitive) { setUpdateReady(true); return }
    // Fuera de un flujo sensible: auto-actualización inmediata (skipWaiting + reload).
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

// Observabilidad: captura de errores no atrapados y promesas rechazadas. Se
// reportan vía track() → quedan encolados hasta que exista un sink (PostHog) y
// entonces se vacían. Sin esto, un crash o un fallo en el flujo de pago solo iba
// a console.error y el equipo nunca se enteraba (Stripe en LIVE).
// ANALYTICS-1 · P1-A · telemetría de error SIN contenido: NUNCA se envía message/stack/
// source/URL (pueden contener texto de usuario, payloads de Supabase, /u/<usuario>, ?ref).
// Solo el NOMBRE de tipo del error (TypeError…, allowlist-seguro) + la pantalla (enum
// interno). El error crudo queda en console.error para debug local, no en analytics.
const errScreen = () => { try { return useAppStore.getState().currentScreen } catch { return '' } }
window.addEventListener('error', (e) => {
  try { console.error('[client_error]', e.error ?? e.message) } catch { /* noop */ }
  track('client_error', { kind: errorKind(e.error?.name), screen: errScreen() })
})
window.addEventListener('unhandledrejection', (e) => {
  const r = (e as PromiseRejectionEvent).reason
  try { console.error('[client_unhandled_rejection]', r) } catch { /* noop */ }
  track('client_unhandled_rejection', { kind: errorKind(r?.name), screen: errScreen() })
})
// Referido: si la app se abrió con ?ref=<@usuario>, lo guarda para atribuir al registrarse.
captureRefFromUrl()

// Herramienta DEV-ONLY: reset del historial de entrenamiento del usuario autenticado, para
// smokes reproducibles del Composer/cardio/fuerza. `import.meta.env.DEV` es estáticamente false
// en el build de producción → todo este bloque (y el import) se elimina por dead-code-elimination.
// NO expone ninguna acción destructiva en producción. Invocación en dev: window.__resetTrainingHistory().
if (import.meta.env.DEV) {
  void import('./utils/resetTrainingHistory').then((m) => {
    ;(window as unknown as { __resetTrainingHistory?: typeof m.resetTrainingHistoryForCurrentUser })
      .__resetTrainingHistory = m.resetTrainingHistoryForCurrentUser
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isAdminRoute
        ? <React.Suspense fallback={null}><AdminApp /></React.Suspense>
        : isPublicProfileRoute
        ? <React.Suspense fallback={null}><PublicProfilePage /></React.Suspense>
        : <App />}
    </ErrorBoundary>
  </React.StrictMode>
)
