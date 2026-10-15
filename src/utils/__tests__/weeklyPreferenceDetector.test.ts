import { describe, it, expect } from 'vitest';
import { BANCO, type BancoDish } from '../../data/banco';
import { makeAvoidFilter, makePreferenceFilter } from '../planEngine';
import { dishAvoidUnits, hiddenAllergenCatsFor, HIDDEN_RULE_RELATIONS } from '../allergenSafety';
import { PERMANENT_AVOID_CATALOG } from '../avoidAuthority';

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY PREFERENCES SPLIT · MB1 · detector SUAVE de preferencia semanal (CLOSED_DESIGN).
//   STRICT (permanente, D-WP1) = ingrediente propio + sub-recetas + reglas ocultas IS y CONTAINS.
//   SOFT   (semanal,    D-WP2) = solo ingrediente PROPIO/VISIBLE + reglas IS; sin sub-recetas ni CONTAINS.
// Sin "protagonista" (D-WP3): no se mira nombre, gramos, rol ni macros.
// El whey vive fuera de esta autoridad de platillos (`shakeCompatibleWith`): se conecta en MB4 (D-WP5).
// Nada productivo consume todavía `makePreferenceFilter`.
// ─────────────────────────────────────────────────────────────────────────────

const dish = (nombre: string): BancoDish => {
  const d = BANCO.find((x) => x.nombre === nombre);
  if (!d) throw new Error(`no está en el banco: ${nombre}`);
  return d;
};
const strict = (cat: string, nombre: string) => makeAvoidFilter([cat])(dish(nombre));
const soft = (cat: string, nombre: string) => makePreferenceFilter([cat])(dish(nombre));

describe('HIDDEN_RULES · relación IS / CONTAINS', () => {
  it('cada regla está tipada como se decidió (sin reglas nuevas: tahini solo se separa del hummus)', () => {
    expect(HIDDEN_RULE_RELATIONS.map((r) => [r.name, [...r.cats], r.relation])).toEqual([
      ['mayonesa→huevo', ['huevo'], 'CONTAINS'],
      ['hummus→ajonjoli', ['ajonjoli'], 'CONTAINS'],
      ['tahini→ajonjoli', ['ajonjoli'], 'IS'],
      ['pesto→lacteos+frutos-secos', ['lacteos', 'frutos-secos'], 'CONTAINS'],
      ['salsa-de-soya→gluten', ['gluten'], 'CONTAINS'],
      ['corn-flakes→gluten', ['gluten'], 'CONTAINS'],
      ['crema(dairy)→lacteos', ['lacteos'], 'IS'],
    ]);
  });
  it('strict aplica todas; soft solo las IS', () => {
    expect(hiddenAllergenCatsFor('Mayonesa light')).toEqual(['huevo']);
    expect(hiddenAllergenCatsFor('Mayonesa light', 'soft')).toEqual([]);
    expect(hiddenAllergenCatsFor('Hummus', 'soft')).toEqual([]);
    expect(hiddenAllergenCatsFor('Tahini', 'soft')).toEqual(['ajonjoli']);
    expect(hiddenAllergenCatsFor('Salsa pesto', 'soft')).toEqual([]);
    expect(hiddenAllergenCatsFor('Salsa de soya', 'soft')).toEqual([]);
    expect(hiddenAllergenCatsFor('Crema light', 'soft')).toEqual(['lacteos']);
    expect(hiddenAllergenCatsFor('Queso crema', 'soft')).toEqual(['lacteos']);
    expect(hiddenAllergenCatsFor('Crema de cacahuate', 'soft')).toEqual([]);   // mantequilla, no lácteo
  });
  it('soft NO expande sub-recetas; strict sí (y strict es el modo por defecto)', () => {
    const d = dish('Bowl de Camarón Mediterráneo');   // lleva Tzatziki (sub-receta con yogurt griego)
    expect(dishAvoidUnits(d)).toEqual(dishAvoidUnits(d, 'strict'));
    expect(dishAvoidUnits(d, 'strict').some((u) => u.includes('yogurt griego'))).toBe(true);
    expect(dishAvoidUnits(d, 'soft').some((u) => u.includes('yogurt'))).toBe(false);
    expect(dishAvoidUnits(d, 'soft')).toContain('tzatziki');
  });
});

