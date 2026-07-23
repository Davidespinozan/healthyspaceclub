import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBitacora } from '../hooks/useBitacora';
import { fechaHora } from '../lib/format';

const ACCION: Record<string, string> = {
  'socio.nota': 'Nota interna',
  'socio.estado': 'Cambio de estado',
  'socio.aviso': 'Aviso enviado',
};

export default function Bitacora() {
  const { loading, error, filas } = useBitacora();
  const [q, setQ] = useState('');

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return filas;
    return filas.filter((f) =>
      (f.actor_nombre ?? '').toLowerCase().includes(t) ||
      (f.socio_nombre ?? '').toLowerCase().includes(t) ||
      f.resumen.toLowerCase().includes(t) ||
      f.accion.toLowerCase().includes(t));
  }, [filas, q]);

  return (
    <>
      <div className="adm-page-head">
        <h1>Bitácora</h1>
        <p>Quién tocó qué. Registro append-only de las acciones del panel.</p>
      </div>

      <div className="adm-toolbar">
        <input className="adm-search" placeholder="Buscar por socio, admin o acción…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <div className="adm-alert">No se pudo cargar: {error}</div>}
      {loading ? <div className="adm-muted">Cargando…</div> : (
        <div className="adm-card">
          <table className="adm-table adm-table--rows">
            <thead>
              <tr><th>Cuándo</th><th>Acción</th><th>Socio</th><th>Resumen</th><th>Admin</th></tr>
            </thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id}>
                  <td className="adm-sub2">{fechaHora(f.creado_en)}</td>
                  <td><span className="adm-badge muted">{ACCION[f.accion] ?? f.accion}</span></td>
                  <td>{f.socio_id ? <Link className="adm-link" to={`/socios/${f.socio_id}`}>{f.socio_nombre ?? f.socio_id.slice(0, 8)}</Link> : '—'}</td>
                  <td>{f.resumen}</td>
                  <td className="adm-sub2">{f.actor_nombre ?? '—'}</td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr><td colSpan={5} className="adm-muted" style={{ padding: '20px 6px' }}>
                  {filas.length === 0 ? 'Aún no hay acciones registradas.' : 'Nada coincide con la búsqueda.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
