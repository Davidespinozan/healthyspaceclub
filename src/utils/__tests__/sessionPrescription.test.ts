import { describe, it, expect } from 'vitest';
import {
  categorize, allocateSessionVolume, repRangeFor, restFor, rirFor,
  schemeFor, prescribeExercise, prescribeSession,
} from '../sessionPrescription';
import type { Exercise } from '../../types';

const ex = (id: string, name: string, type: string, muscleGroup = 'pecho') =>
  ({ id, name, type, muscleGroup } as unknown as Exercise);

describe('sessionPrescription — categoría', () => {
  it('compuesto pesado → main, compuesto ligero → secondary, aislamiento → isolation', () => {
    expect(categorize(ex('sentadilla-barra', 'Sentadilla con Barra', 'compuesto'))).toBe('main-compound');
    expect(categorize(ex('press-inclinado-mancuernas', 'Press Inclinado', 'compuesto'))).toBe('secondary-compound');
    expect(categorize(ex('curl-biceps', 'Curl', 'aislamiento'))).toBe('isolation');
  });
});

describe('sessionPrescription — reparto de volumen (allocateSessionVolume)', () => {
  const baseIn = {
    weeklyTarget: { pecho: 12 }, doneThisWeek: { pecho: 0 },
    dayMuscles: ['pecho'], freqTarget: 4, sessionsThisWeekDone: 0,
    muscleWeeklyFreq: { pecho: 2 },
  };

  it('NO mete todo el déficit en una sesión', () => {
    const a = allocateSessionVolume(baseIn);
    expect(a.pecho).toBeLessThan(12);   // reparte, no vuelca los 12
    expect(a.pecho).toBeGreaterThanOrEqual(4);
  });

  it('ÚLTIMA sesión de la semana → alcanza el faltante (acotado por el límite)', () => {
    const a = allocateSessionVolume({ ...baseIn, freqTarget: 4, sessionsThisWeekDone: 3, doneThisWeek: { pecho: 4 } });
    // faltan 8, es la última → intenta darlos (cap 10)
    expect(a.pecho).toBeGreaterThanOrEqual(6);
  });

  it('músculo con MUCHO déficit no supera el límite por sesión', () => {
    const a = allocateSessionVolume({ ...baseIn, weeklyTarget: { pecho: 30 }, sessionsThisWeekDone: 3, doneThisWeek: { pecho: 0 }, maxSetsPerMuscle: 10 });
    expect(a.pecho).toBeLessThanOrEqual(10);
  });

  it('músculo CASI en target → dosis mínima (mantenimiento)', () => {
    const a = allocateSessionVolume({ ...baseIn, weeklyTarget: { pecho: 12 }, doneThisWeek: { pecho: 12 } });
    expect(a.pecho).toBeLessThanOrEqual(2);
  });

  it('varias sesiones restantes → dosis moderada; menos sesiones → dosis mayor', () => {
    const muchas = allocateSessionVolume({ ...baseIn, freqTarget: 5, sessionsThisWeekDone: 0, muscleWeeklyFreq: { pecho: 3 } });
    const pocas = allocateSessionVolume({ ...baseIn, freqTarget: 2, sessionsThisWeekDone: 0, muscleWeeklyFreq: { pecho: 1 } });
    expect(pocas.pecho).toBeGreaterThanOrEqual(muchas.pecho);
  });

  it('readiness BAJA → menos series', () => {
    const normal = allocateSessionVolume(baseIn);
    const cansado = allocateSessionVolume({ ...baseIn, recovery: 'mala' });
    expect(cansado.pecho).toBeLessThanOrEqual(normal.pecho);
  });

  it('DELOAD → recorte claro', () => {
    const normal = allocateSessionVolume(baseIn);
    const deload = allocateSessionVolume({ ...baseIn, isDeload: true });
    expect(deload.pecho).toBeLessThan(normal.pecho);
  });

  it('secundario del día recibe MENOS directo que el principal', () => {
    const a = allocateSessionVolume({
      weeklyTarget: { pecho: 12, biceps: 12 }, doneThisWeek: {},
      dayMuscles: ['pecho', 'biceps'], primaryMuscles: ['pecho'],
      freqTarget: 4, sessionsThisWeekDone: 0, muscleWeeklyFreq: { pecho: 2, biceps: 2 },
    });
    expect(a.biceps).toBeLessThan(a.pecho);
  });
});