describe('HUEVO', () => {
  it.each(['Huevos Rancheros', 'Machaca con Huevo', 'Bowl de Lentejas con Huevo Pochado', 'Huevos Pochados sobre Toast de Aguacate'])(
    'huevo visible · %s → STRICT excluye y SOFT evita', (n) => {
      expect(strict('huevo', n)).toBe(true);
      expect(soft('huevo', n)).toBe(true);
    });
  it('Tostadas de Atún (Mayonesa light como ingrediente propio) → STRICT excluye, SOFT permite', () => {
    expect(dish('Tostadas de Atún').ings.map((i) => i.nv)).toContain('Mayonesa light');
    expect(strict('huevo', 'Tostadas de Atún')).toBe(true);
    expect(soft('huevo', 'Tostadas de Atún')).toBe(false);
  });
  it.each(['Pasta Fría con Pollo y Aderezo Chipotle', 'Ensalada César con Pollo', 'Burger Bowl'])(
    'huevo solo dentro de una sub-receta (mayonesa del aderezo) · %s → STRICT excluye, SOFT permite', (n) => {
      expect(strict('huevo', n)).toBe(true);
      expect(soft('huevo', n)).toBe(false);
    });
});

describe('LÁCTEOS', () => {
  it.each([
    ['queso', 'Queso Fresco con Cacahuate y Manzana'],
    ['cottage', 'Bowl de Cottage con Durazno y Nuez'],
    ['panela', 'Panela a la Plancha con Salsa'],
    ['crema visible (regla IS, sin término del diccionario)', 'Camote Relleno de Carne Molida'],
  ])('%s · %s → STRICT excluye y SOFT evita', (_k, n) => {
    expect(strict('lacteos', n)).toBe(true);
    expect(soft('lacteos', n)).toBe(true);
  });
  it.each([
    ['Tzatziki', 'Bowl de Camarón Mediterráneo'],
    ['Tzatziki', 'Bowl de Salmón y Quinoa con Aguacate'],
    ['Aderezo chipotle', 'Pasta Fría con Pollo y Aderezo Chipotle'],
    ['Aderezo de hamburguesa', 'Burger Bowl'],
  ])('yogurt solo dentro de %s · %s → STRICT excluye, SOFT permite', (_k, n) => {
    expect(strict('lacteos', n)).toBe(true);
    expect(soft('lacteos', n)).toBe(false);
  });
});

describe('MISMO DICCIONARIO · alias y excepciones también en SOFT', () => {
  it('alias de entrada', () => {
    for (const a of ['lacteos', 'Lácteos', 'lacteo', 'sin lacteos']) expect(makePreferenceFilter([a])(dish('Panela a la Plancha con Salsa')), a).toBe(true);
    for (const a of ['huevo', 'sin huevo']) expect(makePreferenceFilter([a])(dish('Huevos Rancheros')), a).toBe(true);
  });
  it('TERM_EXCEPT: galletas de arroz no son gluten en SOFT ni en STRICT', () => {
    const n = 'Galletas de Arroz con Crema de Cacahuate y Plátano';
    expect(strict('gluten', n)).toBe(false);
    expect(soft('gluten', n)).toBe(false);
  });
  it('un compuesto PROPIO que solo CONTIENE la categoría no cuenta en SOFT (pesto → frutos secos)', () => {
    expect(strict('frutos-secos', 'Pasta al Pesto con Pollo')).toBe(true);
    expect(soft('frutos-secos', 'Pasta al Pesto con Pollo')).toBe(false);
    // …pero el parmesano VISIBLE del mismo platillo sí cuenta para lácteos
    expect(soft('lacteos', 'Pasta al Pesto con Pollo')).toBe(true);
  });
  it('sin categorías → nada se evita', () => {
    expect(BANCO.filter(makePreferenceFilter([])).length).toBe(0);
  });
});

