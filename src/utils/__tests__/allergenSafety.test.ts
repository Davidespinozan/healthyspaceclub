import { describe, it, expect } from 'vitest';
import { BANCO } from '../../data/banco';
import {
  effectiveDishAvoidText, hiddenAllergenCatsFor, subRecipeIngredientNames,
  canonicalizeAvoidTerm, normAllergen,
} from '../allergenSafety';
import { makeAvoidFilter, expandAvoidCats, buildWeeklyPlan, textMatchesAvoid, type PlanTarget } from '../planEngine';
import type { BancoDish } from '../../data/banco';

// Oracle INDEPENDIENTE: ¿el nombre de un ingrediente implica una categoría de avoid? Se corre el sistema
// REAL (effectiveDishAvoidText sobre un plato sintético + expandAvoidCats) contra HECHOS hardcodeados.
// Si effectiveDishAvoidText y su derivación comparten un bug, la tabla hardcodeada lo atrapa.
const matchText = (text: string, terms: string[]) => {
  const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
  return terms.some(t => (t.includes(' ') ? text.includes(t) : words.has(t)));
};
const ingImpliesCat = (nv: string, cat: string): boolean => {
  const synthetic = { nombre: '', ings: [{ nv, rol: 'principal', g0: 1 }] } as unknown as BancoDish;
  return matchText(effectiveDishAvoidText(synthetic), expandAvoidCats([cat]));
};

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N3 · COMPOSITE-INGREDIENT / ALLERGEN SAFETY.
// El MISMO makeAvoidFilter (fail-closed) ahora ve alérgenos escondidos en SUB-RECETAS (SUBRECETAS ya en
// banco.ts) y en composites atómicos (mayonesa=huevo, hummus=ajonjolí…). Tests con platos REALES + un
// invariante de propiedad independiente del AVOID_MAP-como-oracle.
// ─────────────────────────────────────────────────────────────────────────────

const avoids = (cat: string) => makeAvoidFilter([cat]);           // predicado: true = EXCLUIR
const dishWithIng = (rx: RegExp) => BANCO.find(d => d.ings.some(i => rx.test(i.nv)))!;
const dishWithSub = (subName: RegExp) => BANCO.find(d => d.ings.some(i => subName.test(normAllergen(i.nv)) && subRecipeIngredientNames(i.nv).length > 0))!;

// ── Helpers puros (§9) ───────────────────────────────────────────────────────
describe('N3 · reglas de composite oculto + expansión de sub-receta', () => {
  it('mayonesa→huevo · hummus/tahini→ajonjoli · pesto→lacteos+frutos-secos · salsa de soya→gluten', () => {
    expect(hiddenAllergenCatsFor('Mayonesa light')).toEqual(['huevo']);
    expect(hiddenAllergenCatsFor('Mayonesa sriracha')).toEqual(['huevo']);
    expect(hiddenAllergenCatsFor('Hummus')).toEqual(['ajonjoli']);
    expect(hiddenAllergenCatsFor('Salsa pesto')).toEqual(['lacteos', 'frutos-secos']);
    expect(hiddenAllergenCatsFor('Salsa de soya')).toEqual(['gluten']);
    expect(hiddenAllergenCatsFor('Corn flakes triturados')).toEqual(['gluten']);
  });
  it('crema lácteo SÍ; crema de cacahuate/almendra NO (false-positive audit §12)', () => {
    expect(hiddenAllergenCatsFor('Crema light')).toEqual(['lacteos']);
    expect(hiddenAllergenCatsFor('Crema')).toEqual(['lacteos']);
    expect(hiddenAllergenCatsFor('Crema de cacahuate')).toEqual([]);   // mantequilla de maní, no lácteo
    expect(hiddenAllergenCatsFor('Crema de almendra')).toEqual([]);
  });
  it('SUBRECETAS case/acento-insensible: "Aderezo césar" resuelve a "Aderezo César"', () => {
    const ings = subRecipeIngredientNames('Aderezo césar');   // el plato la referencia en minúscula
    expect(ings.length).toBeGreaterThan(0);
    expect(ings.some(n => /mayonesa/i.test(n))).toBe(true);   // → huevo
    expect(ings.some(n => /parmesano/i.test(n))).toBe(true);  // → lácteo
    expect(subRecipeIngredientNames('vinagreta balsámica').some(n => /miel/i.test(n))).toBe(true);
  });
  it('effectiveDishAvoidText es puro y no muta el plato', () => {
    const d = dishWithIng(/mayonesa/i);
    const snap = JSON.stringify(d);
    expect(effectiveDishAvoidText(d)).toBe(effectiveDishAvoidText(d));
    expect(JSON.stringify(d)).toBe(snap);
  });
});

