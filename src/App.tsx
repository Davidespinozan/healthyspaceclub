import { dayKey } from './utils/localDate';
import { identify } from './utils/analytics';
import { signedInScreen } from './utils/authProviders';
import { sincronizarPush } from './utils/push';
import { useAutoRegenPlan, useWeeklyPlanReset } from './utils/useAutoRegenPlan';
import { runProfileHydration, fetchWithTimeout, shouldShowAccountLoader, type ProfileResolution } from './utils/profileHydration';
import AccountLoadingState from './components/AccountLoadingState';
import { ensureLocaleAssets } from './utils/localeAssets';
import { useEffect, useState, useRef, Suspense } from 'react';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { useAppStore } from './store';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from './lib/supabase';
import { shouldUseRemotePlan } from './utils/planSync';
import { shouldUseRemoteWorkout } from './utils/dailyWorkoutSync';
import { mergeMealProgress } from './utils/mealProgressSync';
import {
  mapWorkoutLogRowToSession,
  mergeWorkoutSessions,
  type WorkoutLogRow,
} from './utils/workoutSync';
import { flushPendingWorkouts } from './utils/workoutOutbox';
import { bootstrapVideoAvailability } from './utils/syncVideoAvailability';   // F2C-9A.1 · disponibilidad de video en runtime
import { isStrengthDomainSession } from './utils/trainingDomain';   // F2C-9B.2 · strength credit por SESIÓN
import { isWorkingSet, type ExecutionRole } from './utils/executionRole';   // F2C-9C.1 · lastPerf hydration solo working
import type { Modality } from './types';
import { detectBrowserLanguage } from './i18n';
import LandingScreen from './screens/LandingScreen';
import UpdatePrompt from './components/UpdatePrompt';
import OfflineBanner from './components/OfflineBanner';

const LoginScreen = lazyWithRetry(() => import('./screens/LoginScreen'), 'LoginScreen');
const OnboardingScreen = lazyWithRetry(() => import('./screens/OnboardingScreen'), 'OnboardingScreen');
const DashboardScreen = lazyWithRetry(() => import('./screens/DashboardScreen'), 'DashboardScreen');
const ResetPasswordScreen = lazyWithRetry(() => import('./screens/ResetPasswordScreen'), 'ResetPasswordScreen');
const PaywallScreen = lazyWithRetry(() => import('./screens/PaywallScreen'), 'PaywallScreen');
const PaymentModal = lazyWithRetry(() => import('./components/modals/PaymentModal'), 'PaymentModal');
const SignupModal = lazyWithRetry(() => import('./components/modals/SignupModal'), 'SignupModal');
const VideoModal = lazyWithRetry(() => import('./components/modals/VideoModal'), 'VideoModal');

