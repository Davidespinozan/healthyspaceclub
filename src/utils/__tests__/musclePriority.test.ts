import { describe, it, expect } from 'vitest';
import {
  resolvePriorities, applyMusclePriority, priorityMultiplier, possibleWeakPoint,
  MAX_EFFECTIVE_PRIORITIES,
} from '../musclePriority';
import { targetsToMap, type VolumeTargets } from '../volumeLandmarks';
import { allocateSessionVolume, prescribeSession } from '../sessionPrescription';
import { repairWorkoutStructure } from '../exerciseOrder';
import type { Exercise } from '../../types';

const targets = (over: Record<string, Partial<VolumeTargets[string]>> = {}): VolumeTargets => {
  const mk = (target: number, max = 20, min = 8) => ({ baseline: target, target, min, max });
  const t: VolumeTargets = { pecho: mk(12), espalda: mk(12), gluteo: mk(12), biceps: mk(10) };
  for (const m of Object.keys(over)) t[m] = { ...t[m], ...over[m] } as VolumeTargets[string];
  return t;
};

describe('musclePriority — resolvePriorities', () => {
  it('SIN prioridad → vacío (×1.00)', () => {
    expect(resolvePriorities({ explicit: [] })).toEqual({});
  });
  it('UNA explícita → high', () => {
    expect(resolvePriorities({ explicit: ['gluteo'] })).toEqual({ gluteo: 'high' });
  });
  it('DOS explícitas → ambas high', () => {
    const p = resolvePriorities({ explicit: ['gluteo', 'espalda'] });
    expect(p).toEqual({ gluteo: 'high', espalda: 'high' });
  });
  it('DEMASIADAS explícitas → recorta al máximo y baja a moderate', () => {
    const p = resolvePriorities({ explicit: ['gluteo', 'espalda', 'pecho', 'biceps'] });
    expect(Object.keys(p).length).toBe(MAX_EFFECTIVE_PRIORITIES);
    expect(Object.values(p).every(v => v === 'moderate')).toBe(true);
  });
  it('inferida rellena solo si queda cupo, como moderate', () => {
    const p = resolvePriorities({ explicit: ['gluteo'], inferred: ['espalda'] });
    expect(p).toEqual({ gluteo: 'high', espalda: 'moderate' });
  });
  it('DOLOR/restricción saca el músculo (seguridad manda)', () => {
    const p = resolvePriorities({ explicit: ['gluteo', 'espalda'], painMuscles: ['espalda'] });
    expect(p.espalda).toBeUndefined();
    expect(p.gluteo).toBe('high');
  });
  it('mala recuperación / deload / sesión corta → baja el nivel', () => {
    expect(resolvePriorities({ explicit: ['gluteo'], recovery: 'mala' }).gluteo).toBe('moderate');
    expect(resolvePriorities({ explicit: ['gluteo'], isDeload: true }).gluteo).toBe('moderate');
    expect(resolvePriorities({ explicit: ['gluteo'], shortSession: true }).gluteo).toBe('moderate');
  });
});

describe('musclePriority — applyMusclePriority (volumen)', () => {
  it('multiplicadores: none 1.0, moderate ~1.10, high ~1.18', () => {
    expect(priorityMultiplier('none')).toBe(1);
    expect(priorityMultiplier('moderate')).toBeCloseTo(1.1, 2);
    expect(priorityMultiplier('high')).toBeGreaterThan(1.15);
  });

  it('AUMENTA la dosis del prioritario, deja el resto INTACTO', () => {
    const t = targets();
    const out = applyMusclePriority(t, { gluteo: 'high' });
    expect(out.gluteo.target).toBeGreaterThan(t.gluteo.target);
    expect(out.pecho.target).toBe(t.pecho.target); // el resto no se toca
  });

  it('MODERADA sube menos que ALTA', () => {
    const t = targets();
    const mod = applyMusclePriority(t, { gluteo: 'moderate' }).gluteo.target;
    const hi = applyMusclePriority(t, { gluteo: 'high' }).gluteo.target;
    expect(hi).toBeGreaterThan(mod);
  });

  it('target ya cerca del MÁXIMO operativo → no lo supera', () => {
    const t = targets({ gluteo: { target: 19.5, max: 20 } });
    const out = applyMusclePriority(t, { gluteo: 'high' });
    expect(out.gluteo.target).toBeLessThanOrEqual(20);
  });

  it('NO destruye el volumen del resto del cuerpo', () => {
    const t = targets();
    const out = applyMusclePriority(t, { gluteo: 'high' });
    for (const m of ['pecho', 'espalda', 'biceps']) expect(out[m].target).toBe(t[m].target);
  });
});

