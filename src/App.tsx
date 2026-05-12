import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useAppStore } from './store';
import { supabase } from './lib/supabase';
import LandingScreen from './screens/LandingScreen';

const LoginScreen = lazy(() => import('./screens/LoginScreen'));
const OnboardingScreen = lazy(() => import('./screens/OnboardingScreen'));
const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const PaymentModal = lazy(() => import('./components/modals/PaymentModal'));
const SignupModal = lazy(() => import('./components/modals/SignupModal'));
const VideoModal = lazy(() => import('./components/modals/VideoModal'));

export default function App() {
  const { currentScreen, activeModal } = useAppStore();
  const setSession = useAppStore(s => s.setSession);
  const setAuthReady = useAppStore(s => s.setAuthReady);
  const authReady = useAppStore(s => s.authReady);
  const startDate = useAppStore(s => s.startDate);

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
      setAuthReady(true);
    });

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[auth]', event, session?.user?.email ?? 'no user');
      setSession(session);

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
              .select('display_name, ob_data, start_date, tdee, plan_goal, meal_plan_key, user_plan, trial_ends_at')
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
            }
          } catch (e) {
            console.error('[auth] failed to hydrate profile:', e);
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
        background: 'var(--cream, #F6F2EA)',
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

        {/* Modals */}
        {activeModal === 'pay' && <PaymentModal />}
        {activeModal === 'signup' && <SignupModal />}
        {activeModal === 'video' && <VideoModal />}
      </Suspense>
    </>
  );
}
