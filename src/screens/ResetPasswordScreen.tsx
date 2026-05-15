import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';

export default function ResetPasswordScreen() {
  const goTo = useAppStore(s => s.goTo);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || 'No pudimos actualizar tu contraseña.');
        return;
      }
      setSuccess(true);
      await supabase.auth.signOut();
      window.history.replaceState({}, '', '/');
      setTimeout(() => goTo('login'), 1600);
    } catch (e) {
      console.error('[reset-password]', e);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="ls-bg" />
      <div className="ls-card">
        <div className="ls-logo">
          <img
            src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png"
            alt="Healthy Space Club"
          />
        </div>

        <div className="ls-head">
          <h1>Nueva contraseña</h1>
          <p>Elegí una nueva contraseña para tu cuenta.</p>
        </div>

        {success ? (
          <div className="ls-reset-ok">
            <div className="ls-reset-icon">✓</div>
            <div className="ls-reset-title">Contraseña actualizada</div>
            <p>Te llevamos al login…</p>
          </div>
        ) : (
          <form className="ls-form" onSubmit={handleSubmit}>
            <div className="ls-field">
              <label className="ls-label">Nueva contraseña</label>
              <input
                className="ls-input"
                type="password"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="ls-field">
              <label className="ls-label">Confirmar contraseña</label>
              <input
                className="ls-input"
                type="password"
                placeholder="Repetí la contraseña"
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>

            {error && <div className="ls-error">{error}</div>}

            <button className="ls-btn" type="submit" disabled={loading}>
              {loading ? <span className="ls-spinner" /> : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
