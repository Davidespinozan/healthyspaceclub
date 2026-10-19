import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// MENÚ HSC V1 · BLOQUE 4 · MEDIDAS REALES + PORCIONES NATURALES.
//   D1/D2 · autoridad de medidas (cerrada > catálogo > SMAE de la app; conflicto → gramos, reportado).
//   D3    · INTERNAL_GRAMS (macros) vs DISPLAY_PORTION (texto): gramos visibles en múltiplos de 5.
//   D4    · piezas naturales; pan/pita/bagel cuadrados a su unidad en el cierre del día.
//   D5    · avena cruda nunca se muestra como «avena cocida».
//   D6    · «Fruta» genérica → la fruta real de sus macros (dato del CSV).
//   D7    · singular/plural, sin medidas duplicadas, condimentos «al gusto».
// ─────────────────────────────────────────────────────────────────────────────
import { BANCO, type BancoIng } from '../../data/banco';
import { buildWeeklyPlan, portionStr, type PlanTarget } from '../planEngine';
import { displayGrams, servedPieceStep } from '../portionDisplay';
import { measureOf, measureConflicts, parseSmeAmount } from '../measureAuthority';
import { tPortion } from '../nutritionI18n';

const dish = (n: string) => { const d = BANCO.find((x) => x.nombre === n); if (!d) throw new Error(n); return d; };
const ingOf = (d: string, nv: string) => { const i = dish(d).ings.find((x) => x.nv === nv); if (!i) throw new Error(`${d}/${nv}`); return i; };
const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round((kcal * 0.28) / 4), fatG: Math.round((kcal * 0.27) / 9), carbG: Math.round((kcal * 0.45) / 4) });

describe('D1/D2 · autoridad de medidas', () => {
  it('gen_banco conserva TODAS las medidas confiables del catálogo (taza/cda/cdita/pieza/rebanada), no solo pieza/rebanada', () => {
    const units = new Set(BANCO.flatMap((d) => d.ings).flatMap((i) => Object.keys(i.m ?? {})));
    expect([...units].sort()).toEqual(['cda', 'cdita', 'pieza', 'rebanada', 'taza']);
    expect(ingOf('Avena con Manzana y Canela', 'Avena cocida').m).toEqual({ taza: 218.67 });
  });
  it('decisiones cerradas mandan sobre catálogo y SMAE', () => {
    const arroz = BANCO.flatMap((d) => d.ings).find((i) => i.fid === 'arroz-cocido')!;
    expect(measureOf(arroz, 'taza')).toEqual({ g: 188, source: 'CLOSED' });
    const pasta = BANCO.flatMap((d) => d.ings).find((i) => i.fid === 'pasta-cocida')!;
    expect(measureOf(pasta, 'taza')).toEqual({ g: 120, source: 'CLOSED' });
    expect(measureOf({ nv: 'Aceite de oliva' }, 'cdita')).toEqual({ g: 5, source: 'CLOSED' });
    expect(measureOf({ nv: 'Miel' }, 'cdita')!.g).toBe(7);
    expect(measureOf({ nv: 'Miel' }, 'cda')!.g).toBe(21);
    expect(measureOf({ nv: 'Jamón de pavo', fid: 'pechuga-de-pavo' }, 'rebanada')!.g).toBe(21.33);
  });
  it('parser de la tabla SMAE de la app', () => {
    expect(parseSmeAmount('½ tz picado (85g)')).toEqual({ taza: 170 });
    expect(parseSmeAmount('2 pz medianas (100g)')).toEqual({ pieza: 50 });
    expect(parseSmeAmount('1 cdita (5 ml)')).toEqual({});   // ml no se convierte
  });
  it('conflictos registrados y NO usados (la unidad cae a gramos)', () => {
    const c = measureConflicts();
    const key = (fid: string, u: string) => c.find((x) => x.fid === fid && x.unit === u);
    expect(key('avena-en-hojuelas', 'taza')).toMatchObject({ kind: 'CATALOG_VS_SMAE', catalog: 40, smae: 80 });
    expect(key('aguacate-hass', 'pieza')).toMatchObject({ kind: 'CATALOG_VS_SMAE', catalog: 93.94, smae: 150 });
    expect(key('chia', 'cda')).toMatchObject({ kind: 'IMPLAUSIBLE' });
    expect(key('pasta-de-codito', 'taza')).toMatchObject({ kind: 'KNOWN_DEFECT' });
    for (const x of c) expect(measureOf(BANCO.flatMap((d) => d.ings).find((i) => i.fid === x.fid)!, x.unit), `${x.fid}/${x.unit}`).toBeNull();
  });
});

