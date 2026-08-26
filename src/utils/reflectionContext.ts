// REFLECTION-1 · P0 · Snapshot behavioral COMPACTO para la reseña diaria de HSM.
//
// Reflection NO recalcula entreno ni nutrición: LEE las mismas autoridades que el
// Coach vía buildCoachContext (COACH-CONTEXT-1) y selecciona el subconjunto MÍNIMO
// útil para afilar el espejo — nada de identidad de pareja, coachTrace, chat, perfil
// psicológico (las reflexiones ya llegan por separado a hsmReview), ni metadatos de
// cuenta. Puro, read-only, account-local (hereda el snapshot del store).
//
// Disciplina epistémica (igual que COACH-CONTEXT): ausencia de dato ≠ inferencia
// (sin entreno hoy ≠ descanso; sin tendencia ≠ estable). Los HECHOS son autoritativos;
// el "por qué" es hipótesis del modelo, no hecho.
import { buildCoachContext } from './coachContext';
import type { useAppStore } from '../store';

type StoreState = ReturnType<typeof useAppStore.getState>;

/**
 * Renderiza el bloque "HECHOS ACTUALES DE HSC" para la reseña diaria de reflexión,
 * o '' si no hay ningún hecho conductual útil todavía. Compacto y en prosa.
 * Campos incluidos (y SOLO estos): días en programa, racha, existencia+prescripción
 * básica del entreno de hoy, sesiones de esta semana, tendencia de volumen 4-sem
 * (solo si existe), y meta/consumido/resta de nutrición EXACTOS (autoridad CoachContext).
 */
export function renderReflectionBehaviorFacts(store: StoreState): string {
  const ctx = buildCoachContext(store);
  const lines: string[] = [];

  // ── Programa ────────────────────────────────────────────────────────────────
  const dp = ctx.user.daysInProgram;
  const prog = dp != null ? `día ${dp} en Healthy Space` : 'día en programa no disponible';
  lines.push(`- Programa: ${prog} · racha ${ctx.user.streak} día(s).`);

  // ── Entreno de hoy (existencia + prescripción básica; sin cargas ni readiness) ─
  const w = ctx.training.todayWorkout;
  if (w && w.exercises.length > 0) {
    const modality = w.modality ? `${w.modality} ` : '';
    const exs = w.exercises.map(e => `${e.name} ${e.sets}×${e.reps}`).join(', ');
    lines.push(`- Entreno de hoy: ${modality}— ${exs}.`);
  } else {
    lines.push(`- Entreno de hoy: no hay entreno generado hoy (ausencia de dato ≠ día de descanso).`);
  }

  // ── Esta semana ──────────────────────────────────────────────────────────────
  lines.push(`- Esta semana: ${ctx.training.thisWeek.sessions} sesión(es) completada(s).`);

  // ── Tendencia de volumen (solo si HSC tiene señal real; nunca fabricar) ────────
  if (ctx.training.trend4wk !== 'n/a') {
    const label = ctx.training.trend4wk === 'up' ? 'al alza' : ctx.training.trend4wk === 'down' ? 'a la baja' : 'estable';
    lines.push(`- Tendencia de volumen (4 sem): ${label}.`);
  } else {
    lines.push(`- Tendencia de volumen: sin datos suficientes para una tendencia (no la inventes).`);
  }

  // ── Nutrición (autoridad CoachContext; valores EXACTOS, sin recalcular) ─────────
  const n = ctx.nutrition;
  if (n.target.kcal > 0) {
    lines.push(
      `- Nutrición hoy: meta ${n.target.kcal} kcal (P${n.target.prot} C${n.target.carb} G${n.target.fat}g); ` +
      `consumido ${n.consumed.kcal} kcal; resta ${n.remaining.kcal} kcal · P${n.remaining.prot}g · C${n.remaining.carb}g · G${n.remaining.fat}g (exacto).`,
    );
  }

  return lines.join('\n');
}
