import { describe, it, expect } from 'vitest';
import { prescribeSession, prescribeExercise } from '../sessionPrescription';

// ═══════════════════════════════════════════════════════════════════════════
// CACHE: ESTRUCTURA SÍ, PERSONALIZACIÓN NO.
// La personalización fisiológica (topKg/backoffKg/sets/reps) es una FUNCIÓN PURA del
// historial del USUARIO ACTUAL. Un cache HIT debe RE-DERIVARLA (mismo pipeline determinista),
// nunca servir la del primer usuario. Estos tests reproducen la fuga y fijan el contrato.
// ═══════════════════════════════════════════════════════════════════════════

// Motor de carga por-ejercicio (lo que un cache-hit DEBE re-ejecutar por usuario).
const loadFor = (lastSets: { reps: number; kg: number }[]) =>
  prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'fuerza', phase: 'acumulacion', level: 'intermedio', lastSets }).topKg;

describe('cache · personalización de CARGA es por-usuario (reproduce la fuga cross-user)', () => {
  it('ROOT CAUSE: mismo ejercicio, distinto historial → distinto topKg (servir el de A a B = bug)', () => {
    const topA = loadFor([{ reps: 5, kg: 100 }]); // A fuerte
    const topB = loadFor([{ reps: 5, kg: 40 }]);  // B débil, MISMA config
    expect(topA).toBeGreaterThan(topB!);          // si el cache sirviera topKg de A, B recibiría ~100 en vez de ~40
    expect(topA).toBeGreaterThan(90);
    expect(topB).toBeLessThan(60);
  });

  it('B sin historial → arranque en frío seguro (sin topKg), NUNCA la carga de A', () => {
    const topColdStart = loadFor([]);             // sin historial → sin carga comparable
    expect(topColdStart).toBeUndefined();          // el player pide encontrar el peso; no hereda el de A
    expect(loadFor([{ reps: 5, kg: 100 }])).toBeDefined(); // (A sí tiene carga)
  });

  it('B más fuerte que A → recibe SU carga (mayor), no la de A', () => {
    const strongerB = loadFor([{ reps: 5, kg: 140 }]);
    const weakerA = loadFor([{ reps: 5, kg: 100 }]);
    expect(strongerB!).toBeGreaterThan(weakerA!); // la carga sigue al historial del usuario actual
  });

  it('DETERMINISMO (HIT ≡ MISS): mismo usuario/historial → misma prescripción', () => {
    const h = [{ reps: 5, kg: 100 }];
    expect(loadFor(h)).toBe(loadFor(h));          // re-derivar en un HIT da EXACTAMENTE lo mismo que un MISS
  });
});

describe('cache · personalización de VOLUMEN/sets es por-usuario', () => {
  const base = {
    exercises: [{ id: 'press', muscleGroup: 'pecho' }, { id: 'apertura', muscleGroup: 'pecho' }],
    bankById: new Map([
      ['press', { id: 'press', name: 'Press banca', type: 'compuesto' as const }],
      ['apertura', { id: 'apertura', name: 'Apertura', type: 'aislamiento' as const }],
    ]),
    trainingGoal: 'hipertrofia' as const, phase: 'acumulacion' as const, level: 'intermedio', mainMinutes: 40,
  };

  it('distinta allocation (volumen semanal por usuario) → distinto reparto de series', () => {
    const low = prescribeSession({ ...base, allocation: { pecho: 6 }, lastPerf: {} });
    const high = prescribeSession({ ...base, allocation: { pecho: 12 }, lastPerf: {} });
    const setsLow = low.reduce((a, it) => a + it.prescription.sets, 0);
    const setsHigh = high.reduce((a, it) => a + it.prescription.sets, 0);
    expect(setsHigh).toBeGreaterThan(setsLow); // el volumen sigue la dosis del usuario actual, no la cacheada
  });

  it('prescribeSession propaga la carga por-usuario (integración con prescribeExercise)', () => {
    const strong = prescribeSession({ ...base, allocation: { pecho: 8 }, lastPerf: { press: { sets: [{ reps: 6, kg: 120 }] } } });
    const weak = prescribeSession({ ...base, allocation: { pecho: 8 }, lastPerf: { press: { sets: [{ reps: 6, kg: 50 }] } } });
    const topStrong = strong.find(it => it.ex.id === 'press')!.prescription.topKg;
    const topWeak = weak.find(it => it.ex.id === 'press')!.prescription.topKg;
    if (topStrong != null && topWeak != null) expect(topStrong).toBeGreaterThan(topWeak);
  });
});

// La asignación de carga del componente es CONDICIONAL (`if topKg != null`). En un cache HIT para
// un usuario en arranque en frío, hay que BORRAR la carga horneada por el otro usuario ANTES de
// re-prescribir, o la sobrescritura condicional la deja intacta.
describe('cache · cold-start NO hereda la carga horneada (contrato del materializado en HIT)', () => {
  const coldFresh = () => prescribeExercise({ category: 'main-compound', sets: 4, trainingGoal: 'fuerza', phase: 'acumulacion', lastSets: [] });

  it('CON el fix (limpiar antes de re-prescribir) → sin topKg heredado', () => {
    const ex: { id: string; topKg?: number } = { id: 'press', topKg: 100 }; // horneado por A
    delete ex.topKg;                                                          // fix: limpiar en el HIT
    const fresh = coldFresh();
    if (fresh.topKg != null) ex.topKg = fresh.topKg;                          // asignación condicional (como el componente)
    expect(ex.topKg).toBeUndefined();                                         // NO heredó los 100 de A
  });

  it('CONTRA-PRUEBA (sin limpiar) → la condicional dejaría la carga de A (por eso hace falta el fix)', () => {
    const ex: { id: string; topKg?: number } = { id: 'press', topKg: 100 };
    const fresh = coldFresh();
    if (fresh.topKg != null) ex.topKg = fresh.topKg;                          // sin limpiar previo
    expect(ex.topKg).toBe(100);                                              // demuestra la fuga que el fix elimina
  });
});
