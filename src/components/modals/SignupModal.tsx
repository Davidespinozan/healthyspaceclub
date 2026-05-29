import { useAppStore } from '../../store';
import TermsSheet from '../sheets/TermsSheet';
import PrivacySheet from '../sheets/PrivacySheet';
import { useEmailSignup } from '../../hooks/useEmailSignup';

export default function SignupModal() {
  const { closeModal, goTo, setUserName, setObData } = useAppStore();
  const su = useEmailSignup();

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
          <div className="signup-check">✓</div>
          <h3 className="login-title" style={{ textAlign: 'center' }}>¡Pago exitoso!</h3>
          <p className="login-sub" style={{ textAlign: 'center' }}>Crea tu cuenta para acceder al Club.</p>
          <div className="pay-lbl">Nombre completo</div>
          <input
            className="pay-inp"
            type="text"
            placeholder="Tu nombre"
            autoComplete="name"
            value={su.name}
            onChange={(e) => su.setName(e.target.value)}
          />
          <div className="pay-lbl">Correo electrónico</div>
          <input
            className="pay-inp"
            type="email"
            placeholder="tu@correo.com"
            autoComplete="email"
            value={su.email}
            onChange={(e) => su.setEmail(e.target.value)}
          />
          <div className="pay-lbl">Crea una contraseña</div>
          <input
            className="pay-inp"
            type="password"
            placeholder="Mínimo 8 caracteres"
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
              Acepto los{' '}
              <button type="button" className="signup-tos-link" onClick={() => su.setShowTerms(true)}>
                Términos de Servicio
              </button>
              {' '}y la{' '}
              <button type="button" className="signup-tos-link" onClick={() => su.setShowPrivacy(true)}>
                Política de Privacidad
              </button>
              .
            </span>
          </label>

          {su.error && <div style={{ color: '#cc3333', fontSize: '.8rem', margin: '0 0 10px', textAlign: 'center' }}>{su.error}</div>}
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
              Crear mi cuenta ✦
            </button>
          )}
          <p className="login-demo">— Demo visual · ingresa cualquier dato —</p>
        </div>
      </div>

      {su.showTerms && <TermsSheet onClose={() => su.setShowTerms(false)} />}
      {su.showPrivacy && <PrivacySheet onClose={() => su.setShowPrivacy(false)} />}
    </div>
  );
}
