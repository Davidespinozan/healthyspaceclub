import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import './daily-rings.css';

export interface RingItem {
  key: string;
  progress: number;   // 0..1
  done: boolean;
  label: string;
  color: string;
  icon: ReactNode;
  onClick?: () => void;
}

const R = 17;
const C = 2 * Math.PI * R;

// Anillos de progreso diario estilo Apple Fitness: cada pilar (entreno, comida,
// reflexión, compartir) es un anillo que se llena con animación.
export default function DailyRings({ items }: { items: RingItem[] }) {
  return (
    <div className="dr-row">
      {items.map(it => {
        const pct = Math.max(0, Math.min(1, it.progress));
        const Tag = it.onClick ? 'button' : 'div';
        return (
          <Tag
            key={it.key}
            className={`dr-ring${it.done ? ' is-done' : ''}`}
            onClick={it.onClick}
            type={it.onClick ? 'button' : undefined}
          >
            <span className="dr-circle" style={{ ['--dr-color' as string]: it.color }}>
              <svg viewBox="0 0 44 44" className="dr-svg" aria-hidden="true">
                <circle className="dr-track" cx="22" cy="22" r={R} />
                <circle
                  className="dr-fill"
                  cx="22" cy="22" r={R}
                  style={{ strokeDasharray: C, strokeDashoffset: C * (1 - pct) }}
                />
              </svg>
              <span className="dr-icon">
                {it.done ? <Check size={16} strokeWidth={3} /> : it.icon}
              </span>
            </span>
            <span className="dr-label">{it.label}</span>
          </Tag>
        );
      })}
    </div>
  );
}
