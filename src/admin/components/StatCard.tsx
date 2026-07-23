import type { ReactNode } from 'react';

// Tarjeta de métrica del panel. `value` puede ser un string ya formateado o
// varios (una línea por moneda). `tone` tiñe el valor para estados (bueno/alerta).
export default function StatCard({
  label, value, sub, tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'good' | 'warn' | 'danger';
}) {
  const color = tone === 'good' ? 'var(--adm-good)'
    : tone === 'warn' ? 'var(--adm-warn)'
    : tone === 'danger' ? 'var(--adm-danger)'
    : undefined;
  return (
    <div className="adm-card">
      <div className="adm-card-label">{label}</div>
      <div className="adm-card-value" style={color ? { color } : undefined}>{value}</div>
      {sub != null && <div className="adm-card-sub">{sub}</div>}
    </div>
  );
}
