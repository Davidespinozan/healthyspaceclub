import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useAppStore, persistStreakToProfile } from './store';
import { supabase } from './lib/supabase';
import { MILESTONE_STEPS } from './constants/milestones';
import { shouldUseRemotePlan } from './utils/planSync';
import { mergeMealProgress, type MealProgressRow } from './utils/mealProgressSync';
import {
  mapWorkoutLogRowToSession,
  mergeWorkoutSessions,
  type WorkoutLogRow,
} from './utils/workoutSync';
import { detectBrowserLanguage } from './i18n';
import LandingScreen from './screens/LandingScreen';

const LoginScreen = lazy(() => import('./screens/LoginScreen'));
const OnboardingScreen = lazy(() => import('./screens/OnboardingScreen'));
const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const ResetPasswordScreen = lazy(() => import('./screens/ResetPasswordScreen'));
const PaywallScreen = lazy(() => import('./screens/PaywallScreen'));
const PaymentModal = lazy(() => import('./components/modals/PaymentModal'));
const SignupModal = lazy(() => import('./components/modals/SignupModal'));
const VideoModal = lazy(() => import('./components/modals/VideoModal'));

export default function App() {
  const { currentScreen, activeModal } = useAppStore();
  const setSession = useAppStore(s => s.setSession);
  const setAuthReady = useAppStore(s => s.setAuthReady);
  const authReady = useAppStore(s => s.authReady);
  const startDate = useAppStore(s => s.startDate);
  const user = useAppStore(s => s.user);
  const subscriptionStatus = useAppStore(s => s.subscriptionStatus);
  const subscriptionStatusLoaded = useAppStore(s => s.subscriptionStatusLoaded);

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
    if (!authReady || !user || subscriptionStatusLoaded) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('subscription_status, stripe_customer_id, subscription_period_end, cancel_at_period_end')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      useAppStore.setState({
        subscriptionStatus: (data?.subscription_status ?? 'none') as 'none' | 'trial' | 'pro',
        stripeCustomerId: data?.stripe_customer_id ?? null,
        subscriptionPeriodEnd: data?.subscription_period_end ?? null,
        cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
        subscriptionStatusLoaded: true,
      });
    })();
    return () => { cancelled = true; };
  }, [authReady, user, subscriptionStatusLoaded]);

  // ── Gate: sin suscripción ('none') NO entra al dashboard → paywall ─
  // Gatea SOLO 'dashboard'; no toca landing/login/onboarding/reset-password/checkout/paywall.
  useEffect(() => {
    if (authReady && subscriptionStatusLoaded && subscriptionStatus === 'none' && currentScreen === 'dashboard') {
      useAppStore.setState({ currentScreen: 'paywall' });
    }
  }, [authReady, subscriptionStatusLoaded, subscriptionStatus, currentScreen]);

  // ── Supabase auth state listener ──────────────────────────
  useEffect(() => {
    // Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Si el usuario aterriza en /reset-password (link de recovery), forzamos esa pantalla.
      if (typeof window !== 'undefined' && window.location.pathname.includes('reset-password')) {
        useAppStore.setState({ currentScreen: 'reset-password' });
      }
      setAuthReady(true);
    });

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[auth]', event, session?.user?.email ?? 'no user');
      setSession(session);

      if (event === 'PASSWORD_RECOVERY') {
        useAppStore.setState({ currentScreen: 'reset-password' });
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        // Redirect INMEDIATO (sync, fuera del auth lock de Supabase v2)
        const { currentScreen, startDate } = useAppStore.getState();
        if (currentScreen === 'login') {
          useAppStore.setState({
            currentScreen: startDate ? 'dashboard' : 'onboarding',
          });
        }

        // Hidratar profile en background. setTimeout(0) saca la query del lock
        // del callback de onAuthStateChange — evita deadlock en supabase-js v2.
        setTimeout(async () => {
          try {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('display_name, ob_data, start_date, tdee, plan_goal, meal_plan_key, user_plan, trial_ends_at, streak_count, last_active_date, weekly_plan, weekly_plan_updated_at, shopping_day')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (profile) {
              useAppStore.setState({
                userName: profile.display_name ?? '',
                obData: (profile.ob_data as Record<string, string | number>) ?? {},
                startDate: profile.start_date ?? '',
                tdee: profile.tdee ?? 0,
                planGoal: profile.plan_goal ?? 0,
                mealPlanKey: profile.meal_plan_key ?? 'planA',
                userPlan: (profile.user_plan ?? 'none') as 'none' | 'trial' | 'pro',
                trialEndsAt: profile.trial_ends_at ?? null,
              });

              // Backfill streak server: si server está en 0 pero el local tiene
              // streak > 0, pushear local → server. Una vez por device.
              const localState = useAppStore.getState();
              const localStreak = localState.streakCount;
              if ((profile.streak_count ?? 0) === 0 && localStreak > 0) {
                const fallbackDate = localState.lastActiveDate ?? new Date().toISOString().split('T')[0];
                console.log('[streak-backfill] pushing local streak', localStreak, 'to server');
                await persistStreakToProfile(session.user.id, localStreak, fallbackDate);
              }

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
              } else if (decision === 'use_local' && localPlan) {
                // Backfill: subir el local a Supabase
                console.log('[weekly-plan-backfill] pushing local plan to server');
                const now = new Date().toISOString();
                await supabase.from('user_profiles').upsert(
                  {
                    user_id: session.user.id,
                    weekly_plan: localPlan,
                    weekly_plan_updated_at: now,
                    updated_at: now,
                  },
                  { onConflict: 'user_id' },
                );
              }

              // shopping_day: simpler — si remote tiene valor, usar; si no,
              // backfill el local (si lo hay).
              const localShoppingDay = localState.shoppingDay;
              const remoteShoppingDay = profile.shopping_day;
              if (remoteShoppingDay !== null && remoteShoppingDay !== undefined) {
                useAppStore.setState({ shoppingDay: remoteShoppingDay });
              } else if (localShoppingDay !== null && localShoppingDay !== undefined) {
                console.log('[shopping-day-backfill] pushing local shopping_day to server');
                await supabase.from('user_profiles').upsert(
                  {
                    user_id: session.user.id,
                    shopping_day: localShoppingDay,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'user_id' },
                );
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
            const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
            const { data: foods } = await supabase
              .from('food_log')
              .select('id, date, description, kcal, prot, carbs, fat, source')
              .eq('user_id', session.user.id)
              .gte('date', cutoff)
              .order('date', { ascending: true });
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
                  source: f.source as 'manual' | 'ai',
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
            const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
            const { data: workouts } = await supabase
              .from('workout_log')
              .select('date_local, completed_at, modality, duration_minutes, exercises_completed, exercises_total, exercises')
              .eq('user_id', session.user.id)
              .gte('date_local', cutoff)
              .order('completed_at', { ascending: true });
            if (workouts) {
              const remoteSessions = (workouts as WorkoutLogRow[]).map(mapWorkoutLogRowToSession);
              const localState = useAppStore.getState();
              const { merged, toPush } = mergeWorkoutSessions(
                localState.completedSessions,
                remoteSessions,
              );
              useAppStore.setState({ completedSessions: merged });

              if (toPush.length > 0) {
                console.log('[workout-log-backfill] pushing', toPush.length, 'sessions');
                // Backfill: las sesiones locales que remote no tiene se
                // suben. Reconstruir exercises jsonb mínimo desde
                // exerciseIds (no tenemos planned/performed acá — solo IDs).
                // El planner remoto va a ver la sesión + duration + count,
                // y el flat loggedSets se preserva en local.
                const rows = toPush.map(s => ({
                  user_id: session.user.id,
                  date_local: s.date,
                  completed_at: s.completedAtIso,
                  modality: s.modality,
                  duration_minutes: Math.round(s.durationSeconds / 60),
                  target_duration_minutes: Math.round(s.durationSeconds / 60),
                  equipment: 'gym', // placeholder defensivo; sesión local no preservó equipment
                  exercises: s.exerciseIds.map((id, order) => ({ exercise_id: id, order })),
                  exercises_completed: s.exercisesCompleted,
                  exercises_total: s.exercisesTotal,
                  generation_method: 'backfill',
                }));
                const { error: backfillError } = await supabase
                  .from('workout_log')
                  .insert(rows);
                if (backfillError) {
                  console.warn('[workout-log-backfill] insert failed:', backfillError);
                }
              }
            }
          } catch (e) {
            console.error('[auth] failed to hydrate workout_log:', e);
          }

          // Hidratar meal_progress: últimos 14 días (Sync-2).
          // Merge "true wins": un check hecho en cualquier device sobrevive.
          // Backfill push: lo que local tiene y remote no se sube.
          try {
            const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
            const { data: rows } = await supabase
              .from('meal_progress')
              .select('date, meal_index, checked, resolved_by_log')
              .eq('user_id', session.user.id)
              .gte('date', cutoff);
            if (rows) {
              const localState = useAppStore.getState();
              const { merged, toPush } = mergeMealProgress(
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

              if (toPush.length > 0) {
                console.log('[meal-progress-backfill] pushing', toPush.length, 'rows');
                const now = new Date().toISOString();
                await supabase.from('meal_progress').upsert(
                  toPush.map((p: MealProgressRow) => ({
                    user_id: session.user.id,
                    date: p.date,
                    meal_index: p.meal_index,
                    checked: p.checked,
                    resolved_by_log: p.resolved_by_log,
                    updated_at: now,
                  })),
                  { onConflict: 'user_id,date,meal_index' },
                );
              }
            }
          } catch (e) {
            console.error('[auth] failed to hydrate meal_progress:', e);
          }

          // Hidratar user_milestones en paralelo (logros desbloqueados)
          try {
            const { data: milestones } = await supabase
              .from('user_milestones')
              .select('milestone_days, unlocked_at')
              .eq('user_id', session.user.id)
              .order('unlocked_at', { ascending: true });
            if (milestones) {
              useAppStore.setState({ userMilestones: milestones });
            }

            // Backfill retroactivo: si la tabla está vacía pero el user tiene
            // streak local (Zustand persist), derivar milestones desde streakCount
            // y persistir. unlocked_at = lastActiveDate como aproximación honesta.
            const localState = useAppStore.getState();
            const localStreak = localState.streakCount;
            if ((milestones?.length ?? 0) === 0 && localStreak > 0) {
              const derived = MILESTONE_STEPS.filter(m => localStreak >= m);
              if (derived.length > 0) {
                const fallbackUnlocked = localState.lastActiveDate
                  ? new Date(`${localState.lastActiveDate}T00:00:00Z`).toISOString()
                  : new Date().toISOString();
                const rows = derived.map(milestone_days => ({
                  user_id: session.user.id,
                  milestone_days,
                  unlocked_at: fallbackUnlocked,
                }));
                console.log('[milestone-backfill] inserting', rows.length, 'milestones for streak', localStreak);
                const { error: backfillError } = await supabase
                  .from('user_milestones')
                  .upsert(rows, { onConflict: 'user_id,milestone_days', ignoreDuplicates: true });
                if (backfillError) {
                  console.error('[milestone-backfill] upsert failed:', backfillError);
                } else {
                  useAppStore.setState({
                    userMilestones: derived.map(milestone_days => ({
                      milestone_days,
                      unlocked_at: fallbackUnlocked,
                    })),
                  });
                  console.log('[milestone-backfill] OK, hydrated', derived.length, 'entries');
                }
              }
            }
          } catch (e) {
            console.error('[auth] failed to hydrate user_milestones:', e);
          }
        }, 0);
      }

      if (event === 'SIGNED_OUT') {
        useAppStore.setState({
          currentScreen: 'landing',
          userName: '',
          obData: {},
        });
      }
    });

    return () => {
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

  return (
    <>
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
            <OnboardingScreen />
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
