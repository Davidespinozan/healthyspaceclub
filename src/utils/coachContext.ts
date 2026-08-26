// ─────────────────────────────────────────────────────────────────────────────
// COACH-CONTEXT-1 · capa PURA de contexto del Coach.
//
//   AUTORIDADES HSC (motores/estado)  →  derivación pura  →  CoachContext compacto
//
// El Coach EXPLICA y RAZONA sobre el estado de HSC; NO recrea sus motores. Este módulo
// SOLO LEE autoridades existentes (computeNutritionTargets, computeCoach,
// computeDayConsumption, computeWeeklyVolume/weeklyVolumeSeries, dailyWorkout.plan +
// su coachTrace, hsmProfile). No escribe estado, no llama a IA, no muta planes, no
// hace red, no reimplementa fórmulas. Se construye desde el snapshot del store en cada
// envío (fresco) → hereda el aislamiento por cuenta de ACCOUNT-ISOLATION-1.
// ─────────────────────────────────────────────────────────────────────────────
import { dayKey } from './localDate';
import { computeNutritionTargets, parseObData } from './nutritionTargets';
import { computeCoach } from './nutritionCoach';
import { computeDayConsumption } from './foodConsumption';
import { computeWeeklyVolume, weeklyVolumeSeries } from './workoutPlanner';
import { resolveTodayPlanMeals, hasGeneratedWeeklyPlan } from './weeklyPlanState';
import { exercises as exerciseBank } from '../data/exercises';
import type { CoachTraceForPlan } from './coachTrace';
import type { useAppStore } from '../store';

type StoreState = ReturnType<typeof useAppStore.getState>;
type Macro4 = { kcal: number; prot: number; carb: number; fat: number };

export interface CoachContext {
  user: {
    name: string; sex?: string; age?: number; heightCm?: number; weightKg?: number;
    goal?: string; trainingGoal?: string; activity?: string;
    daysInProgram: number | null; streak: number; today: string;
  };
  training: {
    todayWorkout: {
      modality?: string; durationMin?: number; partner: boolean;
      exercises: Array<{ name: string; sets: number; reps: string; load?: number; rir?: number }>;
    } | null;
    why: CoachTraceForPlan | null;
    thisWeek: { sessions: number; volumeTop: string[] };
    trend4wk: 'up' | 'flat' | 'down' | 'n/a';
    partnerToday: boolean;
  };
  nutrition: {
    hasPlan: boolean;
    target: Macro4; consumed: Macro4; remaining: Macro4;
    mealsDone: number; mealsLeft: number;
    todayMeals: Array<{ time?: string; name: string; kcal?: number }>;
  };
  mindset: {
    profileSummary?: string; profileAsOf?: string;
    todayReflections: Array<{ dimension: string; response: string }>;
  };
}

/** Días entre dos fechas locales YYYY-MM-DD (Date.parse = UTC midnight en ambas → diff exacto). */
function daysBetween(fromYmd: string, toYmd: string): number | null {
  if (!fromYmd) return null;
  const a = Date.parse(fromYmd), b = Date.parse(toYmd);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.floor((b - a) / 86400000));
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined => {
  const s = String(v ?? '').trim();
  return s ? s : undefined;
};

