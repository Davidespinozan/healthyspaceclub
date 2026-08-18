import { describe, it, expect } from 'vitest';
import { getExercises } from '../../data/exercises';
import { filterNoSupportsBank, isMatOnlyVariant } from '../../data/matOnly';
import { deriveCapabilities, type Gear } from '../equipmentImplement';
import { filterExercisesForWorkout, supportedSplitsForEquipment, hasPlayableVariant, selectVariantForEquipment, DAY_TYPE_CONFIG, type TrainingLevel } from '../workoutPlanner';
import { buildGroups } from '../supersetEngine';
import type { Exercise, Goal, MuscleGroup, WorkoutDayType, TrainingGoal } from '../../types';

// ────────────────────────────────────────────────────────────────────────────
// QA HARDENING — invariantes de producción sobre el banco + videos REALES.
// Recorre una matriz representativa (goal × gear × level × split) por la ruta
// determinista de selección y verifica los contratos duros que no pueden romperse.
// ────────────────────────────────────────────────────────────────────────────
const bankAll = getExercises('es');
const GEARS: [string, Gear[]][] = [
  ['gym', ['gym']], ['mancuernas', ['mancuernas']], ['barra', ['barra']],
  ['dominadas', ['dominadas']], ['bandas', ['ligas']], ['bodyweight', []], ['tapete', ['tapete']],
];
const SPLITS: WorkoutDayType[] = ['full-body', 'upper', 'lower', 'push', 'pull', 'legs'];
const LEVELS: TrainingLevel[] = ['principiante', 'intermedio', 'avanzado'];
const GOALS: Goal[] = ['hipertrofia', 'fuerza'];

function poolFor(gear: Gear[], goal: Goal, level: TrainingLevel, split: WorkoutDayType) {
  const caps = deriveCapabilities(gear);
  const bank = caps.noSupport ? filterNoSupportsBank(bankAll) : bankAll;
  const mg = DAY_TYPE_CONFIG[split].muscleGroups as MuscleGroup[];
  const pool = filterExercisesForWorkout({ exercises: bank, equipment: caps.equipmentList, muscleGroups: mg, goal, difficulty: level, allowedImplements: caps.allowedImplements });
  return { caps, pool };
}

describe('QA · invariantes duros de producción (banco + video reales)', () => {
  it('VIDEO GATE: ningún candidato de ningún pool carece de video reproducible', () => {
    const bad: string[] = [];
    for (const goal of GOALS) for (const [gl, gear] of GEARS) for (const level of LEVELS) for (const split of SPLITS) {
      const { caps, pool } = poolFor(gear, goal, level, split);
      for (const e of pool) if (!hasPlayableVariant(e, caps.equipmentList, caps.allowedImplements)) bad.push(`${gl}/${goal}/${level}/${split}:${e.id}`);
    }
    expect(bad, bad.slice(0, 10).join(', ')).toEqual([]);
  });

  it('SOLO TAPETE: 100% de las variantes seleccionadas son matOnly (cero infraestructura)', () => {
    const caps = deriveCapabilities(['tapete']);
    const leaks: string[] = [];
    for (const goal of GOALS) for (const level of LEVELS) for (const split of SPLITS) {
      const { pool } = poolFor(['tapete'], goal, level, split);
      for (const e of pool) { const v = selectVariantForEquipment(e, caps.equipmentList, caps.allowedImplements); if (v && !isMatOnlyVariant(v)) leaks.push(`${e.id}→${v.id}`); }
    }
    expect(leaks, leaks.join(', ')).toEqual([]);
  });

  it('SUPERSETS: en toda la matriz no se forma ni un solo grupo BAD', () => {
    let bad = 0; const ex: string[] = [];
    for (const goal of GOALS) for (const [gl, gear] of GEARS) for (const level of LEVELS) for (const split of SPLITS) {
      const { pool } = poolFor(gear, goal, level, split);
      if (pool.length < 4) continue;
      const sel = pool.slice(0, Math.min(8, pool.length));
      const trainingGoal: TrainingGoal = goal === 'fuerza' ? 'fuerza' : 'hipertrofia';
      const grp = buildGroups(sel.map(e => e.id), new Map(sel.map(e => [e.id, e])) as Map<string, Exercise>, { trainingGoal, timeMinutes: 45, phase: 'accumulation' as never, level });
      for (const g of grp.trace) if (g.quality === 'bad') { bad++; if (ex.length < 8) ex.push(`${gl}/${split}: ${g.ids.join('+')}`); }
    }
    expect(bad, ex.join(' | ')).toBe(0);
  });

  it('CAPABILITY split honesta: los splits que la UI degrada (tapete pull/lower) NO figuran como soportados', () => {
    const caps = deriveCapabilities(['tapete']);
    const bank = filterNoSupportsBank(bankAll);
    const supported = new Set(supportedSplitsForEquipment({ exercises: bank, equipment: caps.equipmentList, allowedImplements: caps.allowedImplements, goal: 'hipertrofia' }));
    // Solo Tapete no puede sostener un PULL real (sin barra) → no debe declararse soportado.
    expect(supported.has('pull')).toBe(false);
    // full-body sí (es lo que la degradación entrega).
    expect(supported.has('full-body')).toBe(true);
  });

  it('CAPABILITY gear: gym/bandas sostienen los 6 splits; bodyweight NO sostiene pull', () => {
    const gymSup = new Set(supportedSplitsForEquipment({ exercises: bankAll, equipment: ['gym'], goal: 'hipertrofia' }));
    for (const s of SPLITS) expect(gymSup.has(s), `gym debería soportar ${s}`).toBe(true);
    const bwSup = new Set(supportedSplitsForEquipment({ exercises: bankAll, equipment: ['cuerpo'], goal: 'hipertrofia' }));
    expect(bwSup.has('pull'), 'bodyweight NO puede sostener pull real (sin barra)').toBe(false);
    expect(bwSup.has('full-body')).toBe(true);
  });
});
