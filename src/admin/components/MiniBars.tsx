// Barras de tendencia hechas a mano en SVG (sin librería de gráficas, como el
// dashboard de sala-studio). Responsivo por viewBox. Cada barra trae <title>
// para hover nativo. La última barra (hoy) va resaltada.
export default function MiniBars({
  data, fmt, height = 120,
}: {
  data: { label: string; value: number; hint?: string }[];
  fmt?: (n: number) => string;
  height?: number;
}) {
  const n = data.length || 1;
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 700, H = height, pad = 4;
  const bw = (W - pad * 2) / n;
  const barW = Math.max(1, bw * 0.66);

  return (
    <svg className="adm-bars" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Tendencia">
      {data.map((d, i) => {
        const h = max > 0 ? (d.value / max) * (H - 8) : 0;
        const x = pad + i * bw + (bw - barW) / 2;
        const y = H - h;
        const last = i === data.length - 1;
        return (
          <rect
            key={i}
            x={x} y={y} width={barW} height={Math.max(h, d.value > 0 ? 2 : 0)}
            rx={2}
            fill={last ? 'var(--adm-accent)' : 'var(--adm-accent-soft)'}
            stroke={last ? 'none' : 'var(--adm-accent)'}
            strokeWidth={last ? 0 : 0.5}
          >
            <title>{d.hint ?? `${d.label}: ${fmt ? fmt(d.value) : d.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
