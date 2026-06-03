import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import LanguageToggle from '../components/LanguageToggle';

export default function ResetPasswordScreen() {
  const { t } = useT();
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
      setError(t('resetPassword.errTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('resetPassword.errMismatch'));
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || t('resetPassword.errUpdate'));
        return;
      }
      setSuccess(true);
      await supabase.auth.signOut();
      window.history.replaceState({}, '', '/');
      setTimeout(() => goTo('login'), 1600);
    } catch (e) {
      console.error('[reset-password]', e);
      setError(t('resetPassword.errConnection'));
    } finally {
      setLoading(false);
    }
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
          <h1>{t('resetPassword.title')}</h1>
          <p>{t('resetPassword.subtitle')}</p>
        </div>

        {success ? (
          <div className="ls-reset-ok">
            <div className="ls-reset-icon">✓</div>
            <div className="ls-reset-title">{t('resetPassword.okTitle')}</div>
            <p>{t('resetPassword.okBody')}</p>
          </div>
        ) : (
          <form className="ls-form" onSubmit={handleSubmit}>
            <div className="ls-field">
              <label className="ls-label">{t('resetPassword.newLabel')}</label>
              <input
                className="ls-input"
                type="password"
                placeholder={t('resetPassword.newPlaceholder')}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="ls-field">
              <label className="ls-label">{t('resetPassword.confirmLabel')}</label>
              <input
                className="ls-input"
                type="password"
                placeholder={t('resetPassword.confirmPlaceholder')}
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>

            {error && <div className="ls-error">{error}</div>}

            <button className="ls-btn" type="submit" disabled={loading}>
              {loading ? <span className="ls-spinner" /> : t('resetPassword.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