// ── Matriz adversaria con platos REALES (§10) ────────────────────────────────
describe('N3 · el filtro EXCLUYE el alérgeno oculto (platos reales)', () => {
  it('A · mayonesa → REJECT para avoid huevo', () => {
    expect(avoids('huevo')(dishWithIng(/mayonesa/i))).toBe(true);
  });
  it('B · hummus → REJECT para avoid ajonjoli/sésamo', () => {
    expect(avoids('ajonjoli')(dishWithIng(/hummus/i))).toBe(true);
  });
  it('C/D · pesto → REJECT para lácteos y frutos-secos', () => {
    const d = dishWithIng(/pesto/i);
    expect(avoids('lacteos')(d)).toBe(true);
    expect(avoids('frutos-secos')(d)).toBe(true);
  });
  it('E · tzatziki (sub-receta) → REJECT para lácteos', () => {
    expect(avoids('lacteos')(dishWithSub(/tzatziki/))).toBe(true);
  });
  it('F/G · Aderezo César (sub-receta) → REJECT para huevo Y lácteos', () => {
    const d = dishWithSub(/aderezo cesar/);
    expect(avoids('huevo')(d)).toBe(true);
    expect(avoids('lacteos')(d)).toBe(true);
  });
  it('H · Aderezo chipotle (sub-receta) → REJECT para vegano (yoghurt+mayonesa)', () => {
    expect(avoids('vegano')(dishWithSub(/aderezo chipotle/))).toBe(true);
  });
  it('K · corn flakes triturados → REJECT para gluten', () => {
    const d = dishWithIng(/corn\s*flakes/i);
    if (d) expect(avoids('gluten')(d)).toBe(true);
  });
  it('J · vinagreta balsámica (miel) → REJECT para vegano', () => {
    expect(avoids('vegano')(dishWithSub(/vinagreta balsamica/))).toBe(true);
  });
});

// ── Regresión legacy: lo que ya se detectaba sigue detectándose (§10 L/M/N) ──
describe('N3 · restricciones legacy intactas (sin regresión)', () => {
  it('crema de cacahuate → sigue REJECT para cacahuate', () => {
    expect(avoids('cacahuate')(dishWithIng(/crema de cacahuate/i))).toBe(true);
  });
  it('crema de cacahuate/almendra → NO false-positive para lácteos', () => {
    // un plato cuya ÚNICA "crema" es de cacahuate/almendra y sin otro lácteo NO debe excluirse por lacteos
    const nutButterOnly = BANCO.find(d =>
      d.ings.some(i => /crema de (cacahuate|almendra)/i.test(i.nv)) &&
      !d.ings.some(i => /queso|yogur|leche|requeson|ricotta|panela|\bcrema\b(?! de)/i.test(i.nv)) &&
      subRecipeIngredientNames(d.ings.find(x => /mayonesa|cesar|chipotle|tzatziki/i.test(x.nv))?.nv ?? '__none__').length === 0);
    if (nutButterOnly) expect(avoids('lacteos')(nutButterOnly)).toBe(false);
  });
});

// ── Localización de entrada del usuario (§4) ─────────────────────────────────
describe('N3 · alias localizados del usuario', () => {
  it('maní / cacahuete → cacahuate; sésamo → ajonjoli', () => {
    expect(canonicalizeAvoidTerm('maní')).toBe('cacahuate');
    expect(canonicalizeAvoidTerm('cacahuete')).toBe('cacahuate');
    expect(canonicalizeAvoidTerm('sésamo')).toBe('ajonjoli');
    expect(expandAvoidCats(['maní'])).toEqual(expandAvoidCats(['cacahuate']));
  });
  it('avoid "maní" excluye los mismos platos que "cacahuate"', () => {
    const d = dishWithIng(/cacahuate/i);
    expect(makeAvoidFilter(['maní'])(d)).toBe(avoids('cacahuate')(d));
  });
});

// ── Batido de proteína (§5) ──────────────────────────────────────────────────
describe('N3 · el batido whey no se prescribe a lácteos/vegano', () => {
  const T = (kcal: number): PlanTarget => ({ kcal, protG: Math.round(kcal*0.28/4), fatG: Math.round(kcal*0.27/9), carbG: Math.round(kcal*0.45/4) });
  const hasWheyShake = (days: ReturnType<typeof buildWeeklyPlan>) =>
    days.some(d => d.meals.some(m => m.name === 'Batido de Proteína' && !/vegana/i.test(m.desc ?? '')));
  it('regular (whey) + avoid lacteos → NO batido', () => {
    const days = buildWeeklyPlan(T(2500), { seed: 7, avoid: ['lacteos'], shake: { slots: ['am'], type: 'regular', protG: 30 } });
    expect(hasWheyShake(days)).toBe(false);
  });
  it('massgainer (whey) + vegano → NO batido', () => {
    const days = buildWeeklyPlan(T(2500), { seed: 7, avoid: ['vegano'], shake: { slots: ['am'], type: 'massgainer', protG: 40 } });
    expect(hasWheyShake(days)).toBe(false);
  });
  it('usuario sin restricción → el batido whey se conserva', () => {
    const days = buildWeeklyPlan(T(2500), { seed: 7, shake: { slots: ['am'], type: 'regular', protG: 30 } });
    expect(days.some(d => d.meals.some(m => m.name === 'Batido de Proteína'))).toBe(true);
  });
});

