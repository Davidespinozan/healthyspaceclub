import { describe, it, expect } from 'vitest';
import { buildCardioMain, cardioPlayableMinutes, type CardioMainPlan } from '../cardioMain';
import { planEarlyEnd, planPlannedMinutes } from '../workoutDisplay';
import type { Exercise } from '../../types';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';

// ── Fixtures mínimos de estación (solo campos que leen las capabilities) ──────
function station(over: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: over.id, type: 'cardio', muscleGroup: 'cardio', equipment: ['cuerpo'],
    cardioStyle: 'funcional', impact: 'low', fallRisk: false, variants: [],
    ...over,
  } as unknown as Exercise;
}
// Estación funcional de ALTA demanda (burpee-like): interval sí, continuo NO.
const burpee = station({ id: 'burpee', cardioStyle: 'funcional', impact: 'high', fallRisk: true });
// Estación CONTINUA reproducible tipo máquina (bici/elíptica): steady/recovery/cooldown.
const bici = station({ id: 'bici', cardioStyle: 'lowImpact', impact: 'low', fallRisk: false, equipment: ['gym'] });
// Estación lowImpact continua (marcha-like con equipo, para no depender de video en el test unitario).
const walk = station({ id: 'walk', cardioStyle: 'lowImpact', impact: 'low', fallRisk: false, equipment: ['gym'] });
// Estación explosiva (power).
const jump = station({ id: 'jump', cardioStyle: 'explosividad', impact: 'high', fallRisk: true });

// ── A · funcional 60 bodyweight, supportPool=0 → CONTENT_LIMITED ─────────────
describe('A · funcional bodyweight sin estación continua', () => {
  it('endReason = CONTENT_LIMITED y earlyEnd = true', () => {
    const plan = buildCardioMain({
      mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal',
      pool: [burpee], supportPool: [],
    });
    expect(plan.earlyEnd).toBe(true);
    expect(plan.endReason).toBe('CONTENT_LIMITED');
    // No es dosis/estilo/tiempo-lleno
    expect(plan.endReason).not.toBe('DOSE_REACHED');
    expect(plan.endReason).not.toBe('STYLE_QUALITY_CAP');
    expect(plan.endReason).not.toBe('AVAILABLE_TIME_FILLED');
  });
});

// ── C · output byte-identical: el circuito es lo único que se construye ───────
describe('C · output cardio del caso real (byte-identical al motor previo)', () => {
  it('1 solo bloque burpee 6×40/20, total 6, sin steady', () => {
    const plan = buildCardioMain({
      mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal',
      pool: [burpee], supportPool: [],
    });
    expect(plan.blocks).toHaveLength(1);
    const b = plan.blocks[0];
    expect(b.kind).toBe('intervals');
    expect(b.stationId).toBe('burpee');
    expect(b.rounds).toBe(6);
    expect(b.workSec).toBe(40);
    expect(b.restSec).toBe(20);
    expect(b.minutes).toBe(6);
    expect(plan.totalMinutes).toBe(6);
    expect(plan.steadyMinutes).toBe(0);
    // Ningún bloque continuo se coló (fail-closed intacto)
    expect(plan.blocks.some(x => x.kind === 'steady' || x.kind === 'recovery')).toBe(false);
  });
});

// ── D · gym funcional 60 con bici/elíptica → NO CONTENT_LIMITED ──────────────
describe('D · funcional con estación continua disponible', () => {
  it('no colapsa a CONTENT_LIMITED', () => {
    const plan = buildCardioMain({
      mainBudgetMinutes: 54, style: 'funcional', level: 'intermedio', readiness: 'normal',
      pool: [burpee], supportPool: [bici],
    });
    expect(plan.endReason).not.toBe('CONTENT_LIMITED');
    // Sí construyó trabajo continuo con la estación disponible
    expect(plan.blocks.some(x => x.kind === 'steady' || x.kind === 'recovery')).toBe(true);
  });
});

// ── E · explosividad limitada por style cap → STYLE_QUALITY_CAP ──────────────
describe('E · explosividad tope de estilo', () => {
  it('endReason = STYLE_QUALITY_CAP', () => {
    const plan = buildCardioMain({
      mainBudgetMinutes: 54, style: 'explosividad', level: 'principiante', readiness: 'normal',
      pool: [jump], supportPool: [],
    });
    expect(plan.earlyEnd).toBe(true);
    expect(plan.endReason).toBe('STYLE_QUALITY_CAP');
  });
});

// ── F · tope aeróbico real → AEROBIC_CAP_REACHED ─────────────────────────────
describe('F · tope aeróbico del nivel', () => {
  it('lowImpact intermedio con budget > 120 y estación continua → AEROBIC_CAP_REACHED', () => {
    const plan = buildCardioMain({
      mainBudgetMinutes: 140, style: 'lowImpact', level: 'intermedio', readiness: 'normal',
      pool: [walk], supportPool: [walk],
    });
    expect(plan.earlyEnd).toBe(true);
    expect(plan.endReason).toBe('AEROBIC_CAP_REACHED');
    expect(plan.totalMinutes).toBeLessThanOrEqual(120); // llenó la ventana, no el budget
  });
});

