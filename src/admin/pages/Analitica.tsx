import { useAnalitica, tasa, type Dias } from '../hooks/useAnalitica';
import StatCard from '../components/StatCard';
import MiniBars from '../components/MiniBars';
import { money, num, pct, monedasPorVolumen } from '../lib/format';

// ADMIN-ANALYTICS-1 · P0 · Analítica de producto desde datos autoritativos (DB/Stripe).
// PostHog NO participa (funnels de comportamiento = futuro). Solo agregados.

const RANGOS: Dias[] = [7, 30, 90];

function MoneyLines({ rec }: { rec: Record<string, number> }) {
  const ms = monedasPorVolumen(rec);
  if (!ms.length) return <span>—</span>;
  return <>{ms.map((m) => <div key={m}>{money(rec[m], m)}</div>)}</>;
}

function Ret({ d, label, r }: { d: string; label: string; r: Record<string, { elegibles: number; retenidos: number }> }) {
  const cell = r[d];
  const t = cell ? tasa(cell.retenidos, cell.elegibles) : null;
  return (
    <StatCard
      label={label}
      value={t == null ? '—' : pct(t)}
      sub={cell ? `${num(cell.retenidos)}/${num(cell.elegibles)} de la cohorte elegible` : 'sin cohorte con tiempo suficiente'}
    />
  );
}

export default function Analitica() {
  const { data, loading, error, dias, setDias } = useAnalitica();

  const actTasa = data ? tasa(data.activacion.activados, data.activacion.elegibles) : null;
  const wauMau = data && data.activos.mau > 0 ? data.activos.wau / data.activos.mau : null;

  return (
    <>
      <div className="adm-page-head">
        <h1>Analítica</h1>
        <p>Producto y crecimiento, desde datos reales de HSC. Sin PostHog (los funnels de comportamiento llegan al activar analítica de producto).</p>
      </div>

      <div className="adm-range" role="tablist" aria-label="Rango de fechas">
        {RANGOS.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={dias === d}
            className={`adm-range-btn${dias === d ? ' is-active' : ''}`}
            onClick={() => setDias(d)}
          >
            {d} días
          </button>
        ))}
      </div>

      {error && <div className="adm-alert">No se pudo cargar: {error}</div>}
      {loading || !data ? (
        <div className="adm-muted">Cargando…</div>
      ) : (
        <>
          {/* ── TOP KPIs ── */}
          <div className="adm-grid">
            <StatCard label="Usuarios nuevos" value={num(data.growth.nuevos)} sub={`${num(data.growth.total_users)} en total`} />
            <StatCard label="Activos de producto" value={num(data.activos.rango)} sub={`en ${dias} días · entreno/nutrición/reflexión`} />
            <StatCard
              label="Activación (≤3 días)"
              value={actTasa == null ? '—' : pct(actTasa)}
              sub={`${num(data.activacion.activados)}/${num(data.activacion.elegibles)} nuevos con 1er día activo`}
            />
            <StatCard label="Socios Pro" value={num(data.subs.pro)} sub={`${num(data.subs.trial_ahora)} en prueba`} />
          </div>

          {/* ── CRECIMIENTO ── */}
          <div className="adm-card adm-trend">
            <div className="adm-card-label">Usuarios nuevos · últimos {dias} días</div>
            {data.growth.serie.some((p) => p.n > 0) ? (
              <MiniBars
                data={data.growth.serie.map((p) => ({
                  label: p.fecha.slice(5),
                  value: p.n,
                  hint: `${p.fecha}: ${num(p.n)} nuevos`,
                }))}
                fmt={(n) => num(n)}
              />
            ) : (
              <div className="adm-muted" style={{ padding: '20px 0' }}>Sin altas en el rango.</div>
            )}
          </div>

          {/* ── RETENCIÓN ── */}
          <div className="adm-section-label">Retención (día exacto)</div>
          <div className="adm-grid">
            <Ret d="d1" label="D1" r={data.retencion} />
            <Ret d="d7" label="D7" r={data.retencion} />
            <Ret d="d30" label="D30" r={data.retencion} />
            <StatCard label="WAU / MAU" value={wauMau == null ? '—' : pct(wauMau)}
              sub={`${num(data.activos.wau)} WAU · ${num(data.activos.mau)} MAU`} />
          </div>

          {/* ── ADOPCIÓN DE PRODUCTO ── */}
          <div className="adm-section-label">Adopción de producto · {dias} días</div>
          <div className="adm-grid">
            <StatCard label="Entrenamiento" value={num(data.adopcion.entreno_users)} sub={`${num(data.adopcion.entreno_sesiones)} sesiones completadas`} />
            <StatCard label="Nutrición" value={num(data.adopcion.nutri_users)} sub={`${num(data.adopcion.nutri_dias)} días registrados`} />
            <StatCard label="Reflexión" value={num(data.adopcion.reflex_users)} sub={`${num(data.adopcion.reflex_dias)} días de reflexión`} />
            <StatCard label="Coach" value="—" sub="no aislable hoy (toda la IA comparte endpoint)" />
          </div>

          {/* ── SUSCRIPCIÓN / REVENUE ── */}
          <div className="adm-section-label">Suscripción · {dias} días</div>
          <div className="adm-grid">
            <StatCard label="Trials" value={num(data.subs.trials_rango)} />
            <StatCard label="Trial → Pro" value={num(data.subs.conversiones_rango)} tone={data.subs.conversiones_rango > 0 ? 'good' : undefined} />
            <StatCard label="Bajas" value={num(data.subs.bajas_rango)} tone={data.subs.bajas_rango > 0 ? 'danger' : undefined} />
            <StatCard label="Pago vencido" value={num(data.subs.past_due)} tone={data.subs.past_due > 0 ? 'warn' : undefined} />
            <StatCard label="MRR realizado" value={<MoneyLines rec={data.subs.mrr} />} sub="por moneda · anual a mensual" />
            <StatCard label="Ingreso del rango" value={<MoneyLines rec={data.subs.ingreso_rango} />} sub="neto, por moneda" />
          </div>

          {/* ── REFERIDOS ── */}
          <div className="adm-section-label">Referidos</div>
          <div className="adm-grid">
            <StatCard label="Signups referidos" value={num(data.referidos.signups)} sub={`en ${dias} días`} />
            <StatCard label="Referidos activados" value={num(data.referidos.activados)} sub="con ≥1 día activo (histórico)" />
            <StatCard label="Referidos que pagan" value={num(data.referidos.pagados)} sub="Pro actual" />
          </div>

          <p className="adm-muted adm-caveat">
            Nota: los libros de dinero/estado arrancaron en jul-2026 (backfill de lanzamiento); el histórico previo puede estar incompleto.
            Los días activos usan la fecha local del dispositivo (posible ±1 día vs el instante de alta).
          </p>
        </>
      )}
    </>
  );
}
