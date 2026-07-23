import { useParams, useNavigate } from 'react-router-dom';
import { useSocioDetalle } from '../hooks/useSocioDetalle';
import StatusBadge from '../components/StatusBadge';
import StatCard from '../components/StatCard';
import { money, num, fecha, fechaHora, monedasPorVolumen } from '../lib/format';
import { nombreDe } from './Socios';
import { ArrowLeft } from 'lucide-react';

const METODO: Record<string, string> = { stripe: 'Stripe', efectivo: 'Efectivo', transferencia: 'Transferencia', terminal: 'Terminal', cortesia: 'Cortesía' };
const CONCEPTO: Record<string, string> = { suscripcion: 'Suscripción', venta: 'Venta', reembolso: 'Reembolso', ajuste: 'Ajuste' };
const MOTIVO: Record<string, string> = {
  alta: 'Alta', conversion_trial: 'Convirtió de prueba', pago_fallido: 'Pago fallido',
  pago_recuperado: 'Pago recuperado', cancelacion: 'Cancelación', cambio_estado: 'Cambio de estado',
  backfill_lanzamiento: 'Alta (registro inicial)',
};

function antiguedad(desde: string | null): string {
  if (!desde) return '—';
  const dias = Math.floor((Date.now() - new Date(desde).getTime()) / 86400000);
  if (dias < 31) return `${dias} d`;
  const meses = Math.floor(dias / 30);
  return meses < 12 ? `${meses} mes${meses === 1 ? '' : 'es'}` : `${(dias / 365).toFixed(1)} años`;
}

export default function SocioDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const d = useSocioDetalle(id);

  if (d.loading) return <div className="adm-muted">Cargando…</div>;
  if (d.error) return <div className="adm-alert">No se pudo cargar: {d.error}</div>;
  if (!d.perfil) return <div className="adm-muted">Socio no encontrado.</div>;

  const p = d.perfil;
  const ltvMonedas = monedasPorVolumen(d.ltv);

  return (
    <>
      <button className="adm-back" onClick={() => nav('/socios')}>
        <ArrowLeft size={15} strokeWidth={2} /> Socios
      </button>

      {/* Hero */}
      <div className="adm-hero">
        {p.avatar_url ? <img className="adm-hero-av" src={p.avatar_url} alt="" /> : <div className="adm-hero-av adm-hero-av--empty">{nombreDe(p).slice(0, 1).toUpperCase()}</div>}
        <div>
          <h1>{nombreDe(p)}</h1>
          <div className="adm-hero-meta">
            <StatusBadge status={p.subscription_status} pastDue={p.payment_past_due} />
            {p.plan_id && <span>{p.billing_cycle === 'annual' ? 'Anual' : 'Mensual'}</span>}
            {p.subscription_period_end && <span>renueva {fecha(p.subscription_period_end)}</span>}
            {p.username && <span>@{p.username}</span>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="adm-grid">
        <StatCard label="LTV" value={ltvMonedas.length ? <>{ltvMonedas.map((m) => <div key={m}>{money(d.ltv[m], m)}</div>)}</> : '—'}
          sub="total cobrado de por vida" />
        <StatCard label="Antigüedad" value={antiguedad(p.start_date ?? p.created_at)}
          sub={p.created_at ? `desde ${fecha(p.created_at)}` : undefined} />
        <StatCard label="Racha" value={p.streak_count ? `${num(p.streak_count)}🔥` : '—'}
          sub={p.fire_count != null ? `${num(p.fire_count)} totales` : undefined} />
        <StatCard label="Último activo" value={p.last_active_date ? fecha(p.last_active_date) : '—'}
          sub="abrió la app" />
      </div>

      <div className="adm-cols">
        {/* Historial de pagos */}
        <div className="adm-card">
          <div className="adm-card-label">Historial de pagos ({num(d.pagos.length)})</div>
          {d.pagos.length === 0 ? <div className="adm-muted" style={{ padding: '12px 0' }}>Sin cobros registrados.</div> : (
            <table className="adm-table adm-table--rows">
              <tbody>
                {d.pagos.map((x, i) => (
                  <tr key={i}>
                    <td>{fecha(x.ocurrido_en)}</td>
                    <td>{CONCEPTO[x.concepto] ?? x.concepto}<span className="adm-sub2"> · {METODO[x.metodo] ?? x.metodo}</span></td>
                    <td className="adm-num" style={x.monto_centavos < 0 ? { color: 'var(--adm-danger)' } : undefined}>{money(x.monto_centavos, x.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Historial de estados */}
        <div className="adm-card">
          <div className="adm-card-label">Historial de estados ({num(d.eventos.length)})</div>
          {d.eventos.length === 0 ? <div className="adm-muted" style={{ padding: '12px 0' }}>Sin eventos. (Se registran desde el lanzamiento.)</div> : (
            <ul className="adm-timeline">
              {d.eventos.map((e, i) => (
                <li key={i}>
                  <div className="adm-tl-dot" />
                  <div>
                    <b>{MOTIVO[e.motivo ?? ''] ?? e.motivo ?? 'Cambio'}</b>
                    <div className="adm-sub2">
                      {e.de_estado ? `${e.de_estado} → ` : ''}{e.a_estado} · {fechaHora(e.ocurrido_en)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Acciones (Fase 3b) */}
      <div className="adm-soon" style={{ marginTop: 16 }}>
        <span className="adm-soon-tag">Fase 3b</span>
        <h2>Acciones sobre el socio</h2>
        <p>Aquí irán, por RPC seguro + bitácora: cambiar estado, dar cortesía/meses gratis, notas internas y enviar aviso.</p>
      </div>
    </>
  );
}
