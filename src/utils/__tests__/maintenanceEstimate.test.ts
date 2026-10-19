import { describe, it, expect } from 'vitest';
import srcMaintenance from '../maintenanceEstimate.ts?raw';
import {
  estimateMaintenance,
  eerForCategory,
  biologicalSexFrom,
  EER_COEFFICIENTS,
  InvalidMaintenanceInputError,
  MAINTENANCE_ESTIMATE_VERSION,
  ADULT_ROUTE_MIN_AGE_YEARS,
  BIOLOGICAL_SEXES,
  type MaintenanceAnthropometry,
  type MaintenanceEstimate,
  type BiologicalSex,
} from '../maintenanceEstimate';
import {
  classifyActivity,
  ACTIVITY_CATEGORIES,
  ACTIVITY_CLASSIFIER_VERSION,
  type ActivityCategory,
  type ActivityClassification,
} from '../activityClassifier';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · MAINTENANCE ESTIMATE V1
//
// Los valores esperados de las ecuaciones NO salen de llamar al módulo que se
// está probando: están calculados aparte con aritmética decimal exacta y
// escritos aquí como literales. Además, los 32 coeficientes se verifican uno a
// uno contra una SEGUNDA transcripción de la Tabla 5-5, para que un error de
// copia no pase por estar repetido en los dos lados.
//
// Nadie en producción consume todavía este módulo.
// ─────────────────────────────────────────────────────────────────────────────

/** Código del módulo sin comentarios (ni `//` ni bloques), para auditar CÓDIGO y no prosa. */
const CODIGO = srcMaintenance
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

const usaIdentificador = (id: string) =>
  new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(CODIGO);

const anthro = (
  sex: BiologicalSex, ageYears: number, heightCm: number, weightKg: number,
): MaintenanceAnthropometry => ({ sex, ageYears, heightCm, weightKg });

const clear = (category: ActivityCategory): ActivityClassification => ({
  classificationConfidence: 'CLEAR',
  category,
  matrixCell: { dailyLife: 'DL1', trainingBand: 'T0' },
  weeklyTrainingMinutes: 0,
  engineVersion: ACTIVITY_CLASSIFIER_VERSION,
});

const borderline = (
  lowerCategory: ActivityCategory, upperCategory: ActivityCategory,
): ActivityClassification => ({
  classificationConfidence: 'BORDERLINE',
  lowerCategory,
  upperCategory,
  matrixCell: { dailyLife: 'DL1', trainingBand: 'T0' },
  weeklyTrainingMinutes: 0,
  engineVersion: ACTIVITY_CLASSIFIER_VERSION,
});

