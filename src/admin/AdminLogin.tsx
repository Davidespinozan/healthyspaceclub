import { useState } from 'react';
import { supabase } from '../lib/supabase';

// Login del panel. Usa EXACTAMENTE el mismo Supabase Auth que la landing de
// ventas y la app del socio: mismas cuentas, misma contraseña. No hay un login
// admin aparte. Al entrar, se recarga /admin para que el guard re-evalúe la
// sesión (y is_admin) ya con el usuario presente.
export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setBusy(false); setError('Correo o contraseña incorrectos.'); return; }
    // Sesión lista → recarga en /admin: el guard vuelve a correr y decide.
    window.location.reload();
  }

  return (
    <div className="adm-root adm-boot">
      <form className="adm-login" onSubmit={entrar}>
        <h1>Panel del Club</h1>
        <p>Entra con tu cuenta de Healthy Space.</p>
        <input
          className="adm-search" type="email" autoComplete="email" placeholder="Correo"
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <input
          className="adm-search" type="password" autoComplete="current-password" placeholder="Contraseña"
          value={password} onChange={(e) => setPassword(e.target.value)} required
        />
        {error && <span className="adm-err">{error}</span>}
        <button className="adm-btn" type="submit" disabled={busy || !email || !password}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
