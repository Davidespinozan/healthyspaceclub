import { describe, it, expect } from 'vitest';
import srcTargets from '../nutritionTargets.ts?raw';
import {
  legacyMacros,
  legacyMacroWellness,
  type ObInput,
} from '../nutritionTargets';
import { C1_GOLDEN_CASES } from './c1Golden.fixture';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE C1 (seam) → FASE C5 (macro-only)
//
// C1 separó el cálculo de la ENERGÍA legacy del de las MACROS legacy. **C5 borra
// la mitad energética**, así que este fichero deja de custodiar las dos y queda
// como la red de seguridad de la ÚNICA que sobrevive: `legacyMacros`, que recibe
// la energía desde fuera y no la calcula.
//
// ── CÓMO SE DEMUESTRA LA NEUTRALIDAD, ANTES Y AHORA ─────────────────────────
// NO reimplementando la fórmula —un test que repite el cálculo se equivoca igual
// que el código—, sino contra un GOLDEN capturado MECÁNICAMENTE. El de C1 salió
// de ejecutar el código PRE-refactor en HEAD c219c57: 167 casos de frontera con
// sus 11 salidas, más un barrido de 635.040 combinaciones en un dígito FNV-1a.
//
// C5 reutiliza ESE MISMO golden sin regenerarlo, cambiando qué papel juega cada
// columna:
//
//   ANTES          bmr|tdee|planGoal|floor|capped|wellnessMode | protG|fatG|carbG|fiberG
//                  └──────────── expectativa ────────────────┘ └──── expectativa ────┘
//
//   AHORA          bmr|tdee|planGoal|floor|capped|wellnessMode | protG|fatG|carbG|fiberG
//                             └── INPUT ──┘ └ INPUT ┘           └──── expectativa ────┘
//
// Es decir: se le suministra a `legacyMacros` exactamente la energía y el
// `wellnessMode` que la fórmula legacy producía, y se exige que los cuatro
// gramos salgan idénticos. Si C5 hubiera tocado una sola regla macro, falla.
// Las columnas energéticas dejan de comprobarse porque la fórmula que las
// producía ya no existe; conservarlas como entrada es lo que permite no
// regenerar el golden y, por tanto, no poder «ajustarlo» para que pase.
//
// El barrido se rehace macro-only con energía ROTATORIA (ver §A): no puede
// derivarse de `legacyEnergy`, que ya no está, así que se inyectan cinco niveles
// de kcal ciclando sobre las 635.040 combinaciones de perfil. Su dígito se
// capturó ANTES de borrar nada, en el baseline 13f744b.
// ─────────────────────────────────────────────────────────────────────────────

/** Serialización macro-only: las cuatro columnas que C5 debe preservar. */
const macroRow = (o: ObInput, energyKcal: number, wellnessMode: boolean): string => {
  const m = legacyMacros(o, energyKcal, wellnessMode);
  return [m.protG, m.fatG, m.carbG, m.fiberG].join('|');
};

/**
 * Energías inyectadas en el barrido macro. Cinco niveles que cruzan los umbrales
 * que importan: el piso de grasa de 0.6 g/kg, el piso de carbos de 50 g y el
 * escalón de fibra por 1000 kcal.
 */
const SWEEP_KCAL = [1200, 1650, 1999, 2400, 3600];

/**
 * Dígito del barrido macro, capturado en el baseline 13f744b ANTES de retirar la
 * energía legacy. No se regenera: si cambia, C5 cambió las macros.
 */
