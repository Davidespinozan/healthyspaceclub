// ActivityLogSheet — hermano de FoodLogSheet, pero para MOVIMIENTO.
//
// Premia la actividad alterna: si alguien jugó básquet, fue a surfear o salió
// a caminar en vez de hacer la rutina prescrita, eso TAMBIÉN cuenta. No usa IA
// (el movimiento es movimiento, no hay nada que "estimar"): chips sugeridos +
// texto libre + duración opcional. Al registrar, addActivityLog marca el día
// como activo (racha) vía markActiveDay.
//
// Familia visual .th-popout-* (shell compartido con MealDetailPopout/FoodLogSheet).

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Footprints, Waves, Bike, Music, Mountain, Dumbbell, type LucideIcon } from 'lucide-react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/es';

const PRESET_ACTIVITIES: { key: TranslationKey; icon: LucideIcon }[] = [
  { key: 'activityLog.actBasket', icon: Activity },
  { key: 'activityLog.actSoccer', icon: Activity },
  { key: 'activityLog.actVolley', icon: Activity },
  { key: 'activityLog.actHiking', icon: Footprints },
  { key: 'activityLog.actSurf', icon: Waves },
  { key: 'activityLog.actSwim', icon: Waves },
  { key: 'activityLog.actCycling', icon: Bike },
  { key: 'activityLog.actDance', icon: Music },
  { key: 'activityLog.actWalk', icon: Footprints },
  { key: 'activityLog.actTennis', icon: Activity },
  { key: 'activityLog.actClimb', icon: Mountain },
];

const DURATIONS = [15, 30, 45, 60, 90];

interface Props {
  onClose: () => void;
  /** Disparado tras un registro exitoso (después del tap "Listo"). */
  onLogged?: () => void;
}

type Phase = 'input' | 'done';

export default function ActivityLogSheet({ onClose, onLogged }: Props) {
  const { t } = useT();
  const addActivityLog = useAppStore(s => s.addActivityLog);

  const [phase, setPhase] = useState<Phase>('input');
  const [activity, setActivity] = useState('');
  const [duration, setDuration] = useState<number | null>(null);

  const durationLabel = (d: number) => (d === 90 ? t('activityLog.durationOpen') : `${d} ${t('activityLog.min')}`);

  async function handleSubmit() {
    const name = activity.trim();
    if (!name) return;
    await addActivityLog({ activity: name, durationMin: duration });
    setPhase('done');
  }

  function handleDone() {
    onLogged?.();
    onClose();
  }

  return createPortal(
    <div className="th-popout-backdrop" onClick={onClose}>
      <div className="th-popout th-popout-sm" onClick={e => e.stopPropagation()}>
        <div className="th-popout-handle" />

        <div className="th-popout-content">
          {phase === 'input' && (
            <>
              <div className="th-popout-time">{t('activityLog.eyebrow')}</div>
              <div className="th-popout-name">{t('activityLog.title')}</div>
              <p className="al-sub">{t('activityLog.subtitle')}</p>

              <div className="al-chips">
                {PRESET_ACTIVITIES.map(a => {
                  const label = t(a.key);
                  const active = activity.trim() === label;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      className={`al-chip${active ? ' active' : ''}`}
                      onClick={() => setActivity(active ? '' : label)}
                    >
                      <span className="al-chip-emoji" aria-hidden="true"><a.icon size={16} strokeWidth={2} style={{ verticalAlign: '-3px', flexShrink: 0 }} /></span>{label}
                    </button>
                  );
                })}
              </div>

              <input
                className="al-input"
                type="text"
                placeholder={t('activityLog.placeholder')}
                value={activity}
                onChange={e => setActivity(e.target.value)}
              />

              <div className="al-dur-label">{t('activityLog.durationLabel')}</div>
              <div className="al-durs">
                {DURATIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`al-dur${duration === d ? ' active' : ''}`}
                    onClick={() => setDuration(duration === d ? null : d)}
                  >
                    {durationLabel(d)}
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === 'done' && (
            <div className="al-done">
              <div className="al-done-emoji" aria-hidden="true"><Dumbbell size={40} strokeWidth={1.5} /></div>
              <div className="th-popout-name">{t('activityLog.doneTitle')}</div>
              <div className="al-done-activity">
                {activity.trim()}{duration ? ` · ${durationLabel(duration)}` : ''}
              </div>
              <p className="al-done-note">{t('activityLog.doneNote')}</p>
            </div>
          )}
        </div>

        {phase === 'input' && (
          <div className="th-popout-footer">
            <button type="button" className="wz-cta" onClick={handleSubmit} disabled={!activity.trim()}>
              {t('activityLog.ctaSubmit')}
            </button>
            <button type="button" className="th-popout-close" onClick={onClose}>
              {t('activityLog.ctaCancel')}
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="th-popout-footer">
            <button type="button" className="wz-cta" onClick={handleDone}>
              {t('activityLog.ctaDone')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