describe('D1 · medida visible por familia', () => {
  const p = (d: string, nv: string, g: number) => portionStr(ingOf(d, nv), g);
  it('granos/leguminosas/fruta picada → taza', () => {
    expect(p('Avena con Manzana y Canela', 'Avena cocida', 219)).toBe('1 taza de avena cocida');
    expect(portionStr({ nv: 'Arroz blanco', rol: 'principal', g0: 150 }, 94)).toBe('½ taza de arroz blanco');
  });
  it('proteínas y quesos → gramos aunque el catálogo tenga otra medida (camarón por pieza, cottage por cda)', () => {
    const cam = BANCO.flatMap((d) => d.ings).find((i) => i.fid === 'camaron-cocido' && i.rol === 'principal')!;
    expect(portionStr(cam, 123)).toBe(`125 g ${cam.nv}`);
    const cot = BANCO.flatMap((d) => d.ings).find((i) => i.fid === 'queso-cottage' && i.rol === 'principal' && (i.max ?? 0) >= 200)!;
    expect(portionStr(cot, 151)).toMatch(/^150 g /);
    expect(portionStr({ ...cot, max: 150 }, 151)).toMatch(/^150 g /);
    expect(portionStr({ ...cot, max: 148 }, 148)).toMatch(/^148 g /);   // redondear cruzaría su max_g → exacto
  });
  it('grasas/untables/semillas → cdita/cda del catálogo', () => {
    const cc = BANCO.flatMap((d) => d.ings).find((i) => i.fid === 'mantequilla-de-cacahuate')!;
    expect(portionStr(cc, 16)).toBe('1 cda de crema de cacahuate');
    const aj = BANCO.flatMap((d) => d.ings).find((i) => i.fid === 'ajonjoli')!;
    expect(portionStr(aj, 5)).toBe('2 cditas de ajonjolí');
  });
  it('condimentos y guarniciones → «al gusto»', () => {
    expect(portionStr({ nv: 'Canela', rol: 'condimento', g0: 1 }, null)).toBe('Canela al gusto');
    expect(portionStr({ nv: 'Pizca de sal', rol: 'condimento', g0: 1 }, null)).toBe('Pizca de sal');
  });
  it('una proteína glaseada no es salsa; el caldo de pollo sí va en tazas', () => {
    expect(portionStr({ nv: 'Salmón glaseado', rol: 'principal', g0: 150 }, 234)).toBe('235 g Salmón glaseado');
    const caldo = BANCO.flatMap((d) => d.ings).find((i) => i.nv === 'Caldo de pollo')!;
    expect(portionStr(caldo, 240)).toBe('1 taza de caldo de pollo');
  });
});

describe('D3 · INTERNAL_GRAMS vs DISPLAY_PORTION', () => {
  const ing = (over: Partial<BancoIng> = {}): BancoIng => ({ nv: 'Salmón a la plancha', rol: 'principal', g0: 150, max: 250, ...over });
  it('múltiplos de 5 desde 10 g', () => {
    expect(displayGrams(ing(), 83)).toBe(85);
    expect(displayGrams(ing(), 67)).toBe(65);
    expect(displayGrams(ing(), 7)).toBe(7);
  });
  it('base de la receta → exacta; redondear sobre un límite → exacta', () => {
    expect(displayGrams(ing({ g0: 94 }), 94)).toBe(94);
    expect(displayGrams(ing({ max: 248 }), 248)).toBe(248);
  });
  it('en planes reales el texto nunca mueve las macros: gramos internos exactos, display a ≤ 2.5 g', () => {
    for (const k of [1500, 3000]) for (const d of buildWeeklyPlan(mk(k), { seed: 7 })) for (const m of d.meals) {
      m.portions.forEach((s, i) => {
        const gm = s.match(/^(\d+) g /);
        const g = m.ings?.[i]?.g;
        if (gm && typeof g === 'number') expect(Math.abs(+gm[1] - g), `${s} vs ${g}`).toBeLessThanOrEqual(2.5);
      });
    }
  }, 120_000);
});

