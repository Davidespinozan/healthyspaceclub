import { useState } from 'react';
import { useAppStore } from '../../store';

export default function LoginModal() {
  const { closeModal, goTo, setUserName } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleLogin() {
    setError('');
    const trimEmail = email.trim();
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError('Ingresa un correo válido.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    const raw = trimEmail.split('@')[0];
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setUserName(name);
      closeModal();
      goTo('dashboard');
    }, 1200);
  }

  return (
    <div className="ov open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="login-box">
        <div className="login-head">
          <img
            className="login-logo"
            src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png"
            alt="Healthy Space Club"
          />
          <button className="pay-x" onClick={closeModal}>✕</button>
        </div>
        <div className="login-body">
          <h3 className="login-title">Bienvenid@ de vuelta</h3>
          <p className="login-sub">Inicia sesión para acceder a tu espacio personal.</p>
          <div className="pay-lbl">Correo electrónico</div>
          <input
            className="pay-inp"
            type="email"
            placeholder="tu@correo.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="pay-lbl">Contraseña</div>
          <input
            className="pay-inp"
            type="password"
            placeholder="Tu contraseña"
            autoComplete="current-password"
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
            <button className="btn-login" onClick={handleLogin}>Iniciar sesión →</button>
          )}
          <p className="login-demo">— Demo visual · ingresa cualquier dato —</p>
        </div>
      </div>
    </div>
  );
}
