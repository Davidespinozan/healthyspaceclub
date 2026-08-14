import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { allocateHeadroom } from '../headroom';
import { prescribeExercise, type Category, type PrescribedItem, type Phase } from '../sessionPrescription';
import type { TrainingGoal } from '../../types';

const bankById = new Map(exercises.map(e => [e.id, e]));
type It = PrescribedItem<{ id: string; muscleGroup: string }>;
const mk = (id: string, cat: Category, sets: number, phase: Phase = 'acumulacion', tg: TrainingGoal = 'hipertrofia'): It => ({
  ex: { id, muscleGroup: bankById.get(id)!.muscleGroup }, category: cat,
  prescription: prescribeExercise({ category: cat, sets, trainingGoal: tg, phase }),
});
const makeItem = (id: string, cat: Category, sets: number): It | null => {
  const b = bankById.get(id); if (!b) return null;
  return { ex: { id, muscleGroup: b.muscleGroup }, category: cat, prescription: prescribeExercise({ category: cat, sets, trainingGoal: 'hipertrofia', phase: 'acumulacion' }) };
};
const base = {
  bankById, availableMainMinutes: 48, trainingGoal: 'hipertrofia' as TrainingGoal,
  phase: 'acumulacion' as Phase, readiness: 'normal' as const,
};
const setsOf = (r: { items: It[] }, id: string) => r.items.find(i => i.ex.id === id)?.prescription.sets;

// ── §1/§3/§4/§12 · PROFUNDIDAD ANTES QUE VARIEDAD ───────────────────────
describe('HEADROOM · profundidad primero (§3/§4/§12)', () => {
  it('con headroom sube series de mains/secondary antes que añadir ejercicios', () => {
    const items = [mk('press-horizontal', 'main-compound', 2), mk('remo-horizontal-pesado', 'secondary-compound', 2)];
    const r = allocateHeadroom({ ...base, items, allocation: { pecho: 6, espalda: 6 }, weeklyRemaining: { pecho: 12, espalda: 12 } });
    expect(r.addedSets).toBeGreaterThan(0);
    expect(setsOf(r, 'press-horizontal')!).toBeGreaterThan(2); // profundizó el compuesto
    expect(r.items.length).toBe(2); // no añadió ejercicios habiendo profundidad disponible
  });
  it('respeta role caps (main ≤5, secondary/isolation ≤4)', () => {
    const items = [mk('press-horizontal', 'main-compound', 4), mk('aperturas', 'isolation', 3)];
    const r = allocateHeadroom({ ...base, availableMainMinutes: 120, items, allocation: { pecho: 20 }, weeklyRemaining: { pecho: 40 } });
    expect(setsOf(r, 'press-horizontal')!).toBeLessThanOrEqual(5);
    expect(setsOf(r, 'aperturas')!).toBeLessThanOrEqual(4);
  });
});

// ── §7 · NUNCA SUPERA EL SEMANAL ────────────────────────────────────────
describe('HEADROOM · volumen semanal como límite (§7)', () => {
  it('no sube series de un músculo por encima del semanal pendiente', () => {
    const items = [mk('press-horizontal', 'main-compound', 2)];
    const r = allocateHeadroom({ ...base, availableMainMinutes: 120, items, allocation: { pecho: 6 }, weeklyRemaining: { pecho: 3 } });
    expect(setsOf(r, 'press-horizontal')!).toBeLessThanOrEqual(3); // tope = semanal pendiente
  });
  it('músculo en target (remaining 0) no recibe nada', () => {
    const items = [mk('press-horizontal', 'main-compound', 2)];
    const r = allocateHeadroom({ ...base, availableMainMinutes: 120, items, allocation: { pecho: 2 }, weeklyRemaining: { pecho: 2 } });
    expect(setsOf(r, 'press-horizontal')!).toBe(2);
    expect(r.addedSets).toBe(0);
  });
});

// ── §8/§10 · ADELANTO CONTROLADO SOLO EN ACUMULACIÓN ────────────────────
describe('HEADROOM · bring-forward solo en acumulación (§8/§10)', () => {
  it('intensificación: solo restaura hasta la dosis de hoy, no adelanta el semanal', () => {
    const items = [mk('press-horizontal', 'main-compound', 2, 'intensificacion')];
    const r = allocateHeadroom({ ...base, phase: 'intensificacion', availableMainMinutes: 120, items, allocation: { pecho: 3 }, weeklyRemaining: { pecho: 30 } });
    expect(setsOf(r, 'press-horizontal')!).toBeLessThanOrEqual(3); // no pasa de la dosis de hoy
  });
  it('acumulación: puede adelantar hasta el semanal pendiente', () => {
    const items = [mk('press-horizontal', 'main-compound', 2)];
    const r = allocateHeadroom({ ...base, availableMainMinutes: 120, items, allocation: { pecho: 3 }, weeklyRemaining: { pecho: 10 } });
    expect(setsOf(r, 'press-horizontal')!).toBeGreaterThan(3); // adelanta por encima de la dosis de hoy
  });
});

