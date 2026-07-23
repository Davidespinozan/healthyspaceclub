import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocios, type SocioRow } from '../hooks/useSocios';
import StatusBadge from '../components/StatusBadge';
import { num, fecha } from '../lib/format';

type Filtro = 'todos' | 'pro' | 'trial' | 'vencidos' | 'sin';

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'pro', label: 'Pro' },
  { id: 'trial', label: 'En prueba' },
  { id: 'vencidos', label: 'Pago vencido' },
  { id: 'sin', label: 'Sin plan' },
];

export function nombreDe(s: { display_name: string | null; username: string | null; user_id: string }): string {
  return (s.display_name && s.display_name.trim()) || (s.username && `@${s.username}`) || s.user_id.slice(0, 8);
}

function coincide(s: SocioRow, f: Filtro): boolean {
  if (f === 'todos') return true;
  if (f === 'vencidos') return !!s.payment_past_due;
  if (f === 'pro') return s.subscription_status === 'pro';
  if (f === 'trial') return s.subscription_status === 'trial';
  return !s.subscription_status || s.subscription_status === 'none';
}

export default function Socios() {
  const { loading, error, socios } = useSocios();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const nav = useNavigate();

  const lista = useMemo(() => {
    const term = q.trim().toLowerCase();
    return socios.filter((s) => coincide(s, filtro) && (!term || nombreDe(s).toLowerCase().includes(term)));
  }, [socios, q, filtro]);

  return (
    <>
      <div className="adm-page-head">
        <h1>Socios</h1>
        <p>{loading ? 'Cargando…' : `${num(socios.length)} socios en total.`}</p>
      </div>

      <div className="adm-toolbar">
        <input className="adm-search" placeholder="Buscar por nombre o usuario…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="adm-pills">
          {FILTROS.map((f) => (
            <button key={f.id} className={`adm-pill${filtro === f.id ? ' on' : ''}`} onClick={() => setFiltro(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="adm-alert">No se pudo cargar: {error}</div>}
      {!loading && !error && (
        <div className="adm-card">
          <table className="adm-table adm-table--rows">
            <thead>
              <tr><th>Socio</th><th>Estado</th><th>Plan</th><th>Alta</th><th>Último activo</th><th className="adm-num">Racha</th></tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.user_id} className="adm-row-link" onClick={() => nav(`/socios/${s.user_id}`)}>
                  <td><b>{nombreDe(s)}</b></td>
                  <td><StatusBadge status={s.subscription_status} pastDue={s.payment_past_due} /></td>
                  <td>{s.plan_id ? (s.billing_cycle === 'annual' ? 'Anual' : 'Mensual') : '—'}</td>
                  <td>{s.created_at ? fecha(s.created_at) : '—'}</td>
                  <td>{s.last_active_date ? fecha(s.last_active_date) : '—'}</td>
                  <td className="adm-num">{s.streak_count ? `${num(s.streak_count)}🔥` : '—'}</td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr><td colSpan={6} className="adm-muted" style={{ padding: '20px 6px' }}>Ningún socio coincide.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
