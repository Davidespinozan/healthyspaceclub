import { describe, it, expect } from 'vitest';
import CODE from '../nutritionTrajectory.ts?raw';
import {
  assessTrajectory,
  requiredWindowDays,
  DAYS_PER_MONTH,
  DIRECTION_STABLE_BAND_PCT,
  FAT_LOSS_MIN_WINDOW_DAYS,
  BODY_MIN_WINDOW_DAYS,
  MUSCLE_GAIN_TARGET_KG_PER_MONTH,
  type TrajectoryInput,
  type TrajectoryResult,
  type MuscleGainExperienceLevel,
} from '../nutritionTrajectory';

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive Nutrition · Microbloque 1 · Trajectory Engine (puro, sin decisión de kcal)
// ─────────────────────────────────────────────────────────────────────────────

const run = (over: Partial<TrajectoryInput>): TrajectoryResult =>
  assessTrajectory({ objective: 'FAT_LOSS', previousWeightKg: 70, currentWeightKg: 70, elapsed: { elapsedDays: 14 }, ...over });

/** Exige una evaluación SUFFICIENT_FOR_DECISION y devuelve su clasificación. */
function decided(r: TrajectoryResult) {
  if (r.status !== 'ASSESSED' || r.sufficiency !== 'SUFFICIENT_FOR_DECISION') throw new Error(`no evaluable: ${JSON.stringify(r)}`);
  return r;
}
const cls = (r: TrajectoryResult) => decided(r).classification as Record<string, unknown>;

describe('FAT_LOSS · ritmo de pérdida (% del peso por semana, como magnitud de pérdida)', () => {
  const fl = (curr: number, days = 14) => run({ objective: 'FAT_LOSS', previousWeightKg: 70, currentWeightKg: curr, elapsed: { elapsedDays: days } });

  it('70 → 69.3 en 2 semanas = 0.5 %/sem → ON_TARGET (frontera inferior inclusiva)', () => {
    expect(cls(fl(69.3))).toEqual({ objective: 'FAT_LOSS', lossPercentPerWeek: 0.5, rate: 'ON_TARGET' });
    expect(decided(fl(69.3)).metrics.direction).toBe('DOWN');
  });
  it('70 → 69.65 en 2 semanas = 0.25 %/sem → BORDERLINE_SLOW (frontera inclusiva; no implica recorte)', () => {
    expect(cls(fl(69.65))).toMatchObject({ lossPercentPerWeek: 0.25, rate: 'BORDERLINE_SLOW' });
  });
  it('70 → 69.8 en 2 semanas ≈ 0.143 %/sem → VERY_SLOW', () => {
    expect(cls(fl(69.8))).toMatchObject({ lossPercentPerWeek: 0.142857, rate: 'VERY_SLOW' });
  });
  it('70 → 68.4 en 2 semanas ≈ 1.143 %/sem → FAST', () => {
    expect(cls(fl(68.4))).toMatchObject({ lossPercentPerWeek: 1.142857, rate: 'FAST' });
  });
  it('70 → 69.3 en 1 semana = 1.0 %/sem → ON_TARGET (frontera superior inclusiva) … pero 1 semana es ventana corta', () => {
    const r = fl(69.3, 7);
    expect(r).toMatchObject({ status: 'ASSESSED', sufficiency: 'INSUFFICIENT_WINDOW', requiredWindowDays: FAT_LOSS_MIN_WINDOW_DAYS });
    // la métrica se calcula igual; solo no se clasifica
    expect(r.status === 'ASSESSED' && r.metrics?.percentChangePerWeek).toBe(-1);
  });
  it('70 → 68.6 en 2 semanas = 1.0 %/sem exacto → ON_TARGET', () => {
    expect(cls(fl(68.6))).toMatchObject({ lossPercentPerWeek: 1, rate: 'ON_TARGET' });
  });
  it('ganancia accidental: 70 → 70.4 → VERY_SLOW, dirección UP, pérdida negativa', () => {
    const r = decided(fl(70.4));
    expect(r.metrics.direction).toBe('UP');
    expect(r.metrics.absoluteChangeKg).toBe(0.4);
    expect(r.classification).toMatchObject({ rate: 'VERY_SLOW', lossPercentPerWeek: -0.285714 });
  });
  it('sin cambio: dirección STABLE, VERY_SLOW', () => {
    const r = decided(fl(70));
    expect(r.metrics.direction).toBe('STABLE');
    expect(r.classification).toMatchObject({ rate: 'VERY_SLOW', lossPercentPerWeek: 0 });
  });
  it('ventana insuficiente: 12 días no basta; 13 días (check-in adelantado) sí', () => {
    expect(fl(69.3, 12)).toMatchObject({ sufficiency: 'INSUFFICIENT_WINDOW' });
    expect(fl(69.3, 13)).toMatchObject({ sufficiency: 'SUFFICIENT_FOR_DECISION' });
  });
  it('con fechas reales alineadas a domingo (2026-10-04 → 2026-10-18 = 14 días)', () => {
    const r = decided(run({ previousWeightKg: 70, currentWeightKg: 69.3, elapsed: { previousDate: '2026-10-04', currentDate: '2026-10-18' } }));
    expect(r.metrics.elapsedDays).toBe(14);
    expect(r.metrics.evaluationWindowWeeks).toBe(2);
    expect(r.classification).toMatchObject({ rate: 'ON_TARGET' });
  });
});

