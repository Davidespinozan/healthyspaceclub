import { useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { formatDate } from '../i18n/format';

// Tendencia de peso — área+línea inline (serie única). Change-over-time: el eje x
// es la fecha real (no el índice) para que los huecos entre pesadas se vean honestos.
// Endpoint enfatizado + crosshair/tooltip al tocar. Marca verde HSC.
interface Props {
  data: { date: string; kg: number }[]; // ordenado ascendente por fecha
  locale: 'es' | 'en';
}

const W = 320, H = 96, PAD_X = 6, PAD_T = 12, PAD_B = 10;
const MAX_POINTS = 16;

export default function WeightTrend({ data, locale }: Props) {
  const { t } = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const pts = useMemo(() => {
    const series = data.slice(-MAX_POINTS);
    if (series.length < 2) return null;
    const times = series.map(d => new Date(`${d.date}T00:00:00`).getTime());
    const kgs = series.map(d => d.kg);
    const tMin = times[0], tMax = times[times.length - 1];
    const kMin = Math.min(...kgs), kMax = Math.max(...kgs);
    const kPad = (kMax - kMin) * 0.15 || 1; // aire arriba/abajo; si es plano, ±1kg
    const lo = kMin - kPad, hi = kMax + kPad;
    const spanT = tMax - tMin || 1;
    const spanK = hi - lo || 1;
    const innerW = W - PAD_X * 2, innerH = H - PAD_T - PAD_B;
    return series.map((d, i) => ({
      ...d,
      x: PAD_X + ((times[i] - tMin) / spanT) * innerW,
      y: PAD_T + (1 - (d.kg - lo) / spanK) * innerH,
    }));
  }, [data]);

  if (!pts) return null;

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const baseline = H - PAD_B;
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${baseline} L${pts[0].x.toFixed(1)} ${baseline} Z`;
  const last = pts[pts.length - 1];
  const cur = active != null ? pts[active] : null;

  function onMove(clientX: number) {
    const el = wrapRef.current;
    if (!el || !pts) return;
    const rect = el.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * W; // px → coords del viewBox
    let best = 0, bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - vx);
      if (d < bestD) { bestD = d; best = i; }
    }
    setActive(best);
  }

  return (
    <div
      className="wt-trend"
      ref={wrapRef}
      onPointerMove={e => onMove(e.clientX)}
      onPointerDown={e => onMove(e.clientX)}
      onPointerLeave={() => setActive(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="wt-trend-svg" role="img"
        aria-label={t('weight.trendAria')} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="wtFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--moss, #1C3B35)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--moss, #1C3B35)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#wtFill)" />
        <path d={line} fill="none" stroke="var(--moss, #1C3B35)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {cur && (
          <line x1={cur.x} y1={PAD_T - 4} x2={cur.x} y2={baseline}
            stroke="var(--moss, #1C3B35)" strokeWidth="1" strokeOpacity="0.25" />
        )}
        {/* Endpoint enfatizado (último dato) */}
        <circle cx={last.x} cy={last.y} r="4" fill="var(--moss, #1C3B35)"
          stroke="var(--surface, #fff)" strokeWidth="2" />
        {cur && active !== pts.length - 1 && (
          <circle cx={cur.x} cy={cur.y} r="3.5" fill="var(--moss, #1C3B35)"
            stroke="var(--surface, #fff)" strokeWidth="2" />
        )}
      </svg>
      {cur && (
        <div className="wt-trend-tip" style={{ left: `${Math.min(90, Math.max(10, (cur.x / W) * 100))}%` }}>
          <b>{cur.kg} kg</b>
          <span>{formatDate(cur.date, locale)}</span>
        </div>
      )}
    </div>
  );
}
