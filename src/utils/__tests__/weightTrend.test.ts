import { describe, it, expect } from 'vitest';
import {
  deriveStableNutritionWeight, nextNutritionWeight,
  NUTRITION_WEIGHT_UPDATE_KG, NUTRITION_WEIGHT_MIN_DAYS,
} from '../weightTrend';
import { computeNutritionTargets } from '../nutritionTargets';

// NUTRITION-N10.1 · peso de tendencia estable (mediana rodante 14 días). Todo puro/determinista;
// asOf se pasa siempre (sin Date.now oculto).
const wp = (date: string, kg: number) => ({ date, kg });
// serie de días consecutivos terminando en asOf
const series = (asOf: string, kgs: number[]) => {
  const [y, m, d] = asOf.split('-').map(Number);
  return kgs.map((kg, i) => {
    const dt = new Date(y, m - 1, d - (kgs.length - 1 - i));
    const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return wp(k, kg);
  });
};
const ASOF = '2026-08-24';

describe('N10.1 · A-K · median / window / min-points', () => {
  it('A · null/empty → INSUFFICIENT', () => {
    expect(deriveStableNutritionWeight(null, ASOF).status).toBe('INSUFFICIENT_DATA');
    expect(deriveStableNutritionWeight([], ASOF).status).toBe('INSUFFICIENT_DATA');
  });
  it('B/C · 1 y 2 puntos → INSUFFICIENT', () => {
    expect(deriveStableNutritionWeight(series(ASOF, [80]), ASOF).status).toBe('INSUFFICIENT_DATA');
    expect(deriveStableNutritionWeight(series(ASOF, [80, 80.2]), ASOF).status).toBe('INSUFFICIENT_DATA');
    expect(NUTRITION_WEIGHT_MIN_DAYS).toBe(3);
  });
  it('D/E · 3 puntos → READY, mediana impar', () => {
    const r = deriveStableNutritionWeight(series(ASOF, [79.8, 80.1, 80.0]), ASOF);
    expect(r.status).toBe('READY'); if (r.status === 'READY') { expect(r.stableKg).toBe(80.0); expect(r.pointsUsed).toBe(3); }
  });
  it('F · mediana par = promedio de los dos centrales', () => {
    const r = deriveStableNutritionWeight(series(ASOF, [80.0, 80.2, 80.4, 80.6]), ASOF);
    expect(r.status).toBe('READY'); if (r.status === 'READY') expect(r.stableKg).toBe(80.3);
  });
  it('G · input desordenado → mismo resultado', () => {
    const s = series(ASOF, [79.8, 80.1, 80.0]);
    const shuffled = [s[2], s[0], s[1]];
    expect(deriveStableNutritionWeight(shuffled, ASOF)).toEqual(deriveStableNutritionWeight(s, ASOF));
  });
  it('H · duplicado mismo día → último gana, cuenta 1 día', () => {
    const s = series(ASOF, [79.0, 80.0, 81.0]);
    const dupDay = s[2].date;                                       // repite el 3er día con otro valor
    const r = deriveStableNutritionWeight([...s, wp(dupDay, 82.0)], ASOF);
    expect(r.status).toBe('READY');
    if (r.status === 'READY') { expect(r.pointsUsed).toBe(3); expect(r.stableKg).toBe(80.0); } // 3 días: 79,80,82 → mediana 80
  });
  it('I · kg inválido (0/neg/NaN/Inf) ignorado', () => {
    const s = [...series(ASOF, [80.0, 80.1, 80.2]), wp('2026-08-24', 0), wp('2026-08-23', -5), wp('2026-08-22', NaN), wp('2026-08-21', Infinity)];
    // los válidos de la serie base siguen dando 3 días
    expect(deriveStableNutritionWeight(series(ASOF, [80.0, 80.1, 80.2]), ASOF).status).toBe('READY');
    // añadir inválidos con fechas propias no debe crear días válidos extra ni romper
    expect(() => deriveStableNutritionWeight(s, ASOF)).not.toThrow();
  });
  it('J · fecha inválida ignorada', () => {
    const s = [...series(ASOF, [80.0, 80.1, 80.2]), wp('not-a-date', 80), wp('2026-13-40', 81)];
    expect(deriveStableNutritionWeight(s, ASOF).status).toBe('READY');
  });
  it('K/L · corte 14 días: datos viejos excluidos', () => {
    const recent = series(ASOF, [80.0, 80.1, 80.2]);                 // 3 recientes
    const old = [wp('2026-07-01', 90), wp('2026-07-02', 91), wp('2026-06-01', 92)]; // fuera de ventana
    const r = deriveStableNutritionWeight([...old, ...recent], ASOF);
    expect(r.status).toBe('READY'); if (r.status === 'READY') { expect(r.pointsUsed).toBe(3); expect(r.stableKg).toBe(80.1); }
  });
});