describe('MUSCLE_GAIN · kg/mes por nivel (ventana principal 4 semanas)', () => {
  const mg = (level: MuscleGainExperienceLevel | null | undefined, change: number, days = 28) =>
    run({ objective: 'MUSCLE_GAIN', previousWeightKg: 75, currentWeightKg: 75 + change, elapsed: { elapsedDays: days }, experienceLevel: level });

  // 28 días → kg/mes = cambio × 30.4375 / 28
  const CASES: [MuscleGainExperienceLevel, number, number, number][] = [
    //            below  on    above   (cambio en kg a 28 días)
    ['BEGINNER', 0.3, 0.6, 0.9],
    ['INTERMEDIATE', 0.2, 0.4, 0.7],
    ['ADVANCED', 0.1, 0.25, 0.45],
  ];
  describe.each(CASES)('%s', (level, below, on, above) => {
    it('below → BELOW_TARGET', () => expect(cls(mg(level, below))).toMatchObject({ rate: 'BELOW_TARGET', experienceLevel: level }));
    it('on target → ON_TARGET', () => expect(cls(mg(level, on))).toMatchObject({ rate: 'ON_TARGET' }));
    it('above → ABOVE_TARGET', () => expect(cls(mg(level, above))).toMatchObject({ rate: 'ABOVE_TARGET' }));
    it('ventana < 4 semanas (21 días) → INSUFFICIENT_WINDOW, sin decidir con el peso a 2 semanas', () => {
      expect(mg(level, on, 21)).toMatchObject({ sufficiency: 'INSUFFICIENT_WINDOW', requiredWindowDays: BODY_MIN_WINDOW_DAYS });
      expect(mg(level, on, 14)).toMatchObject({ sufficiency: 'INSUFFICIENT_WINDOW' });
    });
    it('trae el rango cerrado del nivel', () => {
      expect(cls(mg(level, on))).toMatchObject({ targetKgPerMonth: MUSCLE_GAIN_TARGET_KG_PER_MONTH[level] });
    });
  });

  it('rangos cerrados por nivel', () => {
    expect(MUSCLE_GAIN_TARGET_KG_PER_MONTH).toEqual({
      BEGINNER: { min: 0.5, max: 0.8 }, INTERMEDIATE: { min: 0.3, max: 0.6 }, ADVANCED: { min: 0.15, max: 0.4 },
    });
  });
  it('fronteras inclusivas: exactamente min y max por mes → ON_TARGET', () => {
    for (const [level, { min, max }] of Object.entries(MUSCLE_GAIN_TARGET_KG_PER_MONTH)) {
      for (const v of [min, max]) {
        const r = mg(level as MuscleGainExperienceLevel, v, DAYS_PER_MONTH);
        expect(cls(r), `${level} ${v}`).toMatchObject({ gainKgPerMonth: v, rate: 'ON_TARGET' });
      }
    }
  });
  it('nivel ausente → INSUFFICIENT_DATA (sin fallback), aunque calcula las métricas', () => {
    for (const lvl of [null, undefined]) {
      const r = mg(lvl, 0.5);
      expect(r).toMatchObject({ status: 'ASSESSED', sufficiency: 'INSUFFICIENT_DATA', missing: 'EXPERIENCE_LEVEL' });
      expect(r.status === 'ASSESSED' && r.metrics?.absoluteChangeKg).toBe(0.5);
    }
  });
  it('nivel desconocido (p. ej. la etiqueta de Training) → INVALID_INPUT, no se traduce aquí', () => {
    expect(mg('principiante' as never, 0.5)).toEqual({ status: 'INVALID_INPUT', reason: 'UNKNOWN_EXPERIENCE_LEVEL' });
  });
});

