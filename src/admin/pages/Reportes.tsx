import { useState } from 'react';
import { useReportes, type PeriodoRep } from '../hooks/useReportes';
import StatCard from '../components/StatCard';
import { money, num, pct, monedasPorVolumen } from '../lib/format';

const PERIODOS: { id: PeriodoRep; label: string }[] = [
  { id: 'mes', label: 'Este mes' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
];

function MoneyLines({ rec }: { rec: Record<string, number> }) {
  const ms = monedasPorVolumen(rec);
  if (!ms.length) return <span>—</span>;
  return <>{ms.map((m) => <div key={m}>{money(rec[m], m)}</div>)}</>;
}

function Seccion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="adm-section">
      <div className="adm-section-title">{title}</div>
      <div className="adm-grid">{children}</div>
    </div>
  );
}

export default function Reportes() {
  const [periodo, setPeriodo] = useState<PeriodoRep>('30d');
  const d = useReportes(periodo);

  return (
    <>
      <div className="adm-page-head">
        <h1>Reportes</h1>
        <p>Economía, retención y engagement — lo que dice si el negocio funciona.</p>
      </div>

      <div className="adm-pills">
        {PERIODOS.map((p) => (
          <button key={p.id} className={`adm-pill${periodo === p.id ? ' on' : ''}`} onClick={() => setPeriodo(p.id)}>{p.label}</button>
        ))}
      </div>

      {d.error && <div className="adm-alert">No se pudo cargar: {d.error}</div>}
      {d.loading ? <div className="adm-muted">Cargando…</div> : (
        <>
          <Seccion title="Economía">
            <StatCard label="MRR realizado" value={<MoneyLines rec={d.mrr} />} sub="ingreso recurrente mensual" />
            <StatCard label="ARR" value={<MoneyLines rec={d.arr} />} sub="MRR × 12" />
            <StatCard label="ARPU" value={<MoneyLines rec={d.arpu} />} sub="ingreso por socio pagando" />
            <StatCard label="LTV estimado" value={d.churnMensual > 0 ? <MoneyLines rec={d.ltv} /> : '—'}
              sub={d.churnMensual > 0 ? 'ARPU ÷ churn' : 'sin churn aún'} />
          </Seccion>

          <Seccion title="Retención">
            <StatCard label="Churn mensual" value={pct(d.churnMensual * 100)}
              tone={d.churnMensual > 0.1 ? 'danger' : d.churnMensual > 0 ? 'warn' : 'good'}
              sub={`${num(d.bajas)} bajas en el período`} />
            <StatCard label="Retención mensual" value={pct(d.retencion * 100)} tone="good" />
            <StatCard label="Altas del período" value={num(d.altas)} tone={d.altas > 0 ? 'good' : undefined} />
            <StatCard label="Conversión de prueba" value={d.trialStarts > 0 ? pct(d.conversion * 100) : '—'}
              sub={d.trialStarts > 0 ? `${num(d.conversiones)}/${num(d.trialStarts)} pruebas (histórico)` : 'sin pruebas aún'} />
          </Seccion>

          <Seccion title="Engagement">
            <StatCard label="MAU" value={num(d.mau)} sub="activos en 30 días" />
            <StatCard label="DAU" value={num(d.dau)} sub="activos hoy" />
            <StatCard label="Stickiness" value={d.mau > 0 ? pct(d.stickiness * 100) : '—'} sub="DAU ÷ MAU" />
            <StatCard label="Activación" value={pct(d.activacion * 100)} sub="altas 90d que usaron la app" />
          </Seccion>

          <div className="adm-section">
            <div className="adm-section-title">Retención por cohorte de alta</div>
            <div className="adm-card">
              <table className="adm-table adm-table--rows">
                <thead>
                  <tr><th>Mes de alta</th><th className="adm-num">Altas</th><th className="adm-num">Activos hoy</th><th>Retención</th></tr>
                </thead>
                <tbody>
                  {d.cohortes.map((c, i) => (
                    <tr key={i}>
                      <td>{c.mes}</td>
                      <td className="adm-num">{num(c.alta)}</td>
                      <td className="adm-num">{num(c.activos)}</td>
                      <td>
                        {c.alta > 0 ? (
                          <span className="adm-cohort">
                            <span className="adm-cohort-bar"><span style={{ width: `${Math.round(c.retencion * 100)}%` }} /></span>
                            {pct(c.retencion * 100)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="adm-note">
            El MRR/ARPU/LTV son <b>realizados</b> (desde el ledger de cobros), no a precio de lista.
            La conversión de prueba es histórica. Todo se afina cuando haya más historia post-lanzamiento.
          </p>
        </>
      )}
    </>
  );
}
