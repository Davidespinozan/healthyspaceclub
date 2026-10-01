import { describe, it, expect } from 'vitest';
import srcEngine from '../planEngine.ts?raw';
import { BANCO, type BancoDish, type BancoIng } from '../../data/banco';
import {
  buildWeeklyPlan, buildDayWithFixed, safeBankByTiempo, adequateBankByTiempo,
  makeAvoidFilter, portionStr, NoEligibleDishesError,
  type PlanTarget, type FixedMeal,
} from '../planEngine';

// ─────────────────────────────────────────────────────────────────────────────
// DECISIÓN 06 · `rol:'guarnicion'` NO es autoridad de elegibilidad.
//
// La regla histórica «verduras presentes en Comida y Cena» se implementaba como un filtro
// DURO sobre un tag que, según las propias instrucciones a Magaly, era OPCIONAL y servía
// para registrar una verdura de guarnición: «Puedes escribir "guarnición" en la columna
// `nota` si quieres». Un campo de registro voluntario decidía qué recetas existían.
//
// Lo que esta suite fija es la separación de las dos cosas que el tag mezclaba:
//   · ELEGIBILIDAD del platillo → la decide su `tiempo` (y las restricciones del socio).
//   · DISPLAY de la porción      → `guarnicion` sigue imprimiendo «al gusto», intacto.
//
// La calidad vegetal del plan queda como objetivo pendiente, no como filtro.
// ─────────────────────────────────────────────────────────────────────────────

const mk = (kcal: number): PlanTarget => ({
  kcal, protG: Math.round(kcal * 0.3 / 4), fatG: Math.round(kcal * 0.27 / 9), carbG: Math.round(kcal * 0.43 / 4),
});
const conGuarnicion = (d: BancoDish) => d.ings.some((i) => i.rol === 'guarnicion');
const SIN_TAG = BANCO.filter((d) => (d.tiempo === 'Comida' || d.tiempo === 'Cena') && !conGuarnicion(d));
const NOMBRES_SIN_TAG = new Set(SIN_TAG.map((d) => d.nombre));