describe('RECOMPOSITION · solo estabilidad del peso (no éxito/fracaso)', () => {
  const rc = (perMonth: number, days = DAYS_PER_MONTH) =>
    run({ objective: 'RECOMPOSITION', previousWeightKg: 80, currentWeightKg: 80 + perMonth * (days / DAYS_PER_MONTH), elapsed: { elapsedDays: days } });

  it('−0.4 kg/mes → RELATIVELY_STABLE', () => expect(cls(rc(-0.4))).toEqual({ objective: 'RECOMPOSITION', changeKgPerMonth: -0.4, weight: 'RELATIVELY_STABLE' }));
  it('0 kg → RELATIVELY_STABLE', () => expect(cls(rc(0))).toMatchObject({ changeKgPerMonth: 0, weight: 'RELATIVELY_STABLE' }));
  it('+0.4 kg/mes → RELATIVELY_STABLE', () => expect(cls(rc(0.4))).toMatchObject({ weight: 'RELATIVELY_STABLE' }));
  it('±0.5 kg/mes exacto → RELATIVELY_STABLE (frontera inclusiva)', () => {
    expect(cls(rc(-0.5))).toMatchObject({ weight: 'RELATIVELY_STABLE' });
    expect(cls(rc(0.5))).toMatchObject({ weight: 'RELATIVELY_STABLE' });
  });
  it('fuera de ±0.5 kg/mes → DOWN / UP', () => {
    expect(cls(rc(-0.8))).toMatchObject({ weight: 'DOWN' });
    expect(cls(rc(0.8))).toMatchObject({ weight: 'UP' });
  });
  it('con 28 días también normaliza a kg/mes', () => {
    const r = decided(run({ objective: 'RECOMPOSITION', previousWeightKg: 80, currentWeightKg: 80.4, elapsed: { elapsedDays: 28 } }));
    expect(r.metrics.changeKgPerMonth).toBeCloseTo(0.4 * DAYS_PER_MONTH / 28, 6);
    expect(r.classification).toMatchObject({ weight: 'RELATIVELY_STABLE' });
  });
  it('la clasificación no tiene campo de éxito: solo peso', () => {
    expect(Object.keys(cls(rc(0))).sort()).toEqual(['changeKgPerMonth', 'objective', 'weight']);
  });
  it('ventana insuficiente (14 días)', () => expect(rc(0.2, 14)).toMatchObject({ sufficiency: 'INSUFFICIENT_WINDOW' }));
});

describe('MAINTENANCE · banda ±1 % del peso anterior', () => {
  const mt = (curr: number, days = 28) => run({ objective: 'MAINTENANCE', previousWeightKg: 70, currentWeightKg: curr, elapsed: { elapsedDays: days } });

  it('dentro de ±1 %', () => expect(cls(mt(70.5))).toEqual({ objective: 'MAINTENANCE', percentChangeFromBaseline: 0.714286, band: 'WITHIN_MAINTENANCE_BAND' }));
  it('por debajo', () => expect(cls(mt(69))).toMatchObject({ band: 'BELOW_MAINTENANCE_BAND' }));
  it('por arriba', () => expect(cls(mt(71))).toMatchObject({ band: 'ABOVE_MAINTENANCE_BAND' }));
  it('frontera exacta ±1 % → WITHIN (inclusiva)', () => {
    expect(cls(mt(70.7))).toMatchObject({ percentChangeFromBaseline: 1, band: 'WITHIN_MAINTENANCE_BAND' });
    expect(cls(mt(69.3))).toMatchObject({ percentChangeFromBaseline: -1, band: 'WITHIN_MAINTENANCE_BAND' });
  });
  it('ventana insuficiente (21 días)', () => expect(mt(70.5, 21)).toMatchObject({ sufficiency: 'INSUFFICIENT_WINDOW' }));
});

