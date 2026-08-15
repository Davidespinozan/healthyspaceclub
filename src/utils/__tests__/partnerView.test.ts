import { describe, it, expect } from 'vitest';
import { isPartnerBDevice, partnerExerciseView } from '../partnerView';

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