export default function App() {
  const { currentScreen, activeModal } = useAppStore(useShallow((s) => ({ currentScreen: s.currentScreen, activeModal: s.activeModal })));
  // Regenera el plan si quedó guardado con un motor viejo — desde cualquier
  // pantalla, no solo desde Nutrición (ahí la tarjeta de Inicio se quedaba vieja).
  useAutoRegenPlan();
  useWeeklyPlanReset();
  const setSession = useAppStore(s => s.setSession);
  const setAuthReady = useAppStore(s => s.setAuthReady);
  const authReady = useAppStore(s => s.authReady);
  const startDate = useAppStore(s => s.startDate);
  const user = useAppStore(s => s.user);
  const rawSubscriptionStatus = useAppStore(s => s.subscriptionStatus);
  const subscriptionStatusLoadedFor = useAppStore(s => s.subscriptionStatusLoadedFor);
  const subscriptionPeriodEnd = useAppStore(s => s.subscriptionPeriodEnd);
  const cancelAtPeriodEnd = useAppStore(s => s.cancelAtPeriodEnd);
  const paymentPastDue = useAppStore(s => s.paymentPastDue);
  const language = useAppStore(s => s.language);
  // "loaded" keyado por usuario: solo cuenta si el status cargado es del user actual.
  const subscriptionStatusLoaded = !!user && subscriptionStatusLoadedFor === user.id;

  // Contenido EN (ejercicios/comidas) se carga bajo demanda → no en el bundle inicial.
  // Esperamos a que esté antes de montar el dashboard en EN (evita flash de ES).
  const [assetsReady, setAssetsReady] = useState(() => useAppStore.getState().language !== 'en');
  useEffect(() => {
    if (language !== 'en') { setAssetsReady(true); return; }
    setAssetsReady(false);
    let done = false;
    const open = () => { if (!done) { done = true; setAssetsReady(true); } };
    // Failsafe: .catch cubre un RECHAZO, pero si loadExercisesEn/loadMealPlanEn se
    // CUELGAN (chunk viejo tras redeploy, red estancada) nunca settlean → dashboard
    // en spinner infinito. A los 6s abrimos el gate igual (peor caso: nombres en ES).
    const t = setTimeout(open, 6000);
    ensureLocaleAssets('en').then(open).catch(open).finally(() => clearTimeout(t));
    return () => clearTimeout(t);
  }, [language]);

  // F2C-9A.1 · disponibilidad de video en runtime. UN solo bootstrap global (contenido público, no
  // per-usuario): overlay ← LKG (localStorage, síncrono) + fresh sync de exercise_videos (fire-and-forget).
  // Sin soft-gate: la app genera de inmediato con snapshot ∪ LKG; el live corrige/mejora después. Sin red
  // no rompe (snapshot es el floor). NO toca cardioMain/workoutPlanner/cardioPlayability.
  useEffect(() => { bootstrapVideoAvailability(); }, []);

  // ── MVP-RESILIENCE-1 · Hidratación RESILIENTE del perfil (routing) ─────────────
  // Atado a [authReady, user?.id] → corre también en reload/INITIAL_SESSION (no solo
  // en SIGNED_IN), en cambio de cuenta y en un futuro callback de proveedor externo. Con timeout
  // por-request + reintentos acotados. Su ESTADO (profileResolution) gatea el render de
  // onboarding: un usuario que vuelve en un dispositivo limpio NUNCA ve onboarding por
  // un fallo transitorio de red; ve una pantalla neutral de carga/reintento. NO toca la
  // ruta de SIGNED_IN (AUTH-PROVIDERS) ni el resto de la hidratación existente.
  const [profileResolution, setProfileResolution] = useState<ProfileResolution>('idle');
  const [profileRetryTick, setProfileRetryTick] = useState(0);
  useEffect(() => {
    if (!authReady) return;
    if (!user) { setProfileResolution('idle'); return; }
    const uid = user.id;
    let cancelled = false;
    setProfileResolution('loading');
    (async () => {
      const status = await runProfileHydration({
        fetchProfile: () => fetchWithTimeout(async () => {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('display_name, username, avatar_url, ob_data, start_date, tdee, plan_goal, meal_plan_key, user_plan, trial_ends_at')
            .eq('user_id', uid)
            .maybeSingle();
          return { data, error };
        }, 10_000),
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        // Guard anti-cambio-de-cuenta: dataOwnerId es la señal fiable (se reclama al firmar).
        isCurrent: () => !cancelled && useAppStore.getState().dataOwnerId === uid,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onResolvedRow: (p: any) => {
          if (cancelled || useAppStore.getState().dataOwnerId !== uid) return;
          useAppStore.setState({
            userName: p.display_name || p.username || useAppStore.getState().userName || '',
            username: p.username ?? useAppStore.getState().username,
            avatarUrl: p.avatar_url ?? null,
            obData: (p.ob_data as Record<string, string | number>) ?? {},
            startDate: p.start_date ?? '',
            tdee: p.tdee ?? 0,
            planGoal: p.plan_goal ?? 0,
            mealPlanKey: p.meal_plan_key ?? 'planA',
            userPlan: (p.user_plan ?? 'none') as 'none' | 'trial' | 'pro',
            trialEndsAt: p.trial_ends_at ?? null,
          });
        },
        onResolvedEmpty: () => { /* usuario nuevo real: startDate queda '' → onboarding legítimo */ },
      });
      if (cancelled) return;
      if (status !== 'idle') setProfileResolution(status); // 'idle' = abortado por cambio de cuenta
    })();
    return () => { cancelled = true; };
    // profileRetryTick fuerza un reintento manual/passive sin cambiar de usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user?.id, profileRetryTick]);

  // Recuperación pasiva: si quedó en 'error', reintenta al volver online o a foco.
  useEffect(() => {
    if (profileResolution !== 'error') return;
    const retry = () => setProfileRetryTick((n) => n + 1);
    const onVis = () => { if (document.visibilityState === 'visible') retry(); };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [profileResolution]);

  // Tope de seguridad por period_end (independiente de la zona horaria del user
  // — comparamos instantes UTC). Si la suscripción está CANCELADA-al-fin-de-ciclo
  // o en MORA y el fin de periodo pagado quedó atrás (con 3 días de gracia para
  // absorber clock-skew y la ventana hasta que llegue el webhook de renovación),
  // tratamos el acceso como caducado. Una suscripción activa y al día SIEMPRE
  // tiene period_end futuro → nunca se corta por error. Cubre el caso de un
  // past_due que nunca se cancela y el de un webhook de cancelación perdido.
  const accessLapsed = (() => {
    if (!subscriptionPeriodEnd) return false;
    if (!cancelAtPeriodEnd && !paymentPastDue) return false;
    const end = new Date(subscriptionPeriodEnd).getTime();
    if (!Number.isFinite(end)) return false;
    return end + 3 * 86_400_000 < Date.now();
  })();
  const subscriptionStatus = accessLapsed ? 'none' : rawSubscriptionStatus;

  // ── Bootstrap idioma — corre una vez al mount ────────────
  // Si el user nunca eligió manualmente (languageSetByUser=false), aplicamos
  // navigator.language. Si ya eligió antes (persistido), respetamos esa elección.
  useEffect(() => {
    const { languageSetByUser, language } = useAppStore.getState();
    if (!languageSetByUser) {
      const detected = detectBrowserLanguage();
      if (detected !== language) {
        useAppStore.setState({ language: detected });
      }
    }
  }, []);

  // ── Reconciliar la suscripción de push ────────────────────────────────────
  // El navegador puede rotar el endpoint por su cuenta. El service worker lo
  // mueve en cuanto pasa, pero no todos los navegadores entregan la suscripción
  // vieja, y sin ella no sabe qué fila mover. Aquí ya hay sesión, así que se
  // resuelve sin ambigüedad. Sin esto la fila apunta a un buzón muerto y la
  // persona deja de recibir notificaciones sin que nada lo diga.
  useEffect(() => {
    if (!authReady || !user) return;
    void sincronizarPush();
  }, [authReady, user]);

  // ── Reroute: si profile hidrata después y trae startDate, salir de onboarding ──
  useEffect(() => {
    if (currentScreen === 'onboarding' && startDate) {
      useAppStore.setState({ currentScreen: 'dashboard' });
    }
  }, [startDate, currentScreen]);

  // ── Cargar subscription_status (gate Stripe-3) ────────────────────
  // ⚠️ Atado a authReady + sesión (NO solo a SIGNED_IN) → corre también en reload
  // (INITIAL_SESSION), si no el que recarga quedaría en loading infinito.
  // subscriptionStatus/Loaded NO se persisten (Protección 1) → siempre frescos de DB.
  useEffect(() => {
    if (!authReady || !user || subscriptionStatusLoadedFor === user.id) return;
    const uid = user.id;
    let cancelled = false;
    (async () => {
      // Reintento con backoff: un error transitorio (red/RLS/timeout) NO debe
      // caer a 'none' ni marcar loadedFor, porque eso atoraría a un usuario que
      // paga en el paywall sin forma de reintentar. Reintentamos hasta que la DB
      // responda; solo entonces fijamos el estado.
      for (let attempt = 0; !cancelled; attempt++) {
        // Timeout por-intento: supabase-js NO pone timeout al fetch, así que un socket
        // estancado dejaría este await colgado PARA SIEMPRE y el loop nunca itera →
        // spinner infinito en el dashboard (el mismo bug que colgó la app hoy). Lo
        // carreamos contra 10s; un timeout cuenta como error y reintenta con backoff.
        // Así se conserva el reintento infinito en error persistente (no varar a quien
        // paga) SIN el riesgo de congelarse por una conexión que nunca responde.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await Promise.race([
          supabase
            .from('user_profiles')
            .select('subscription_status, stripe_customer_id, subscription_period_end, cancel_at_period_end, payment_past_due, is_admin')
            .eq('user_id', uid)
            .maybeSingle(),
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: null, error: { message: 'timeout (10s)' } }), 10_000)),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ]) as { data: any; error: { message: string } | null };
        if (cancelled) return;
        const { data, error } = res;
        if (error) {
          console.warn(`[sub] fetch subscription_status falló (intento ${attempt + 1}), reintentando:`, error.message);
          await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** attempt, 15_000)));
          continue;
        }
        useAppStore.setState({
          subscriptionStatus: (data?.subscription_status ?? 'none') as 'none' | 'trial' | 'pro',
          stripeCustomerId: data?.stripe_customer_id ?? null,
          subscriptionPeriodEnd: data?.subscription_period_end ?? null,
          cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
          paymentPastDue: data?.payment_past_due ?? false,
          isAdmin: data?.is_admin === true,
          subscriptionStatusLoadedFor: uid,
        });
        return;
      }
    })();
    return () => { cancelled = true; };
  }, [authReady, user, subscriptionStatusLoadedFor]);

  // ── MINDSET-1 · Hidratación + migración de reflexiones HSM ─────────
  // Corre en SIGNED_IN y en reload (atado a authReady+user). Orden: migración
  // legacy idempotente → flush del outbox → hidratar remoto (autoritativo por
  // questionKey). Imports dinámicos para no inflar el bundle inicial.
  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ fetchReflections, fetchProfile, fetchDailyReview }, { flushHSMOutbox }, { runHSMMigration }] = await Promise.all([
          import('./utils/hsmRepository'), import('./utils/hsmOutbox'), import('./utils/hsmMigration'),
        ]);
        const st = useAppStore.getState();
        if (!st.hsmMigratedAt) {
          const res = await runHSMMigration(st.dailyHSMResponses);
          if (res.ok && !cancelled) st.setHSMMigratedAt(new Date().toISOString());
        }
        await flushHSMOutbox();
        const today = dayKey(new Date());
        const [rows, profile, review] = await Promise.all([fetchReflections(), fetchProfile(), fetchDailyReview(today)]);
        if (cancelled) return;
        if (rows.length) useAppStore.getState().hydrateHSMReflections(rows);
        if (profile && profile.text) useAppStore.setState({ hsmProfile: { text: profile.text, updatedAt: (profile.generatedAt || '').slice(0, 10) } });
        // Reseña del día desde remoto → evita que un 2º dispositivo la regenere.
        if (review && review.text && !useAppStore.getState().hsmDailyReview) {
          useAppStore.setState({ hsmDailyReview: { date: review.date, text: review.text, source: review.source } });
        }
      } catch { /* fail-safe: journal local intacto */ }
    })();
    return () => { cancelled = true; };
  }, [authReady, user]);

  // ── Re-validar suscripción al volver al foco ──────────────────────
  // Si una suscripción se cancela/expira con la app abierta (sesión PWA larga),
  // el cliente quedaría con acceso obsoleto. Al volver la pestaña a primer plano
  // refrescamos el estado EN SEGUNDO PLANO — actualizamos los campos sin tocar
  // subscriptionStatusLoadedFor, para NO tumbar `subscriptionStatusLoaded` (eso
  // parpadeaba el dashboard a spinner en cada retorno).
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const u = useAppStore.getState().user;
      if (!u) return;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('subscription_status, stripe_customer_id, subscription_period_end, cancel_at_period_end, payment_past_due')
        .eq('user_id', u.id)
        .maybeSingle();
      if (error || !data) return; // error transitorio → conservamos lo que había
      useAppStore.setState({
        subscriptionStatus: (data.subscription_status ?? 'none') as 'none' | 'trial' | 'pro',
        stripeCustomerId: data.stripe_customer_id ?? null,
        subscriptionPeriodEnd: data.subscription_period_end ?? null,
        cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
        paymentPastDue: data.payment_past_due ?? false,
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // P2-A · OUTBOX: reintenta sesiones que no llegaron a Supabase (offline) al recuperar conexión
  // o al volver a foco. Idempotente (índice único server) → nunca duplica. Al montar cubre el caso
  // "cerré la app offline, la abro online". El flush tras hidratar (abajo) cubre el login/reload.
  useEffect(() => {
    const flush = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (!useAppStore.getState().user) return;
      void flushPendingWorkouts();
    };
    const onVis = () => { if (document.visibilityState === 'visible') flush(); };
    flush();
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // ── Gate: sin suscripción ('none') NO entra al dashboard → paywall ─
  // Gatea SOLO 'dashboard'; no toca landing/login/onboarding/reset-password/checkout/paywall.
  useEffect(() => {
    if (authReady && subscriptionStatusLoaded && subscriptionStatus === 'none' && currentScreen === 'dashboard') {
      useAppStore.setState({ currentScreen: 'paywall' });
    }
  }, [authReady, subscriptionStatusLoaded, subscriptionStatus, currentScreen]);

  // ── Supabase auth state listener ──────────────────────────
  useEffect(() => {
    // Anti-fuga entre cuentas: la DB es la fuente de verdad; el cache offline solo
    // se confía si dataOwnerId === usuario autenticado. Si NO coincide (incluido
    // dataOwnerId===null = dueño desconocido), reseteá el slice per-usuario ANTES de
    // hidratar y adoptá el id. Devuelve si el cache era de confianza.
    function ensureDataOwner(userId: string): boolean {
      const { dataOwnerId } = useAppStore.getState();
      const trusted = dataOwnerId === userId;
      if (!trusted) {
        useAppStore.getState().resetUserScopedData();
        useAppStore.setState({ dataOwnerId: userId });
      }
      return trusted;
    }

    // Failsafe: getSession() es lo ÚNICO que abre el gate (authReady). Si se cuelga
    // (token corrupto en storage, refresh de red que nunca resuelve, localStorage
    // bloqueado) o se rechaza sin catch, la app quedaría en spinner infinito y ni el
    // hard-refresh lo cura (el token sigue en storage). A los 8s abrimos el gate a la
    // fuerza: sin sesión válida cae a landing/login, que es recuperable.
    const gateFailsafe = setTimeout(() => {
      if (!useAppStore.getState().authReady) {
        console.warn('[auth] getSession no resolvió en 8s — abriendo gate (failsafe)');
        setAuthReady(true);
      }
    }, 8000);

    // Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) ensureDataOwner(session.user.id);
      useAppStore.getState().setUserEmail(session?.user?.email ?? '');
      setSession(session);
      // Si el usuario aterriza en /reset-password (link de recovery), forzamos esa pantalla.
      if (typeof window !== 'undefined' && window.location.pathname.includes('reset-password')) {
        useAppStore.setState({ currentScreen: 'reset-password' });
      }
      clearTimeout(gateFailsafe);
      setAuthReady(true);
    }).catch((e) => {
      // getSession rechazó (p.ej. refresh token inválido). Fail-open: NO dejamos la
      // app colgada — abrimos el gate y que auth/landing maneje el estado sin sesión.
      console.error('[auth] getSession falló, abriendo gate igual:', e);
      clearTimeout(gateFailsafe);
      setAuthReady(true);
    });

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // No loguear el email (PII de una app de salud). Solo el evento y si hay usuario.
      console.log('[auth]', event, session?.user ? 'user' : 'no user');
      setSession(session);

      if (event === 'PASSWORD_RECOVERY') {
        useAppStore.setState({ currentScreen: 'reset-password' });
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        identify(session.user.id);
        useAppStore.getState().setUserEmail(session.user.email ?? '');
        // Anti-fuga: reseteá datos de otro user ANTES de rutear/hidratar.
        // Efecto: si el dueño del cache no es este user, resetea + reclama
        // dataOwnerId (guard anti-leak). Ya no se backfillea local→DB, así que
        // el valor de retorno no se usa.
        ensureDataOwner(session.user.id);
        // Redirect INMEDIATO (sync, fuera del auth lock de Supabase v2).
        // AUTH-PROVIDERS B: el callback de OAuth puede volver a la landing (no solo a
        // 'login'), así que ruteamos desde cualquier pantalla PRE-AUTH. La autoridad
        // sigue siendo startDate (→ onboarding vs dashboard); 'dashboard' queda además
        // gated por la suscripción (paywall + guard de montaje), así que es seguro.
        const { currentScreen, startDate } = useAppStore.getState();
        if (currentScreen === 'login' || currentScreen === 'landing') {
          useAppStore.setState({ currentScreen: signedInScreen(startDate) });
        }

        // Hidratar profile en background. setTimeout(0) saca la query del lock
        // del callback de onAuthStateChange — evita deadlock en supabase-js v2.
        setTimeout(async () => {
          // Guardia anti-carrera: si mientras las queries vuelan cambió el dueño
          // de los datos (otro login o un logout), abortamos para no escribir los
          // datos de ESTE usuario sobre la sesión de otro. dataOwnerId se reclama
          // síncronamente en ensureDataOwner al firmar, así que es la señal fiable.
          const isStillCurrentUser = () => useAppStore.getState().dataOwnerId === session.user.id;
          try {
            // Hidratación con reintento: un socio existente que reaparece en un
            // dispositivo limpio arranca en 'onboarding' (startDate=''); solo el
            // perfil hidratado lo reencamina a dashboard. Si la query falla de forma
            // transitoria (red/RLS/timeout) NO debe quedar atrapado en onboarding, así
            // que reintentamos con backoff. Un usuario NUEVO genuino (data:null sin
            // error) corta de inmediato y sí va a onboarding.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let profile: any = null;
            for (let attempt = 0; attempt < 3; attempt++) {
              const { data, error } = await supabase
                .from('user_profiles')
                .select('display_name, avatar_url, ob_data, start_date, tdee, plan_goal, meal_plan_key, user_plan, trial_ends_at, streak_count, last_active_date, weekly_plan, weekly_plan_updated_at, shopping_day, daily_workout, daily_workout_updated_at, daily_workout_regen, daily_workout_regen_updated_at')
                .eq('user_id', session.user.id)
                .maybeSingle();
              if (!isStillCurrentUser()) return;
              if (data) { profile = data; break; }
              if (!error) break; // sin error y sin fila → usuario nuevo real
              await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            }

            // @usuario (Fase 1A) — query aparte y tolerante: si la migración aún
            // no está desplegada, la columna no existe y el error se ignora sin
            // romper la hidratación del perfil.
            let handle: string | null = null;
            try {
              const { data: u } = await supabase
                .from('user_profiles')
                .select('username')
                .eq('user_id', session.user.id)
                .maybeSingle();
              handle = (u as { username?: string | null } | null)?.username ?? null;
              if (handle && isStillCurrentUser()) {
                useAppStore.setState({ username: handle });
              }
            } catch { /* columna username inexistente (pre-migración) → ignora */ }

            if (!isStillCurrentUser()) return; // cambió de cuenta mientras cargaba
            if (profile) {
              useAppStore.setState({
                // Si el perfil no tiene display_name, caemos al @usuario (que
                // siempre existe) en vez de quedar "Anónimo".
                userName: profile.display_name || handle || '',
                avatarUrl: (profile as { avatar_url?: string | null }).avatar_url ?? null,
                obData: (profile.ob_data as Record<string, string | number>) ?? {},
                startDate: profile.start_date ?? '',
                tdee: profile.tdee ?? 0,
                planGoal: profile.plan_goal ?? 0,
                mealPlanKey: profile.meal_plan_key ?? 'planA',
                userPlan: (profile.user_plan ?? 'none') as 'none' | 'trial' | 'pro',
                trialEndsAt: profile.trial_ends_at ?? null,
              });

              // NO auto-backfill de streak local→DB en hidratación (re-seed).
              const localState = useAppStore.getState();

              // Sync-1: weeklyPlan + shoppingDay con push-then-pull.
              // shouldUseRemotePlan decide si subir local (backfill), bajar
              // remote (pull), o no hacer nada. Esto evita pisar el plan
              // local de usuarios existentes en el primer login post-deploy.
              const localPlan = localState.weeklyPlan;
              const localPlanUpdatedAt = localPlan?.generatedAt ?? null;
              const remotePlan = (profile.weekly_plan ?? null) as typeof localPlan;
              const remotePlanUpdatedAt = profile.weekly_plan_updated_at ?? null;
              const decision = shouldUseRemotePlan(
                localPlan, localPlanUpdatedAt, remotePlan, remotePlanUpdatedAt,
              );
              if (decision === 'use_remote') {
                useAppStore.setState({ weeklyPlan: remotePlan });
              }
              // 'use_local'/'noop': NO auto-backfill local→DB en hidratación.
              // El generate persiste por su cuenta (saveWeeklyPlan). Esto evita
              // re-seedear la DB con el plan cacheado en cada reload.

              // shopping_day: solo lectura remote→local. NO auto-backfill
              // local→DB en hidratación (re-seed).
              const remoteShoppingDay = profile.shopping_day;
              if (remoteShoppingDay !== null && remoteShoppingDay !== undefined) {
                useAppStore.setState({ shoppingDay: remoteShoppingDay });
              }

              // Sync-3: dailyWorkout + regen count, solo lectura remote→local.
              // El generate persiste por su cuenta (saveDailyWorkout /
              // incrementDailyWorkoutRegen). NO auto-backfill local→DB acá.
              const localWorkout = localState.dailyWorkout;
              const remoteWorkout = (profile.daily_workout ?? null) as typeof localWorkout;
              const decWorkout = shouldUseRemoteWorkout(
                localWorkout, localWorkout?.generatedAt ?? null,
                remoteWorkout, profile.daily_workout_updated_at ?? null,
              );
              if (decWorkout === 'use_remote') {
                useAppStore.setState({ dailyWorkout: remoteWorkout });
              }

              const localRegen = localState.dailyWorkoutRegenCount;
              const remoteRegen = (profile.daily_workout_regen ?? null) as typeof localRegen | null;
              const decRegen = shouldUseRemoteWorkout(
                localRegen, localRegen?.updatedAt ?? null,
                remoteRegen, profile.daily_workout_regen_updated_at ?? null,
              );
              if (decRegen === 'use_remote' && remoteRegen) {
                useAppStore.setState({ dailyWorkoutRegenCount: remoteRegen });
              }

              // Racha: leer remote→local. Sin esto, un dispositivo nuevo arrancaba
              // en 0 y al entrenar SOBRESCRIBÍA la racha real de la DB (pérdida de
              // dato). Tomamos la más avanzada por lastActiveDate (dayKeys locales,
              // comparables como string); si local va por delante (entrenó offline
              // más reciente), se respeta local.
              const remoteStreak = (profile as { streak_count?: number }).streak_count ?? 0;
              const remoteLastActive = (profile as { last_active_date?: string | null }).last_active_date ?? null;
              if (remoteLastActive && (
                !localState.lastActiveDate ||
                remoteLastActive > localState.lastActiveDate ||
                (remoteLastActive === localState.lastActiveDate && remoteStreak > localState.streakCount)
              )) {
                useAppStore.setState({ streakCount: remoteStreak, lastActiveDate: remoteLastActive });
              }
            }
          } catch (e) {
            console.error('[auth] failed to hydrate profile:', e);
          }

          // Hidratar weight_log en paralelo (independiente del profile)
          try {
            const { data: weights } = await supabase
              .from('weight_log')
              .select('date, kg')
              .eq('user_id', session.user.id)
              .order('date', { ascending: true });
            if (!isStillCurrentUser()) return;
            if (weights) {
              useAppStore.setState({
                weightLog: weights.map(w => ({ date: w.date, kg: Number(w.kg) })),
              });
            }
          } catch (e) {
            console.error('[auth] failed to hydrate weight_log:', e);
          }

          // Hidratar food_log: últimos 14 días (Food-1).
          // El coach prompt lee solo el día de hoy; 14 días alcanza para
          // sobrevivir cambio de device sin traer toda la historia.
          // Mapeo description (SQL) → desc (cliente).
          try {
            const cutoff = dayKey(new Date(Date.now() - 14 * 86400000));
            const { data: foods } = await supabase
              .from('food_log')
              .select('id, date, description, kcal, prot, carbs, fat, source, meal_time, meal_index, items')
              .eq('user_id', session.user.id)
              .gte('date', cutoff)
              .order('date', { ascending: true });
            if (!isStillCurrentUser()) return;
            if (foods) {
              useAppStore.setState({
                foodLog: foods.map(f => ({
                  id: f.id,
                  date: f.date,
                  desc: f.description,
                  kcal: Number(f.kcal),
                  prot: Number(f.prot),
                  carbs: Number(f.carbs),
                  fat: Number(f.fat),
                  source: f.source as 'manual' | 'ai' | 'bowl',   // NUTRITION-N10.2A · bowl ahora persiste (migration food_log_source)
                  ...(f.meal_time != null ? { mealTime: f.meal_time as string } : {}),
                  ...(f.meal_index != null ? { mealIndex: Number(f.meal_index) } : {}),
                  ...(f.items != null ? { items: f.items as import('./store').FoodLogItem[] } : {}),
                })),
              });
            }
          } catch (e) {
            console.error('[auth] failed to hydrate food_log:', e);
          }

          // Hidratar workout_log: últimos 14 días (Track-2).
          // Merge UNIÓN con dedup por completedAtIso. Lo que local tiene
          // y remote no → backfill push (insert no-bloqueante de antes).
          // Cierra la asimetría: ahora el historial de entrenamientos
          // también viaja entre dispositivos, igual que food_log.
          try {
            const cutoff = dayKey(new Date(Date.now() - 14 * 86400000));
            const { data: workouts } = await supabase
              .from('workout_log')
              .select('date_local, completed_at, client_session_id, modality, duration_minutes, exercises_completed, exercises_total, exercises')
              .eq('user_id', session.user.id)
              .gte('date_local', cutoff)
              .order('completed_at', { ascending: true });
            if (!isStillCurrentUser()) return;
            if (workouts) {
              const remoteSessions = (workouts as WorkoutLogRow[]).map(mapWorkoutLogRowToSession);
              const localState = useAppStore.getState();
              const { merged } = mergeWorkoutSessions(
                localState.completedSessions,
                remoteSessions,
              );
              // Solo lectura remote→local. NO auto-backfill ciego local→DB (evita re-insertar
              // sesiones cacheadas). El backfill dirigido lo hace el OUTBOX (solo pendientes,
              // idempotente) — se dispara abajo tras hidratar.
              useAppStore.setState({ completedSessions: merged });

              // Último desempeño por ejercicio (para "la vez pasada" en el player).
              // Las filas vienen ascendentes por completed_at → la última gana.
              const perf: Record<string, { date: string; sets: { reps: number; kg: number; rir?: number; repsUnconfirmed?: boolean }[] }> = {};
              for (const w of workouts as Array<WorkoutLogRow & { date_local: string; exercises: unknown; modality?: string }>) {
                // F2C-9B.2 · la hidratación de lastExercisePerformance es un PRODUCTOR (el mapa se keya
                // por exerciseId → pierde el contexto de sesión aguas abajo). Solo filas de DOMINIO fuerza
                // pueden reconstruir el "peso a batir". Cardio/yoga explícitos se saltan enteros; legacy
                // sin modality se conserva (comportamiento conservador, no borra historial de fuerza viejo).
                if (!isStrengthDomainSession({ modality: w.modality as Modality | undefined })) continue;
                const exs = Array.isArray(w.exercises) ? w.exercises : [];
                for (const ex of exs as Array<{ exercise_id?: string; performed?: { sets?: Array<{ reps: number; kg: number; rir?: number; repsUnconfirmed?: boolean; role?: ExecutionRole } | null>; skipped?: boolean } }>) {
                  if (!ex || typeof ex.exercise_id !== 'string' || !ex.performed || ex.performed.skipped) continue;
                  // BLOQUE 2 · conserva el RIR real del set (para la e1RM RIR-aware que prescribe carga).
                  // PRESCRIPCIÓN ≠ DESEMPEÑO: conserva TAMBIÉN `repsUnconfirmed` (filter passthrough, sin
                  // re-map) → la progresión/carga NO trata la sugerencia prescrita como real tras el
                  // round-trip Supabase. NO re-mapear a {reps,kg,rir} aquí o se perdería el flag.
                  // F2C-9C.1 · "la vez pasada" = último TRABAJO real; ramp/warmup/cooldown fuera (legacy → working).
                  const sets = (ex.performed.sets ?? []).filter((s): s is { reps: number; kg: number; rir?: number; repsUnconfirmed?: boolean; role?: ExecutionRole } => !!s && isWorkingSet(s) && (s.reps > 0 || s.kg > 0));
                  if (sets.length === 0) continue;
                  perf[ex.exercise_id] = { date: w.date_local, sets };
                }
              }
              if (Object.keys(perf).length > 0) {
                // Merge: la DB manda para el historial; lo local (sesión recién hecha
                // aún no sincronizada) se conserva si es más reciente por fecha.
                useAppStore.setState((s) => {
                  const next = { ...perf };
                  for (const [id, local] of Object.entries(s.lastExercisePerformance)) {
                    if (!next[id] || local.date > next[id].date) next[id] = local;
                  }
                  return { lastExercisePerformance: next };
                });
              }
            }
            // P2-A · backfill dirigido: reintenta las sesiones pendientes de este usuario
            // (offline previo). Idempotente (índice único) → nunca duplica lo ya sincronizado.
            if (isStillCurrentUser()) void flushPendingWorkouts();
          } catch (e) {
            console.error('[auth] failed to hydrate workout_log:', e);
          }

          // Hidratar meal_progress: últimos 14 días (Sync-2).
          // Merge "true wins": un check hecho en cualquier device sobrevive.
          // Backfill push: lo que local tiene y remote no se sube.
          try {
            const cutoff = dayKey(new Date(Date.now() - 14 * 86400000));
            const { data: rows } = await supabase
              .from('meal_progress')
              .select('date, meal_index, checked, resolved_by_log')
              .eq('user_id', session.user.id)
              .gte('date', cutoff);
            if (!isStillCurrentUser()) return;
            if (rows) {
              const localState = useAppStore.getState();
              const { merged } = mergeMealProgress(
                {
                  mealChecks: localState.mealChecks,
                  mealResolvedByLog: localState.mealResolvedByLog,
                },
                rows.map(r => ({
                  date: r.date,
                  meal_index: r.meal_index,
                  checked: !!r.checked,
                  resolved_by_log: !!r.resolved_by_log,
                })),
              );
              useAppStore.setState({
                mealChecks: merged.mealChecks,
                mealResolvedByLog: merged.mealResolvedByLog,
              });

              // NO auto-backfill de meal_progress local→DB en hidratación
              // (re-seed). La lectura/merge remote→local (arriba) se mantiene.
            }
          } catch (e) {
            console.error('[auth] failed to hydrate meal_progress:', e);
          }

          // NUTRITION-N10.2A.2 · hidratar la historia cross-device de evidencia (nutrition_day_summary).
          // Corre DESPUÉS de food_log + meal_progress (arriba) para poder recomputar HOY desde raw fresco.
          // Historia: la DB manda (target congelado, evidencia cacheada); no se sube el legacy local.
          try {
            const cutoff = dayKey(new Date(Date.now() - 90 * 86400000)); // ventana de lectura 90 días
            const { data: sums } = await supabase
              .from('nutrition_day_summary')
              .select('date, target_kcal, logged_kcal, measured_slots, total_slots, evidence_class')
              .eq('user_id', session.user.id)
              .gte('date', cutoff)
              .order('date', { ascending: true });
            if (!isStillCurrentUser()) return;
            if (sums) {
              const { summaryFromDbRow } = await import('./utils/nutritionSummaryDb');
              useAppStore.setState({ nutritionDaySummaries: sums.map(summaryFromDbRow) });
              // recomputa HOY desde el raw ya hidratado (food_log + meal_progress) + persiste best-effort.
              useAppStore.getState().refreshNutritionDaySummary(dayKey(new Date()));
            }
          } catch (e) {
            console.error('[auth] failed to hydrate nutrition_day_summary:', e);
          }

          // Hidratar user_milestones en paralelo (logros desbloqueados)
          try {
            const { data: milestones } = await supabase
              .from('user_milestones')
              .select('milestone_days, unlocked_at')
              .eq('user_id', session.user.id)
              .order('unlocked_at', { ascending: true });
            if (!isStillCurrentUser()) return;
            if (milestones) {
              useAppStore.setState({ userMilestones: milestones });
            }

            // NO auto-backfill de milestones local→DB en hidratación (re-seed).
            // La lectura remote→local (arriba) se mantiene.
          } catch (e) {
            console.error('[auth] failed to hydrate user_milestones:', e);
          }
        }, 0);
      }

      if (event === 'SIGNED_OUT') {
        // Mismo reset per-usuario que logout + soltar el dueño de los datos.
        useAppStore.getState().resetUserScopedData();
        useAppStore.setState({ currentScreen: 'landing', dataOwnerId: null });
      }
    });

    return () => {
      clearTimeout(gateFailsafe);
      subscription.unsubscribe();
    };
  }, [setSession, setAuthReady]);

  // ── Reading progress bar ────────────────────────────────
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (currentScreen !== 'landing') { setProgress(0); return; }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [currentScreen]);

  // ── Screen fade transition (StrictMode-safe via setTimeout) ──
  const [fadeClass, setFadeClass] = useState('scr-in');
  const prevScreen = useRef(currentScreen);
  useEffect(() => {
    if (prevScreen.current === currentScreen) return;
    prevScreen.current = currentScreen;
    setFadeClass('scr-out');
    const t = setTimeout(() => setFadeClass('scr-in'), 20);
    return () => clearTimeout(t);
  }, [currentScreen]);

  // ── Scroll reveal ───────────────────────────────────────
  useEffect(() => {
    if (!authReady) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [currentScreen, authReady]);

  // ── Nav scroll effect ───────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      const nav = document.querySelector('nav.landing-nav');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentScreen]);

  // ── Loading gate — esperar verificación inicial de sesión ──
  if (!authReady) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--sala-bg)',
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '2px solid #BFA065',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Compuerta: el dashboard en EN espera el overlay de contenido (ejercicios/comidas).
  if (currentScreen === 'dashboard' && !assetsReady) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--sala-bg)',
      }}>
        <div style={{
          width: 32, height: 32, border: '2px solid #BFA065', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 0.6s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      {/* Banner global de update de PWA — fijo arriba, persistente hasta recargar */}
      <UpdatePrompt />
      <OfflineBanner />
      {/* Reading progress bar */}
      {currentScreen === 'landing' && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed', top: 0, left: 0, height: '2.5px',
            width: `${progress}%`, zIndex: 10000, pointerEvents: 'none',
            background: 'linear-gradient(90deg, var(--amber), #d4b374)',
            boxShadow: '0 0 10px rgba(191,160,101,.55)',
            transition: 'width .12s linear',
          }}
        />
      )}

      {/* Grain overlay */}
      <div className="grain-overlay" aria-hidden="true" />

      {/* Screens — lazy loaded for code splitting */}
      {currentScreen === 'landing' && (
        <div id="scr-landing" className={`screen active ${fadeClass}`}>
          <LandingScreen />
        </div>
      )}
      <Suspense fallback={null}>
        {currentScreen === 'login' && (
          <div id="scr-login" className={`screen active ${fadeClass}`}>
            <LoginScreen />
          </div>
        )}
        {currentScreen === 'onboarding' && (
          <div id="scr-onboarding" className={`screen active ${fadeClass}`}>
            {/* MVP-RESILIENCE-1 · render-gate: un usuario autenticado en 'onboarding'
                cuya resolución de perfil AÚN no terminó (idle/loading/error) ve una
                pantalla neutral de carga/reintento — NUNCA el formulario de onboarding
                (que podría pisar ob_data/tdee/plan_goal). Nuevo usuario real (resuelto,
                sin start_date) sí ve onboarding. */}
            {shouldShowAccountLoader({ authenticated: !!user, currentScreen, profileResolution })
              ? <AccountLoadingState resolution={profileResolution} onRetry={() => setProfileRetryTick((n) => n + 1)} />
              : <OnboardingScreen />}
          </div>
        )}
        {currentScreen === 'dashboard' && (
          // ⚠️ Protección 3 (flash/leak): el dashboard solo se monta con suscripción
          // confirmada. Mientras el status no cargó (o es 'none' y el gate aún no
          // redirigió), mostramos spinner — nunca el dashboard.
          subscriptionStatusLoaded && subscriptionStatus !== 'none' ? (
            <div id="scr-dashboard" className={`screen active ${fadeClass}`}>
              <DashboardScreen />
            </div>
          ) : (
            <div id="scr-dashboard-gate" className="screen active" style={{
              position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'var(--sala-bg)',
            }}>
              <div style={{
                width: 32, height: 32, border: '2px solid #BFA065',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }} />
            </div>
          )
        )}
        {currentScreen === 'reset-password' && (
          <div id="scr-reset-password" className={`screen active ${fadeClass}`}>
            <ResetPasswordScreen />
          </div>
        )}
        {currentScreen === 'paywall' && (
          <div id="scr-paywall" className={`screen active ${fadeClass}`}>
            <PaywallScreen />
          </div>
        )}

        {/* Modals */}
        {activeModal === 'pay' && <PaymentModal />}
        {activeModal === 'signup' && <SignupModal />}
        {activeModal === 'video' && <VideoModal />}
      </Suspense>
    </>
  );
}