describe('GENERALES · entradas inválidas o incompletas, sin fallback silencioso', () => {
  it('peso ≤ 0, NaN o infinito → INVALID_WEIGHT (anterior o actual)', () => {
    for (const bad of [0, -5, NaN, Infinity, '70' as never]) {
      expect(run({ previousWeightKg: bad })).toEqual({ status: 'INVALID_INPUT', reason: 'INVALID_WEIGHT' });
      expect(run({ currentWeightKg: bad })).toEqual({ status: 'INVALID_INPUT', reason: 'INVALID_WEIGHT' });
    }
  });
  it('peso faltante → INSUFFICIENT_DATA sin métricas', () => {
    expect(run({ previousWeightKg: null })).toEqual({ status: 'ASSESSED', sufficiency: 'INSUFFICIENT_DATA', objective: 'FAT_LOSS', missing: 'PREVIOUS_WEIGHT', metrics: null });
    expect(run({ currentWeightKg: undefined })).toMatchObject({ sufficiency: 'INSUFFICIENT_DATA', missing: 'CURRENT_WEIGHT', metrics: null });
  });
  it('fecha actual ≤ anterior → NON_CHRONOLOGICAL_DATES', () => {
    expect(run({ elapsed: { previousDate: '2026-10-18', currentDate: '2026-10-18' } })).toEqual({ status: 'INVALID_INPUT', reason: 'NON_CHRONOLOGICAL_DATES' });
    expect(run({ elapsed: { previousDate: '2026-10-18', currentDate: '2026-10-04' } })).toEqual({ status: 'INVALID_INPUT', reason: 'NON_CHRONOLOGICAL_DATES' });
    expect(run({ elapsed: { elapsedDays: 0 } })).toEqual({ status: 'INVALID_INPUT', reason: 'NON_CHRONOLOGICAL_DATES' });
    expect(run({ elapsed: { elapsedDays: -7 } })).toEqual({ status: 'INVALID_INPUT', reason: 'NON_CHRONOLOGICAL_DATES' });
  });
  it('fechas mal formadas o inexistentes → INVALID_DATE', () => {
    for (const [a, b] of [['2026-02-30', '2026-03-15'], ['2026/10/04', '2026-10-18'], ['', '2026-10-18'], ['2026-10-04', 'hoy']]) {
      expect(run({ elapsed: { previousDate: a, currentDate: b } }), `${a}→${b}`).toEqual({ status: 'INVALID_INPUT', reason: 'INVALID_DATE' });
    }
    expect(run({ elapsed: { elapsedDays: NaN } })).toEqual({ status: 'INVALID_INPUT', reason: 'INVALID_DATE' });
  });
  it('objetivo desconocido → UNKNOWN_OBJECTIVE', () => {
    for (const g of ['BULK', 'Bajar grasa', '', null, undefined]) {
      expect(run({ objective: g as never })).toEqual({ status: 'INVALID_INPUT', reason: 'UNKNOWN_OBJECTIVE' });
    }
  });
  it('cálculo porcentual y por semana: 80 → 79.2 en 21 días', () => {
    const r = run({ objective: 'MAINTENANCE', previousWeightKg: 80, currentWeightKg: 79.2, elapsed: { elapsedDays: 21 } });
    const m = r.status === 'ASSESSED' ? r.metrics : null;
    expect(m).toEqual({
      previousWeightKg: 80, currentWeightKg: 79.2, elapsedDays: 21, evaluationWindowWeeks: 3,
      absoluteChangeKg: -0.8, percentChangeFromBaseline: -1, percentChangePerWeek: -0.333333,
      changeKgPerMonth: -1.159524, direction: 'DOWN',
    });
  });
  it('semanas reales = días / 7, sin asumir 14 ni 28 (15 días)', () => {
    const r = decided(run({ previousWeightKg: 70, currentWeightKg: 69.3, elapsed: { previousDate: '2026-10-04', currentDate: '2026-10-19' } }));
    expect(r.metrics.evaluationWindowWeeks).toBe(2.142857);
    expect(r.metrics.percentChangePerWeek).toBe(-0.466667);
  });
  it('fechas a través de un cambio de horario cuentan días enteros', () => {
    const r = run({ objective: 'MAINTENANCE', previousWeightKg: 70, currentWeightKg: 70, elapsed: { previousDate: '2026-10-25', currentDate: '2026-11-22' } });
    expect(r.status === 'ASSESSED' && r.metrics?.elapsedDays).toBe(28);
  });
  it('el nivel solo se exige en MUSCLE_GAIN; en los demás se ignora', () => {
    expect(run({ experienceLevel: 'nada' as never, currentWeightKg: 69.3 })).toMatchObject({ sufficiency: 'SUFFICIENT_FOR_DECISION' });
  });
  it('ventana mínima por objetivo', () => {
    expect(requiredWindowDays('FAT_LOSS')).toBe(13);
    for (const g of ['MUSCLE_GAIN', 'RECOMPOSITION', 'MAINTENANCE'] as const) expect(requiredWindowDays(g)).toBe(27);
  });
  it('determinista y sin mutar la entrada', () => {
    const input = Object.freeze({ objective: 'FAT_LOSS', previousWeightKg: 70, currentWeightKg: 69.3, elapsed: Object.freeze({ elapsedDays: 14 }) }) as TrajectoryInput;
    expect(assessTrajectory(input)).toEqual(assessTrajectory(input));
  });
});