// ── ORACLE INDEPENDIENTE · hechos de seguridad HARDCODEADOS (§3) ─────────────
describe('N3 · tabla de hechos de seguridad (hardcoded, no derivada del helper)', () => {
  const EXPECT: { nv: string; must: string[]; mustNot: string[] }[] = [
    { nv: 'Mayonesa light', must: ['huevo'], mustNot: ['lacteos', 'ajonjoli'] },
    { nv: 'Hummus', must: ['ajonjoli'], mustNot: ['huevo', 'lacteos'] },
    { nv: 'Aderezo César', must: ['huevo', 'lacteos'], mustNot: ['cacahuate'] },          // sub-receta
    { nv: 'Aderezo chipotle', must: ['huevo', 'lacteos', 'soya', 'gluten'], mustNot: ['cacahuate'] }, // sub-receta
    { nv: 'Tzatziki', must: ['lacteos'], mustNot: ['huevo'] },                             // sub-receta
    { nv: 'Salsa Tinga', must: ['vegetariano'], mustNot: [] },                             // caldo de pollo
    { nv: 'Salsa pesto', must: ['lacteos', 'frutos-secos'], mustNot: ['huevo'] },
    { nv: 'Salsa de soya', must: ['gluten', 'soya'], mustNot: ['lacteos'] },
    { nv: 'Vinagreta balsámica', must: ['vegano'], mustNot: [] },                          // miel
    { nv: 'Corn flakes triturados', must: ['gluten'], mustNot: [] },
    // controles SEGUROS
    { nv: 'Guacamole', must: [], mustNot: ['huevo', 'lacteos', 'ajonjoli', 'gluten'] },
    { nv: 'Pico de gallo', must: [], mustNot: ['huevo', 'lacteos', 'ajonjoli', 'gluten'] },
    { nv: 'Crema de cacahuate', must: ['cacahuate'], mustNot: ['lacteos'] },
    { nv: 'Crema de almendra', must: ['frutos-secos'], mustNot: ['lacteos'] },
  ];
  for (const e of EXPECT) {
    it(`${e.nv}: implica [${e.must.join(',')}] y NO [${e.mustNot.join(',')}]`, () => {
      for (const c of e.must) expect(ingImpliesCat(e.nv, c), `${e.nv} debe implicar ${c}`).toBe(true);
      for (const c of e.mustNot) expect(ingImpliesCat(e.nv, c), `${e.nv} NO debe implicar ${c}`).toBe(false);
    });
  }
});

// ── STATIC FALLBACK fail-closed (§6) ─────────────────────────────────────────
describe('N3 · el plan estático es fail-closed (nunca sirve el alérgeno)', () => {
  it('un plan donde TODOS los días llevan el alérgeno → filtrado vacío (no el plan sin filtrar)', () => {
    const terms = expandAvoidCats(['huevo']);
    const regionPlan = [1, 2, 3].map(day => ({ day, theme: '', meals: [{ time: 'Desayuno', name: 'Omelette', desc: '', portions: ['2 pz huevo'] }] }));
    // misma lógica que TabHoy (post-N3): safe SIN fallback a regionPlan
    const safe = regionPlan.filter(d => !(d.meals ?? []).some(m =>
      textMatchesAvoid(m.name || '', terms) || (m.portions ?? []).some(p => textMatchesAvoid(p, terms))));
    expect(safe).toEqual([]);                 // fail-closed: vacío, NO regionPlan
    expect(safe).not.toBe(regionPlan);
  });
});

// ── INVARIANTE DE PROPIEDAD (§11) — oracle independiente del AVOID_MAP ────────
describe('N3 · property: ningún plato generado contiene el alérgeno evitado', () => {
  const RESTR = ['huevo', 'ajonjoli', 'lacteos', 'gluten', 'soya', 'cacahuate', 'frutos-secos', 'pescado', 'mariscos', 'vegetariano', 'vegano'];
  const KCAL = [1450, 1800, 2200, 3000];
  const SEEDS = [7, 42, 99];
  const byName = new Map(BANCO.map(d => [d.nombre, d]));

  // Un test por restricción (12 generaciones c/u) → cada uno rápido; cobertura completa 4kcal × 3 seeds.
  for (const r of RESTR) {
    it(`avoid ${r}: 7 días compliant, 0 fuga del alérgeno (ings+SUBRECETAS+composites)`, () => {
      const terms = expandAvoidCats([r]);
      const leaks: string[] = [];
      for (const kcal of KCAL) for (const seed of SEEDS) {
        const days = buildWeeklyPlan({ kcal, protG: Math.round(kcal*0.28/4), fatG: Math.round(kcal*0.27/9), carbG: Math.round(kcal*0.45/4) }, { seed, avoid: [r] });
        expect(days).toHaveLength(7);
        for (const d of days) for (const m of d.meals) {
          const dish = byName.get(m.name);
          if (!dish) continue;   // batidos/compuestos sin plato base
          const text = effectiveDishAvoidText(dish);
          const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
          for (const t of terms) {
            if (t.includes(' ') ? text.includes(t) : words.has(t)) leaks.push(`${r} @${kcal}/${seed}: ${m.name} ~ ${t}`);
          }
        }
      }
      expect(leaks).toEqual([]);
    });
  }
});