describe('D4 · piezas y fracciones', () => {
  const ing = (nv: string, pu: number): BancoIng => ({ nv, rol: 'principal', g0: pu, pu });
  it('enteras: huevo, tortilla, guayaba, kiwi — nunca fracción', () => {
    for (const [nv, pu] of [['Huevo', 44], ['Tortilla de maíz', 30], ['Guayaba', 41], ['Kiwi', 76]] as const) {
      for (let k = 0.5; k <= 6; k += 0.1) expect(portionStr(ing(nv, pu), k * pu)).not.toMatch(/[¼⅓½⅔¾]/);
    }
  });
  it('medias solo donde es natural; tercios solo aguacate (SMAE ⅓ pieza)', () => {
    expect(portionStr(ing('Bagel', 72.73), 36)).toBe('½ bagel');
    expect(portionStr(ing('Bagel', 72.73), 109)).toBe('1½ bagels');
    expect(portionStr(ing('Naranja', 76), 0.5 * 76)).toBe('½ naranja');
    expect(portionStr(ing('Plátano', 108), 36)).not.toMatch(/⅓/);
    expect(portionStr(ing('Aguacate', 150), 50)).toBe('⅓ aguacate');
  });
  it('el cierre del día cuadra pan/pita/bagel a su unidad (rebanada entera, media pieza)', () => {
    let seen = 0;
    for (const k of [1500, 3000]) for (const seed of [7]) for (const d of buildWeeklyPlan(mk(k), { seed })) for (const m of d.meals) {
      if (m.time.startsWith('Snack')) continue;
      const bd = BANCO.find((x) => x.nombre === m.name);
      if (!bd) continue;
      for (const i of bd.ings) {
        const step = i.rol === 'principal' ? servedPieceStep(i) : null;
        if (!step || !/\bpan\b|bagel|pita|baguette/i.test(i.nv)) continue;
        const g = m.ings?.find((x) => x.nv === i.nv)?.g;
        if (typeof g !== 'number' || g === i.g0) continue;
        seen++;
        expect(Math.abs(g / step - Math.round(g / step)), `${m.name}: ${i.nv} ${g} g`).toBeLessThan(0.05);
      }
    }
    expect(seen).toBeGreaterThan(0);
  }, 180_000);
});

describe('D5 · avena', () => {
  it('ningún ingrediente se llama «cocido/a» con macros de un cereal SECO', () => {
    const bad = BANCO.flatMap((d) => d.ings.map((i) => ({ d: d.nombre, i }))).filter(({ i }) => /cocid/i.test(i.nv) && (i.a?.[0] ?? 0) > 2);
    expect(bad.map((x) => `${x.d}: ${x.i.nv}`)).toEqual([]);
  });
  it('«Avena Cocida con Plátano y Nuez»: 50 g de avena CRUDA (sus macros) → se muestra como hojuelas, sin taza falsa', () => {
    const i = ingOf('Avena Cocida con Plátano y Nuez', 'Avena en hojuelas');
    expect(i.a![0]).toBeCloseTo(3.65, 2);
    expect(portionStr(i, 50)).toBe('50 g Avena en hojuelas');   // taza de hojuelas en conflicto 40 vs 80 g
  });
  it('«Avena con Manzana y Canela»: avena COCIDA con macros de cocida (0.40 kcal/g) → 1 taza', () => {
    expect(ingOf('Avena con Manzana y Canela', 'Avena cocida').a![0]).toBeLessThan(1);
  });
});