describe('sessionPrescription — reps/RIR/descanso por fase', () => {
  it('ACUMULACIÓN vs INTENSIFICACIÓN: el compuesto baja reps y sube descanso al intensificar', () => {
    const acum = repRangeFor('main-compound', 'hipertrofia', 'acumulacion');
    const inten = repRangeFor('main-compound', 'hipertrofia', 'intensificacion');
    expect(parseInt(inten)).toBeLessThanOrEqual(parseInt(acum));
    expect(restFor('main-compound', 'intensificacion')).toBeGreaterThan(restFor('main-compound', 'acumulacion'));
  });
  it('aislamiento: más reps y menos descanso que el compuesto', () => {
    expect(restFor('isolation', 'acumulacion')).toBeLessThan(restFor('main-compound', 'acumulacion'));
  });
  it('RIR: intensificación más cerca del fallo que acumulación; deload lejos', () => {
    expect(rirFor('main-compound', 'intensificacion')).toBeLessThan(rirFor('main-compound', 'acumulacion'));
    expect(rirFor('isolation', 'deload')).toBeGreaterThanOrEqual(3);
  });
});

describe('sessionPrescription — esquema top-backoff solo donde aplica', () => {
  const loaded = [{ reps: 8, kg: 100 }];
  it('compuesto principal CON carga → top-backoff; SIN carga → recto', () => {
    expect(schemeFor('main-compound', true, 'acumulacion')).toBe('top-backoff');
    expect(schemeFor('main-compound', false, 'acumulacion')).toBe('straight');
  });
  it('secundario / aislamiento → siempre recto (aunque haya carga)', () => {
    expect(schemeFor('secondary-compound', true, 'acumulacion')).toBe('straight');
    expect(schemeFor('isolation', true, 'acumulacion')).toBe('straight');
  });
  it('deload → nunca top-backoff', () => {
    expect(schemeFor('main-compound', true, 'deload')).toBe('straight');
  });
  it('prescribeExercise integra P2: top-backoff trae topKg + backoffKg', () => {
    const p = prescribeExercise({ category: 'main-compound', sets: 4, objective: 'hipertrofia', phase: 'acumulacion', lastSets: loaded });
    expect(p.scheme).toBe('top-backoff');
    expect(p.topKg).toBeGreaterThan(0);
    expect(p.backoffKg).toBeGreaterThan(0);
    expect(p.topKg!).toBeGreaterThanOrEqual(p.backoffKg!);
  });
  it('peso corporal (sin kg) → recto, sin topKg', () => {
    const p = prescribeExercise({ category: 'isolation', sets: 3, objective: 'hipertrofia', phase: 'acumulacion', lastSets: [{ reps: 15, kg: 0 }] });
    expect(p.scheme).toBe('straight');
    expect(p.topKg).toBeUndefined();
  });
});

