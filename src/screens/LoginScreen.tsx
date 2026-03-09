import { useState } from 'react';
import { useAppStore } from '../store';

const SUPABASE_CONFIGURED = import.meta.env.VITE_SUPABASE_URL &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

export default function LoginScreen() {
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
      setError('Correo o contraseña incorrectos. Intenta de nuevo.');
      setLoading(false);
    }
    // On success, onAuthStateChange in App.tsx handles the redirect
  }

  async function handleReset() {
    if (!email) { setError('Escribe tu correo primero.'); return; }
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
      <div className="ls-card">
        <div className="ls-logo">
          <img
            src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1771971266/logo_ohaica.png"
            alt="Healthy Space Club"
          />
        </div>

        <div className="ls-head">
          <h1>Acceso para Miembros</h1>
          <p>Inicia sesión para continuar tu programa</p>
        </div>

        {resetSent ? (
          <div className="ls-reset-ok">
            <div className="ls-reset-icon">✉️</div>
            <div className="ls-reset-title">Revisa tu correo</div>
            <p>Te enviamos un enlace para restablecer tu contraseña.</p>
            <button className="ls-btn" onClick={() => setResetSent(false)}>Volver al login</button>
          </div>
        ) : (
          <form className="ls-form" onSubmit={handleLogin}>
            <div className="ls-field">
              <label className="ls-label">Correo electrónico</label>
              <input
                className="ls-input"
                type="email"
                placeholder="tu@correo.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="ls-field">
              <label className="ls-label">Contraseña</label>
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
              {loading ? <span className="ls-spinner" /> : 'Entrar al Club'}
            </button>

            <button
              type="button"
              className="ls-forgot"
              onClick={handleReset}
              disabled={loading}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        )}

        <div className="ls-footer">
          <button className="ls-back" onClick={() => goTo('landing')}>
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
