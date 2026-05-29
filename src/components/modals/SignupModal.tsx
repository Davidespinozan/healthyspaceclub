import { useState } from 'react';
import { useAppStore } from '../../store';
import { supabase } from '../../lib/supabase';
import TermsSheet from '../sheets/TermsSheet';
import PrivacySheet from '../sheets/PrivacySheet';

export default function SignupModal() {
  const { closeModal, goTo, setUserName, setObData } = useAppStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  async function handleSignup() {
    setError('');
    if (name.trim().length < 2) {
      setError('Ingresa tu nombre (mínimo 2 caracteres).');
      return;
    }
    const trimEmail = email.trim();
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError('Ingresa un correo válido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!acceptedTerms) {
      setError('Aceptá los Términos y la Política de Privacidad para continuar.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimEmail,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        const displayName = name.trim().split(' ')[0];
        setUserName(displayName);
        setObData('name', displayName);
        closeModal();
        // Si hay un checkout pendiente, App.tsx (SIGNED_IN) lo reanuda y redirige
        // a Stripe — no navegamos a onboarding para no pisar ese flujo.
        if (!useAppStore.getState().pendingCheckout) {
          goTo('onboarding');
        }
      } else if (data.user && !data.session) {
        setError('Revisa tu email para confirmar tu cuenta.');
        setLoading(false);
      }
    } catch {
      setError('Error al crear cuenta. Intenta de nuevo.');
      setLoading(false);
    }
  }

  return (
    <div className="ov open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="login-box">
        <div className="login-head" style={{ background: 'linear-gradient(135deg,var(--forest),var(--moss))' }}>
          <img
            src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png"
            alt="Healthy Space Club"
            className="login-logo"
          />
          <button className="pay-x" onClick={closeModal}>✕</button>
        </div>
        <div className="login-body">
          <div className="signup-check">✦</div>
          <h3 className="login-title" style={{ textAlign: 'center' }}>Creá tu cuenta</h3>
          <p className="login-sub" style={{ textAlign: 'center' }}>Un paso antes de tu prueba gratis. Después te llevamos al pago seguro.</p>
          <div className="pay-lbl">Nombre completo</div>
          <input
            className="pay-inp"
            type="text"
            placeholder="Tu nombre"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="pay-lbl">Correo electrónico</div>
          <input
            className="pay-inp"
            type="email"
            placeholder="tu@correo.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="pay-lbl">Crea una contraseña</div>
          <input
            className="pay-inp"
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label className="signup-tos">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={e => setAcceptedTerms(e.target.checked)}
            />
            <span>
              Acepto los{' '}
              <button type="button" className="signup-tos-link" onClick={() => setShowTerms(true)}>
                Términos de Servicio
              </button>
              {' '}y la{' '}
              <button type="button" className="signup-tos-link" onClick={() => setShowPrivacy(true)}>
                Política de Privacidad
              </button>
              .
            </span>
          </label>

          {error && <div style={{ color: '#cc3333', fontSize: '.8rem', margin: '0 0 10px', textAlign: 'center' }}>{error}</div>}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="var(--moss)" strokeWidth="3" fill="none" strokeDasharray="32" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <button
              className="btn-login"
              style={{
                background: acceptedTerms ? 'var(--amber)' : 'rgba(212,151,107,.4)',
                color: 'var(--forest)',
                cursor: acceptedTerms ? 'pointer' : 'not-allowed',
              }}
              onClick={handleSignup}
              disabled={!acceptedTerms}
            >
              Crear mi cuenta ✦
            </button>
          )}
          <p className="login-demo">— Sin cobro hoy · cancelás cuando quieras —</p>
        </div>
      </div>

      {showTerms && <TermsSheet onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacySheet onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
