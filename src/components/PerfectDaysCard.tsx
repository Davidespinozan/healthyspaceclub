import { Gem, Flame, Trophy } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import './perfect-days-card.css';

// "Días completos" — recompensa la disciplina de cerrar los 3 anillos core
// (entreno + nutrición + reflexión) en un mismo día. Complementa la racha
// normal (constancia mínima, 1 acción): esto mide EXCELENCIA sostenida.
// Racha actual (se reinicia si fallas) + récord (pico histórico) + total (nunca baja).
export default function PerfectDaysCard() {
  const { t } = useT();
  const { streak, best, total } = useAppStore(useShallow((s) => ({
    streak: s.perfectDayStreak,
    best: s.perfectDayBest,
    total: s.perfectDaysTotal,
  })));

  // Sin días completos aún: nada que mostrar (los anillos de Hoy enseñan la meta).
  if (total <= 0) return null;

  return (
    <div className="pdc">
      <div className="pdc-icon" aria-hidden="true"><Gem size={20} strokeWidth={2} /></div>
      <div className="pdc-body">
        <div className="pdc-title">{t('profile.perfectTitle')}</div>
        <div className="pdc-sub">{t('profile.perfectSub')}</div>
        <div className="pdc-meta">
          <span className="pdc-streak">
            <Flame size={13} strokeWidth={2.4} /> {t('profile.perfectStreak', { n: streak })}
          </span>
          {best > streak && (
            <span className="pdc-best">
              <Trophy size={12} strokeWidth={2.2} /> {t('profile.perfectBest', { n: best })}
            </span>
          )}
        </div>
      </div>
      <div className="pdc-total">
        <div className="pdc-total-num">{total}</div>
        <div className="pdc-total-label">{t('profile.perfectTotal')}</div>
      </div>
    </div>
  );
}
