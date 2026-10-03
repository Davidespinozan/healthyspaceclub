import { describe, it, expect } from 'vitest';
import srcTargets from '../nutritionTargets.ts?raw';
import {
  computeNutritionTargets,
  legacyEnergy,
  legacyMacros,
  type ObInput,
} from '../nutritionTargets';
import {
  C1_GOLDEN_CASES,
  C1_GOLDEN_SWEEP_COUNT,
  C1_GOLDEN_SWEEP_DIGEST,
} from './c1Golden.fixture';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE C1 · SEAM ENERGÍA → MACROS
//
// C1 separa el cálculo de la ENERGÍA legacy (que muere en C4) del de las MACROS
// legacy (que sobrevive hasta la Fase D), sin cambiar quién calcula la energía
// productiva y sin cambiar un solo número.
//
// ── CÓMO SE DEMUESTRA LA NEUTRALIDAD ────────────────────────────────────────
// NO reimplementando la fórmula —un test que repite el cálculo se equivoca igual
// que el código—, sino contra un GOLDEN capturado MECÁNICAMENTE ejecutando el
// código PRE-refactor en HEAD c219c57: 158 casos de frontera con sus 11 salidas
// completas, más un barrido de 635.040 combinaciones reducido a un dígito FNV-1a.
// Si cualquier número cambia en cualquier rama, el dígito cambia.
// ─────────────────────────────────────────────────────────────────────────────

/** Misma serialización que usó el generador del golden. */
const row = (o: ObInput): string => {
  const t = computeNutritionTargets(o);
  return [t.bmr, t.tdee, t.planGoal, t.floor, t.capped ? 1 : 0, t.wellnessMode ? 1 : 0,
    t.wellnessReason ?? '-', t.protG, t.fatG, t.carbG, t.fiberG].join('|');
};

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const CODIGO = srcTargets
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

/** Cuerpo de una función exportada, hasta la siguiente declaración de nivel raíz. */
function cuerpo(nombre: string): string {
  const i = CODIGO.indexOf(`export function ${nombre}(`);
  expect(i, `no se encontró ${nombre}`).toBeGreaterThan(-1);
  const resto = CODIGO.slice(i + 1);
  const j = resto.indexOf('\nexport ');
  return j === -1 ? resto : resto.slice(0, j);
}

const BASE: ObInput = {
  sexo: 'Hombre', pesoKg: 82, estaturaCm: 178, edad: 34,
  activity: 'Moderada', goal: 'Bajar grasa',
};
const ob = (over: Partial<ObInput> = {}): ObInput => ({ ...BASE, ...over });

