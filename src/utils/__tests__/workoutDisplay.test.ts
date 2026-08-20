import { describe, it, expect } from 'vitest';
import { planPlannedMinutes, planEarlyEnd, isCardioPlan, cardioBlockTitleKey, cardioShowVideo, shouldOfferAddCardio, type CardioExerciseMeta } from '../workoutDisplay';
import { cardioBlocksToExercises } from '../cardioMain';

const meta = (o: Partial<CardioExerciseMeta>): CardioExerciseMeta =>
  ({ kind: 'steady', labelKey: 'cardio.steady', minutes: 10, intensity: 'baja', style: 'correr', ...o });

// ═══════════════════════════════════════════════════════════════════════════
// DURACIÓN REAL — el header no miente (cardio) ni esconde (resistencia).
// ═══════════════════════════════════════════════════════════════════════════
describe('planPlannedMinutes — autoridad temporal correcta', () => {
  const cardioPlan = {
    exercises: [{ reps: '5 min', cardio: meta({ kind: 'drills' }) }, { reps: '77 min · Zona 2', cardio: meta({}) }],
    warmupBlock: { minutes: 8 }, cardioMainBlock: { totalMinutes: 112 }, finisherBlock: null,
  };
  it('CARDIO: warmup + cardioMain (NO el estimador de fuerza que daba "25 min")', () => {
    expect(planPlannedMinutes(cardioPlan)).toBe(120); // 8 + 112 — NO 25
    expect(isCardioPlan(cardioPlan)).toBe(true);
  });
  it('RESISTENCIA (push 2×2, rest 150): estimador honesto ≈ 13 min', () => {
    const push = { exercises: [{ sets: 2, rest: 150, reps: '6-10' }, { sets: 2, rest: 150, reps: '6-10' }] };
    expect(planPlannedMinutes(push)).toBe(13); // 2×2×(40+150)/60 = 12.7 → 13 (honesto, es la sesión real)
  });
  it('RESISTENCIA sesión completa (10 ejercicios ~4 sets) ≈ cerca del tiempo pedido', () => {
    const full = { exercises: Array.from({ length: 10 }, () => ({ sets: 4, rest: 90, reps: '8-12' })) };
    expect(planPlannedMinutes(full)).toBeGreaterThan(80);
  });
});