describe('D6 · «Fruta» genérica', () => {
  it('ya no existe en el banco; las 4 filas muestran la fruta de sus macros (Fresa rebanada → «Fresas»)', () => {
    expect(BANCO.flatMap((d) => d.ings).filter((i) => /^fruta\b/i.test(i.nv))).toEqual([]);
    for (const n of ['Yogurt con Fruta', 'Yogurt Griego con Granola y Fruta', 'Requesón con Nueces Miel y Fruta', 'Cacao Nibs con Fruta']) {
      const f = dish(n).ings.find((i) => i.fid === 'fresa-rebanada')!;
      expect(f.nv, n).toBe('Fresas');
    }
    expect(portionStr(ingOf('Cacao Nibs con Fruta', 'Fresas'), 166)).toBe('1 taza de fresas');
  });
});

describe('D7 · texto', () => {
  it('singular/plural correcto', () => {
    expect(portionStr({ nv: 'Aceitunas verdes', rol: 'principal', g0: 3, pu: 3, un: 'aceituna' }, 3)).toBe('1 aceituna verde');
    expect(portionStr({ nv: 'Dátiles', rol: 'principal', g0: 8.5, pu: 8.5, un: 'dátil' }, 8.5)).toBe('1 dátil');
    expect(portionStr({ nv: 'Tortilla de maíz', rol: 'principal', g0: 30, pu: 30, un: 'tortilla' }, 90)).toBe('3 tortillas de maíz');
    expect(portionStr({ nv: 'Miel', rol: 'fijo', g0: 21 }, 42)).toBe('2 cdas de miel');
  });
  it('sin medida duplicada en el nombre', () => {
    const i = BANCO.flatMap((d) => d.ings).find((x) => x.nv === 'Pan tostado (2 rebanadas)')!;
    expect(portionStr(i, 50)).toBe('2 rebanadas de pan tostado');
  });
  it('inglés: cdita → tsp, al gusto → to taste', () => {
    expect(tPortion('2 cditas de aceite de oliva', { nv: 'Aceite de oliva', g: 10, rol: 'fijo' }, 'en')).toMatch(/^2 tsp of /);
    expect(tPortion('Canela al gusto', { nv: 'Canela', g: null, rol: 'condimento' }, 'en')).toMatch(/to taste$/);
  });
});

describe('QA · matriz 1500–3000 × restricciones: nada de lo que Bloque 4 elimina reaparece', () => {
  it('sin gramos sueltos no-múltiplos de 5 (salvo base de receta / límite), sin fracciones de enteros, sin «Fruta», sin tercios fuera de aguacate', () => {
    const bad: string[] = [];
    const base = new Set(BANCO.flatMap((d) => d.ings).map((i) => `${i.nv}|${Math.round(i.g0)}`));
    for (const k of [1500, 1800, 2200, 2500, 3000]) for (const strict of [[], ['lacteos'], ['lacteos', 'gluten', 'huevo']]) {
      for (const d of buildWeeklyPlan(mk(k), { seed: 7, avoid: { strict, soft: [] } })) for (const m of d.meals) m.portions.forEach((s, i) => {
        const nv = m.ings?.[i]?.nv ?? '';
        const gm = s.match(/^(\d+) g /);
        if (gm && +gm[1] >= 10 && +gm[1] % 5 && !base.has(`${nv}|${gm[1]}`)) {
          const bi = BANCO.flatMap((x) => x.ings).find((x) => x.nv === nv);
          if (!(bi?.max != null && Math.round(+gm[1] / 5) * 5 > bi.max)) bad.push(`g:${s}`);
        }
        if (!gm && /^\d*[½⅓⅔¼¾]/.test(s) && /huevo|tortilla|tostad|totopo|d[aá]til|aceituna|guayaba|kiwi|mandarina|higo|ciruela/i.test(s)) bad.push(`frac:${s}`);
        if (!gm && !/taza/.test(s) && /^\d*[⅓⅔]/.test(s) && !/aguacate/i.test(s)) bad.push(`third:${s}`);
        if (/\bfruta\b/i.test(nv)) bad.push(`fruta:${s}`);
        if (/taza.*(salm[oó]n|pollo|carne|at[uú]n)/i.test(s) && !/caldo/i.test(s)) bad.push(`protein-cup:${s}`);
      });
    }
    expect([...new Set(bad)]).toEqual([]);
  }, 300_000);
});