/** Platillos de Comida/Cena servidos en una muestra de planes. */
function servidosFuertes(perfiles: PlanTarget[], seeds: number[], avoid: string[] = []) {
  const out: Array<{ slot: string; name: string }> = [];
  for (const T of perfiles) for (const seed of seeds) {
    for (const d of buildWeeklyPlan(T, { seed, avoid })) {
      for (const m of d.meals) if (m.time === 'Comida' || m.time === 'Cena') out.push({ slot: m.time, name: m.name });
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// A · EL DEFECTO · recetas nominalmente válidas excluidas solo por el tag
// ═════════════════════════════════════════════════════════════════════════════
describe('Decisión 06 · A · el tag ya no excluye recetas válidas', () => {
  it('los platillos sin el tag son por lo demás NOMINALMENTE VÁLIDOS', () => {
    // La premisa del bloque: lo único que les falta es la etiqueta. Son del tiempo
    // correcto, están en el banco y sin restricciones activas nada los excluye.
    expect(SIN_TAG.length, 'hay platillos de Comida/Cena sin el tag').toBeGreaterThan(0);
    const sinRestriccion = makeAvoidFilter([]);
    for (const d of SIN_TAG) {
      expect(['Comida', 'Cena'], d.nombre).toContain(d.tiempo);
      expect(sinRestriccion(d), `${d.nombre} no debe estar excluido por restricciones`).toBe(false);
      expect(d.ings.length, `${d.nombre} tiene ingredientes`).toBeGreaterThan(0);
    }
  });

  it('el motor determinista SÍ puede servirlos (antes de la Decisión 06: nunca)', () => {
    const servidos = servidosFuertes([mk(2300), mk(1800)], [7, 42]);
    const delGrupo = servidos.filter((s) => NOMBRES_SIN_TAG.has(s.name));
    expect(delGrupo.length, 'al menos uno de los platillos sin tag debe poder salir').toBeGreaterThan(0);
  });

  it('el pool de cada tiempo es el NOMINAL completo, sin filtro de guarnición', () => {
    const nominal = (t: string) => BANCO.filter((d) => d.tiempo === t).length;
    expect(nominal('Comida')).toBe(68);
    expect(nominal('Cena')).toBe(54);
    // El motor no declara ningún subconjunto por guarnición ni lo usa como pool. Se busca
    // CÓDIGO, no texto: el comentario histórico de la Decisión 06 nombra a propósito lo que
    // se retiró, y debe poder seguir ahí.
    const codigo = srcEngine.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(codigo, 'no debe declararse hasVeg').not.toMatch(/const\s+hasVeg\s*=/);
    expect(codigo, 'no deben declararse los pools filtrados').not.toMatch(/const\s+(COMIDA_VEG|CENA_VEG)\s*=/);
    expect(codigo, 'no deben usarse como pool').not.toMatch(/\b(COMIDA_VEG|CENA_VEG)\b/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · LA SEMÁNTICA DE DISPLAY SIGUE INTACTA
// ═════════════════════════════════════════════════════════════════════════════
describe('Decisión 06 · B · `guarnicion` conserva su uso de display', () => {
  const ing = (nv: string, rol: string, g0 = 60): BancoIng => ({ nv, rol, g0 });

  it('una guarnición se sigue imprimiendo «al gusto», sin gramos', () => {
    const s = portionStr(ing('Verduras (lechuga, jitomate, cebolla)', 'guarnicion'), 60);
    expect(s).toBe('Verduras (lechuga, jitomate, cebolla) al gusto');
    expect(s, 'sin gramos').not.toMatch(/\d\s*g\b/);
  });

  it('el rol sigue existiendo en el banco y no se ha reescrito ningún dato', () => {
    const conTag = BANCO.filter(conGuarnicion);
    expect(conTag.length, 'los datos no se tocaron').toBeGreaterThan(100);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · LO QUE NO DEBE HABER CAMBIADO (P0-01 → P0-04)
// ═════════════════════════════════════════════════════════════════════════════
describe('Decisión 06 · C · las garantías P0 siguen en pie', () => {
  it('P0-01/P0-02 · las restricciones se siguen aplicando a los platillos nuevos', () => {
    const casos = [['lacteos'], ['gluten'], ['gluten', 'lacteos', 'huevo'], ['pescado', 'mariscos']];
    for (const avoid of casos) {
      const f = makeAvoidFilter(avoid);
      const byName = new Map(BANCO.map((d) => [d.nombre, d]));
      for (const { name } of servidosFuertes([mk(2200)], [5, 33], avoid)) {
        const d = byName.get(name);
        if (d) expect(f(d), `avoid=[${avoid}] sirvió ${name}`).toBe(false);
      }
    }
  });

  it('P0-03 · el tiempo sigue siendo invariante: nada cruza de slot', () => {
    const byName = new Map(BANCO.map((d) => [d.nombre, d]));
    for (const avoid of [[], ['lacteos'], ['gluten', 'lacteos']]) {
      for (const { slot, name } of servidosFuertes([mk(1600), mk(2800)], [11], avoid)) {
        const d = byName.get(name);
        if (d) expect(d.tiempo, `${name} servido en ${slot}`).toBe(slot);
      }
    }
  });

  it('P0-03 · el fail-closed sigue intacto: un tiempo sin candidatos lanza', () => {
    // fixture sintético recalibrado a los pools NOMINALES (ver grupo A de
    // eligibilityInvariants): vacía solo la Comida.
    expect(() => buildWeeklyPlan(mk(2000), { seed: 3, avoid: ['verduras', 'pizca'] }))
      .toThrow(NoEligibleDishesError);
  });

  it('P0-03 · safeBankByTiempo y la ruta IA siguen respetando tiempo y restricciones', () => {
    for (const cats of [[], ['lacteos'], ['gluten', 'huevo']]) {
      const f = makeAvoidFilter(cats);
      for (const bank of [safeBankByTiempo(cats), adequateBankByTiempo(cats, mk(2200), '', 'LATAM')]) {
        for (const slot of ['Comida', 'Cena'] as const) {
          expect(bank[slot].filter((d) => f(d)).map((d) => d.nombre), `${cats} ${slot}`).toEqual([]);
          expect(bank[slot].filter((d) => d.tiempo !== slot).map((d) => d.nombre), `${cats} ${slot}`).toEqual([]);
        }
      }
    }
  });

  it('la ruta IA no cambió: safeBankByTiempo ya ofrecía los pools nominales', () => {
    expect(safeBankByTiempo([]).Comida).toHaveLength(68);
    expect(safeBankByTiempo([]).Cena).toHaveLength(54);
  });

  it('el bowl (buildDayWithFixed) usa también el pool nominal y respeta el tiempo', () => {
    const bowl: FixedMeal = { slot: 'Comida', name: 'Bowl Verde', kcal: 737, prot: 59, fat: 31, carb: 64 };
    const byName = new Map(BANCO.map((d) => [d.nombre, d]));
    const day = buildDayWithFixed(mk(2200), bowl, { avoid: ['lacteos'] }, 1);
    for (const m of day.meals) {
      const d = byName.get(m.name);
      if (d) expect(d.tiempo, `${m.name} en ${m.time}`).toBe(m.time.startsWith('Snack') ? 'Snack' : m.time);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · LOS PLANES SIGUEN SIENDO BUENOS (no hay regresión de macros)
// ═════════════════════════════════════════════════════════════════════════════
describe('Decisión 06 · D · sin regresión en el cuadre del día', () => {
  it('los 7 días siguen pegando la meta con los pools ampliados', () => {
    for (const T of [mk(1450), mk(2300), mk(3500)]) {
      for (const d of buildWeeklyPlan(T, { seed: 7 })) {
        const s = d.meals.reduce((a, m) => ({
          p: a.p + (m.macros?.prot ?? 0), f: a.f + (m.macros?.fat ?? 0), c: a.c + (m.macros?.carb ?? 0),
        }), { p: 0, f: 0, c: 0 });
        expect(Math.abs(s.p - T.protG) / T.protG, `prot @${T.kcal}`).toBeLessThan(0.12);
        expect(Math.abs(s.f - T.fatG) / T.fatG, `fat @${T.kcal}`).toBeLessThan(0.15);
        expect(Math.abs(s.c - T.carbG) / T.carbG, `carb @${T.kcal}`).toBeLessThan(0.15);
      }
    }
  });

  it('la comida sigue siendo la más grande del día (reparto de Magaly)', () => {
    for (const d of buildWeeklyPlan(mk(2300), { seed: 7 })) {
      const k = (t: string) => d.meals.filter((m) => m.time === t).reduce((a, m) => a + (m.macros?.kcal ?? 0), 0);
      expect(k('Comida')).toBeGreaterThanOrEqual(k('Desayuno'));
      expect(k('Comida')).toBeGreaterThanOrEqual(k('Cena'));
    }
  });
});