// ── G · sesión que llena el tiempo → AVAILABLE_TIME_FILLED ───────────────────
describe('G · sesión que ocupa el tiempo disponible', () => {
  it('funcional 30 con estación continua → AVAILABLE_TIME_FILLED (sin early-end)', () => {
    const plan = buildCardioMain({
      mainBudgetMinutes: 27, style: 'funcional', level: 'intermedio', readiness: 'normal',
      pool: [burpee], supportPool: [bici],
    });
    expect(plan.earlyEnd).toBe(false);
    expect(plan.endReason).toBe('AVAILABLE_TIME_FILLED');
  });
});

// ── Helpers de PlanLike para probar planEarlyEnd/planPlannedMinutes ──────────
function cardioPlanLike(endReason: CardioMainPlan['endReason'] | undefined, mainMin: number, warm = 6) {
  return {
    exercises: [{ sets: 1, reps: '6 min', cardio: { kind: 'intervals', labelKey: 'x', minutes: mainMin, intensity: 'alta', style: 'funcional' } }],
    warmupBlock: { minutes: warm },
    cardioMainBlock: { totalMinutes: mainMin, ...(endReason ? { endReason } : {}) },
    finisherBlock: null,
  };
}

// ── B · CONTENT_LIMITED nunca usa el copy "pasarte sería contraproducente" ───
describe('B · copy honesto de CONTENT_LIMITED', () => {
  it('planEarlyEnd devuelve la key de contenido, no la de dosis', () => {
    const r = planEarlyEnd(cardioPlanLike('CONTENT_LIMITED', 6) as never, 60);
    expect(r?.reasonKey).toBe('workout.earlyEnd.cardioContentLimited');
    expect(r?.reasonKey).not.toBe('workout.earlyEnd.cardio');
  });
  it('ni ES ni EN de las copias de cardio contienen "contraproducente"/"counterproductive"', () => {
    const ee = (es as { workout: { earlyEnd: Record<string, string> } }).workout.earlyEnd;
    const een = (en as { workout: { earlyEnd: Record<string, string> } }).workout.earlyEnd;
    for (const k of ['cardio', 'cardioContentLimited', 'cardioStyleCap', 'cardioAerobicCap']) {
      expect(ee[k]).toBeTruthy();
      expect(ee[k].toLowerCase()).not.toContain('contraproducente');
      expect(een[k].toLowerCase()).not.toContain('counterproductive');
    }
  });
  it('las 4 razones tipadas mapean a keys distintas y AVAILABLE_TIME_FILLED no muestra banner', () => {
    expect(planEarlyEnd(cardioPlanLike('DOSE_REACHED', 6) as never, 60)?.reasonKey).toBe('workout.earlyEnd.cardio');
    expect(planEarlyEnd(cardioPlanLike('STYLE_QUALITY_CAP', 20) as never, 60)?.reasonKey).toBe('workout.earlyEnd.cardioStyleCap');
    expect(planEarlyEnd(cardioPlanLike('AEROBIC_CAP_REACHED', 75) as never, 90)?.reasonKey).toBe('workout.earlyEnd.cardioAerobicCap');
    expect(planEarlyEnd(cardioPlanLike('AVAILABLE_TIME_FILLED', 54) as never, 60)).toBeNull();
  });
});

// ── H · plan legacy sin endReason → fallback por duración sigue funcionando ──
describe('H · fallback legacy (sin endReason)', () => {
  it('planned < requested*0.75 → workout.earlyEnd.cardio; si no, null', () => {
    const short = planEarlyEnd(cardioPlanLike(undefined, 6) as never, 60); // planned=12 < 45
    expect(short?.reasonKey).toBe('workout.earlyEnd.cardio');
    const full = planEarlyEnd(cardioPlanLike(undefined, 48) as never, 60);  // planned=54 >= 45
    expect(full).toBeNull();
  });
});

// ── I · fuerza no cambia ─────────────────────────────────────────────────────
describe('I · resistencia intacta', () => {
  it('plan sin cardioMainBlock usa la heurística de resistencia', () => {
    const strengthPlan = {
      exercises: [{ sets: 3, reps: '10', rest: 60 }, { sets: 3, reps: '10', rest: 60 }],
      warmupBlock: { minutes: 8 }, cardioMainBlock: null, finisherBlock: null,
    };
    const r = planEarlyEnd(strengthPlan as never, 120);
    expect(r?.reasonKey).toBe('workout.earlyEnd.resistance');
  });
});

// ── K · displayedMinutes = warmup + main + finisher ─────────────────────────
describe('K · duración mostrada', () => {
  it('planPlannedMinutes = warmup + cardioMain.total + finisher', () => {
    const plan = cardioPlanLike('CONTENT_LIMITED', 6, 6);
    expect(planPlannedMinutes(plan as never)).toBe(12); // 6 + 6 + 0
  });
});

// ── L · duración cronológica del player = suma de bloques ────────────────────
describe('L · duración cronológica del player sin cambio', () => {
  it('cardioPlayableMinutes = Σ block.minutes = totalMinutes', () => {
    const plan = buildCardioMain({
      mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal',
      pool: [burpee], supportPool: [],
    });
    expect(cardioPlayableMinutes(plan)).toBe(plan.totalMinutes);
    expect(cardioPlayableMinutes(plan)).toBe(6);
  });
});
