import { useState } from 'react';
import { useIngresos, type Periodo } from '../hooks/useIngresos';
import { money, num, fechaHora } from '../lib/format';

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'mes', label: 'Este mes' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
];
const METODO: Record<string, string> = {
  stripe: 'Stripe', efectivo: 'Efectivo', transferencia: 'Transferencia', terminal: 'Terminal', cortesia: 'Cortesía',
};
const CONCEPTO: Record<string, string> = {
  suscripcion: 'Suscripción', venta: 'Venta', reembolso: 'Reembolso', ajuste: 'Ajuste',
};

export default function Ingresos() {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const d = useIngresos(periodo);

  return (
    <>
      <div className="adm-page-head">
        <h1>Ingresos</h1>
        <p>El libro contable del Club. Cada moneda por separado — nunca se suman.</p>
      </div>

      <div className="adm-pills">
        {PERIODOS.map((p) => (
          <button key={p.id} className={`adm-pill${periodo === p.id ? ' on' : ''}`} onClick={() => setPeriodo(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {d.error && <div className="adm-alert">No se pudo cargar: {d.error}</div>}
      {d.loading ? (
        <div className="adm-muted">Cargando…</div>
      ) : d.monedas.length === 0 ? (
        <div className="adm-muted">Sin movimientos en este período.</div>
      ) : (
        <>
          {/* Resumen por moneda */}
          <div className="adm-grid">
            {d.monedas.map((m) => {
              const r = d.resumen[m];
              return (
                <div key={m} className="adm-card">
                  <div className="adm-card-label">Cobrado neto · {m}</div>
                  <div className="adm-card-value">{money(r.neto, m)}</div>
                  <div className="adm-card-sub">
                    {num(r.cobros)} cobros · ticket {money(r.ticket, m)}
                    {r.reembolsado < 0 && <> · reemb. {money(r.reembolsado, m)}</>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desgloses */}
          <div className="adm-cols">
            <div className="adm-card">
              <div className="adm-card-label">Por método</div>
              <table className="adm-table">
                <tbody>
                  {d.porMetodo.map((x, i) => (
                    <tr key={i}>
                      <td>{METODO[x.metodo] ?? x.metodo}</td>
                      <td className="adm-num">{money(x.total, x.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adm-card">
              <div className="adm-card-label">Por concepto</div>
              <table className="adm-table">
                <tbody>
                  {d.porConcepto.map((x, i) => (
                    <tr key={i}>
                      <td>{CONCEPTO[x.concepto] ?? x.concepto}</td>
                      <td className="adm-num">{money(x.total, x.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Movimientos */}
          <div className="adm-card" style={{ marginTop: 16 }}>
            <div className="adm-card-label">Movimientos ({num(d.movimientos.length)}{d.movimientos.length >= 200 ? '+' : ''})</div>
            <table className="adm-table adm-table--rows">
              <thead>
                <tr><th>Fecha</th><th>Concepto</th><th>Método</th><th className="adm-num">Monto</th><th>Referencia</th></tr>
              </thead>
              <tbody>
                {d.movimientos.map((m, i) => (
                  <tr key={i}>
                    <td>{fechaHora(m.ocurrido_en)}</td>
                    <td>{CONCEPTO[m.concepto] ?? m.concepto}</td>
                    <td>{METODO[m.metodo] ?? m.metodo}</td>
                    <td className="adm-num" style={m.monto_centavos < 0 ? { color: 'var(--adm-danger)' } : undefined}>
                      {money(m.monto_centavos, m.moneda)}
                    </td>
                    <td className="adm-ref">{m.referencia_externa ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