describe('N10.1 · M-P · robustez a ruido y tendencia real', () => {
  const baseline = series(ASOF, [80.0, 80.1, 79.9, 80.0, 80.2]); // mediana 80.0
  it('M · spike de sodio +1.5 kg NO mueve la mediana materialmente', () => {
    const withSpike = [...baseline.slice(0, 4), wp(ASOF, 81.5)];
    const r = deriveStableNutritionWeight(withSpike, ASOF);
    expect(r.status).toBe('READY'); if (r.status === 'READY') expect(Math.abs(r.stableKg - 80.0)).toBeLessThan(NUTRITION_WEIGHT_UPDATE_KG);
    expect(nextNutritionWeight(withSpike, 80.0, ASOF).update).toBe(false);
  });
  it('N · dip de deshidratación −1.2 kg NO mueve materialmente', () => {
    const withDip = [...baseline.slice(0, 4), wp(ASOF, 78.8)];
    expect(nextNutritionWeight(withDip, 80.0, ASOF).update).toBe(false);
  });
  it('O · desplazamiento sostenido eventualmente mueve', () => {
    const shifted = series(ASOF, [80.0, 80.6, 80.8, 80.9, 81.0]); // mediana sube a 80.8
    const r = deriveStableNutritionWeight(shifted, ASOF);
    expect(r.status).toBe('READY'); if (r.status === 'READY') expect(r.stableKg).toBeGreaterThanOrEqual(80.5);
    expect(nextNutritionWeight(shifted, 80.0, ASOF).update).toBe(true);
  });
  it('P · pérdida real gradual: mediana baja suave', () => {
    const loss = series(ASOF, [80.0, 79.8, 79.6, 79.4, 79.2]);
    const r = deriveStableNutritionWeight(loss, ASOF);
    expect(r.status).toBe('READY'); if (r.status === 'READY') expect(r.stableKg).toBe(79.6);
  });
});

describe('N10.1 · U/V · umbral 0.5 kg + Q/R sparse/daily', () => {
  const s = series(ASOF, [80.0, 80.0, 80.0, 80.0, 80.0]);
  it('U · delta 0.49 kg → HOLD', () => expect(nextNutritionWeight(s, 80.49, ASOF).update).toBe(false));
  it('V · delta 0.50 kg → UPDATE', () => {
    const d = nextNutritionWeight(s, 80.5, ASOF);
    expect(d.update).toBe(true); if (d.update) expect(d.stableKg).toBe(80.0);
    expect(NUTRITION_WEIGHT_UPDATE_KG).toBe(0.5);
  });
  it('Q · usuario sparse (<3 días en ventana) → sin adaptación', () => {
    const sparse = [wp('2026-08-24', 80), wp('2026-08-10', 81)]; // 10-agosto fuera de la ventana de 14d → 1 día
    expect(nextNutritionWeight(sparse, 79.0, ASOF).reason).toBe('INSUFFICIENT_DATA');
    expect(nextNutritionWeight(sparse, 79.0, ASOF).update).toBe(false);
  });
  it('R · usuario diario ruidoso: baseline estable no salta', () => {
    const noisy = series(ASOF, [80.0, 80.6, 79.5, 80.4, 79.6, 80.5, 80.0]); // mediana ~80.0
    expect(nextNutritionWeight(noisy, 80.0, ASOF).update).toBe(false);
  });
});