describe('CONTEOS DE REGRESIÓN · banco real', () => {
  const count = (f: (d: BancoDish) => boolean) => BANCO.filter(f).length;
  it('huevo: STRICT 84 · SOFT 64 (medición de Carril B)', () => {
    expect(count(makeAvoidFilter(['huevo']))).toBe(84);
    expect(count(makePreferenceFilter(['huevo']))).toBe(64);
  });
  // DECISIÓN VINCULANTE (producto, 2026-10-15): lácteos SOFT = 169. La «Crema» visible cuenta como lácteo
  // para la preferencia semanal (regla crema → lácteos = IS). El audit de Carril B estimó ≈168 porque no
  // aplicaba las reglas IS; la diferencia es exactamente «Camote Relleno de Carne Molida», que se evita.
  it('lácteos: STRICT 175 · SOFT 169 (decisión vinculante; ≈168 de Carril B no aplicaba la regla IS de la crema)', () => {
    expect(count(makeAvoidFilter(['lacteos']))).toBe(175);
    expect(count(makePreferenceFilter(['lacteos']))).toBe(169);
    // Único platillo cuyo lácteo visible llega SOLO por la regla IS de la crema (ningún término del
    // diccionario lo ve). Sin aplicar las reglas IS, SOFT daría 168.
    const soloPorIS = BANCO.filter((d) => makePreferenceFilter(['lacteos'])(d)
      && !d.ings.some((i) => /\b(leche|queso|yogur|yoghurt|yogurt|requeson|ricotta|cottage|panela|oaxaca|feta|mozzarella|parmesano|crema acida)\b/.test(i.nv.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))));
    expect(soloPorIS.map((d) => d.nombre)).toEqual(['Camote Relleno de Carne Molida']);
  });
});

describe('INVARIANTE · SOFT nunca es más restrictivo que STRICT (banco completo)', () => {
  it('para toda categoría y todo platillo: SOFT excluye ⇒ STRICT excluye', () => {
    const cats = [...PERMANENT_AVOID_CATALOG, 'pollo', 'pavo', 'cerdo', 'vegano', 'vegetariano'];
    const fallas: string[] = [];
    for (const c of cats) {
      const st = makeAvoidFilter([c]), so = makePreferenceFilter([c]);
      for (const d of BANCO) if (so(d) && !st(d)) fallas.push(`${c} · ${d.nombre}`);
    }
    expect(fallas).toEqual([]);
  });
  it('por construcción: cada unidad SOFT está contenida en la unidad STRICT del mismo ingrediente', () => {
    for (const d of BANCO) {
      const st = new Set(dishAvoidUnits(d, 'strict').flatMap((u) => u.split(' ')));
      for (const w of dishAvoidUnits(d, 'soft').flatMap((u) => u.split(' '))) expect(st.has(w), `${d.nombre} · ${w}`).toBe(true);
    }
  });
});

describe('CONSUMIDORES · el modo suave solo lo usa la VALIDACIÓN (MB2); la generación todavía no (MB3)', () => {
  it('el único módulo productivo que usa el filtro de preferencia es planIntegrity', () => {
    const files = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const users = Object.entries(files)
      .filter(([p]) => !p.includes('__tests__') && !/\.(test|spec)\.tsx?$/.test(p))
      .filter(([p, src]) => !p.endsWith('/planEngine.ts') && !p.endsWith('/allergenSafety.ts') && /makePreferenceFilter|'soft'/.test(src))
      .map(([p]) => p);
    expect(users).toEqual(['../planIntegrity.ts']);
  });
  it('dentro de planEngine, el filtro de preferencia no alimenta ningún pool del generador', () => {
    const src = (import.meta.glob('../planEngine.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../planEngine.ts'];
    const usos = src.split('\n').filter((l) => /makePreferenceFilter\(|\.soft\b/.test(l) && !/^\s*(\/\/|\*)/.test(l));
    // solo su propia definición y el acceso a las unidades suaves dentro de ella
    expect(usos.map((l) => l.trim())).toEqual([
      'export function makePreferenceFilter(softCats: string[]): (d: BancoDish) => boolean {',
      'return (d: BancoDish) => unitsMatchAvoidTerms(dishText(d).soft, terms);',
    ]);
  });
});
