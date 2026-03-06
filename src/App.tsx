import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './store';
import LandingScreen from './screens/LandingScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import DashboardScreen from './screens/DashboardScreen';
import LifeSystemScreen from './screens/LifeSystemScreen';
import PaymentModal from './components/modals/PaymentModal';
import LoginModal from './components/modals/LoginModal';
import SignupModal from './components/modals/SignupModal';
import VideoModal from './components/modals/VideoModal';

export default function App() {
  const { currentScreen, activeModal } = useAppStore();

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
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [currentScreen]);

  // ── Nav scroll effect ───────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      const nav = document.querySelector('nav.landing-nav');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentScreen]);

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

      {/* Screens — conditional rendering for performance */}
      {currentScreen === 'landing' && (
        <div id="scr-landing" className={`screen active ${fadeClass}`}>
          <LandingScreen />
        </div>
      )}
      {currentScreen === 'onboarding' && (
        <div id="scr-onboarding" className={`screen active ${fadeClass}`}>
          <OnboardingScreen />
        </div>
      )}
      {(currentScreen === 'dashboard' || currentScreen === 'lifesystem') && (
        <div id="scr-dashboard" className={`screen${currentScreen === 'dashboard' ? ` active ${fadeClass}` : ''}`}>
          <DashboardScreen />
        </div>
      )}
      {currentScreen === 'lifesystem' && (
        <div id="scr-lifesystem" className={`screen active ${fadeClass}`}>
          <LifeSystemScreen />
        </div>
      )}

      {/* Modals */}
      {activeModal === 'pay' && <PaymentModal />}
      {activeModal === 'login' && <LoginModal />}
      {activeModal === 'signup' && <SignupModal />}
      {activeModal === 'video' && <VideoModal />}
    </>
  );
}