describe('planEarlyEnd — early-end honesto y comunicado', () => {
  it('push 13 min con 120 pedidos → early-end (resistencia)', () => {
    const push = { exercises: [{ sets: 2, rest: 150, reps: '6-10' }, { sets: 2, rest: 150, reps: '6-10' }] };
    const e = planEarlyEnd(push, 120);
    expect(e).not.toBeNull();
    expect(e!.plannedMin).toBe(13);
    expect(e!.reasonKey).toBe('workout.earlyEnd.resistance');
  });
  it('cardio 45 min con 120 pedidos → early-end (cardio)', () => {
    const cardio = { exercises: [{ reps: '45 min', cardio: meta({}) }], warmupBlock: { minutes: 0 }, cardioMainBlock: { totalMinutes: 45 } };
    expect(planEarlyEnd(cardio, 120)!.reasonKey).toBe('workout.earlyEnd.cardio');
  });
  it('sesión que ocupa ~el tiempo pedido → sin aviso', () => {
    const full = { exercises: Array.from({ length: 12 }, () => ({ sets: 4, rest: 90, reps: '8-12' })) };
    expect(planEarlyEnd(full, 90)).toBeNull(); // ~112 min ≥ 90×0.75
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IDENTIDAD DE BLOQUES CARDIO — nunca el stationId técnico.
// ═══════════════════════════════════════════════════════════════════════════
describe('cardioBlockTitleKey — actividad real, no el ejercicio-estación', () => {
  it('un bloque STEADY nunca titula como el stationId (devuelve una clave de actividad)', () => {
    // Explosividad recovery usa un station de saltos → el título NO puede ser "Saltos Básicos"
    const k = cardioBlockTitleKey(meta({ kind: 'steady', style: 'explosividad', labelKey: 'cardio.recovery', minutes: 81 }));
    expect(k.startsWith('workout.cardioBlock.')).toBe(true); // identidad de bloque, no nombre de estación
  });
  it('correr: drills ≠ intervals ≠ steady (no colisionan)', () => {
    const d = cardioBlockTitleKey(meta({ kind: 'drills', style: 'correr' }));
    const i = cardioBlockTitleKey(meta({ kind: 'intervals', style: 'correr' }));
    const s = cardioBlockTitleKey(meta({ kind: 'steady', style: 'correr' }));
    expect(new Set([d, i, s]).size).toBe(3);
    expect(s).toBe('workout.cardioBlock.runSteady');
  });
  it('estilo importa: steady correr ≠ steady lowImpact ≠ steady funcional', () => {
    expect(cardioBlockTitleKey(meta({ kind: 'steady', style: 'lowImpact' }))).toBe('workout.cardioBlock.lowImpactSteady');
    expect(cardioBlockTitleKey(meta({ kind: 'steady', style: 'funcional' }))).toBe('workout.cardioBlock.funcionalSteady');
  });
});

describe('cardioShowVideo — sin video engañoso en bloques sostenidos', () => {
  it('steady/recovery → NO video (no high-knees durante 77 min)', () => {
    expect(cardioShowVideo(meta({ kind: 'steady' }))).toBe(false);
    expect(cardioShowVideo(meta({ kind: 'recovery' }))).toBe(false);
  });
  it('drills → sí (es el drill); intervals de CARRERA → no (station es proxy)', () => {
    expect(cardioShowVideo(meta({ kind: 'drills', style: 'correr' }))).toBe(true);
    expect(cardioShowVideo(meta({ kind: 'intervals', style: 'correr' }))).toBe(false);
  });
  it('intervals/power NO-running (funcional/explosividad) → sí (station ES el ejercicio)', () => {
    expect(cardioShowVideo(meta({ kind: 'intervals', style: 'funcional' }))).toBe(true);
    expect(cardioShowVideo(meta({ kind: 'power', style: 'explosividad' }))).toBe(true);
  });
});

describe('cardioBlocksToExercises — la identidad del bloque viaja con el ejercicio', () => {
  it('cada ejercicio de cardio lleva ex.cardio con kind/style/labelKey', () => {
    const plan = {
      style: 'correr' as const, budgetMinutes: 120, totalMinutes: 90, intenseMinutes: 10, steadyMinutes: 80, earlyEnd: false,
      blocks: [
        { kind: 'drills' as const, minutes: 5, stationId: 'running-drills', intensity: 'media' as const, labelKey: 'cardio.drills', zone: undefined, rpe: 6, cue: '' },
        { kind: 'steady' as const, minutes: 77, stationId: 'running-drills', intensity: 'baja' as const, labelKey: 'cardio.steady', zone: 'Zona 2', rpe: 3, cue: '' },
      ],
    };
    const exs = cardioBlocksToExercises(plan);
    expect(exs[0].cardio.kind).toBe('drills');
    expect(exs[1].cardio.kind).toBe('steady');
    expect(exs[1].cardio.style).toBe('correr');
    // el steady de 77 min comparte stationId con los drills, pero su IDENTIDAD es distinta
    expect(cardioBlockTitleKey(exs[0].cardio)).not.toBe(cardioBlockTitleKey(exs[1].cardio));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// F2B-1 (item 4) · shouldOfferAddCardio respeta composedCardio: no doble cardio si hay uno pendiente.
// ═══════════════════════════════════════════════════════════════════════════
describe('shouldOfferAddCardio — gate de composedCardio (Today)', () => {
  const strengthPlan = (composedCardio?: { done?: boolean }) =>
    ({ exercises: [{ sets: 4, reps: '8', rest: 120 }], ...(composedCardio ? { composedCardio } : {}) });
  it('composedCardio PENDING → NO ofrecer "Añadir cardio"', () => {
    expect(shouldOfferAddCardio(strengthPlan({ done: false }) as never, [])).toBe(false);
    expect(shouldOfferAddCardio(strengthPlan({}) as never, [])).toBe(false); // done ausente = pending
  });
  it('composedCardio DONE → sí ofrecer (flujo manual normal)', () => {
    expect(shouldOfferAddCardio(strengthPlan({ done: true }) as never, [])).toBe(true);
  });
  it('SIN composedCardio → comportamiento previo intacto (plan de fuerza → true)', () => {
    expect(shouldOfferAddCardio(strengthPlan() as never, [])).toBe(true);
  });
  it('SIN composedCardio · sin plan pero sesión de fuerza completada → true', () => {
    expect(shouldOfferAddCardio(null, [{ modality: 'fuerza' }])).toBe(true);
  });
  it('día de cardio (isCardioPlan) sin composed → false (ya es cardio)', () => {
    expect(shouldOfferAddCardio({ exercises: [], cardioMainBlock: { totalMinutes: 30 } } as never, [])).toBe(false);
  });
});
