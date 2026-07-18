import { useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useAppStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../../i18n';
import TermsSheet from '../sheets/TermsSheet';
import PrivacySheet from '../sheets/PrivacySheet';
import { useEmailSignup } from '../../hooks/useEmailSignup';

export default function SignupModal() {
  const { t } = useT();
  const { closeModal, goTo, setUserName, setObData } = useAppStore(useShallow((s) => ({ closeModal: s.closeModal, goTo: s.goTo, setUserName: s.setUserName, setObData: s.setObData })));
  const su = useEmailSignup();

  // Cerrar con Escape (estándar de modal + accesibilidad por teclado).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal]);

  async function handleSignup() {
    const { outcome } = await su.submit();
    if (outcome === 'session') {
      setUserName(su.firstName);
      setObData('name', su.firstName);
      closeModal();
      goTo('onboarding');
    }
    // 'needs-confirmation' y 'error' ya dejaron el mensaje en su.error.
  }

  return (
    <div className="ov open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="login-box" role="dialog" aria-modal="true" aria-label={t('signup.success')}>
        <div className="login-head" style={{ background: 'linear-gradient(135deg, rgba(28,59,53,.55), rgba(8,19,18,0))' }}>
          <img
            src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logohscisotipo.webp"
            alt="Healthy Space Club"
            className="login-logo"
          />
          <button className="pay-x" onClick={closeModal} aria-label={t('common.close')}><X size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /></button>
        </div>
        <div className="login-body">
          <div className="signup-check"><Check size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /></div>
          <h3 className="login-title" style={{ textAlign: 'center' }}>{t('signup.success')}</h3>
          <p className="login-sub" style={{ textAlign: 'center' }}>{t('signup.subtitle')}</p>
          <div className="pay-lbl">{t('signup.nameLabel')}</div>
          <input
            className="pay-inp"
            type="text"
            placeholder={t('signup.namePlaceholder')}
            autoComplete="name"
            value={su.name}
            onChange={(e) => su.setName(e.target.value)}
          />
          <div className="pay-lbl">{t('signup.emailLabel')}</div>
          <input
            className="pay-inp"
            type="email"
            placeholder={t('signup.emailPlaceholder')}
            autoComplete="email"
            value={su.email}
            onChange={(e) => su.setEmail(e.target.value)}
          />
          <div className="pay-lbl">{t('signup.passwordLabel')}</div>
          <input
            className="pay-inp"
            type="password"
            placeholder={t('signup.passwordPlaceholder')}
            autoComplete="new-password"
            value={su.password}
            onChange={(e) => su.setPassword(e.target.value)}
          />
          <label className="signup-tos">
            <input
              type="checkbox"
              checked={su.acceptedTerms}
              onChange={e => su.setAcceptedTerms(e.target.checked)}
            />
            <span>
              {t('signup.tosAccept')}{' '}
              <button type="button" className="signup-tos-link" onClick={() => su.setShowTerms(true)}>
                {t('signup.tosTerms')}
              </button>
              {' '}{t('signup.tosAnd')}{' '}
              <button type="button" className="signup-tos-link" onClick={() => su.setShowPrivacy(true)}>
                {t('signup.tosPrivacy')}
              </button>
              .
            </span>
          </label>

          {su.error && <div style={{ color: '#ff8a8a', fontSize: '.8rem', margin: '0 0 10px', textAlign: 'center' }}>{su.error}</div>}
          {su.loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="var(--moss)" strokeWidth="3" fill="none" strokeDasharray="32" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <button
              className="btn-login"
              style={{
                background: su.acceptedTerms ? 'var(--amber)' : 'rgba(212,151,107,.4)',
                color: 'var(--forest)',
                cursor: su.acceptedTerms ? 'pointer' : 'not-allowed',
              }}
              onClick={handleSignup}
              disabled={!su.acceptedTerms}
            >
              {t('signup.submit')}
            </button>
          )}
          <p className="login-demo">{t('signup.demo')}</p>
        </div>
      </div>

      {su.showTerms && <TermsSheet onClose={() => su.setShowTerms(false)} />}
      {su.showPrivacy && <PrivacySheet onClose={() => su.setShowPrivacy(false)} />}
    </div>
  );
}
