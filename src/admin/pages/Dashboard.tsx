import { useAdminDashboard } from '../hooks/useAdminDashboard';
import StatCard from '../components/StatCard';
import MiniBars from '../components/MiniBars';
import { money, num, monedasPorVolumen } from '../lib/format';

// Líneas de dinero por moneda (MXN y USD/EUR nunca se suman → una línea c/u).
function MoneyLines({ rec }: { rec: Record<string, number> }) {
  const ms = monedasPorVolumen(rec);
  if (!ms.length) return <span>—</span>;
  return <>{ms.map((m) => <div key={m}>{money(rec[m], m)}</div>)}</>;
}

export default function Dashboard() {
  const d = useAdminDashboard();

  return (
    <>
      <div className="adm-page-head">
        <h1>Dashboard</h1>
        <p>El pulso del negocio del Club, este mes.</p>
      </div>

      {d.error && <div className="adm-alert">No se pudo cargar: {d.error}</div>}
      {d.loading ? (
        <div className="adm-muted">Cargando…</div>
      ) : (
        <>
          <div className="adm-grid">
            <StatCard label="Ingreso del mes" value={<MoneyLines rec={d.ingresoMes} />}
              sub={monedasPorVolumen(d.reembolsosMes).length ? 'reembolsos ya restados' : 'neto del mes'} />
            <StatCard label="MRR realizado" value={<MoneyLines rec={d.mrr} />}
              sub="último cobro de cada socio pro, a mensual" />
            <StatCard label="Socios activos" value={num(d.activos)}
              sub={`${num(d.pro)} pro · ${num(d.trial)} en prueba`} />
            <StatCard label="Activos este mes (MAU)" value={num(d.mau)}
              sub="abrieron la app en 30 días" />
            <StatCard label="Altas del mes" value={num(d.altasMes)} tone={d.altasMes > 0 ? 'good' : undefined} />
            <StatCard label="Bajas del mes" value={num(d.bajasMes)} tone={d.bajasMes > 0 ? 'danger' : undefined} />
            <StatCard label="Pago vencido" value={num(d.pastDue)} tone={d.pastDue > 0 ? 'warn' : undefined}
              sub={d.pastDue > 0 ? 'socios por regularizar' : 'todo al corriente'} />
          </div>

          <div className="adm-card adm-trend">
            <div className="adm-card-label">
              Ingreso · últimos 30 días{d.trendMoneda ? ` (${d.trendMoneda})` : ''}
            </div>
            {d.trend.some((t) => t.value > 0) ? (
              <MiniBars data={d.trend.map((t) => ({ ...t, hint: `${t.label}: ${money(t.value, d.trendMoneda ?? 'MXN')}` }))}
                fmt={(n) => money(n, d.trendMoneda ?? 'MXN')} />
            ) : (
              <div className="adm-muted" style={{ padding: '20px 0' }}>Sin cobros en los últimos 30 días.</div>
            )}
          </div>
        </>
      )}
    </>
  );
}
