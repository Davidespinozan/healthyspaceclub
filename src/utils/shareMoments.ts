// SHARE-2 · P0 · Motor DETERMINISTA de momentos para compartir.
//
// PRIVACY-BY-PROJECTION: buildShareMoments recibe SOLO una proyección estrecha
// (ShareInput) — NUNCA el store, obData, reflexiones, comidas, coach ni la cuenta.
// Cada ShareMoment contiene SOLO strings display-safe. Puro: sin red, sin IA, sin
// persistencia, sin analytics, sin efectos. No inventa logros (cada momento tiene un
// predicado estricto). No emite PR ni comida (diferidos). No expone identidad de pareja.
import { MILESTONE_STEPS, getMilestoneCopy } from '../constants/milestones';

export type ShareMomentKind =
  | 'showed_up' | 'workout' | 'cardio' | 'streak_milestone' | 'streak'
  | 'week_complete' | 'comeback' | 'duo' | 'program_milestone';

export type ShareStyle = 'dark' | 'editorial' | 'stat';

export interface ShareStat { big: string; label: string }

export interface ShareMoment {
  id: string;
  kind: ShareMomentKind;
  title: string;               // display-safe (ya localizado)
  subtitle?: string;           // display-safe
  stat?: ShareStat;            // content-free (min, días, N/N…)
  secondaryStat?: ShareStat;
  priority: number;            // mayor = se recomienda primero
  autoSuggest: boolean;
  photoCompatible: boolean;
  privacy: 'public-safe';
  defaultStyle: ShareStyle;
}

/** Proyección estrecha y content-free desde autoridades aprobadas. Sin PII/salud. */
export interface ShareInput {
  streakCount: number;
  todayWorkout?: {
    modality: string;                 // 'fuerza' | 'cardio' | 'yoga' | 'auto'
    durationMinutes: number;
    exercisesCompleted?: number;
    totalVolumeKg?: number;
  } | null;
  // Evidencia AUTORITATIVA de actividad significativa HOY (p.ej. sesión completada hoy).
  // showed_up NUNCA se emite sin esto (ni como fallback de array vacío).
  showedUpToday?: boolean;
  daysSinceLastActiveBefore?: number | null;  // hueco previo (para comeback)
  duo?: { days: number } | null;      // racha dúo — SOLO el número, jamás identidad
}

export type TFn = (key: string, params?: Record<string, string | number>) => string;

function modalityLabel(modality: string, t: TFn): string {
  const key = ['fuerza', 'cardio', 'yoga'].includes(modality) ? `sstudio.modality.${modality}` : 'sstudio.modality.auto';
  return t(key);
}

/** Milestone más alto alcanzado (o null si <3). Reusa MILESTONE_STEPS (no duplica). */
function highestMilestone(streak: number): number | null {
  let hit: number | null = null;
  for (const m of MILESTONE_STEPS) if (streak >= m) hit = m;
  return hit;
}

/**
 * Construye los momentos ELEGIBLES, ordenados por prioridad (rareza/valor primero).
 * Puro. `t`/`locale` solo resuelven copy (lookup puro). No emite nada que no sea
 * verdad con la autoridad disponible.
 */
export function buildShareMoments(input: ShareInput, t: TFn): ShareMoment[] {
  const out: ShareMoment[] = [];
  const s = input.streakCount ?? 0;

  // ── STREAK MILESTONE (autoridad: MILESTONE_STEPS) ──────────────────────────
  const ms = highestMilestone(s);
  if (ms != null) {
    const copy = getMilestoneCopy(ms, t as never);
    const rare = ms >= 30;
    out.push({
      id: `streak_${ms}`, kind: 'streak_milestone',
      title: copy.title || String(ms),
      subtitle: copy.sub || undefined,
      stat: { big: String(ms), label: t('sstudio.streakLabel') },
      priority: (rare ? 100 : 70) + Math.min(ms, 30),
      autoSuggest: true, photoCompatible: true, privacy: 'public-safe',
      defaultStyle: 'stat',
    });
  }

  // ── WEEK COMPLETE — DIFERIDO en P0 ─────────────────────────────────────────
  // No hay autoridad fiable para probar "completó la semana programada" sin emparejar
  // día-planeado→fecha-de-completado dentro del MISMO calendario (weeklyPlan.selectedDays
  // ↔ completedSessions.date con el ancla shoppingDay). Un conteo rolling de 7 días NO lo
  // prueba y un "SEMANA COMPLETA N/N" falso es peor que omitirlo. La kind existe para P1.
  // NUNCA se emite en P0.

  // ── COMEBACK (hueco previo real ≥7 días + activo hoy) ──────────────────────
  if ((input.daysSinceLastActiveBefore ?? 0) >= 7) {
    out.push({
      id: 'comeback', kind: 'comeback',
      title: t('sstudio.comeback'),
      subtitle: input.todayWorkout ? modalityLabel(input.todayWorkout.modality, t) : undefined,
      priority: 60,
      autoSuggest: true, photoCompatible: true, privacy: 'public-safe',
      defaultStyle: 'editorial',
    });
  }

  // ── WORKOUT / CARDIO (autoridad: sesión completada hoy) ────────────────────
  if (input.todayWorkout) {
    const w = input.todayWorkout;
    const isCardio = w.modality === 'cardio';
    out.push({
      id: isCardio ? 'cardio' : 'workout',
      kind: isCardio ? 'cardio' : 'workout',
      title: t('sstudio.showedUp'),
      subtitle: modalityLabel(w.modality, t),
      stat: w.durationMinutes > 0 ? { big: String(w.durationMinutes), label: t('sstudio.min') } : undefined,
      priority: 50,
      autoSuggest: true, photoCompatible: true, privacy: 'public-safe',
      defaultStyle: 'dark',
    });
  }

  // ── DUO (autoridad: racha dúo — sin identidad) ─────────────────────────────
  if (input.duo && input.duo.days > 0) {
    out.push({
      id: 'duo', kind: 'duo',
      title: t('sstudio.duo'),
      stat: { big: String(input.duo.days), label: t('sstudio.togetherLabel') },
      priority: 40,
      autoSuggest: true, photoCompatible: true, privacy: 'public-safe',
      defaultStyle: 'stat',
    });
  }

  // ── SHOWED UP — SOLO con evidencia autoritativa de actividad HOY ───────────
  // NUNCA como fallback de array vacío: sin evidencia (workout hoy o showedUpToday),
  // NO se emite. Si nada califica, buildShareMoments devuelve [].
  if (input.showedUpToday || input.todayWorkout) {
    out.push({
      id: 'showed_up', kind: 'showed_up',
      title: t('sstudio.showedUp'),
      stat: s >= 3 ? { big: String(s), label: t('sstudio.streakLabel') } : undefined,
      priority: 10,
      autoSuggest: true, photoCompatible: true, privacy: 'public-safe',
      defaultStyle: 'dark',
    });
  }

  // Dedup por kind (una tarjeta por tipo) + orden por prioridad desc, estable por id.
  const seen = new Set<ShareMomentKind>();
  return out
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .filter(m => (seen.has(m.kind) ? false : (seen.add(m.kind), true)));
}

/** Momento recomendado dado un kind preferido por la superficie (contexto). */
export function pickRecommended(moments: ShareMoment[], preferred?: ShareMomentKind): ShareMoment | null {
  if (moments.length === 0) return null;
  if (preferred) { const p = moments.find(m => m.kind === preferred); if (p) return p; }
  return moments[0];
}
