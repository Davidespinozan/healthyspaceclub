import { useState } from 'react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import LanguageToggle from '../components/LanguageToggle';

const SUPABASE_CONFIGURED = import.meta.env.VITE_SUPABASE_URL &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

export default function LoginScreen() {
  const { t } = useT();
  const goTo = useAppStore(s => s.goTo);
  const setUserName = useAppStore(s => s.setUserName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!SUPABASE_CONFIGURED) {
        // Supabase not configured yet — bypass auth and go straight to dashboard
        const name = email.split('@')[0];
        setUserName(name.charAt(0).toUpperCase() + name.slice(1));
        goTo('dashboard');
        return;
      }

      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(t('login.errInvalid'));
      }
      // On success, onAuthStateChange in App.tsx handles the redirect
    } catch (err) {
      setError(t('login.errConnection'));
      console.error('[login]', err);
    } finally {
      // Defensa: setLoading(false) garantizado aunque el redirect del listener
      // falle o tarde. Sin esto, el botón queda spinning indefinidamente.
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!email) { setError(t('login.errNoEmail')); return; }
    if (!SUPABASE_CONFIGURED) { setResetSent(true); return; }
    setLoading(true);
    const { supabase } = await import('../lib/supabase');
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setResetSent(true);
  }

  return (
    <div className="login-screen">
      <div className="ls-bg" />
      <LanguageToggle className="lang-toggle--corner" />
      <div className="ls-card">
        <div className="ls-logo">
          <img
            src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png"
            alt="Healthy Space Club"
          />
        </div>

        <div className="ls-head">
          <h1>{t('login.title')}</h1>
          <p>{t('login.subtitle')}</p>
        </div>

        {resetSent ? (
          <div className="ls-reset-ok">
            <div className="ls-reset-icon">✉️</div>
            <div className="ls-reset-title">{t('login.resetTitle')}</div>
            <p>{t('login.resetBody')}</p>
            <button className="ls-btn" onClick={() => setResetSent(false)}>{t('login.resetBack')}</button>
          </div>
        ) : (
          <form className="ls-form" onSubmit={handleLogin}>
            <div className="ls-field">
              <label className="ls-label">{t('login.emailLabel')}</label>
              <input
                className="ls-input"
                type="email"
                placeholder={t('login.emailPlaceholder')}
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="ls-field">
              <label className="ls-label">{t('login.passwordLabel')}</label>
              <input
                className="ls-input"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="ls-error">{error}</div>}

            <button className="ls-btn" type="submit" disabled={loading}>
              {loading ? <span className="ls-spinner" /> : t('login.submit')}
            </button>

            <button
              type="button"
              className="ls-forgot"
              onClick={handleReset}
              disabled={loading}
            >
              {t('login.forgot')}
            </button>

            {/* Volver a la landing. Estilo inline a propósito: la clase .ls-back
                global (index.css:2574, de LifeSystemScreen) la pintaría blanca sobre
                la card clara → invisible. */}
            <button
              type="button"
              onClick={() => goTo('landing')}
              disabled={loading}
              style={{
                display: 'block', margin: '20px auto 0', background: 'none', border: 'none',
                color: 'var(--txt2)', fontSize: '.78rem', cursor: 'pointer',
                fontFamily: 'inherit', textDecoration: 'none',
              }}
            >
              {t('login.back')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