describe('DIRECCIÓN general · STABLE dentro de ±0.25 % del peso anterior (1B)', () => {
  const dir = (prev: number, curr: number) => {
    const r = run({ objective: 'MAINTENANCE', previousWeightKg: prev, currentWeightKg: curr, elapsed: { elapsedDays: 28 } });
    return r.status === 'ASSESSED' ? r.metrics?.direction : r.status;
  };

  it('la banda es 0.25 %', () => expect(DIRECTION_STABLE_BAND_PCT).toBe(0.25));
  it('ejemplo de producto: 60 kg → ±0.15 kg', () => {
    expect(dir(60, 60.1)).toBe('STABLE');
    expect(dir(60, 59.9)).toBe('STABLE');
    expect(dir(60, 60.2)).toBe('UP');
    expect(dir(60, 59.8)).toBe('DOWN');
  });
  it.each([
    // base, +0.25 % exacto, −0.25 % exacto, apenas dentro (+/−), apenas fuera (+/−)
    [60, 60.15, 59.85, 60.149, 59.851, 60.151, 59.849],
    [80, 80.2, 79.8, 80.199, 79.801, 80.201, 79.799],
    [100, 100.25, 99.75, 100.249, 99.751, 100.251, 99.749],
    [47.2, 47.318, 47.082, 47.317, 47.083, 47.319, 47.081],
  ])('base %s kg: frontera exacta e inclusiva, apenas dentro y apenas fuera', (base, upEx, downEx, inUp, inDown, outUp, outDown) => {
    expect(dir(base, upEx), `+0.25 % (${upEx})`).toBe('STABLE');
    expect(dir(base, downEx), `−0.25 % (${downEx})`).toBe('STABLE');
    expect(dir(base, inUp)).toBe('STABLE');
    expect(dir(base, inDown)).toBe('STABLE');
    expect(dir(base, outUp)).toBe('UP');
    expect(dir(base, outDown)).toBe('DOWN');
    expect(dir(base, base)).toBe('STABLE');
  });
  it('la dirección no gobierna la clasificación: FAT_LOSS STABLE sigue clasificado por su ritmo', () => {
    const r = decided(run({ objective: 'FAT_LOSS', previousWeightKg: 70, currentWeightKg: 69.85, elapsed: { elapsedDays: 14 } }));
    expect(r.metrics.direction).toBe('STABLE');
    expect(r.classification).toMatchObject({ rate: 'VERY_SLOW', lossPercentPerWeek: 0.107143 });
  });
  it('… y en MAINTENANCE un UP general puede quedar WITHIN de su banda ±1 %', () => {
    const r = decided(run({ objective: 'MAINTENANCE', previousWeightKg: 60, currentWeightKg: 60.3, elapsed: { elapsedDays: 28 } }));
    expect(r.metrics.direction).toBe('UP');
    expect(r.classification).toMatchObject({ band: 'WITHIN_MAINTENANCE_BAND' });
  });
});

describe('PUREZA · sin store, DB, UI, reloj ni decisión de kcal', () => {
  // el encabezado DOCUMENTA lo que el módulo no hace: se escanea solo el código
  const BODY = CODE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const imports = [...CODE.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  it('solo importa el tipo/lista de objetivos canónicos', () => {
    expect(imports).toEqual(['./energyPrescription']);
    expect(CODE).toMatch(/^import \{ CANONICAL_GOALS, type CanonicalGoal \} from '\.\/energyPrescription';$/m);
  });
  it('no toca store, Supabase, React, storage, red ni el reloj', () => {
    for (const banned of ['store', 'supabase', 'react', 'localStorage', 'fetch(', 'Date.now', 'new Date()', 'weightLog', 'useAppStore']) {
      expect(BODY.includes(banned), banned).toBe(false);
    }
  });
  it('no produce kcal ni llama a la cadena energética', () => {
    for (const banned of ['kcal:', 'prescribeEnergy', 'prescribeMacros', 'planGoal', 'estimateMaintenance']) {
      expect(BODY.includes(banned), banned).toBe(false);
    }
  });
});
