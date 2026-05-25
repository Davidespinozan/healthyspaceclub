import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useAppStore, persistStreakToProfile } from './store';
import { supabase } from './lib/supabase';
import { MILESTONE_STEPS } from './constants/milestones';
import { detectBrowserLanguage } from './i18n';
import LandingScreen from './screens/LandingScreen';

const LoginScreen = lazy(() => import('./screens/LoginScreen'));
const OnboardingScreen = lazy(() => import('./screens/OnboardingScreen'));
const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const ResetPasswordScreen = lazy(() => import('./screens/ResetPasswordScreen'));
const PaymentModal = lazy(() => import('./components/modals/PaymentModal'));
const SignupModal = lazy(() => import('./components/modals/SignupModal'));
const VideoModal = lazy(() => import('./components/modals/VideoModal'));

export default function App() {
  const { currentScreen, activeModal } = useAppStore();
  const setSession = useAppStore(s => s.setSession);
  const setAuthReady = useAppStore(s => s.setAuthReady);
  const authReady = useAppStore(s => s.authReady);
  const startDate = useAppStore(s => s.startDate);

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
              .select('display_name, ob_data, start_date, tdee, plan_goal, meal_plan_key, user_plan, trial_ends_at, streak_count, last_active_date')
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
                userPlan: (profile.user_plan ?? 'none') as 'none' | 'trial' | 'basico' | 'pro' | 'elite',
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
          <div id="scr-dashboard" className={`screen active ${fadeClass}`}>
            <DashboardScreen />
          </div>
        )}
        {currentScreen === 'reset-password' && (
          <div id="scr-reset-password" className={`screen active ${fadeClass}`}>
            <ResetPasswordScreen />
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
