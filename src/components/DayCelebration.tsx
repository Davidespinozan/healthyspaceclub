import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { haptics } from '../utils/haptics';
import './day-celebration.css';

const COLORS = ['#C9A968', '#C75B3A', '#1C3B35', '#A8864E', '#F0E2B8'];

// Celebración al cerrar los 3 anillos del día (confetti + mensaje). Auto-cierra.
export default function DayCelebration({ message, sub, onDone }: {
  message: string;
  sub: string;
  onDone: () => void;
}) {
  useEffect(() => {
    haptics.celebrate();
    const id = setTimeout(onDone, 3200);
    return () => clearTimeout(id);
  }, [onDone]);

  const pieces = Array.from({ length: 40 });
  return createPortal(
    <div className="dcl-overlay" onClick={onDone} role="dialog" aria-label={message}>
      <div className="dcl-confetti" aria-hidden="true">
        {pieces.map((_, i) => (
          <span
            key={i}
            className="dcl-piece"
            style={{
              left: `${(i * 2.5 + (i % 7) * 3) % 100}%`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${(i % 12) * 0.05}s`,
              animationDuration: `${2.2 + (i % 6) * 0.28}s`,
            }}
          />
        ))}
      </div>
      <div className="dcl-card">
        <div className="dcl-icon"><Sparkles size={30} strokeWidth={2} /></div>
        <p className="dcl-title">{message}</p>
        <p className="dcl-sub">{sub}</p>
      </div>
    </div>,
    document.body,
  );
}