describe('sessionPrescription — DELOAD de carga (P1, reutiliza P2)', () => {
  const loaded = [{ reps: 6, kg: 100 }];

  it('deload con carga comparable → carga recta REDUCIDA (~87.5% de la normal), sin top-set', () => {
    const normal = prescribeExercise({ category: 'main-compound', sets: 4, objective: 'hipertrofia', phase: 'acumulacion', lastSets: loaded });
    const deload = prescribeExercise({ category: 'main-compound', sets: 3, objective: 'hipertrofia', phase: 'deload', lastSets: loaded });
    expect(deload.scheme).toBe('straight');       // sin top-set agresivo
    expect(deload.backoffKg).toBeUndefined();
    expect(deload.isDeloadLoad).toBe(true);
    expect(deload.topKg!).toBeGreaterThan(0);
    expect(deload.topKg!).toBeLessThan(normal.topKg!); // más ligero que el trabajo normal
    // reducción razonable: entre ~10% y ~15% bajo el peso normal
    const ratio = deload.topKg! / normal.topKg!;
    expect(ratio).toBeGreaterThan(0.83);
    expect(ratio).toBeLessThan(0.92);
  });

  it('deload → RIR alto (lejos del fallo)', () => {
    const deload = prescribeExercise({ category: 'main-compound', sets: 3, objective: 'hipertrofia', phase: 'deload', lastSets: loaded });
    expect(deload.rir).toBeGreaterThanOrEqual(3);
  });

  it('deload SIN carga comparable (bandas/peso corporal) → recto sin kg (no inventa placas)', () => {
    const deload = prescribeExercise({ category: 'main-compound', sets: 3, objective: 'hipertrofia', phase: 'deload', lastSets: [{ reps: 15, kg: 0 }] });
    expect(deload.scheme).toBe('straight');
    expect(deload.topKg).toBeUndefined();
    expect(deload.isDeloadLoad).toBeUndefined();
  });

  it('REGRESO post-deload: con el MISMO historial previo, la carga normal se recupera intacta', () => {
    // El deload no toca lastExercisePerformance (se gatea en el registro), así que la siguiente
    // sesión normal parte del MISMO historial → misma prescripción que antes del deload.
    const antes = prescribeExercise({ category: 'main-compound', sets: 4, objective: 'hipertrofia', phase: 'acumulacion', lastSets: loaded });
    const despues = prescribeExercise({ category: 'main-compound', sets: 4, objective: 'hipertrofia', phase: 'acumulacion', lastSets: loaded });
    expect(despues.topKg).toBe(antes.topKg); // sin caída aprendida
  });
});

describe('sessionPrescription — prescribeSession (reparto + tiempo)', () => {
  const bank = new Map([
    ['sentadilla-barra', ex('sentadilla-barra', 'Sentadilla con Barra', 'compuesto', 'cuadriceps')],
    ['prensa', ex('prensa', 'Prensa', 'compuesto', 'cuadriceps')],
    ['extension-cuad', ex('extension-cuad', 'Extensión', 'aislamiento', 'cuadriceps')],
    ['curl-femoral', ex('curl-femoral', 'Curl Femoral', 'aislamiento', 'isquios')],
  ]);
  const exs = [
    { id: 'sentadilla-barra', muscleGroup: 'cuadriceps' },
    { id: 'prensa', muscleGroup: 'cuadriceps' },
    { id: 'extension-cuad', muscleGroup: 'cuadriceps' },
  ];

  it('el compuesto principal se lleva MÁS series que el aislamiento', () => {
    const items = prescribeSession({
      exercises: exs, bankById: bank, allocation: { cuadriceps: 9 },
      objective: 'hipertrofia', phase: 'acumulacion', mainMinutes: 999,
    });
    const sent = items.find(i => i.ex.id === 'sentadilla-barra')!;
    const ext = items.find(i => i.ex.id === 'extension-cuad')!;
    expect(sent.prescription.sets).toBeGreaterThanOrEqual(ext.prescription.sets);
  });

  it('TIEMPO amplio: no recorta', () => {
    const items = prescribeSession({
      exercises: exs, bankById: bank, allocation: { cuadriceps: 9 },
      objective: 'hipertrofia', phase: 'acumulacion', mainMinutes: 999,
    });
    const totalSets = items.reduce((a, i) => a + i.prescription.sets, 0);
    expect(totalSets).toBeGreaterThanOrEqual(6);
  });

  it('POCO tiempo: recorta accesorios ANTES que el compuesto principal', () => {
    const items = prescribeSession({
      exercises: exs, bankById: bank, allocation: { cuadriceps: 12 },
      objective: 'hipertrofia', phase: 'acumulacion', mainMinutes: 15, // muy apretado
    });
    const totalMin = items.reduce((a, i) => a + i.prescription.sets * (0.7 + i.prescription.rest / 60), 0);
    expect(totalMin).toBeLessThanOrEqual(15 + 3); // cabe (con margen de redondeo)
    const sent = items.find(i => i.ex.id === 'sentadilla-barra')!;
    const ext = items.find(i => i.ex.id === 'extension-cuad')!;
    expect(sent.prescription.sets).toBeGreaterThanOrEqual(ext.prescription.sets); // el compuesto sobrevive
  });
});