// ═════════════════════════════════════════════════════════════════════════════
// VALORES DE REFERENCIA
//
// Calculados FUERA de JS con aritmética decimal exacta a partir de las
// ecuaciones citadas de la Tabla 5-5. Son el oráculo independiente.
// ═════════════════════════════════════════════════════════════════════════════
const REF: Array<{
  nombre: string;
  a: MaintenanceAnthropometry;
  eer: Record<ActivityCategory, number>;
  monotona: boolean;
}> = [
  {
    nombre: 'hombre 35a / 178cm / 82kg',
    a: anthro('male', 35, 178, 82),
    eer: { INACTIVE: 2687.22, LOW_ACTIVE: 2904.90, ACTIVE: 3090.95, VERY_ACTIVE: 3448.67 },
    monotona: true,
  },
  {
    nombre: 'mujer 30a / 165cm / 62kg',
    a: anthro('female', 30, 165, 62),
    eer: { INACTIVE: 2044.42, LOW_ACTIVE: 2207.15, ACTIVE: 2344.13, VERY_ACTIVE: 2576.80 },
    monotona: true,
  },
  {
    nombre: 'hombre 19a / 170cm / 70kg (primer año de la ruta adulta)',
    a: anthro('male', 19, 170, 70),
    eer: { INACTIVE: 2639.30, LOW_ACTIVE: 2832.50, ACTIVE: 3021.15, VERY_ACTIVE: 3267.75 },
    monotona: true,
  },
  {
    nombre: 'mujer 70a / 160cm / 58kg (sin trato especial por edad)',
    a: anthro('female', 70, 160, 58),
    eer: { INACTIVE: 1688.58, LOW_ACTIVE: 1845.19, ACTIVE: 1981.67, VERY_ACTIVE: 2200.81 },
    monotona: true,
  },
  {
    nombre: 'hombre 85a / 175cm / 75kg (sin tope superior de edad)',
    a: anthro('male', 85, 175, 75),
    eer: { INACTIVE: 2027.52, LOW_ACTIVE: 2233.92, ACTIVE: 2418.52, VERY_ACTIVE: 2726.57 },
    monotona: true,
  },
  {
    nombre: 'hombre 30a / 150cm / 45kg · EXCEPCIÓN de la fuente (VERY < ACTIVE)',
    a: anthro('male', 30, 150, 45),
    eer: { INACTIVE: 2037.67, LOW_ACTIVE: 2173.87, ACTIVE: 2373.87, VERY_ACTIVE: 2358.67 },
    monotona: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// 1 · ECUACIONES DE REFERENCIA DRI
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 1 · ecuaciones de referencia DRI 2023', () => {
  for (const caso of REF) {
    for (const cat of ACTIVITY_CATEGORIES) {
      it(`${caso.nombre} · ${cat} → ${caso.eer[cat]} kcal/d`, () => {
        expect(eerForCategory(caso.a, cat)).toBeCloseTo(caso.eer[cat], 6);
      });
    }
  }

  it('los 32 coeficientes coinciden con una SEGUNDA transcripción de la Tabla 5-5', () => {
    // Transcripción independiente, escrita de nuevo desde las ecuaciones citadas.
    // Si el módulo tuviera una errata de copia, este bloque la delata.
    const FUENTE: Record<BiologicalSex, Record<ActivityCategory, [number, number, number, number]>> = {
      male: {
        INACTIVE: [753.07, -10.83, 6.50, 14.10],
        LOW_ACTIVE: [581.47, -10.83, 8.30, 14.94],
        ACTIVE: [1004.82, -10.83, 6.52, 15.91],
        VERY_ACTIVE: [-517.88, -10.83, 15.61, 19.11],
      },
      female: {
        INACTIVE: [584.90, -7.01, 5.72, 11.71],
        LOW_ACTIVE: [575.77, -7.01, 6.60, 12.14],
        ACTIVE: [710.25, -7.01, 6.54, 12.34],
        VERY_ACTIVE: [511.83, -7.01, 9.07, 12.56],
      },
    };
    let comprobados = 0;
    for (const sex of BIOLOGICAL_SEXES) {
      for (const cat of ACTIVITY_CATEGORIES) {
        const c = EER_COEFFICIENTS[sex][cat];
        const [i, a, h, w] = FUENTE[sex][cat];
        expect(c.intercept, `${sex}/${cat} intercepto`).toBe(i);
        expect(c.age, `${sex}/${cat} edad`).toBe(a);
        expect(c.heightCm, `${sex}/${cat} talla`).toBe(h);
        expect(c.weightKg, `${sex}/${cat} peso`).toBe(w);
        comprobados += 4;
      }
    }
    expect(comprobados).toBe(32);
  });

  it('el coeficiente de edad es el mismo en las 4 categorías de cada sexo', () => {
    // Propiedad de la fuente: por eso la diferencia entre categorías adyacentes
    // no depende de la edad. Lo fija el test para que un cambio se note.
    for (const sex of BIOLOGICAL_SEXES) {
      const ages = ACTIVITY_CATEGORIES.map((c) => EER_COEFFICIENTS[sex][c].age);
      expect(new Set(ages).size, `${sex}`).toBe(1);
    }
    expect(EER_COEFFICIENTS.male.INACTIVE.age).toBe(-10.83);
    expect(EER_COEFFICIENTS.female.INACTIVE.age).toBe(-7.01);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2 · CLASIFICACIONES CLEAR
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 2 · CLEAR', () => {
  for (const cat of ACTIVITY_CATEGORIES) {
    it(`CLEAR ${cat} → initialMaintenance = EER(${cat})`, () => {
      const caso = REF[0];
      const m = estimateMaintenance(caso.a, clear(cat));
      expect(m.classificationConfidence).toBe('CLEAR');
      expect(m.category).toBe(cat);
      expect(m.eer).toBeCloseTo(caso.eer[cat], 6);
      expect(m.initialMaintenance).toBeCloseTo(caso.eer[cat], 6);
      expect(m.initialMaintenance).toBe(m.eer);
    });
  }

  it('consume CLEAR VERY_ACTIVE aunque el clasificador V1 nunca lo emita', () => {
    // El contrato CIENTÍFICO de este módulo y la POLÍTICA del clasificador son
    // autoridades distintas: VERY_ACTIVE es una categoría DRI válida y aquí
    // tiene que tener ecuación, independientemente de lo que V1 decida emitir.
    const caso = REF[1];
    const m = estimateMaintenance(caso.a, clear('VERY_ACTIVE'));
    expect(m.initialMaintenance).toBeCloseTo(caso.eer.VERY_ACTIVE, 6);
  });

  it('el clasificador V1 realmente no emite CLEAR_VERY_ACTIVE (contraparte)', () => {
    const c = classifyActivity({
      dailyLife: 'DL4',
      habitualTraining: { trainsHabitually: true, daysPerWeek: 7, habitualSessionMinutes: 120 },
    });
    expect(c.classificationConfidence).toBe('BORDERLINE');
  });

  it('CLEAR no trae campos de BORDERLINE', () => {
    const m = estimateMaintenance(REF[0].a, clear('ACTIVE'));
    expect(m.lowerCategory).toBeUndefined();
    expect(m.upperCategory).toBeUndefined();
    expect(m.lowerEER).toBeUndefined();
    expect(m.upperEER).toBeUndefined();
    expect('lowerCategory' in m).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3 · BORDERLINE · midpoint
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 3 · BORDERLINE midpoint', () => {
  const PARES: Array<[ActivityCategory, ActivityCategory]> = [
    ['INACTIVE', 'LOW_ACTIVE'],
    ['LOW_ACTIVE', 'ACTIVE'],
    ['ACTIVE', 'VERY_ACTIVE'],
  ];

  for (const [lo, hi] of PARES) {
    it(`${lo} ↔ ${hi} → initialMaintenance = (lowerEER + upperEER) / 2`, () => {
      for (const caso of REF) {
        const m = estimateMaintenance(caso.a, borderline(lo, hi));
        expect(m.classificationConfidence).toBe('BORDERLINE');
        expect(m.lowerEER).toBeCloseTo(caso.eer[lo], 6);
        expect(m.upperEER).toBeCloseTo(caso.eer[hi], 6);
        expect(m.initialMaintenance, caso.nombre)
          .toBeCloseTo((caso.eer[lo] + caso.eer[hi]) / 2, 6);
      }
    });
  }

  it('midpoints exactos del caso de referencia (valores calculados aparte)', () => {
    const a = REF[0].a; // hombre 35/178/82
    expect(estimateMaintenance(a, borderline('INACTIVE', 'LOW_ACTIVE')).initialMaintenance)
      .toBeCloseTo(2796.06, 6);
    expect(estimateMaintenance(a, borderline('LOW_ACTIVE', 'ACTIVE')).initialMaintenance)
      .toBeCloseTo(2997.925, 6);
    expect(estimateMaintenance(a, borderline('ACTIVE', 'VERY_ACTIVE')).initialMaintenance)
      .toBeCloseTo(3269.81, 6);
  });

  it('el midpoint queda ENTRE los dos EER (sin elegir lower ni upper)', () => {
    for (const caso of REF) {
      for (const [lo, hi] of PARES) {
        const m = estimateMaintenance(caso.a, borderline(lo, hi));
        const min = Math.min(m.lowerEER!, m.upperEER!);
        const max = Math.max(m.lowerEER!, m.upperEER!);
        expect(m.initialMaintenance).toBeGreaterThanOrEqual(min);
        expect(m.initialMaintenance).toBeLessThanOrEqual(max);
        expect(m.initialMaintenance).not.toBe(m.lowerEER);
        expect(m.initialMaintenance).not.toBe(m.upperEER);
      }
    }
  });

  it('BORDERLINE no trae campos de CLEAR', () => {
    const m = estimateMaintenance(REF[0].a, borderline('LOW_ACTIVE', 'ACTIVE'));
    expect(m.category).toBeUndefined();
    expect(m.eer).toBeUndefined();
    expect('category' in m).toBe(false);
  });

  it('NO se interpola PAL ni se fabrica un PAL decimal', () => {
    expect(usaIdentificador('PAL'), 'el módulo no debe calcular PAL').toBe(false);
    expect(CODIGO).not.toMatch(/1\.53|1\.68|1\.85|2\.50/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4 · MONOTONICIDAD · y la excepción real de la fuente
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 4 · monotonicidad entre categorías', () => {
  it('donde la fuente es monótona, el módulo la reproduce', () => {
    const monotonos = REF.filter((c) => c.monotona);
    expect(monotonos.length).toBe(5);
    for (const caso of monotonos) {
      const v = ACTIVITY_CATEGORIES.map((c) => eerForCategory(caso.a, c));
      for (let i = 0; i < v.length - 1; i++) {
        expect(v[i + 1], `${caso.nombre}: ${ACTIVITY_CATEGORIES[i]} → ${ACTIVITY_CATEGORIES[i + 1]}`)
          .toBeGreaterThan(v[i]);
      }
    }
  });

  it('EXCEPCIÓN DOCUMENTADA · hombre bajo y ligero: VERY_ACTIVE < ACTIVE', () => {
    // NO es un defecto de la implementación: es la relación que publican las
    // ecuaciones. VERY − ACTIVE = −1522.70 + 9.09·h + 3.20·w, negativa cuando
    // 9.09h + 3.20w < 1522.70. El test la FIJA para que nadie la "arregle"
    // silenciosamente ni se sorprenda después.
    const a = anthro('male', 30, 150, 45);   // IMC 20.0, dentro del rango del repo
    const activo = eerForCategory(a, 'ACTIVE');
    const muyActivo = eerForCategory(a, 'VERY_ACTIVE');
    expect(activo).toBeCloseTo(2373.87, 6);
    expect(muyActivo).toBeCloseTo(2358.67, 6);
    expect(muyActivo).toBeLessThan(activo);
    expect(muyActivo - activo).toBeCloseTo(-15.20, 6);
  });

  it('la frontera de la excepción es 9.09·h + 3.20·w = 1522.70', () => {
    const d = (h: number, w: number) =>
      eerForCategory(anthro('male', 40, h, w), 'VERY_ACTIVE')
      - eerForCategory(anthro('male', 40, h, w), 'ACTIVE');
    expect(d(150, 49)).toBeLessThan(0);      // bajo el peso crítico (49.8 kg)
    expect(d(150, 51)).toBeGreaterThan(0);   // por encima
    expect(d(168, 1)).toBeGreaterThan(0);    // h ≥ 168: imposible a cualquier peso
    expect(d(220, 30)).toBeGreaterThan(0);
  });

  it('en mujeres NO ocurre a ninguna talla adulta', () => {
    for (const h of [120, 140, 150, 160, 170, 180, 200, 220]) {
      for (const w of [30, 50, 70, 100, 150]) {
        const a = anthro('female', 40, h, w);
        expect(eerForCategory(a, 'VERY_ACTIVE'), `${h}cm/${w}kg`)
          .toBeGreaterThan(eerForCategory(a, 'ACTIVE'));
      }
    }
  });

  it('INACTIVE < LOW_ACTIVE < ACTIVE se cumple en todo el rango del repo', () => {
    for (const sex of BIOLOGICAL_SEXES) {
      for (const h of [120, 150, 170, 190, 220]) {
        for (const w of [30, 60, 90, 150, 300]) {
          for (const age of [19, 40, 70, 100]) {
            const a = anthro(sex, age, h, w);
            expect(eerForCategory(a, 'LOW_ACTIVE')).toBeGreaterThan(eerForCategory(a, 'INACTIVE'));
            expect(eerForCategory(a, 'ACTIVE')).toBeGreaterThan(eerForCategory(a, 'LOW_ACTIVE'));
          }
        }
      }
    }
  });

  it('el módulo no fuerza monotonicidad: no hay clamp, max, min ni sort sobre los EER', () => {
    expect(CODIGO).not.toMatch(/Math\.max\s*\(\s*(lowerEER|upperEER)/);
    expect(CODIGO).not.toMatch(/\.sort\s*\(/);
    expect(CODIGO).not.toMatch(/clamp/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5 · ECUACIONES ESPECÍFICAS POR SEXO
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 5 · rutas por sexo', () => {
  it('cada sexo usa sus propios coeficientes (nunca una ecuación compartida)', () => {
    for (const cat of ACTIVITY_CATEGORIES) {
      const m = EER_COEFFICIENTS.male[cat];
      const f = EER_COEFFICIENTS.female[cat];
      expect(m.intercept, cat).not.toBe(f.intercept);
      expect(m.age, cat).not.toBe(f.age);
      expect(m.heightCm, cat).not.toBe(f.heightCm);
      expect(m.weightKg, cat).not.toBe(f.weightKg);
    }
  });

  it('misma antropometría, distinto sexo → distinto EER en las 4 categorías', () => {
    for (const cat of ACTIVITY_CATEGORIES) {
      const h = eerForCategory(anthro('male', 35, 170, 70), cat);
      const m = eerForCategory(anthro('female', 35, 170, 70), cat);
      expect(h, cat).not.toBeCloseTo(m, 2);
    }
  });

  it('el mapeo del contrato del repo es explícito y total', () => {
    expect(biologicalSexFrom('Hombre')).toBe('male');
    expect(biologicalSexFrom('Mujer')).toBe('female');
    expect(biologicalSexFrom('male')).toBe('male');
    expect(biologicalSexFrom('female')).toBe('female');
    expect(biologicalSexFrom('  hombre  ')).toBe('male');   // trim + case
    expect(biologicalSexFrom('MUJER')).toBe('female');
  });

  it('NO hay fallback silencioso al masculino (el defecto del código legacy)', () => {
    // El legacy hacía `String(ob.sex || 'Hombre')`: '' caía en la ecuación
    // masculina sin avisar. Aquí se rechaza.
    for (const v of ['', '   ', 'Otro', 'other', 'nonbinary', 'H', 'M', 'x', null, undefined, 1, {}]) {
      expect(() => biologicalSexFrom(v), `valor: ${String(v)}`)
        .toThrow(InvalidMaintenanceInputError);
    }
  });

  it('el error de sexo no mapeable identifica el campo', () => {
    try {
      biologicalSexFrom('Otro');
      expect.unreachable('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidMaintenanceInputError);
      expect((e as InvalidMaintenanceInputError).field).toBe('sex');
      expect((e as InvalidMaintenanceInputError).received).toBe('Otro');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6 · UNIDADES · cm ↔ m y kg ↔ lb
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 6 · unidades', () => {
  const a = anthro('female', 30, 165, 62);

  it('la talla es CENTÍMETROS: pasarla en metros da un resultado absurdo y distinto', () => {
    const correcto = eerForCategory(a, 'ACTIVE');
    const enMetros = eerForCategory(anthro('female', 30, 1.65, 62), 'ACTIVE');
    expect(correcto).toBeCloseTo(2344.13, 6);
    expect(enMetros).toBeCloseTo(1275.821, 3);
    expect(Math.abs(correcto - enMetros)).toBeGreaterThan(1000);
  });

  it('el peso es KILOGRAMOS: pasarlo en libras da un resultado distinto', () => {
    const correcto = eerForCategory(a, 'ACTIVE');
    const enLibras = eerForCategory(anthro('female', 30, 165, 136.69), 'ACTIVE');
    expect(enLibras).toBeCloseTo(3265.8046, 3);
    expect(enLibras - correcto).toBeGreaterThan(900);
  });

  it('el contrato declara las unidades EN EL NOMBRE del campo', () => {
    // Un cm↔m o kg↔lb pasa a ser un error de nombre visible, no un error
    // numérico silencioso. Se comprueba sobre el código, no sobre la prosa.
    expect(usaIdentificador('heightCm')).toBe(true);
    expect(usaIdentificador('weightKg')).toBe(true);
    expect(usaIdentificador('ageYears')).toBe(true);
    expect(usaIdentificador('height'), 'no debe existir un `height` sin unidad').toBe(false);
    expect(usaIdentificador('weight'), 'no debe existir un `weight` sin unidad').toBe(false);
  });

  it('una talla en metros NO se "corrige" sola: el módulo no normaliza unidades', () => {
    // Si alguien añadiera una heurística tipo «si h < 3 multiplícalo por 100»
    // estaría adivinando. 1.65 debe tratarse como 1.65 cm.
    const c = EER_COEFFICIENTS.female.ACTIVE;
    const esperado = c.intercept + c.age * 30 + c.heightCm * 1.65 + c.weightKg * 62;
    expect(eerForCategory(anthro('female', 30, 1.65, 62), 'ACTIVE')).toBeCloseTo(esperado, 9);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7 · EDAD · ruta adulta desde 19, sin tope superior
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 7 · edad', () => {
  const conEdad = (age: number) => () => eerForCategory(anthro('male', age, 175, 75), 'ACTIVE');

  it('la constante de la ruta adulta es 19', () => {
    expect(ADULT_ROUTE_MIN_AGE_YEARS).toBe(19);
  });

  for (const age of [18.999, 18, 17, 13, 1, 0, -5]) {
    it(`edad ${age} → RECHAZA (por debajo de la ruta adulta)`, () => {
      expect(conEdad(age)).toThrow(InvalidMaintenanceInputError);
      expect(conEdad(age)).toThrow(/ruta adulta/);
    });
  }

  for (const age of [19, 19.001, 25, 40, 65, 70, 85, 100, 120]) {
    it(`edad ${age} → VÁLIDA`, () => {
      expect(conEdad(age)).not.toThrow();
      expect(conEdad(age)()).toBeGreaterThan(0);
    });
  }

  it('no hay tope superior artificial: la edad solo entra por su coeficiente', () => {
    const c = EER_COEFFICIENTS.male.ACTIVE;
    for (const age of [19, 65, 70, 85, 100]) {
      const esperado = c.intercept + c.age * age + c.heightCm * 175 + c.weightKg * 75;
      expect(eerForCategory(anthro('male', age, 175, 75), 'ACTIVE')).toBeCloseTo(esperado, 9);
    }
  });

  it('NO existe factor especial para ≥65 ni ≥70, ni ecuación geriátrica', () => {
    for (const id of ['mayor65', 'mayor70', 'geriatric', 'elderly', 'adultoMayor']) {
      expect(usaIdentificador(id), `no debe existir ${id}`).toBe(false);
    }
    expect(CODIGO).not.toMatch(/>=\s*65|>=\s*70|>\s*64|>\s*69/);
  });

  it('66 y 71 años no reciben ningún trato distinto de 64 y 69', () => {
    const d = (a1: number, a2: number) =>
      eerForCategory(anthro('male', a1, 175, 75), 'ACTIVE')
      - eerForCategory(anthro('male', a2, 175, 75), 'ACTIVE');
    // La diferencia por año es CONSTANTE = −coeficiente de edad.
    expect(d(64, 65)).toBeCloseTo(10.83, 9);
    expect(d(65, 66)).toBeCloseTo(10.83, 9);
    expect(d(69, 70)).toBeCloseTo(10.83, 9);
    expect(d(70, 71)).toBeCloseTo(10.83, 9);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8 · SIN AUTORIDAD DE % DE GRASA
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 8 · body-fat no es autoridad', () => {
  it('bodyFat no forma parte del input del módulo', () => {
    for (const id of ['bodyFat', 'bodyFatPct', 'grasa', 'lbm', 'leanBodyMass', 'ffm']) {
      expect(usaIdentificador(id), `no debe existir ${id}`).toBe(false);
    }
  });

  it('añadir bodyFat al objeto no cambia nada', () => {
    const base = estimateMaintenance(REF[0].a, clear('ACTIVE'));
    for (const g of [0, 8, 15, 25, 40, 55]) {
      const conGrasa = { ...REF[0].a, bodyFat: g, grasa: g } as MaintenanceAnthropometry;
      expect(estimateMaintenance(conGrasa, clear('ACTIVE'))).toEqual(base);
    }
  });

  it('no existe selección de ecuación por % de grasa (Katch-McArdle retirado)', () => {
    for (const id of ['Katch', 'McArdle', 'Mifflin', 'bmr', 'BMR', 'calcTDEE']) {
      expect(usaIdentificador(id), `no debe existir ${id}`).toBe(false);
    }
    expect(CODIGO).not.toMatch(/21\.6|370\s*\+|6\.25/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9 · SIN AUTORIDAD DE obData.activity
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 9 · la actividad solo llega por ActivityClassification', () => {
  it('el módulo no usa obData.activity ni el enum legacy', () => {
    for (const id of ['obData', 'ACTIVITY_FACTORS', 'activityFactor', 'actIdx']) {
      expect(usaIdentificador(id), `no debe existir ${id}`).toBe(false);
    }
    for (const v of ['Sedentaria', 'Ligera', 'Moderada', 'Atleta']) {
      expect(CODIGO, `no debe mencionar ${v}`).not.toContain(v);
    }
  });

  it('añadir un activity legacy al objeto no cambia nada', () => {
    const base = estimateMaintenance(REF[0].a, clear('LOW_ACTIVE'));
    for (const v of ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta']) {
      const conLegacy = { ...REF[0].a, activity: v } as MaintenanceAnthropometry;
      expect(estimateMaintenance(conLegacy, clear('LOW_ACTIVE'))).toEqual(base);
    }
  });

  it('la clasificación es lo ÚNICO que mueve la categoría', () => {
    const a = REF[0].a;
    const porCategoria = ACTIVITY_CATEGORIES.map(
      (c) => estimateMaintenance(a, clear(c)).initialMaintenance);
    expect(new Set(porCategoria).size).toBe(4);
  });

  it('acepta la salida REAL del clasificador V1 sin adaptadores', () => {
    const c = classifyActivity({
      dailyLife: 'DL2',
      habitualTraining: { trainsHabitually: true, daysPerWeek: 5, habitualSessionMinutes: 60 },
    });
    expect(c.classificationConfidence).toBe('CLEAR');
    const m = estimateMaintenance(REF[0].a, c);
    expect(m.initialMaintenance).toBeCloseTo(REF[0].eer.ACTIVE, 6);
    expect(m.classifierEngineVersion).toBe(ACTIVITY_CLASSIFIER_VERSION);
  });

  it('las 20 celdas del clasificador producen una estimación válida', () => {
    const DL = ['DL1', 'DL2', 'DL3', 'DL4'] as const;
    const MINS = [0, 90, 200, 350, 500];
    let n = 0;
    for (const dl of DL) {
      for (const mins of MINS) {
        const cl = classifyActivity({
          dailyLife: dl,
          habitualTraining: mins === 0
            ? { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 }
            : { trainsHabitually: true, daysPerWeek: 1, habitualSessionMinutes: mins },
        });
        const m = estimateMaintenance(REF[0].a, cl);
        expect(Number.isFinite(m.initialMaintenance)).toBe(true);
        expect(m.initialMaintenance).toBeGreaterThan(0);
        n++;
      }
    }
    expect(n).toBe(20);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10 · TRAZABILIDAD
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 10 · trazabilidad', () => {
  it('BORDERLINE: categorías, EER y midpoint son coherentes entre sí', () => {
    for (const caso of REF) {
      for (const [lo, hi] of [['INACTIVE', 'LOW_ACTIVE'], ['LOW_ACTIVE', 'ACTIVE'],
        ['ACTIVE', 'VERY_ACTIVE']] as Array<[ActivityCategory, ActivityCategory]>) {
        const m = estimateMaintenance(caso.a, borderline(lo, hi));
        expect(m.lowerCategory).toBe(lo);
        expect(m.upperCategory).toBe(hi);
        // lowerEER es el EER de lowerCategory — comprobado contra el oráculo,
        // no contra otra llamada al módulo.
        expect(m.lowerEER).toBeCloseTo(caso.eer[lo], 6);
        expect(m.upperEER).toBeCloseTo(caso.eer[hi], 6);
        expect(m.initialMaintenance).toBeCloseTo((m.lowerEER! + m.upperEER!) / 2, 9);
        // Adyacencia preservada.
        expect(ACTIVITY_CATEGORIES.indexOf(hi) - ACTIVITY_CATEGORIES.indexOf(lo)).toBe(1);
      }
    }
  });

  it('lowerEER/upperEER se ordenan por CATEGORÍA, no por kcal', () => {
    // En el rincón de la excepción, lowerEER > upperEER. Es intencionado: el
    // orden lo da la categoría PAL, y ordenar por kcal destruiría la semántica.
    const m = estimateMaintenance(anthro('male', 30, 150, 45), borderline('ACTIVE', 'VERY_ACTIVE'));
    expect(m.lowerCategory).toBe('ACTIVE');
    expect(m.upperCategory).toBe('VERY_ACTIVE');
    expect(m.lowerEER).toBeCloseTo(2373.87, 6);
    expect(m.upperEER).toBeCloseTo(2358.67, 6);
    expect(m.lowerEER!).toBeGreaterThan(m.upperEER!);        // ← la excepción
    expect(m.initialMaintenance).toBeCloseTo(2366.27, 6);    // midpoint sigue bien definido
  });

  it('todo resultado lleva source, engineVersion y classifierEngineVersion', () => {
    for (const cl of [clear('ACTIVE'), borderline('LOW_ACTIVE', 'ACTIVE')]) {
      const m = estimateMaintenance(REF[0].a, cl);
      expect(m.source).toBe('DRI_2023_EER_ADULT');
      expect(m.engineVersion).toBe(MAINTENANCE_ESTIMATE_VERSION);
      expect(m.classifierEngineVersion).toBe(ACTIVITY_CLASSIFIER_VERSION);
    }
  });

  it('engineVersion es PROPIO: ni PLAN_ENGINE_VERSION ni el del clasificador', () => {
    expect(MAINTENANCE_ESTIMATE_VERSION).toBe(1);
    expect(usaIdentificador('PLAN_ENGINE_VERSION')).toBe(false);
    expect(usaIdentificador('ACTIVITY_CLASSIFIER_VERSION')).toBe(false);
  });

  it('NO duplica la metadata del clasificador', () => {
    const m = estimateMaintenance(REF[0].a, clear('ACTIVE')) as MaintenanceEstimate
      & { matrixCell?: unknown; weeklyTrainingMinutes?: unknown };
    expect(m.matrixCell, 'matrixCell vive en la ActivityClassification').toBeUndefined();
    expect(m.weeklyTrainingMinutes, 'weeklyTrainingMinutes también').toBeUndefined();
  });

  it('se puede reconstruir qué clasificación produjo qué estimación', () => {
    const m = estimateMaintenance(REF[1].a, borderline('ACTIVE', 'VERY_ACTIVE'));
    expect({
      confianza: m.classificationConfidence,
      categorias: [m.lowerCategory, m.upperCategory],
      eer: [m.lowerEER, m.upperEER],
      estimacion: m.initialMaintenance,
      motor: m.engineVersion,
      clasificador: m.classifierEngineVersion,
      fuente: m.source,
    }).toEqual({
      confianza: 'BORDERLINE',
      categorias: ['ACTIVE', 'VERY_ACTIVE'],
      eer: [REF[1].eer.ACTIVE, REF[1].eer.VERY_ACTIVE],
      estimacion: 2460.465,
      motor: 1,
      clasificador: 1,
      fuente: 'DRI_2023_EER_ADULT',
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11 · DETERMINISMO Y PRECISIÓN
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 11 · determinismo y precisión', () => {
  it('mismo input → mismo resultado exacto (50 veces)', () => {
    const primero = estimateMaintenance(REF[0].a, borderline('LOW_ACTIVE', 'ACTIVE'));
    for (let i = 0; i < 50; i++) {
      expect(estimateMaintenance(REF[0].a, borderline('LOW_ACTIVE', 'ACTIVE'))).toEqual(primero);
    }
  });

  it('no muta la entrada', () => {
    const a = anthro('male', 35, 178, 82);
    const cl = borderline('ACTIVE', 'VERY_ACTIVE');
    const copiaA = structuredClone(a);
    const copiaC = structuredClone(cl);
    estimateMaintenance(a, cl);
    expect(a).toEqual(copiaA);
    expect(cl).toEqual(copiaC);
  });

  it('NO redondea: conserva los decimales para el Goal Energy Engine', () => {
    const m = estimateMaintenance(REF[0].a, borderline('LOW_ACTIVE', 'ACTIVE'));
    expect(m.initialMaintenance).toBeCloseTo(2997.925, 6);
    expect(Number.isInteger(m.initialMaintenance)).toBe(false);
    // Y no hay redondeo de 25/50/100 en ninguna parte del módulo.
    expect(CODIGO).not.toMatch(/Math\.round|toFixed|Math\.floor|Math\.ceil/);
    expect(CODIGO).not.toMatch(/\/\s*(25|50|100)\s*\)\s*\*\s*(25|50|100)/);
  });

  it('un cambio de 1 g de peso mueve el resultado (sin granularidad artificial)', () => {
    const a1 = estimateMaintenance(anthro('male', 35, 178, 82.000), clear('ACTIVE'));
    const a2 = estimateMaintenance(anthro('male', 35, 178, 82.001), clear('ACTIVE'));
    expect(a2.initialMaintenance).not.toBe(a1.initialMaintenance);
    expect(a2.initialMaintenance - a1.initialMaintenance).toBeCloseTo(0.01591, 9);
  });

  it('no lee reloj, aleatoriedad ni entorno', () => {
    expect(CODIGO).not.toMatch(/Math\.random/);
    expect(CODIGO).not.toMatch(/Date\.now|new Date\(/);
    expect(CODIGO).not.toMatch(/localStorage|sessionStorage|process\.env|import\.meta\.env/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 12 · INPUTS INVÁLIDOS · fail-closed
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 12 · inputs inválidos (fail-closed)', () => {
  const OK = anthro('male', 35, 178, 82);
  const malA = (a: unknown) => () => estimateMaintenance(a as MaintenanceAnthropometry, clear('ACTIVE'));
  const malC = (c: unknown) => () => estimateMaintenance(OK, c as ActivityClassification);

  describe('sex', () => {
    for (const v of ['Hombre', 'Mujer', 'MALE', '', 'otro', null, undefined, 1, {}]) {
      it(`rechaza sex = ${String(v)} en el contrato del módulo`, () => {
        // El contrato interno exige 'male'|'female' ya normalizado: el mapeo del
        // valor del repo es responsabilidad explícita de `biologicalSexFrom`.
        expect(malA({ ...OK, sex: v })).toThrow(InvalidMaintenanceInputError);
      });
    }
  });

  describe('ageYears', () => {
    for (const v of [NaN, Infinity, -Infinity, 18, 0, -1, '35', null, undefined, {}]) {
      it(`rechaza ageYears = ${String(v)}`, () => {
        expect(malA({ ...OK, ageYears: v })).toThrow(InvalidMaintenanceInputError);
      });
    }
  });

  describe('heightCm', () => {
    for (const v of [0, -1, -178, NaN, Infinity, -Infinity, '178', null, undefined]) {
      it(`rechaza heightCm = ${String(v)}`, () => {
        expect(malA({ ...OK, heightCm: v })).toThrow(InvalidMaintenanceInputError);
      });
    }
    it('no impone límites fisiológicos nuevos: 1 y 300 cm son válidos', () => {
      expect(malA({ ...OK, heightCm: 1 })).not.toThrow();
      expect(malA({ ...OK, heightCm: 300 })).not.toThrow();
    });
  });

  describe('weightKg', () => {
    for (const v of [0, -1, -82, NaN, Infinity, -Infinity, '82', null, undefined]) {
      it(`rechaza weightKg = ${String(v)}`, () => {
        expect(malA({ ...OK, weightKg: v })).toThrow(InvalidMaintenanceInputError);
      });
    }
    it('no impone límites fisiológicos nuevos: 1 y 500 kg son válidos', () => {
      expect(malA({ ...OK, weightKg: 1 })).not.toThrow();
      expect(malA({ ...OK, weightKg: 500 })).not.toThrow();
    });
  });

  describe('antropometría estructural', () => {
    for (const v of [null, undefined, 'male', 42, []]) {
      it(`rechaza anthropometry = ${String(v)}`, () => {
        expect(malA(v)).toThrow(InvalidMaintenanceInputError);
      });
    }
  });

  describe('ActivityClassification mal formada', () => {
    const casos: Array<[string, unknown]> = [
      ['null', null],
      ['undefined', undefined],
      ['no objeto', 'CLEAR'],
      ['confidence desconocida', { classificationConfidence: 'MAYBE', engineVersion: 1 }],
      ['CLEAR sin category', { classificationConfidence: 'CLEAR', engineVersion: 1 }],
      ['CLEAR con category inválida',
        { classificationConfidence: 'CLEAR', category: 'SUPER_ACTIVE', engineVersion: 1 }],
      ['CLEAR con lower/upper',
        { classificationConfidence: 'CLEAR', category: 'ACTIVE', lowerCategory: 'ACTIVE', upperCategory: 'VERY_ACTIVE', engineVersion: 1 }],
      ['BORDERLINE sin categorías', { classificationConfidence: 'BORDERLINE', engineVersion: 1 }],
      ['BORDERLINE con category',
        { classificationConfidence: 'BORDERLINE', category: 'ACTIVE', lowerCategory: 'ACTIVE', upperCategory: 'VERY_ACTIVE', engineVersion: 1 }],
      ['BORDERLINE no adyacente (INACTIVE↔ACTIVE)',
        { classificationConfidence: 'BORDERLINE', lowerCategory: 'INACTIVE', upperCategory: 'ACTIVE', engineVersion: 1 }],
      ['BORDERLINE no adyacente (LOW↔VERY)',
        { classificationConfidence: 'BORDERLINE', lowerCategory: 'LOW_ACTIVE', upperCategory: 'VERY_ACTIVE', engineVersion: 1 }],
      ['BORDERLINE invertido (VERY↔ACTIVE)',
        { classificationConfidence: 'BORDERLINE', lowerCategory: 'VERY_ACTIVE', upperCategory: 'ACTIVE', engineVersion: 1 }],
      ['engineVersion ausente',
        { classificationConfidence: 'CLEAR', category: 'ACTIVE' }],
      ['engineVersion NaN',
        { classificationConfidence: 'CLEAR', category: 'ACTIVE', engineVersion: NaN }],
    ];
    for (const [nombre, v] of casos) {
      it(`rechaza: ${nombre}`, () => {
        expect(malC(v)).toThrow(InvalidMaintenanceInputError);
      });
    }
  });

  it('ningún input inválido devuelve una estimación «aproximada»', () => {
    const invalidos: Array<[unknown, unknown]> = [
      [{ ...OK, sex: 'Hombre' }, clear('ACTIVE')],
      [{ ...OK, ageYears: 18 }, clear('ACTIVE')],
      [{ ...OK, heightCm: 0 }, clear('ACTIVE')],
      [{ ...OK, weightKg: NaN }, clear('ACTIVE')],
      [OK, { classificationConfidence: 'BORDERLINE', lowerCategory: 'INACTIVE', upperCategory: 'ACTIVE', engineVersion: 1 }],
      [null, null],
    ];
    for (const [a, c] of invalidos) {
      let r: MaintenanceEstimate | null = null;
      try {
        r = estimateMaintenance(a as MaintenanceAnthropometry, c as ActivityClassification);
      } catch { /* esperado */ }
      expect(r, `devolvió resultado para ${JSON.stringify(a) ?? String(a)}`).toBeNull();
    }
  });

  it('el error es identificable por tipo, nombre y campo', () => {
    try {
      estimateMaintenance({ ...OK, ageYears: 18 }, clear('ACTIVE'));
      expect.unreachable('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidMaintenanceInputError);
      expect((e as InvalidMaintenanceInputError).name).toBe('InvalidMaintenanceInputError');
      expect((e as InvalidMaintenanceInputError).field).toBe('ageYears');
      expect((e as InvalidMaintenanceInputError).received).toBe(18);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 13 · AISLAMIENTO DE AUTORIDAD
// ═════════════════════════════════════════════════════════════════════════════
describe('MaintenanceEstimate V1 · 13 · aislamiento de autoridad', () => {
  it('solo importa el clasificador, nada más del repo', () => {
    const imports = srcMaintenance.split('\n')
      .filter((l) => /^\s*import\b/.test(l) || /^\s*}\s*from\s/.test(l));
    const from = imports.filter((l) => /from\s/.test(l)).map((l) => l.match(/from\s+'([^']+)'/)?.[1]);
    expect(from).toEqual(['./activityClassifier']);
  });

  it('NO usa ninguna de las autoridades legacy', () => {
    const PROHIBIDAS = [
      'nutritionTargets', 'computeNutritionTargets', 'parseObData',
      'ACTIVITY_FACTORS', 'calcTDEE', 'goalFactor', 'sexFloor', 'wellnessMode',
      'obData', 'grasa', 'bodyFat', 'targetWeight', 'pesoMeta',
      'planGoal', 'tdee', 'useAppStore', 'supabase',
      'completedSessions', 'workout_log', 'trainingFrequency', 'activityLog',
      'mealPlanKey', 'weeklyPlan', 'PLAN_ENGINE_VERSION',
    ];
    for (const p of PROHIBIDAS) {
      expect(usaIdentificador(p), `no debe usar ${p}`).toBe(false);
    }
  });

  it('NO implementa nada de EnergyPrescription (bloque siguiente)', () => {
    const SIGUIENTE = [
      'prescribedEnergy', 'FAT_LOSS', 'MUSCLE_GAIN', 'RECOMPOSITION',
      'FAT_LOSS_BLOCKED', 'OUTSIDE_HSC_FAT_LOSS_SCOPE', 'OUTSIDE_HSC_NUTRITION_SCOPE',
      'pregnantOrLactating', 'scopeReason',
    ];
    for (const p of SIGUIENTE) {
      expect(usaIdentificador(p), `${p} pertenece al bloque siguiente`).toBe(false);
    }
    expect(CODIGO, 'sin déficit del 15%').not.toMatch(/0\.15|0\.85/);
    expect(CODIGO, 'sin cap de 500').not.toMatch(/\b500\b/);
    expect(CODIGO, 'sin gate de 1200').not.toMatch(/\b1200\b/);
    expect(CODIGO, 'sin gate de IMC 18.5').not.toMatch(/18\.5/);
    expect(CODIGO, 'sin superávit del 5%').not.toMatch(/1\.05/);
  });

  it('no usa goal, macros ni conditions', () => {
    for (const p of ['goal', 'protG', 'fatG', 'carbG', 'fiberG', 'conditions', 'renal', 'embarazo']) {
      expect(usaIdentificador(p), `no debe usar ${p}`).toBe(false);
    }
  });
});
