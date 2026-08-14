// ─────────────────────────────────────────────────────────────────────────
// coachTrace — AUDITORÍA P1–P6: registro legible de UNA sesión generada.
//
// No es un motor: solo FORMATEA las decisiones que ya tomaron los motores, para poder
// auditar una rutina sin leer 10 archivos. El orden refleja la cadena real de ejecución
// y la JERARQUÍA de decisiones (qué gana en conflicto). No se muestra al usuario.
// ─────────────────────────────────────────────────────────────────────────

/**
 * JERARQUÍA DE DECISIONES (derivada de la arquitectura, no impuesta). Lo de arriba
 * SIEMPRE gana sobre lo de abajo cuando hay conflicto. Cada motor respeta a los de
 * encima: prioridad no rompe deload; deload no rompe una restricción por dolor; etc.
 */
export const DECISION_HIERARCHY: readonly string[] = [
  '1. Seguridad / dolor / restricción (pain filter, lowImpact) — excluye ejercicios y músculos',
  '2. Fatiga crítica / deload (P1) — recorta volumen, carga, finisher; RIR alto',
  '3. Objetivo principal (fuerza/hipertrofia/perder grasa) — reps, esquema, reparto de tiempo',
  '4. Mesociclo (P1) — fase, progresión y volumeMultiplier del bloque',
  '5. Readiness aguda de HOY (P6) — modula SOLO la sesión de hoy (dosis/intensidad)',
  '6. Prioridad muscular (P5) — sesga volumen/orden dentro de lo que permiten 1–4',
  '7. Volumen semanal individual (P3) — target por músculo, acotado al rango operativo',
  '8. Preferencia del usuario (músculos del día, tiempo)',
  '9. Accesorios / finisher / cardio opcional — lo primero que se recorta por tiempo',
] as const;

export interface CoachTraceInput {
  objective: string;
  trainingGoal?: string;                // Fase 1 · qué adaptación de resistencia (hipertrofia|fuerza)
  level: string;
  equipment: string[];
  hasLoadHistory: boolean;              // ¿hay kg comparable? (gym vs bandas/peso corporal)
  time: { total: number; warmup: number; main: number; finisher: number };
  meso: {
    week: number; phase: string; progression: string; deload: boolean;
    volumeMultiplier: number; recovery: string; adherence: string; performance: string;
  };
  chronic: 'declining' | 'stable' | 'improving';
  readiness: { state: string; factors: string[]; captured: boolean; dosingRecovery: string };
  targets: Record<string, { target: number; min: number; max: number }>;
  priorities: Record<string, string>;
  doneThisWeek: Record<string, number>;
  sessionsLeftInWeek: number;
  allocation: Record<string, number>;   // series por músculo hoy
  items: Array<{
    id: string; muscle: string; category: string; sets: number; reps: string;
    rest: number; rir: number; topKg?: number; backoffKg?: number;
  }>;
  cutsByTime: string[];                  // qué se recortó por presupuesto de tiempo
  notes: string[];                       // decisiones relevantes ad-hoc
  // Fase 2 · anclas del bloque (continuidad de movimientos principales)
  anchors?: Array<{ exerciseId: string; status: 'reused' | 'new' | 'replaced'; from?: string; reason?: string }>;
  block?: { id: string; week: number };
  // Fase 4 · superseries/triseries decididas por el motor
  groups?: Array<{ ids: string[]; type: string; quality: string; reasons: string[] }>;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Devuelve el trace como líneas legibles (una sección por capa de la cadena). */
export function formatCoachTrace(t: CoachTraceInput): string[] {
  const L: string[] = [];
  L.push('══ COACH TRACE (P1–P6) ══');
  L.push(`OBJETIVO: ${t.objective}${t.trainingGoal ? ` · training goal ${t.trainingGoal}` : ''} · nivel ${t.level} · equipo [${t.equipment.join(',')}] · carga comparable: ${t.hasLoadHistory ? 'sí' : 'no (bandas/peso corporal)'}`);
  L.push(`TIEMPO: total ${t.time.total}′ → warm-up ${t.time.warmup}′ / principal ${t.time.main}′ / finisher ${t.time.finisher}′`);
  L.push(`P1 MESOCICLO: semana ${t.meso.week}, fase ${t.meso.phase}, progresión ${t.meso.progression}${t.meso.deload ? ' · DELOAD' : ''} · volMult ${round(t.meso.volumeMultiplier)}`);
  L.push(`   señales → recuperación(crónica) ${t.meso.recovery}, adherencia ${t.meso.adherence}, rendimiento ${t.meso.performance} · tendencia crónica: ${t.chronic}`);
  L.push(`P6 READINESS HOY: ${t.readiness.captured ? t.readiness.state.toUpperCase() : 'sin check-in → NORMAL'}${t.readiness.factors.length ? ` (${t.readiness.factors.join(', ')})` : ''} · recovery de dosis hoy: ${t.readiness.dosingRecovery}`);
  if (t.anchors && t.anchors.length) {
    L.push(`ANCHORS (continuidad del bloque${t.block ? ` ${t.block.id}, semana ${t.block.week}` : ''}):`);
    for (const a of t.anchors) {
      L.push(a.status === 'replaced'
        ? `   ↻ REEMPLAZADO ${a.from} → ${a.exerciseId}${a.reason ? ` · ${a.reason}` : ''}`
        : `   ${a.status === 'reused' ? '✓ REUSADO' : '＋ NUEVO'} ${a.exerciseId}${a.reason ? ` · ${a.reason}` : ''}`);
    }
  }
  if (t.groups && t.groups.length) {
    L.push('SUPERSERIES (decididas por el motor):');
    for (const g of t.groups) L.push(`   ${g.ids.join(' + ')} · ${g.type}/${g.quality}${g.reasons.length ? ` · ${g.reasons[0]}` : ''}`);
  } else {
    L.push('SUPERSERIES: ninguna (no hacer superset es una decisión válida)');
  }

  const prkeys = Object.keys(t.priorities);
  L.push(`P5 PRIORIDAD: ${prkeys.length ? prkeys.map(m => `${m}:${t.priorities[m]}`).join(', ') : '—'}`);

  L.push('P3 TARGET SEMANAL (músculo: hecho/target [min–max]):');
  for (const m of Object.keys(t.targets)) {
    if ((t.allocation[m] ?? 0) === 0 && (t.doneThisWeek[m] ?? 0) === 0) continue; // solo relevantes hoy
    const tg = t.targets[m];
    const star = t.priorities[m] ? ' ★' : '';
    L.push(`   ${m}: ${round(t.doneThisWeek[m] ?? 0)}/${tg.target} [${tg.min}–${tg.max}]${star} → dosis hoy ${t.allocation[m] ?? 0} series`);
  }
  L.push(`   (sesiones restantes en la semana: ${t.sessionsLeftInWeek})`);

  L.push('P4/P2 PRESCRIPCIÓN (ejercicio → series×reps @RIR, descanso, carga):');
  for (const it of t.items) {
    const load = it.topKg != null ? ` · ${it.topKg}kg top / ${it.backoffKg}kg backoff` : ' · carga por progresión (sin top-set)';
    L.push(`   ${it.id} [${it.muscle}/${it.category}]: ${it.sets}×${it.reps} @${it.rir}RIR, ${it.rest}s${load}`);
  }

  if (t.cutsByTime.length) { L.push('RECORTES POR TIEMPO:'); for (const c of t.cutsByTime) L.push(`   − ${c}`); }
  if (t.notes.length) { L.push('NOTAS:'); for (const n of t.notes) L.push(`   · ${n}`); }
  return L;
}