// ═════════════════════════════════════════════════════════════════════════════
// A · EQUIVALENCIA NUMÉRICA EXACTA contra el golden pre-refactor
// ═════════════════════════════════════════════════════════════════════════════
describe('C1 · neutralidad numérica', () => {
  it('los 158 casos de frontera dan EXACTAMENTE los mismos 11 valores', () => {
    expect(C1_GOLDEN_CASES.length).toBeGreaterThan(150);
    for (const { o, r } of C1_GOLDEN_CASES) {
      expect(row(o), JSON.stringify(o)).toBe(r);
    }
  });

  it('el barrido de 635.040 combinaciones conserva el dígito', () => {
    const SEXOS = ['Hombre', 'Mujer'];
    const EDADES = [16, 17, 18, 25, 40, 55, 64, 65, 67, 69, 70, 75, 82, 100];
    const PESOS = [40, 45, 50, 70, 82, 100, 120];
    const TALLAS = [148, 155, 160, 170, 178, 190];
    const GRASAS: (number | null)[] = [null, 15, 30];
    const GOALS = ['Bajar grasa', 'Ganar músculo', 'Recomposición', 'Bienestar integral', 'Subir masa muscular', ''];
    const ACTS = ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta'];
    const CONDS: string[][] = [[], ['renal'], ['diabetes']];
    const EMBS = [false, true];

    const partes: string[] = [];
    for (const sexo of SEXOS)
      for (const edad of EDADES)
        for (const pesoKg of PESOS)
          for (const estaturaCm of TALLAS)
            for (const grasa of GRASAS)
              for (const goal of GOALS)
                for (const activity of ACTS)
                  for (const conditions of CONDS)
                    for (const embarazo of EMBS)
                      partes.push(row({ sexo, pesoKg, estaturaCm, edad, activity, goal, grasa, embarazo, conditions }));

    expect(partes.length).toBe(C1_GOLDEN_SWEEP_COUNT);
    expect(fnv1a(partes.join(';'))).toBe(C1_GOLDEN_SWEEP_DIGEST);
  });

  it('la composición es idéntica a ensamblar las dos mitades a mano', () => {
    for (const { o } of C1_GOLDEN_CASES) {
      const e = legacyEnergy(o);
      const m = legacyMacros(o, e.planGoal, e.wellnessMode);
      expect(computeNutritionTargets(o)).toEqual({ ...e, ...m });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · EL SEAM EXISTE DE VERDAD
// ═════════════════════════════════════════════════════════════════════════════
describe('C1 · el seam energía → macros', () => {
  it('fatG, carbG y fiberG siguen la energía SUMINISTRADA, no el planGoal interno', () => {
    const o = ob();
    const interno = legacyEnergy(o).planGoal;
    const ajena = interno + 777;                     // una energía deliberadamente distinta
    expect(ajena).not.toBe(interno);

    const conInterna = legacyMacros(o, interno, false);
    const conAjena = legacyMacros(o, ajena, false);

    expect(conAjena.fatG).not.toBe(conInterna.fatG);
    expect(conAjena.carbG).not.toBe(conInterna.carbG);
    expect(conAjena.fiberG).not.toBe(conInterna.fiberG);

    // Y el valor es EXACTAMENTE función de la energía recibida, no «distinto».
    expect(conAjena.fiberG).toBe(Math.round(ajena / 1000 * 14));
  });

  it('cada una de las tres es función EXACTA de la energía recibida', () => {
    // Barrido de energías ajenas, directamente contra `legacyMacros`: no existe
    // ninguna otra vía para suministrarla, y es la que C4 usará.
    const o = ob();
    for (const kcal of [1_200, 1_650, 1_999, 2_400, 3_600]) {
      const m = legacyMacros(o, kcal, false);
      expect(m.fiberG, `fibra @${kcal}`).toBe(Math.round(kcal / 1000 * 14));
      expect(m.fatG, `grasa @${kcal}`).toBe(Math.round(Math.max(kcal * 0.22 / 9, o.pesoKg * 0.6)));
      expect(m.carbG, `carbos @${kcal}`)
        .toBe(Math.round(Math.max(50, (kcal - m.protG * 4 - m.fatG * 9) / 4)));
    }
  });

  it('`legacyMacros` NO devuelve ningún campo energético', () => {
    // Así C4 no puede arrastrar una cifra energética inventada al resultado: la
    // mitad macro no tiene forma de emitir `tdee`, `planGoal`, `floor` ni `capped`.
    expect(Object.keys(legacyMacros(ob(), 1_999, false)).sort())
      .toEqual(['carbG', 'fatG', 'fiberG', 'protG']);
  });

  it('la composición NO acepta una energía externa', () => {
    // Una API con dos modos dejaría pasar una energía ajena por accidente. El
    // único canal es `legacyMacros`.
    expect(computeNutritionTargets.length).toBe(1);
    expect(CODIGO).toContain('export function computeNutritionTargets(o: ObInput): NutritionTargets');
    expect(CODIGO).not.toMatch(/\benergyOverride\b/);
    expect(CODIGO).toContain('const macros = legacyMacros(o, energy.planGoal, energy.wellnessMode);');
  });

  it('la proteína NO depende de la energía: sigue el contrato legacy', () => {
    const o = ob();
    const a = legacyMacros(o, 1_200, false);
    const b = legacyMacros(o, 3_600, false);
    expect(a.protG).toBe(b.protG);
    // …y sí depende de peso, objetivo, actividad y condiciones.
    expect(legacyMacros(ob({ pesoKg: 60 }), 2_000, false).protG).not.toBe(a.protG);
    expect(legacyMacros(ob({ goal: 'Bienestar integral' }), 2_000, false).protG).not.toBe(a.protG);
    expect(legacyMacros(ob({ activity: 'Sedentaria' }), 2_000, false).protG).not.toBe(a.protG);
    expect(legacyMacros(ob({ conditions: ['renal'] }), 2_000, false).protG).not.toBe(a.protG);
  });

  it('`legacyMacros` NO conoce ni invoca `legacyEnergy`', () => {
    const c = cuerpo('legacyMacros');
    for (const id of ['legacyEnergy', 'planGoal', 'tdee', 'bmr', 'ACTIVITY_FACTORS',
      'goalFactor', 'sexFloor', 'floor', 'capped']) {
      expect(c, `legacyMacros no debe usar ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
    // Su única fuente de energía es el argumento.
    expect(c).toContain('energyKcal');
  });

  it('`legacyEnergy` NO calcula macros', () => {
    const c = cuerpo('legacyEnergy');
    for (const id of ['protG', 'fatG', 'carbG', 'fiberG', 'actIdx', 'GKG', 'FAT_PCT', 'gkg']) {
      expect(c, `legacyEnergy no debe usar ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
  });

  it('no hay una segunda fórmula energética ni doble evaluación', () => {
    // `legacyEnergy` se invoca UNA vez en todo el archivo: dentro de la composición.
    expect(CODIGO.match(/legacyEnergy\(/g)).toHaveLength(2); // declaración + 1 llamada
    expect(CODIGO).toContain('const energy = legacyEnergy(o);');
    // Mifflin, Katch y el factor de actividad siguen existiendo UNA sola vez cada uno.
    expect(CODIGO.match(/370 \+ 21\.6 \* lbm/g)).toHaveLength(1);
    expect(CODIGO.match(/ACTIVITY_FACTORS\[o\.activity\]/g)).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · objKey / wellnessMode · la única dependencia macro → energía
// ═════════════════════════════════════════════════════════════════════════════
describe('C1 · dependencia documentada de wellnessMode', () => {
  // Cómo C4 separará la parte macro de esta señal sin devolverle autoridad
  // energética NO está decidido, y estos tests no lo prejuzgan: solo fijan que en
  // C1 el comportamiento es idéntico y que la dependencia es única y visible.
  it('es la ÚNICA vía por la que la mitad energética afecta a las macros', () => {
    const c = cuerpo('legacyMacros');
    // Dos apariciones: el parámetro de la firma y su ÚNICO uso en el cuerpo, que
    // además solo sirve para elegir la tabla de proteína.
    expect(c.match(/\bwellnessMode\b/g)).toHaveLength(2);
    expect(c).toContain('energyKcal: number, wellnessMode: boolean');
    expect(c).toContain("const objKey = wellnessMode ? 'mantener' : normalizeGoal(o.goal);");
  });

  it('wellnessMode cambia la proteína exactamente como antes de C1', () => {
    const o = ob({ goal: 'Bajar grasa' });
    const normal = legacyMacros(o, 2_000, false);
    const bienestar = legacyMacros(o, 2_000, true);
    // 'bajar' con Moderada = 2.2 g/kg · 'mantener' con Moderada = 1.8 g/kg
    expect(normal.protG).toBe(Math.round(82 * 2.2));
    expect(bienestar.protG).toBe(Math.round(82 * 1.8));
    // …y también la grasa, vía FAT_PCT.
    expect(normal.fatG).not.toBe(bienestar.fatG);
  });

  it('los cuatro caminos de wellness siguen produciendo sus razones', () => {
    expect(legacyEnergy(ob({ edad: 16 })).wellnessReason).toBe('menor');
    expect(legacyEnergy(ob({ sexo: 'Mujer', embarazo: true })).wellnessReason).toBe('embarazo');
    expect(legacyEnergy(ob({ pesoKg: 50, estaturaCm: 190 })).wellnessReason).toBe('bajopeso');
    expect(legacyEnergy(ob({ edad: 75 })).wellnessReason).toBe('adultoMayor');
    expect(legacyEnergy(ob()).wellnessReason).toBe(null);
  });

  it('el umbral de 70 para el tope de PROTEÍNA vive en la mitad macro', () => {
    // Es un umbral distinto del `wellnessMode` energético aunque comparta el número:
    // C4 retira el energético y este se queda hasta D.
    expect(cuerpo('legacyMacros')).toContain('const mayor70 = o.edad >= 70;');
    const joven = legacyMacros(ob({ edad: 50 }), 2_000, false);
    const mayor = legacyMacros(ob({ edad: 72 }), 2_000, false);
    expect(joven.protG).toBe(Math.round(82 * 2.2));
    expect(mayor.protG).toBe(Math.round(82 * 2.0));   // tope de 2.0
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · legacy activity sigue alimentando actIdx, sin tocar energía
// ═════════════════════════════════════════════════════════════════════════════
describe('C1 · legacy activity y actIdx', () => {
  it('las 5 actividades siguen moviendo la proteína por actIdx', () => {
    const p = (activity: string) => legacyMacros(ob({ activity }), 2_000, false).protG;
    expect(p('Sedentaria')).toBe(Math.round(82 * 2.0));
    expect(p('Ligera')).toBe(Math.round(82 * 2.0));     // mismo bucket que Sedentaria
    expect(p('Moderada')).toBe(Math.round(82 * 2.2));
    expect(p('Alta')).toBe(Math.round(82 * 2.4));
    expect(p('Atleta')).toBe(Math.round(82 * 2.4));     // mismo bucket que Alta
  });

  it('con la MISMA energía suministrada, activity NO cambia grasa/carbos/fibra', () => {
    // Prueba de que el único canal de `activity` hacia las macros es `actIdx`:
    // fijada la energía, lo demás no se mueve.
    const ref = legacyMacros(ob({ activity: 'Sedentaria' }), 2_000, false);
    for (const activity of ['Ligera', 'Moderada', 'Alta', 'Atleta']) {
      const m = legacyMacros(ob({ activity }), 2_000, false);
      expect(m.fiberG).toBe(ref.fiberG);
      // la grasa solo se mueve si el piso de 0.6 g/kg manda, que aquí no.
      expect(m.fatG).toBe(ref.fatG);
    }
  });

  it('activity sigue cambiando la energía legacy EXACTAMENTE como en el baseline', () => {
    // C1 no retira activity de la energía: eso es C4. El golden ya lo cubre; esto
    // lo deja explícito.
    const kcal = (activity: string) => legacyEnergy(ob({ activity })).tdee;
    expect(kcal('Sedentaria')).toBeLessThan(kcal('Ligera'));
    expect(kcal('Ligera')).toBeLessThan(kcal('Moderada'));
    expect(kcal('Moderada')).toBeLessThan(kcal('Alta'));
    expect(kcal('Alta')).toBeLessThan(kcal('Atleta'));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · C1 NO adelanta nada de C2/C4
// ═════════════════════════════════════════════════════════════════════════════
describe('C1 · frontera del bloque', () => {
  it('nutritionTargets no conoce la cadena nueva', () => {
    for (const id of ['resolveNutritionEnergy', 'nutritionProfileInputFrom',
      'NutritionEnergyState', 'EnergySnapshot', 'prescribedEnergy',
      'estimateMaintenance', 'classifyActivity', 'energy_snapshot']) {
      expect(CODIGO, `C1 no debe mencionar ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
  });

  it('la energía legacy sigue entera: nada se retiró antes de C4', () => {
    for (const id of ['ACTIVITY_FACTORS', 'goalFactor', 'sexFloor', 'wellnessMode', 'capped']) {
      expect(CODIGO, `${id} debe seguir existiendo`).toMatch(new RegExp(`\\b${id}\\b`));
    }
    expect(CODIGO).toContain('Math.max(sexFloor(o.sexo), bmr)');
  });

  it('las constantes macro no cambiaron', () => {
    const c = cuerpo('legacyMacros');
    expect(c).toContain('bajar:    [2.0, 2.2, 2.4]');
    expect(c).toContain('mantener: [1.6, 1.8, 2.0]');
    expect(c).toContain('recomp:   [1.8, 2.0, 2.2]');
    expect(c).toContain('ganar:    [1.8, 2.0, 2.2]');
    expect(c).toContain("{ bajar: 0.22, recomp: 0.25, mantener: 0.28, ganar: 0.30 }");
    expect(c).toContain('if (gkg > 2.4) gkg = 2.4;');
    expect(c).toContain('if (mayor70 && gkg > 2.0) gkg = 2.0;');
    expect(c).toContain('if (renal && gkg > 1.0) gkg = 1.0;');
    expect(c).toContain('o.pesoKg * 0.6');
  });
});
