// WorkoutHistoryCard — Lote Track-3b.
//
// Espejo visual de WeightTrackingCard en TabTu. Cierra el loop de
// entreno simétrico con nutrición: el user ya puede ver SU historial
// (sesiones de la semana + lista de las últimas N).
//
// Solo display — no botón de acción (las sesiones se completan desde
// el WorkoutPlayer, no desde acá). NO tappable por ahora; el detalle
// de sesión es scope futuro.
//
// completedSessions ya viene hidratado por Track-2 (workout_log multi-
// dispositivo) + Track-1 (sesiones del propio device).

import { useMemo } from 'react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { plural } from '../i18n/format';
import { summarizeWeekWorkouts } from '../utils/workoutWeekStats';
import { relativeDayKind } from '../utils/relativeDay';
import type { CompletedSession, Modality } from '../types';
import type { TranslationKey } from '../i18n/es';
import './workout-history-card.css';

const MODALITY_LABEL_KEYS: Record<Modality, TranslationKey> = {
  fuerza: 'profile.modalityFuerza',
  cardio: 'profile.modalityCardio',
  yoga: 'profile.modalityYoga',
  auto: 'profile.modalityAuto',
};

const RECENT_LIMIT = 5;

export default function WorkoutHistoryCard() {
  const completedSessions = useAppStore(s => s.completedSessions);
  const { t } = useT();

  const today = new Date().toISOString().split('T')[0];
  const weekAgoIso = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  // Ordenar por completedAtIso desc para tomar las más recientes
  const sorted = useMemo(
    () => [...completedSessions].sort(
      (a, b) => b.completedAtIso.localeCompare(a.completedAtIso),
    ),
    [completedSessions],
  );
  const recent = sorted.slice(0, RECENT_LIMIT);
  const summary = summarizeWeekWorkouts(completedSessions, weekAgoIso);

  // Stat principal: "X sesiones · Yh"
  const sessionsLabel = summary.count === 0
    ? t('profile.workoutHistoryEmpty')
    : plural(summary.count, {
        one: t('profile.workoutHistorySessionsOne', { n: summary.count }),
        other: t('profile.workoutHistorySessionsOther', { n: summary.count }),
      });
  const hoursLabel = summary.count > 0 && summary.totalMinutes > 0
    ? t('profile.workoutHistoryHours', { h: (summary.totalMinutes / 60).toFixed(1) })
    : '';

  function dayLabelFor(s: CompletedSession): string {
    const rel = relativeDayKind(s.date, today);
    if (rel.kind === 'today') return t('hoy.relHoy');
    if (rel.kind === 'yesterday') return t('hoy.relAyer');
    return plural(rel.days, {
      one: t('hoy.relHaceDiasOne'),
      other: t('hoy.relHaceDiasOther', { n: rel.days }),
    });
  }

  function setsFor(s: CompletedSession): number | null {
    if (!s.loggedSets) return null;
    return s.loggedSets.filter(x => x !== null).length;
  }

  return (
    <div className="workout-history">
      <div className="workout-history-row">
        <div className="workout-history-row-left">
          <span className="workout-history-row-label">
            {t('profile.workoutHistoryLabel')}
          </span>
          <span className="workout-history-row-value">
            {sessionsLabel}
            {hoursLabel && <span className="workout-history-row-hours"> · {hoursLabel}</span>}
          </span>
        </div>
      </div>
      <div className="workout-history-row-meta">
        {summary.count > 0
          ? t('profile.workoutHistoryThisWeek').toLowerCase()
          : ''}
      </div>

      {recent.length > 0 && (
        <>
          <div className="workout-history-section-label">
            {t('profile.workoutHistoryRecent')}
          </div>
          <ul className="workout-history-list">
            {recent.map(s => {
              const mins = Math.max(1, Math.round(s.durationSeconds / 60));
              const sets = setsFor(s);
              const setsLabel = sets !== null
                ? plural(sets, {
                    one: t('profile.workoutHistorySeriesOne', { n: sets }),
                    other: t('profile.workoutHistorySeriesOther', { n: sets }),
                  })
                : null;
              const modalityLabel = t(MODALITY_LABEL_KEYS[s.modality] ?? 'profile.modalityAuto');
              return (
                <li key={s.completedAtIso} className="workout-history-item">
                  <span className="workout-history-item-day">{dayLabelFor(s)}</span>
                  <span className="workout-history-item-dot">·</span>
                  <span className="workout-history-item-modality">{modalityLabel}</span>
                  <span className="workout-history-item-dot">·</span>
                  <span className="workout-history-item-duration">
                    {t('hoy.durMinShort', { n: mins })}
                  </span>
                  {setsLabel && (
                    <>
                      <span className="workout-history-item-dot">·</span>
                      <span className="workout-history-item-sets">{setsLabel}</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