const C5_MACRO_SWEEP_DIGEST = '1c90045c';

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
describe('C5 · neutralidad macro', () => {
  it('los 167 casos de frontera dan EXACTAMENTE las mismas 4 macros', () => {
    expect(C1_GOLDEN_CASES.length).toBe(167);
    for (const { o, r } of C1_GOLDEN_CASES) {
      const c = r.split('|');
      // Columnas 2 y 5 del golden: la energía y el `wellnessMode` que la fórmula
      // legacy producía para este perfil. Entran como ARGUMENTOS.
      const planGoal = Number(c[2]);
      const wellnessMode = c[5] === '1';
      // Columnas 7-10: las cuatro macros. Son la expectativa.
      const esperado = [c[7], c[8], c[9], c[10]].join('|');
      expect(macroRow(o, planGoal, wellnessMode), JSON.stringify(o)).toBe(esperado);
    }
  });

  it('el barrido macro de 635.040 combinaciones conserva el dígito', () => {
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
    let n = 0;
    for (const sexo of SEXOS)
      for (const edad of EDADES)
        for (const pesoKg of PESOS)
          for (const estaturaCm of TALLAS)
            for (const grasa of GRASAS)
              for (const goal of GOALS)
                for (const activity of ACTS)
                  for (const conditions of CONDS)
                    for (const embarazo of EMBS) {
                      const o: ObInput = { sexo, pesoKg, estaturaCm, edad, activity, goal, grasa, embarazo, conditions };
                      // Energía rotatoria + el predicado macro que SOBREVIVE: ni una
                      // sola llamada a la energía legacy, que ya no existe.
                      partes.push(macroRow(o, SWEEP_KCAL[n % SWEEP_KCAL.length], legacyMacroWellness(o)));
                      n++;
                    }

    expect(partes.length).toBe(635040);
    expect(fnv1a(partes.join(';'))).toBe(C5_MACRO_SWEEP_DIGEST);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · EL SEAM EXISTE DE VERDAD
// ═════════════════════════════════════════════════════════════════════════════
describe('C5 · el seam energía → macros', () => {
  it('fatG, carbG y fiberG siguen la energía SUMINISTRADA', () => {
    // C1 comparaba contra `legacyEnergy(o).planGoal` para probar que la energía
    // interna no mandaba. C5 ya no tiene energía interna que comparar: la prueba
    // es más simple y más fuerte — dos energías cualesquiera dan macros distintas,
    // porque el ARGUMENTO es la única fuente que existe.
    const o = ob();
    const interno = 2_300;
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

  it('C5 · ya no existe ninguna composición que inyecte energía implícita', () => {
    // C1 tenía que demostrar que la composición no admitía DOS modos (energía
    // implícita o inyectada). C5 la borra entera: el único canal de energía hacia
    // las macros es el argumento `energyKcal`, y no hay segunda puerta.
    expect(legacyMacros.length).toBe(3);
    expect(CODIGO).not.toMatch(/\bcomputeNutritionTargets\b/);
    expect(CODIGO).not.toMatch(/\bNutritionTargets\b/);
    expect(CODIGO).not.toMatch(/\benergyOverride\b/);
    expect(CODIGO).not.toMatch(/energy\.planGoal/);
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

  it('`legacyMacros` NO conoce ninguna cifra energética', () => {
    const c = cuerpo('legacyMacros');
    for (const id of ['legacyEnergy', 'planGoal', 'tdee', 'bmr', 'ACTIVITY_FACTORS',
      'goalFactor', 'sexFloor', 'floor', 'capped']) {
      expect(c, `legacyMacros no debe usar ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
    // Su única fuente de energía es el argumento.
    expect(c).toContain('energyKcal');
  });

  it('C5 · NO queda ninguna fórmula energética en el fichero', () => {
    // C1 fijaba que Mifflin, Katch y el factor de actividad existían UNA vez cada
    // uno. C5 los retira: la cuenta pasa de uno a cero.
    expect(CODIGO).not.toMatch(/370 \+ 21\.6 \* lbm/);     // Katch-McArdle
    expect(CODIGO).not.toMatch(/6\.25 \* o\.estaturaCm/);  // Mifflin-St Jeor
    expect(CODIGO).not.toMatch(/ACTIVITY_FACTORS/);
    expect(CODIGO).not.toMatch(/\bgoalFactor\b/);
    expect(CODIGO).not.toMatch(/\bsexFloor\b/);
    expect(CODIGO).not.toMatch(/\blegacyEnergy\b/);
    expect(CODIGO).not.toMatch(/\bLegacyEnergy\b/);
    expect(CODIGO).not.toMatch(/\bWellnessReason\b/);
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

  it('los cuatro caminos de wellness siguen activando el predicado macro', () => {
    // C1 comprobaba las CUATRO razones (`'menor'`, `'embarazo'`, `'bajopeso'`,
    // `'adultoMayor'`) sobre `legacyEnergy`. Esas etiquetas murieron con ella: su
    // único consumidor productivo era la UI del onboarding, que C4 sustituyó por
    // los motivos del estado energético nuevo (`sinMeta*`). Lo que importa para
    // las MACROS es el booleano, y las cuatro ramas lo siguen activando igual.
    expect(legacyMacroWellness(ob({ edad: 16 }))).toBe(true);                        // menor
    expect(legacyMacroWellness(ob({ sexo: 'Mujer', embarazo: true }))).toBe(true);    // embarazo
    expect(legacyMacroWellness(ob({ pesoKg: 50, estaturaCm: 190 }))).toBe(true);      // IMC<18.5 + bajar
    expect(legacyMacroWellness(ob({ edad: 75 }))).toBe(true);                         // >=70
    expect(legacyMacroWellness(ob())).toBe(false);
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

  it('C5 · activity ya NO alimenta ninguna energía, solo `actIdx`', () => {
    // C1 fijaba que las 5 actividades movían el TDEE legacy. C5 retira esa ruta
    // por completo: `obData.activity` sobrevive —lo leen Training, el Coach y
    // Ajustes— pero su único efecto nutricional es el bucket de proteína.
    expect(CODIGO.match(/o\.activity/g)).toHaveLength(3); // los 3 usos de actIdx
    expect(cuerpo('legacyMacros')).toContain('const actIdx = o.activity');
    expect(CODIGO).not.toMatch(/ACTIVITY_FACTORS\[o\.activity\]/);
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

  it('C5 · la energía legacy se retiró ENTERA; `wellnessMode` solo sobrevive como macro', () => {
    for (const id of ['ACTIVITY_FACTORS', 'goalFactor', 'sexFloor', 'capped', 'bmr', 'tdee']) {
      expect(CODIGO, `${id} ya no debe existir`).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
    expect(CODIGO).not.toContain('Math.max(sexFloor(o.sexo), bmr)');
    // `wellnessMode` sigue, pero SOLO como parámetro de la mitad macro.
    expect(CODIGO.match(/\bwellnessMode\b/g)).toHaveLength(2);
    expect(CODIGO).toContain('energyKcal: number, wellnessMode: boolean');
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
