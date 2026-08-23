import { describe, it, expect } from 'vitest';
import { parseFoodEstimate, sanitizeFoodEntry, validateFoodEstimateIntegrity, type FoodEstimate } from '../foodEstimate';

describe('parseFoodEstimate', () => {
  it('JSON limpio válido → devuelve FoodEstimate', () => {
    const raw = '{"kcal": 350, "prot": 25, "carbs": 30, "fat": 12}';
    expect(parseFoodEstimate(raw)).toEqual({ kcal: 350, prot: 25, carbs: 30, fat: 12 });
  });

  it('JSON con fences ```json...``` → strip + parse OK', () => {
    const raw = '```json\n{"kcal":350,"prot":25,"carbs":30,"fat":12}\n```';
    expect(parseFoodEstimate(raw)).toEqual({ kcal: 350, prot: 25, carbs: 30, fat: 12 });
  });

  it('JSON con fences ```...``` sin language tag → strip + parse OK', () => {
    const raw = '```\n{"kcal":100,"prot":5,"carbs":10,"fat":2}\n```';
    expect(parseFoodEstimate(raw)).toEqual({ kcal: 100, prot: 5, carbs: 10, fat: 2 });
  });

  it('kcal=0 (caso "no comí nada") → válido', () => {
    const raw = '{"kcal":0,"prot":0,"carbs":0,"fat":0}';
    expect(parseFoodEstimate(raw)).toEqual({ kcal: 0, prot: 0, carbs: 0, fat: 0 });
  });

  it('JSON inválido (texto no parseable) → null', () => {
    expect(parseFoodEstimate('no soy json')).toBeNull();
    expect(parseFoodEstimate('{kcal: 350}')).toBeNull(); // sin quotes en key
  });

  it('campos faltantes → null', () => {
    expect(parseFoodEstimate('{"kcal":350,"prot":25}')).toBeNull();
    expect(parseFoodEstimate('{"kcal":350,"prot":25,"carbs":30}')).toBeNull();
  });

  it('kcal negativo → null', () => {
    const raw = '{"kcal":-100,"prot":25,"carbs":30,"fat":12}';
    expect(parseFoodEstimate(raw)).toBeNull();
  });

  it('kcal > 10000 (outlier) → null', () => {
    const raw = '{"kcal":99999,"prot":25,"carbs":30,"fat":12}';
    expect(parseFoodEstimate(raw)).toBeNull();
  });

  it('prot/carbs/fat negativo → null', () => {
    expect(parseFoodEstimate('{"kcal":350,"prot":-5,"carbs":30,"fat":12}')).toBeNull();
    expect(parseFoodEstimate('{"kcal":350,"prot":25,"carbs":-1,"fat":12}')).toBeNull();
    expect(parseFoodEstimate('{"kcal":350,"prot":25,"carbs":30,"fat":-1}')).toBeNull();
  });

  it('NaN explícito como string "NaN" → null (JSON.parse falla)', () => {
    expect(parseFoodEstimate('{"kcal":NaN,"prot":25,"carbs":30,"fat":12}')).toBeNull();
  });

  it('campo no-numérico (string en kcal) → null', () => {
    const raw = '{"kcal":"trescientos","prot":25,"carbs":30,"fat":12}';
    expect(parseFoodEstimate(raw)).toBeNull();
  });

  it('null o array como top-level → null', () => {
    expect(parseFoodEstimate('null')).toBeNull();
    expect(parseFoodEstimate('[1,2,3]')).toBeNull();
  });

  it('string vacío o solo espacios → null', () => {
    expect(parseFoodEstimate('')).toBeNull();
    expect(parseFoodEstimate('   ')).toBeNull();
    expect(parseFoodEstimate('```\n```')).toBeNull();
  });
});

