import { describe, it, expect } from 'vitest';
import { formatCoachTrace, DECISION_HIERARCHY, type CoachTraceInput } from '../coachTrace';

const base: CoachTraceInput = {
  objective: 'hipertrofia', level: 'intermedio', equipment: ['gym'], hasLoadHistory: true,
  time: { total: 60, warmup: 8, main: 46, finisher: 6 },
  meso: { week: 4, phase: 'intensificacion', progression: 'avanzar', deload: false, volumeMultiplier: 1.15, recovery: 'buena', adherence: 'alta', performance: 'sube' },
  chronic: 'stable',
  readiness: { state: 'low', factors: ['durmió mal'], captured: true, dosingRecovery: 'mala' },
  targets: { pecho: { target: 14, min: 8, max: 20 }, gluteo: { target: 15, min: 8, max: 20 } },
  priorities: { gluteo: 'high' },
  doneThisWeek: { pecho: 4 },
  sessionsLeftInWeek: 2,
  allocation: { pecho: 5, gluteo: 6 },
  items: [
    { id: 'press-banca', muscle: 'pecho', category: 'main-compound', sets: 4, reps: '6-10', rest: 150, rir: 2, topKg: 92.5, backoffKg: 82.5 },
    { id: 'hip-thrust', muscle: 'gluteo', category: 'main-compound', sets: 4, reps: '8-12', rest: 90, rir: 2 },
  ],
  cutsByTime: ['aperturas: −1 serie por tiempo'],
  notes: ['prioridad activa: gluteo'],
};

describe('coachTrace — formato auditable', () => {
  it('produce líneas con todas las capas de la cadena P1–P6', () => {
    const out = formatCoachTrace(base).join('\n');
    expect(out).toContain('OBJETIVO: hipertrofia');
    expect(out).toContain('P1 MESOCICLO');
    expect(out).toContain('intensificacion');
    expect(out).toContain('P6 READINESS HOY: LOW');
    expect(out).toContain('P5 PRIORIDAD: gluteo:high');
    expect(out).toContain('P3 TARGET SEMANAL');
    expect(out).toContain('P4/P2 PRESCRIPCIÓN');
    expect(out).toContain('92.5kg top');
    expect(out).toContain('RECORTES POR TIEMPO');
  });

  it('sin check-in → marca readiness NORMAL sin inventar', () => {
    const out = formatCoachTrace({ ...base, readiness: { state: 'normal', factors: [], captured: false, dosingRecovery: 'media' } }).join('\n');
    expect(out).toContain('sin check-in → NORMAL');
  });

  it('bandas / peso corporal → indica carga por progresión, sin top-set', () => {
    const out = formatCoachTrace({ ...base, hasLoadHistory: false }).join('\n');
    expect(out).toContain('bandas/peso corporal');
    expect(out).toContain('carga por progresión (sin top-set)');
  });

  it('la jerarquía de decisiones está declarada y ordenada (seguridad primero)', () => {
    expect(DECISION_HIERARCHY[0]).toMatch(/Seguridad/i);
    expect(DECISION_HIERARCHY[DECISION_HIERARCHY.length - 1]).toMatch(/opcional/i);
  });
});