/** Construye el contexto compacto y autoritativo del Coach desde el snapshot del store. Puro. */
export function buildCoachContext(store: StoreState): CoachContext {
  const {
    userName, obData, streakCount, startDate, weeklyPlan, shoppingDay,
    mealChecks, mealResolvedByLog, foodLog, completedSessions, workoutLog,
    dailyWorkout, dailyHSMResponses, hsmProfile,
  } = store;
  const today = dayKey(new Date());
  const weekday = new Date().getDay();
  const ob = obData as Record<string, string | number>;

  // ── USER / TEMPORAL ─────────────────────────────────────────────────────────
  const user: CoachContext['user'] = {
    name: userName || '',
    sex: str(ob.sex), age: num(ob.edad), heightCm: num(ob.estatura), weightKg: num(ob.peso),
    goal: str(ob.goal), trainingGoal: str(ob.trainingGoal), activity: str(ob.activity),
    daysInProgram: daysBetween(startDate, today),
    streak: streakCount, today,
  };

  // ── TRAINING ────────────────────────────────────────────────────────────────
  const plan = (dailyWorkout?.date === today ? dailyWorkout?.plan : null) as Record<string, unknown> | null;
  const planExs = Array.isArray(plan?.exercises) ? (plan!.exercises as Array<Record<string, unknown>>) : [];
  const nameOf = (id: unknown) => exerciseBank.find(e => e.id === id)?.name ?? String(id ?? '');
  const todayWorkout = plan && planExs.length > 0 ? {
    modality: str(plan.type) ?? str(plan.modality),
    durationMin: num(plan.durationMin) ?? num((plan.budget as Record<string, unknown>)?.total),
    partner: !!plan.partnerMode,
    exercises: planExs.map(e => ({
      name: nameOf(e.id), sets: num(e.sets) ?? 0, reps: String(e.reps ?? ''),
      load: num(e.topKg) ?? num(e.deloadKg), rir: num(e.rir),
    })),
  } : null;
  const why = (plan && plan.coachTrace ? plan.coachTrace as CoachTraceForPlan : null);

  const since7 = dayKey(new Date(Date.now() - 6 * 86400000));
  const sessionsThisWeek = completedSessions.filter(s => s.date >= since7).length;
  const vol7 = computeWeeklyVolume(completedSessions, exerciseBank, 7, workoutLog || []);
  const volumeTop = Object.entries(vol7).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([m, sets]) => `${m}: ${Math.round(sets)} series`);
  // Tendencia de VOLUMEN (no "fitness"): semana reciente vs la más antigua de 4.
  const series = weeklyVolumeSeries(completedSessions, exerciseBank, workoutLog || [], 4);
  const totals = series.map(w => Object.values(w).reduce((s, v) => s + v, 0));
  const nonEmpty = totals.filter(t => t > 0).length;
  let trend4wk: CoachContext['training']['trend4wk'] = 'n/a';
  if (nonEmpty >= 2) {
    const recent = totals[0] ?? 0;
    const oldest = [...totals].reverse().find(t => t > 0) ?? 0;
    trend4wk = recent > oldest * 1.1 ? 'up' : recent < oldest * 0.9 ? 'down' : 'flat';
  }

  const training: CoachContext['training'] = {
    todayWorkout, why,
    thisWeek: { sessions: sessionsThisWeek, volumeTop },
    trend4wk,
    partnerToday: !!todayWorkout?.partner,
  };

  // ── NUTRITION (autoridades: computeNutritionTargets / computeDayConsumption / computeCoach) ──
  const hasPlan = hasGeneratedWeeklyPlan(weeklyPlan as { days?: unknown[] } | null);
  const targets = computeNutritionTargets(parseObData(ob));
  const todayMeals = resolveTodayPlanMeals(
    weeklyPlan as { days?: Array<{ day: number; meals: Array<Record<string, unknown>> }>; selectedDays?: number[] } | null,
    shoppingDay, weekday,
  );
  const cons = computeDayConsumption({ todayMeals: todayMeals as never, mealChecks, mealResolvedByLog, foodLog, today });
  const coach = computeCoach({
    consumed: { kcal: cons.consumedKcal, prot: cons.consumedProt, carbs: cons.consumedCarbs, fat: cons.consumedFat },
    target: { kcal: targets.planGoal, prot: targets.protG, carbs: targets.carbG, fat: targets.fatG },
    mealsDone: cons.completedSlots, mealsTotal: cons.totalSlots,
  });
  const leftOf = (k: 'carbs' | 'fat') => coach.macros.find(m => m.key === k)?.left ?? 0;
  const nutrition: CoachContext['nutrition'] = {
    hasPlan,
    target: { kcal: targets.planGoal, prot: targets.protG, carb: targets.carbG, fat: targets.fatG },
    consumed: { kcal: Math.round(cons.consumedKcal), prot: Math.round(cons.consumedProt), carb: Math.round(cons.consumedCarbs), fat: Math.round(cons.consumedFat) },
    remaining: { kcal: coach.kcalLeft, prot: coach.protLeft, carb: leftOf('carbs'), fat: leftOf('fat') },
    mealsDone: coach.mealsDone, mealsLeft: coach.mealsLeft,
    todayMeals: (todayMeals as Array<Record<string, unknown>>).map(m => ({
      time: str(m.time), name: String(m.name ?? ''),
      kcal: num((m.macros as Record<string, unknown>)?.kcal),
    })),
  };

  // ── MINDSET (perfil longitudinal + reflexiones de HOY, NUNCA URGENT) ──────────
  const mindset: CoachContext['mindset'] = {
    profileSummary: hsmProfile?.text || undefined,
    profileAsOf: hsmProfile?.updatedAt || undefined,
    todayReflections: dailyHSMResponses
      .filter(r => r.date === today && r.safetyLevel !== 'URGENT')
      .map(r => ({ dimension: r.dimension, response: r.response })),
  };

  return { user, training, nutrition, mindset };
}