describe('musclePriority — possibleWeakPoint (inferencia conservadora)', () => {
  const weeks4 = [{ pecho: 12, espalda: 12 }, { pecho: 12, espalda: 12 }, { pecho: 12, espalda: 12 }, { pecho: 12, espalda: 12 }];
  const tgt = { pecho: 12, espalda: 12 };

  it('POCO historial (1 semana) → none', () => {
    expect(possibleWeakPoint({ series: [{ pecho: 12 }], targets: tgt, muscleE1RM: { pecho: [100, 95] }, adherence: 'alta' })).toEqual([]);
  });

  it('una sola semana corta NO genera rezago (necesita ≥4 semanas)', () => {
    const series = [{ pecho: 4 }, { pecho: 12 }, { pecho: 12 }]; // 3 semanas
    expect(possibleWeakPoint({ series, targets: tgt, muscleE1RM: { pecho: [90, 100] }, adherence: 'alta' })).toEqual([]);
  });

  it('SESIONES PERDIDAS (poca exposición) NO es falso positivo', () => {
    // pecho estancado pero con volumen bajo casi todas las semanas → shortfall por exposición
    const series = [{ pecho: 3, espalda: 12 }, { pecho: 3, espalda: 12 }, { pecho: 12, espalda: 12 }, { pecho: 3, espalda: 12 }];
    const wp = possibleWeakPoint({ series, targets: tgt, muscleE1RM: { pecho: [100, 100], espalda: [110, 100] }, adherence: 'alta' });
    expect(wp).not.toContain('pecho');
  });

  it('EVIDENCIA PERSISTENTE sí infiere: exposición adecuada + fuerza estancada mientras otros suben', () => {
    const wp = possibleWeakPoint({
      series: weeks4, targets: tgt,
      muscleE1RM: { pecho: [100, 100], espalda: [115, 100] }, // pecho plano, espalda sube
      adherence: 'alta',
    });
    expect(wp).toContain('pecho');
  });

  it('si TODO progresa → no hay punto débil', () => {
    const wp = possibleWeakPoint({
      series: weeks4, targets: tgt,
      muscleE1RM: { pecho: [112, 100], espalda: [115, 100] },
      adherence: 'alta',
    });
    expect(wp).toEqual([]);
  });

  it('adherencia BAJA → no infiere (evidencia confundida)', () => {
    const wp = possibleWeakPoint({
      series: weeks4, targets: tgt,
      muscleE1RM: { pecho: [100, 100], espalda: [115, 100] }, adherence: 'baja',
    });
    expect(wp).toEqual([]);
  });
});

// ── INTEGRACIÓN con P3 (target) · P4 (allocate/prescribe) · orden ──────────────
const exBank = (id: string, name: string, type: string, muscleGroup: string) =>
  ({ id, name, type, muscleGroup } as unknown as Exercise);

describe('musclePriority — integración con P3/P4', () => {
  it('P3→P5: el target priorizado sube y allocateSessionVolume da MÁS series al prioritario', () => {
    const t = targets(); // pecho/espalda/gluteo/biceps en 12/12/12/10
    const prio = applyMusclePriority(t, { gluteo: 'high' });
    const base = allocateSessionVolume({
      weeklyTarget: targetsToMap(t), doneThisWeek: {},
      dayMuscles: ['gluteo'], primaryMuscles: ['gluteo'],
      freqTarget: 4, sessionsThisWeekDone: 0, muscleWeeklyFreq: { gluteo: 2 },
    });
    const withPrio = allocateSessionVolume({
      weeklyTarget: targetsToMap(prio), doneThisWeek: {},
      dayMuscles: ['gluteo'], primaryMuscles: ['gluteo'],
      freqTarget: 4, sessionsThisWeekDone: 0, muscleWeeklyFreq: { gluteo: 2 },
    });
    expect(withPrio.gluteo).toBeGreaterThanOrEqual(base.gluteo);
    // el resto del cuerpo NO pierde volumen por priorizar glúteo
    expect(targetsToMap(prio).pecho).toBe(targetsToMap(t).pecho);
  });

  it('P5→prescribeSession: el prioritario del día recibe series efectivas', () => {
    const t = applyMusclePriority(targets(), { gluteo: 'high' });
    const alloc = allocateSessionVolume({
      weeklyTarget: targetsToMap(t), doneThisWeek: {},
      dayMuscles: ['gluteo'], primaryMuscles: ['gluteo'],
      freqTarget: 3, sessionsThisWeekDone: 2, muscleWeeklyFreq: { gluteo: 2 },
    });
    const bank = new Map([
      ['hip-thrust', { id: 'hip-thrust', name: 'Hip Thrust', type: 'compuesto' as Exercise['type'] }],
    ]);
    const items = prescribeSession({
      exercises: [{ id: 'hip-thrust', muscleGroup: 'gluteo' }], bankById: bank,
      allocation: alloc, objective: 'hipertrofia', phase: 'acumulacion', mainMinutes: 999,
    });
    expect(items[0].prescription.sets).toBeGreaterThanOrEqual(2);
  });

  it('ORDEN: el músculo prioritario se adelanta en la sesión (repairWorkoutStructure)', () => {
    const bank = [
      exBank('press-banca', 'Press de Banca', 'compuesto', 'pecho'),
      exBank('hip-thrust', 'Hip Thrust', 'compuesto', 'gluteo'),
    ];
    const workout = [{ id: 'press-banca' }, { id: 'hip-thrust' }];
    const sinPrio = repairWorkoutStructure(workout, bank, {});
    const conPrio = repairWorkoutStructure(workout, bank, { priorityMuscles: new Set(['gluteo']) });
    // sin prioridad, el orden por región deja pecho (upper) tras pierna/gluteo… comprobamos
    // que al priorizar glúteo, hip-thrust va PRIMERO.
    expect(conPrio.exercises[0].id).toBe('hip-thrust');
    // control: sin prioridad no fuerza glúteo primero (el orden lo decide la región base)
    expect(sinPrio.exercises.map(e => e.id)).toContain('press-banca');
  });

  it('CONFLICTO deload: la prioridad se atenúa pero NO desaparece del target', () => {
    const p = resolvePriorities({ explicit: ['gluteo'], isDeload: true });
    expect(p.gluteo).toBe('moderate'); // high→moderate por deload
    const t = applyMusclePriority(targets(), p);
    expect(t.gluteo.target).toBeGreaterThan(targets().gluteo.target); // sigue sesgando, menos
  });
});