// ── §9/§11/§20 · FUERZA / DELOAD / READINESS-LOW NO RELLENAN ─────────────
describe('HEADROOM · fuerza/deload/readiness-low intactos (§9/§11/§20)', () => {
  it('fuerza: sin cambios', () => {
    const items = [mk('press-horizontal', 'main-compound', 2, 'acumulacion', 'fuerza')];
    const r = allocateHeadroom({ ...base, trainingGoal: 'fuerza', availableMainMinutes: 120, items, allocation: { pecho: 6 }, weeklyRemaining: { pecho: 20 } });
    expect(r.addedSets).toBe(0); expect(r.decisions).toHaveLength(0);
  });
  it('deload: sin cambios', () => {
    const items = [mk('press-horizontal', 'main-compound', 2, 'deload')];
    const r = allocateHeadroom({ ...base, phase: 'deload', availableMainMinutes: 120, items, allocation: { pecho: 6 }, weeklyRemaining: { pecho: 20 } });
    expect(r.addedSets).toBe(0);
  });
  it('readiness low: sin cambios', () => {
    const items = [mk('press-horizontal', 'main-compound', 2)];
    const r = allocateHeadroom({ ...base, readiness: 'low', availableMainMinutes: 120, items, allocation: { pecho: 6 }, weeklyRemaining: { pecho: 20 } });
    expect(r.addedSets).toBe(0);
  });
});

// ── §2 · SIN HEADROOM → SIN CAMBIOS ─────────────────────────────────────
describe('HEADROOM · sin tiempo sobrante no toca nada (§2)', () => {
  it('sesión que ya llena el tiempo: 0 series añadidas', () => {
    const items = [mk('press-horizontal', 'main-compound', 4), mk('remo-horizontal-pesado', 'secondary-compound', 4), mk('aperturas', 'isolation', 4)];
    const r = allocateHeadroom({ ...base, availableMainMinutes: 20, items, allocation: { pecho: 12, espalda: 8 }, weeklyRemaining: { pecho: 20, espalda: 20 } });
    expect(r.addedSets).toBe(0);
  });
});

// ── §5/§12 · AÑADE EJERCICIO SOLO SI EL CAP BLOQUEA Y HAY DOSIS ──────────
describe('HEADROOM · añade ejercicio solo con role cap alcanzado + dosis pendiente (§5/§12)', () => {
  it('pull 90min con pocos ejercicios al tope → añade complementario (no antes)', () => {
    // 2 compuestos de espalda ya al cap 5/4, semanal pendiente alto, mucho tiempo → añade
    const items = [mk('traccion-vertical-polea', 'main-compound', 5), mk('remo-horizontal-pesado', 'secondary-compound', 4)];
    const r = allocateHeadroom({
      ...base, availableMainMinutes: 90, items, allocation: { espalda: 12 }, weeklyRemaining: { espalda: 20 },
      candidates: exercises.filter(e => e.muscleGroup === 'espalda'),
      fatigueBudgetValue: 12, ctxQuality: { trainingGoal: 'hipertrofia' }, makeItem,
    });
    expect(r.addedExercises).toBeGreaterThan(0);
  });
  it('no añade ejercicio si aún hay profundidad disponible', () => {
    const items = [mk('traccion-vertical-polea', 'main-compound', 2), mk('remo-horizontal-pesado', 'secondary-compound', 2)];
    const r = allocateHeadroom({
      ...base, availableMainMinutes: 90, items, allocation: { espalda: 12 }, weeklyRemaining: { espalda: 20 },
      candidates: exercises.filter(e => e.muscleGroup === 'espalda'),
      fatigueBudgetValue: 12, ctxQuality: { trainingGoal: 'hipertrofia' }, makeItem,
    });
    // primero profundiza; el ejercicio extra solo tras topar caps
    expect(setsOf(r, 'traccion-vertical-polea')!).toBe(5);
    expect(setsOf(r, 'remo-horizontal-pesado')!).toBe(4);
  });
});

// ── §5 · ENDED EARLY INTENTIONALLY ──────────────────────────────────────
describe('HEADROOM · fin anticipado explícito (§5)', () => {
  it('marca endedEarly cuando sobra tiempo pero el semanal ya está cubierto', () => {
    const items = [mk('press-horizontal', 'main-compound', 2)];
    const r = allocateHeadroom({ ...base, availableMainMinutes: 90, items, allocation: { pecho: 2 }, weeklyRemaining: { pecho: 2 } });
    expect(r.endedEarly).toBe(true);
    expect(r.addedSets).toBe(0);
  });
});
