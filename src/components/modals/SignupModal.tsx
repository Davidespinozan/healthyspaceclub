import { useState } from 'react';
import { useAppStore } from '../../store';

export default function SignupModal() {
  const { closeModal, goTo, setUserName } = useAppStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleSignup() {
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
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const displayName = name.trim().split(' ')[0];
      setUserName(displayName);
      closeModal();
      goTo('onboarding');
    }, 1200);
  }

  return (
    <div className="ov open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="login-box">
        <div className="login-head" style={{ background: 'linear-gradient(135deg,var(--forest),var(--moss))' }}>
          <img
            src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1771971266/logo_ohaica.png"
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
              style={{ background: 'var(--amber)', color: 'var(--forest)' }}
              onClick={handleSignup}
            >
              Crear mi cuenta ✦
            </button>
          )}
          <p className="login-demo">— Demo visual · ingresa cualquier dato —</p>
        </div>
      </div>
    </div>
  );
}