/** Renderiza el CONTEXTO como HECHOS explícitos de HSC (fuente de verdad), separados de las
 *  instrucciones de coaching. El modelo debe distinguir estos DATOS de sus SUGERENCIAS. */
export function renderHscFacts(ctx: CoachContext): string {
  const L: string[] = [];
  const u = ctx.user;
  L.push('═══════════════════════════════');
  L.push('DATOS ACTUALES DE HSC — FUENTE DE VERDAD (no inventes nada fuera de esto)');
  L.push('═══════════════════════════════');
  L.push(`Fecha: ${u.today}${u.daysInProgram != null ? ` · Día ${u.daysInProgram} en Healthy Space` : ''} · Racha: ${u.streak} días`);

  // TRAINING
  const tr = ctx.training;
  if (tr.todayWorkout) {
    const w = tr.todayWorkout;
    const exs = w.exercises.map(e => `${e.name} ${e.sets}×${e.reps}${e.load != null ? ` @${e.load}kg` : ''}${e.rir != null ? ` (RIR ${e.rir})` : ''}`).join('; ');
    L.push(`ENTRENO DE HOY${w.modality ? ` (${w.modality})` : ''}${w.durationMin ? ` ~${w.durationMin}min` : ''}${w.partner ? ' · EN PAREJA' : ''}: ${exs}`);
    if (tr.why) {
      const y = tr.why;
      const bits: string[] = [`semana ${y.week} (${y.phase}, ${y.progression})`];
      if (y.deload) bits.push('DELOAD activo (descarga planeada)');
      bits.push(`readiness: ${y.readinessState}${y.readinessFactors.length ? ` [${y.readinessFactors.join(', ')}]` : ''}`);
      if (y.priorityMuscles.length) bits.push(`prioridad: ${y.priorityMuscles.join(', ')}`);
      if (y.replaced.length) bits.push(`reemplazos: ${y.replaced.map(r => `${r.exerciseId}${r.reason ? ` (${r.reason})` : ''}`).join(', ')}`);
      if (y.notes.length) bits.push(y.notes.join('; '));
      L.push(`POR QUÉ HSC prescribió esto hoy: ${bits.join(' · ')}`);
    } else {
      L.push('POR QUÉ: (no hay traza de decisión para este plan — no inventes la razón)');
    }
  } else {
    L.push('ENTRENO DE HOY: no hay entreno generado para hoy (no asumas que es día de descanso salvo que el plan lo diga).');
  }
  L.push(`ESTA SEMANA: ${tr.thisWeek.sessions} sesiones${tr.thisWeek.volumeTop.length ? ` · volumen: ${tr.thisWeek.volumeTop.join(', ')}` : ''} · tendencia de volumen (4 sem): ${tr.trend4wk}`);

  // NUTRITION
  const n = ctx.nutrition;
  L.push(`NUTRICIÓN HOY — META: ${n.target.kcal} kcal (P${n.target.prot} C${n.target.carb} G${n.target.fat}g)`);
  L.push(`  Consumido: ${n.consumed.kcal} kcal (P${n.consumed.prot} C${n.consumed.carb} G${n.consumed.fat}g) · Comidas: ${n.mealsDone} hechas, ${n.mealsLeft} restantes`);
  L.push(`  RESTA HOY (exacto, no estimes): ${n.remaining.kcal} kcal · P${n.remaining.prot}g · C${n.remaining.carb}g · G${n.remaining.fat}g`);
  if (n.hasPlan && n.todayMeals.length) {
    L.push(`  PLAN DE HOY: ${n.todayMeals.map(m => `${m.time ? m.time + ' ' : ''}${m.name}${m.kcal != null ? ` (${Math.round(m.kcal)}kcal)` : ''}`).join(' · ')}`);
    L.push('  (El plan NO tiene alternativas/sustituciones guardadas: si sugieres cambios, dilo como sugerencia tuya, no como "tu plan dice".)');
  } else if (!n.hasPlan) {
    L.push('  PLAN DE COMIDAS: no hay plan generado (no inventes comidas como si HSC las hubiera planeado).');
  }

  // MINDSET
  const m = ctx.mindset;
  if (m.profileSummary) L.push(`PERFIL PSICOLÓGICO (acumulado, al ${m.profileAsOf ?? '?'}): ${m.profileSummary}`);
  if (m.todayReflections.length) L.push(`REFLEXIONES DE HOY: ${m.todayReflections.map(r => `${r.dimension}: "${r.response}"`).join(' | ')}`);

  return L.join('\n');
}