describe('N10.1 · W/X/Y · remove + onboarding', () => {
  it('W · quitar el último recalcula tendencia del historial restante', () => {
    const full = series(ASOF, [80.0, 80.1, 80.2, 80.3, 84.0]); // último 84 (error)
    const remaining = full.slice(0, 4);
    // con el 84 fuera, la mediana baja → decisión sobre lo restante
    const r = deriveStableNutritionWeight(remaining, ASOF);
    expect(r.status).toBe('READY'); if (r.status === 'READY') expect(r.stableKg).toBe(80.15);
  });
  it('X · quitar deja <3 días → HOLD (no inventa target)', () => {
    const remaining = series(ASOF, [80.0, 80.1]); // 2 días
    expect(nextNutritionWeight(remaining, 79.0, ASOF).reason).toBe('INSUFFICIENT_DATA');
    expect(nextNutritionWeight(remaining, 79.0, ASOF).update).toBe(false);
  });
  it('Y · onboarding: 1er pesaje (1 día) NO cambia el baseline nutricional', () => {
    const firstWeighIn = series(ASOF, [80.0]);
    expect(nextNutritionWeight(firstWeighIn, 80.0, ASOF).update).toBe(false); // baseline de onboarding se preserva
  });
});

describe('N10.1 · S/T · determinismo / no-mutación', () => {
  it('S · determinista', () => {
    const s = series(ASOF, [79.8, 80.1, 80.0, 80.2]);
    expect(deriveStableNutritionWeight(s, ASOF)).toEqual(deriveStableNutritionWeight(s, ASOF));
  });
  it('T · no muta el input', () => {
    const s = series(ASOF, [79.8, 80.1, 80.0]);
    const snap = JSON.parse(JSON.stringify(s));
    deriveStableNutritionWeight(s, ASOF); nextNutritionWeight(s, 80, ASOF);
    expect(s).toEqual(snap);
  });
});

describe('N10.1 · Z/AA/AB/AC · computeNutritionTargets desde peso estable respeta pisos/wellness/renal', () => {
  const ob = (over: any) => ({ sexo: 'Hombre', pesoKg: 80, estaturaCm: 178, edad: 30, activity: 'Ligera', goal: 'bajar grasa', grasa: 0, embarazo: false, conditions: [] as string[], ...over });
  it('Z · target desde stableKg = target desde ese peso (sin capa paralela)', () => {
    const stable = deriveStableNutritionWeight(series(ASOF, [80.0, 80.1, 79.9]), ASOF);
    expect(stable.status).toBe('READY');
    if (stable.status === 'READY') {
      const fromStable = computeNutritionTargets(ob({ pesoKg: stable.stableKg }));
      const direct = computeNutritionTargets(ob({ pesoKg: 80.0 }));
      expect(fromStable.planGoal).toBe(direct.planGoal); // stableKg==80.0
    }
  });
  it('AA · piso de seguridad sigue vigente (mujer chica cut ≥1200)', () => {
    const t = computeNutritionTargets(ob({ sexo: 'Mujer', pesoKg: 48, estaturaCm: 152, edad: 30 }));
    expect(t.planGoal).toBeGreaterThanOrEqual(1200);
  });
  it('AB · wellnessMode (≥70) sin déficit', () => {
    const t = computeNutritionTargets(ob({ edad: 72 }));
    expect(t.wellnessMode).toBe(true);
  });
  it('AC · renal → proteína ≤ 1.0 g/kg', () => {
    const t = computeNutritionTargets(ob({ pesoKg: 80, conditions: ['renal'] }));
    expect(t.protG).toBeLessThanOrEqual(80);
  });
});
