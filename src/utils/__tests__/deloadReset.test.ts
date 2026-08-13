import { describe, it, expect } from 'vitest';
import { deloadCheck, inDeloadWeek } from '../workoutPlanner';
import { deriveMesocycleState } from '../mesocycle';
import { dayKey } from '../localDate';
import {
  coachDay, performAndFeedback, restDay, synthCheckin, newAthlete, freshState,
  type Profile, type SimState,
} from './sim/harness';
import type { CompletedSession } from '../../types';

// ── Unit · reset del bloque tras un deload ─────────────────────────────────────
const at = (daysAgo: number, deload = false): CompletedSession => ({
  date: dayKey(new Date(Date.now() - daysAgo * 86400000)),
  completedAtIso: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  modality: 'fuerza', exerciseIds: ['x'], durationSeconds: 3000, exercisesCompleted: 1, exercisesTotal: 1,
  ...(deload && { isDeload: true }),
});
const hardWeek = (w: number) => [at(w * 7 - 5), at(w * 7 - 3), at(w * 7 - 1)];
const deloadWeek = (w: number) => [at(w * 7 - 5, true), at(w * 7 - 3, true), at(w * 7 - 1, true)];

describe('DELOAD RESET · deloadCheck cuenta solo el bloque EN CURSO', () => {
  it('sin deloads: 4 semanas duras → weeksAccumulated 4 (igual que antes)', () => {
    const s = [...hardWeek(1), ...hardWeek(2), ...hardWeek(3), ...hardWeek(4)];
    expect(deloadCheck(s, []).weeksAccumulated).toBe(4);
  });

  it('una semana de DELOAD resetea el contador: weeks duras ANTES del deload no cuentan', () => {
    // semana 2 = deload; semana 1 = dura (bloque nuevo). Antes: contaría 1+deload+... perpetuo.
    const s = [...hardWeek(4), ...hardWeek(3), ...deloadWeek(2), ...hardWeek(1)];
    expect(deloadCheck(s, []).weeksAccumulated).toBe(1); // solo la semana 1 del bloque nuevo
  });

  it('entrenador EXTREMADAMENTE consistente ya NO acumula infinito si hubo un deload', () => {
    // 6 semanas duras seguidas + deload en semana 2 → tras el deload, solo cuenta la 1.
    const s = [
      ...hardWeek(7), ...hardWeek(6), ...hardWeek(5), ...hardWeek(4), ...hardWeek(3),
      ...deloadWeek(2), ...hardWeek(1),
    ];
    expect(deloadCheck(s, []).weeksAccumulated).toBe(1);
  });

  it('inDeloadWeek: dentro de los 7 días del inicio del deload → true; después → false', () => {
    // deload en curso (semana 1, arranca hace ~5 días)
    const enCurso = [...hardWeek(3), ...hardWeek(2), ...deloadWeek(1)];
    expect(inDeloadWeek(enCurso)).toBe(true);
    // deload terminado (semana 2) + semana 1 dura → fuera de la ventana
    const terminado = [...hardWeek(3), ...deloadWeek(2), ...hardWeek(1)];
    expect(inDeloadWeek(terminado)).toBe(false);
  });

  it('deload → siguiente bloque semana 1 → puede volver a progresar', () => {
    // Tras un deload completado, weeksAccumulated=0/1 → week 1-2 → acumulación (no deload) →
    // con buenas señales, progresión avanza.
    const s = [...deloadWeek(2), ...hardWeek(1)];
    const wa = deloadCheck(s, []).weeksAccumulated;
    const meso = deriveMesocycleState({ weeksAccumulated: wa, recovery: 'buena', adherence: 'alta', performance: 'sube', inDeloadWeek: inDeloadWeek(s) });
    expect(meso.deload).toBe(false);        // bloque nuevo, NO deload
    expect(meso.phase).not.toBe('deload');
    expect(meso.progression).toBe('avanzar'); // puede progresar de nuevo
  });

  it('inDeloadWeek fuerza la continuidad del deload aunque weeksAccumulated ya haya reseteado', () => {
    const s = [...hardWeek(3), ...hardWeek(2), ...deloadWeek(1)];
    const wa = deloadCheck(s, []).weeksAccumulated; // reseteado por el deload de la semana 1
    expect(wa).toBe(0);
    const meso = deriveMesocycleState({ weeksAccumulated: wa, recovery: 'media', adherence: 'alta', performance: 'estable', inDeloadWeek: inDeloadWeek(s) });
    expect(meso.deload).toBe(true); // la descarga se mantiene durante su semana
  });
});

// ── Longitudinal · entrenador consistente 12 semanas: NO deload perpetuo ───────
const CONSISTENT: Profile = { name: 'consistente', level: 'intermedio', goal: 'hipertrofia', daysPerWeek: 4, minutes: 60, equipment: 'gym', adherence: 1.0, adaptRate: 0.012, recoveryQuality: 0.85 };

function weeklyDeloadSequence(p: Profile, weeks: number, seed: number): boolean[] {
  const r = (() => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const hidden = newAthlete(p, r); const state: SimState = freshState();
  const tdays = [0, 2, 4, 6].slice(0, p.daysPerWeek);
  const seq: boolean[] = [];
  for (let w = 0; w < weeks; w++) {
    let weekDeload = false; let any = false;
    for (let d = 0; d < 7; d++) {
      const today = w * 7 + d;
      if (!tdays.includes(d)) { restDay(hidden, p); continue; }
      const day = coachDay(p, state, today, ['pecho', 'espalda', 'triceps'], synthCheckin(hidden, {}, r));
      if (day.meso.deload) weekDeload = true;
      performAndFeedback(p, hidden, state, today, day, r, {});
      any = true;
    }
    if (any) seq.push(weekDeload);
  }
  return seq;
}

// Cuenta PERIODOS de deload (rachas contiguas) — un deload de ~1 semana puede straddlear dos
// buckets calendario; lo que importa es cuántas DESCARGAS distintas hubo, no cuántos buckets.
const countDeloadPeriods = (seq: boolean[]) => seq.filter((d, i) => d && (i === 0 || !seq[i - 1])).length;

describe('DELOAD RESET · longitudinal (no perpetuo)', () => {
  it('consistente 12 semanas: descargas PERIÓDICAS y acotadas (no perpetuo)', () => {
    const seq = weeklyDeloadSequence(CONSISTENT, 12, 12345);
    const periods = countDeloadPeriods(seq);
    // Antes: la mitad del bloque en deload (perpetuo). Ahora: bloques de ~4-6 sem → ~2-3 descargas.
    expect(periods).toBeGreaterThan(0);
    expect(periods).toBeLessThanOrEqual(3);
    // y NUNCA está en deload más de ~2 buckets seguidos (una descarga de ~1 semana straddleada).
    let maxRun = 0, run = 0;
    for (const d of seq) { run = d ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it('consistente: SIEMPRE hay una semana NO-deload después de una de deload (reset real)', () => {
    const seq = weeklyDeloadSequence(CONSISTENT, 12, 999);
    let resetSeen = false;
    for (let i = 1; i < seq.length; i++) if (seq[i - 1] && !seq[i]) resetSeen = true; // deload → bloque nuevo
    expect(resetSeen).toBe(true);
  });

  it('adherencia irregular: no rompe (descargas siguen acotadas)', () => {
    const seq = weeklyDeloadSequence({ ...CONSISTENT, adherence: 0.6 }, 12, 4321);
    expect(countDeloadPeriods(seq)).toBeLessThanOrEqual(3);
  });
});
