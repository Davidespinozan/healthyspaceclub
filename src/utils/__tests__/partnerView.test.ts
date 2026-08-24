import { describe, it, expect } from 'vitest';
import { isPartnerBDevice, partnerExerciseView, deriveBLoads, type PartnerExercise } from '../partnerView';

// ────────────────────────────────────────────────────────────────────────────
// REGRESIÓN — BUG: en dos dispositivos conectados, la persona B veía las reps de A.
// Fix: `ownerId` estampado en el workout → identidad estable; B recibe repsB/tipB.
// ────────────────────────────────────────────────────────────────────────────
const A = 'user-A', B = 'user-B';
const ex = { id: 'press-horizontal', sets: 3, reps: '8-10', repsB: '10-12', tip_personalizado: 'cue A', tipB: 'cue B', rest: 90 };

describe('Partner · identidad A/B estable (por ownerId, no heurística)', () => {
  it('device del OWNER (A): myId === ownerId → NO es partner B', () => {
    expect(isPartnerBDevice(A, A, true)).toBe(false);
  });
  it('device del COMPAÑERO (B): myId !== ownerId → SÍ es partner B', () => {
    expect(isPartnerBDevice(B, A, true)).toBe(true);
  });
  it('sin partnerMode: nunca es partner B (flujo individual intacto)', () => {
    expect(isPartnerBDevice(B, A, false)).toBe(false);
    expect(isPartnerBDevice(A, A, false)).toBe(false);
  });
  it('estable entre recargas: mismo (myId, ownerId) → mismo resultado', () => {
    expect(isPartnerBDevice(B, A, true)).toBe(isPartnerBDevice(B, A, true));
  });
});

describe('Partner · cada persona ve/ejecuta/loguea SU prescripción', () => {
  it('A (owner) ve reps de A (sin cambios)', () => {
    const v = partnerExerciseView(ex, false);
    expect(v.reps).toBe('8-10');
    expect(v.tip_personalizado).toBe('cue A');
  });
  it('B (partner) ve reps de B: repsB→reps, tipB→tip', () => {
    const v = partnerExerciseView(ex, true);
    expect(v.reps).toBe('10-12');            // ← B ya NO ve 8-10 de A
    expect(v.tip_personalizado).toBe('cue B');
  });
  it('B sin repsB (la IA no diferenció): cae a reps compartidas (sin romper)', () => {
    const shared = { id: 'x', sets: 3, reps: '8-10', rest: 90 };
    expect(partnerExerciseView(shared, true).reps).toBe('8-10');
  });
  it('la vista de B es la autoridad para logging (el array transformado alimenta el payload)', () => {
    // el player transforma `exercises` para B → data.exercises[i].reps = repsB → history de B con repsB
    const executedForB = [ex].map(e => partnerExerciseView(e, true));
    expect(executedForB[0].reps).toBe('10-12');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SHARED-1 · Gate B-1 — CARGA prescrita POR PERSONA (topKgB), derivada del propio
// historial de B (lookup, no fórmula). Antes B heredaba topKg de A.
// ────────────────────────────────────────────────────────────────────────────
const exL: PartnerExercise & { id: string } = { id: 'sentadilla', reps: '8-10', repsB: '8-10', topKg: 100, deloadKg: 60, backoffKg: 80 };

describe('SHARED-1 · partnerExerciseView mapea la carga de B (topKgB→topKg) cuando existe', () => {
  it('A (owner) ve SU carga prescrita (topKg de A, sin cambios)', () => {
    const v = partnerExerciseView({ ...exL, topKgB: 70 }, false);
    expect(v.topKg).toBe(100);
    expect(v.deloadKg).toBe(60);
    expect(v.backoffKg).toBe(80);
  });
  it('B ve SU carga: topKgB/deloadKgB/backoffKgB → topKg/deloadKg/backoffKg', () => {
    const v = partnerExerciseView({ ...exL, topKgB: 70, deloadKgB: 42, backoffKgB: 56 }, true);
    expect(v.topKg).toBe(70);        // ← B ya NO hereda 100 de A
    expect(v.deloadKg).toBe(42);
    expect(v.backoffKg).toBe(56);
  });
  it('B sin carga B (histórico ausente): fallback SEGURO a la carga de A (comportamiento previo)', () => {
    const v = partnerExerciseView(exL, true); // sin *B
    expect(v.topKg).toBe(100);
    expect(v.deloadKg).toBe(60);
    expect(v.backoffKg).toBe(80);
  });
  it('A y B ven cargas DISTINTAS de la misma fila compartida', () => {
    const row = { ...exL, topKgB: 70, deloadKgB: 42, backoffKgB: 56 };
    expect(partnerExerciseView(row, false).topKg).toBe(100);
    expect(partnerExerciseView(row, true).topKg).toBe(70);
  });
});

describe('SHARED-1 · deriveBLoads — estampa topKgB del propio historial de B (puro)', () => {
  it('con historial: estampa topKgB y escala deload/backoff proporcionalmente (regla de tres, redondeo 2.5)', () => {
    const [out] = deriveBLoads([exL], () => 50); // B levantó 50 (mitad de A)
    expect(out.topKgB).toBe(50);
    expect(out.deloadKgB).toBe(30); // 60 * 0.5 = 30
    expect(out.backoffKgB).toBe(40); // 80 * 0.5 = 40
  });
  it('redondea la escala al múltiplo de 2.5 más cercano', () => {
    const [out] = deriveBLoads([{ ...exL, topKg: 100, deloadKg: 61 }], () => 55); // ratio 0.55 → 61*0.55=33.55 → 32.5
    expect(out.deloadKgB).toBe(32.5);
  });
  it('sin historial (null): NO estampa carga B → hereda la de A (fallback)', () => {
    const [out] = deriveBLoads([exL], () => null);
    expect(out.topKgB).toBeUndefined();
    expect(partnerExerciseView(out, true).topKg).toBe(100); // hereda A
  });
  it('historial 0 o negativo: tratado como sin historial (no estampa)', () => {
    expect(deriveBLoads([exL], () => 0)[0].topKgB).toBeUndefined();
    expect(deriveBLoads([exL], () => -5)[0].topKgB).toBeUndefined();
  });
  it('es puro: no muta el ejercicio de entrada', () => {
    const input = { ...exL };
    const snapshot = JSON.stringify(input);
    deriveBLoads([input], () => 50);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
  it('A no trae topKg (sin base): estampa topKgB pero NO inventa deload/backoff', () => {
    const base: PartnerExercise & { id: string } = { id: 'x', reps: '8', repsB: '8' };
    const [out] = deriveBLoads([base], () => 40);
    expect(out.topKgB).toBe(40);
    expect(out.deloadKgB).toBeUndefined();
    expect(out.backoffKgB).toBeUndefined();
  });
});