describe('sanitizeFoodEntry', () => {
  it('shape canónico → todos los campos preservados, source incluido', () => {
    const estimate = { kcal: 350, prot: 25, carbs: 30, fat: 12 };
    expect(sanitizeFoodEntry(estimate, 'pollo asado', 'ai')).toEqual({
      desc: 'pollo asado',
      kcal: 350, prot: 25, carbs: 30, fat: 12,
      source: 'ai',
    });
  });

  it('redondea kcal a integer (la columna SQL es integer)', () => {
    const estimate = { kcal: 347.6, prot: 25, carbs: 30, fat: 12 };
    expect(sanitizeFoodEntry(estimate, 'x', 'ai').kcal).toBe(348);
  });

  it('redondea prot/carbs/fat a 1 decimal', () => {
    const estimate = { kcal: 350, prot: 25.456, carbs: 30.991, fat: 12.04 };
    const result = sanitizeFoodEntry(estimate, 'x', 'ai');
    expect(result.prot).toBe(25.5);
    expect(result.carbs).toBe(31.0);
    expect(result.fat).toBe(12.0);
  });

  it('clamp defensivo: kcal > 10000 → 10000', () => {
    const estimate = { kcal: 15000, prot: 0, carbs: 0, fat: 0 };
    expect(sanitizeFoodEntry(estimate, 'x', 'ai').kcal).toBe(10000);
  });

  it('clamp defensivo: macros negativos → 0', () => {
    const estimate = { kcal: 100, prot: -5, carbs: -1, fat: -2 };
    const result = sanitizeFoodEntry(estimate, 'x', 'ai');
    expect(result.prot).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
  });

  it('source manual se preserva', () => {
    const estimate = { kcal: 100, prot: 5, carbs: 10, fat: 2 };
    expect(sanitizeFoodEntry(estimate, 'x', 'manual').source).toBe('manual');
  });

  it('desc se preserva tal cual (no trim/case)', () => {
    const estimate = { kcal: 100, prot: 5, carbs: 10, fat: 2 };
    expect(sanitizeFoodEntry(estimate, '  Pizza Margarita  ', 'ai').desc).toBe('  Pizza Margarita  ');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N4 · INTEGRIDAD ATWATER (autoridad única de coherencia).
// REJECT sólo imposibilidad física; alcohol/fibra/polioles nunca se rechazan por Atwater; kcal muy altas
// respecto a macros = WARN (se guarda). No modifica valores. manual y 0/0/0/0 = PASS.
// ─────────────────────────────────────────────────────────────────────────────
const V = (e: FoodEstimate, s: 'ai' | 'manual' = 'ai') => validateFoodEstimateIntegrity(e, s).status;

describe('validateFoodEstimateIntegrity · matriz adversaria (Gate A §12)', () => {
  it('A · 500 / 100·100·100 → REJECT (imposible)', () => expect(V({ kcal: 500, prot: 100, carbs: 100, fat: 100 })).toBe('REJECT'));
  it('B · 900 / 5·10·5 → WARN', () => expect(V({ kcal: 900, prot: 5, carbs: 10, fat: 5 })).toBe('WARN'));
  it('C · 250 / 50·0·0 → PASS (batido de proteína)', () => expect(V({ kcal: 250, prot: 50, carbs: 0, fat: 0 })).toBe('PASS'));
  it('D · 600 / 0·0·0 → WARN (posible destilado)', () => expect(V({ kcal: 600, prot: 0, carbs: 0, fat: 0 })).toBe('WARN'));
  it('E · 100 / 0·100·0 → REJECT (imposible)', () => expect(V({ kcal: 100, prot: 0, carbs: 100, fat: 0 })).toBe('REJECT'));
  it('F · 300 / 20·30·10 → PASS', () => expect(V({ kcal: 300, prot: 20, carbs: 30, fat: 10 })).toBe('PASS'));
  it('G · 0/0/0/0 → PASS (ayuno)', () => expect(V({ kcal: 0, prot: 0, carbs: 0, fat: 0 })).toBe('PASS'));
  it('H · 400 / 0·0·200 → REJECT (imposible)', () => expect(V({ kcal: 400, prot: 0, carbs: 0, fat: 200 })).toBe('REJECT'));
  it('I · 9999 / macros normales → WARN', () => expect(V({ kcal: 9999, prot: 50, carbs: 200, fat: 60 })).toBe('WARN'));
});

describe('validateFoodEstimateIntegrity · comida REAL nunca se rechaza por Atwater', () => {
  it('cerveza (kcal > macroKcal por alcohol) → PASS/ WARN, nunca REJECT', () => {
    expect(V({ kcal: 150, prot: 1, carbs: 13, fat: 0 })).not.toBe('REJECT');
    expect(V({ kcal: 250, prot: 2, carbs: 20, fat: 0 })).not.toBe('REJECT');   // cerveza fuerte/cóctel
  });
  it('destilado (97 kcal, 0 macros) → no REJECT', () => expect(V({ kcal: 97, prot: 0, carbs: 0, fat: 0 })).not.toBe('REJECT'));
  it('barra alta en fibra (kcal por debajo de 4·C pero sobre el mínimo) → PASS', () => {
    expect(V({ kcal: 200, prot: 10, carbs: 30, fat: 5 })).toBe('PASS');
    expect(V({ kcal: 120, prot: 5, carbs: 25, fat: 2 })).toBe('PASS');   // polioles/keto
  });
  it('mass gainer / comida de restaurante grande pero coherente → PASS', () => {
    expect(V({ kcal: 1200, prot: 50, carbs: 200, fat: 10 })).toBe('PASS');
    expect(V({ kcal: 1500, prot: 60, carbs: 150, fat: 60 })).toBe('PASS');
  });
  it('platillo alto en grasa (aceite) coherente → PASS', () => expect(V({ kcal: 400, prot: 5, carbs: 5, fat: 40 })).toBe('PASS'));
  it('comida mixta normal → PASS', () => expect(V({ kcal: 550, prot: 35, carbs: 45, fat: 22 })).toBe('PASS'));
});

describe('validateFoodEstimateIntegrity · propiedades', () => {
  it('manual jamás se endurece (siempre PASS aunque sea incoherente)', () => {
    expect(V({ kcal: 100, prot: 0, carbs: 100, fat: 0 }, 'manual')).toBe('PASS');   // A/E imposibles → PASS en manual
    expect(V({ kcal: 500, prot: 100, carbs: 100, fat: 100 }, 'manual')).toBe('PASS');
  });
  it('puro / determinista / NO muta el input', () => {
    const e = { kcal: 500, prot: 100, carbs: 100, fat: 100 };
    const snap = JSON.stringify(e);
    expect(validateFoodEstimateIntegrity(e, 'ai')).toEqual(validateFoodEstimateIntegrity(e, 'ai'));
    expect(JSON.stringify(e)).toBe(snap);   // sin reparación silenciosa
  });
  it('nunca REJECT por kcal ALTAS respecto a macros (eso es WARN, no REJECT)', () => {
    for (const K of [500, 900, 2000, 9999]) expect(V({ kcal: K, prot: 5, carbs: 10, fat: 5 })).not.toBe('REJECT');
  });
  it('REJECT sólo cuando K < energía mínima (carbos a 2 kcal/g)', () => {
    // frontera: minKcal = 4·10 + 2·50 + 9·5 = 185; tol = max(20, 27.75)=27.75 → REJECT si K < 157.25
    expect(V({ kcal: 150, prot: 10, carbs: 50, fat: 5 })).toBe('REJECT');
    expect(V({ kcal: 165, prot: 10, carbs: 50, fat: 5 })).not.toBe('REJECT');
  });
  it('NO repara: un estimate aceptado conserva sus valores tras sanitize', () => {
    const e = { kcal: 900, prot: 5, carbs: 10, fat: 5 };   // WARN
    expect(V(e)).toBe('WARN');
    const s = sanitizeFoodEntry(e, 'x', 'ai');
    expect([s.kcal, s.prot, s.carbs, s.fat]).toEqual([900, 5, 10, 5]);   // sin recálculo Atwater
  });
});
