import { useMemo, useState } from 'react';
import { useEquipo } from '../hooks/useEquipo';
import { num } from '../lib/format';
import { nombreDe } from './Socios';
import { ShieldCheck, ShieldX, UserPlus } from 'lucide-react';

export default function Equipo() {
  const { personas, loading, error, setAdmin } = useEquipo();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const admins = useMemo(() => personas.filter((p) => p.is_admin), [personas]);
  const candidatos = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return personas.filter((p) => !p.is_admin && nombreDe(p).toLowerCase().includes(t)).slice(0, 8);
  }, [personas, q]);

  async function cambiar(userId: string, esAdmin: boolean) {
    setBusy(userId); setMsg(null);
    const err = await setAdmin(userId, esAdmin);
    setBusy(null);
    if (err) setMsg(err.includes('ULTIMO_ADMIN') ? 'No puedes quitar al último administrador.' : `No se pudo: ${err}`);
  }

  return (
    <>
      <div className="adm-page-head">
        <h1>Equipo</h1>
        <p>Quién puede entrar al panel del Club.</p>
      </div>

      {error && <div className="adm-alert">No se pudo cargar: {error}</div>}
      {msg && <div className="adm-alert">{msg}</div>}
      {loading ? <div className="adm-muted">Cargando…</div> : (
        <>
          <div className="adm-section">
            <div className="adm-section-title">Administradores ({num(admins.length)})</div>
            <div className="adm-card">
              <table className="adm-table adm-table--rows">
                <tbody>
                  {admins.map((p) => (
                    <tr key={p.user_id}>
                      <td><ShieldCheck size={15} strokeWidth={2} style={{ verticalAlign: '-2px', color: 'var(--adm-accent)' }} /> <b>{nombreDe(p)}</b></td>
                      <td className="adm-num">
                        <button className="adm-btn-ghost" disabled={busy === p.user_id || admins.length <= 1}
                          onClick={() => cambiar(p.user_id, false)}
                          title={admins.length <= 1 ? 'Es el último admin' : 'Quitar acceso'}>
                          <ShieldX size={14} strokeWidth={2} /> Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="adm-section">
            <div className="adm-section-title">Dar acceso</div>
            <div className="adm-card">
              <input className="adm-search" placeholder="Buscar un socio por nombre o usuario…" value={q} onChange={(e) => setQ(e.target.value)} />
              {q.trim() && (
                <table className="adm-table adm-table--rows" style={{ marginTop: 10 }}>
                  <tbody>
                    {candidatos.map((p) => (
                      <tr key={p.user_id}>
                        <td>{nombreDe(p)}</td>
                        <td className="adm-num">
                          <button className="adm-btn-ghost" disabled={busy === p.user_id} onClick={() => cambiar(p.user_id, true)}>
                            <UserPlus size={14} strokeWidth={2} /> Hacer admin
                          </button>
                        </td>
                      </tr>
                    ))}
                    {candidatos.length === 0 && (
                      <tr><td className="adm-muted" style={{ padding: '14px 6px' }}>Ningún socio coincide.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
