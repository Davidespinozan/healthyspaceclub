import { describe, it, expect } from 'vitest';
import srcProfileValidation from '../profileValidation.ts?raw';
import {
  validateNutritionProfile,
  InvalidProfileInputError,
  type ProfileInput,
  type ValidatedNutritionProfile,
} from '../profileValidation';
import type { ActivityProfile } from '../activityClassifier';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · PROFILE VALIDATION
//
// Fija el boundary de entrada: qué normaliza, qué rechaza y —sobre todo— qué
// deja pasar a propósito porque la autoridad pertenece a un motor de abajo.
//
// Nadie en producción consume todavía este módulo.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Código del módulo SIN comentarios (ni `//` ni bloques). Las aserciones de «no
 * usa X» deben mirar CÓDIGO, no prosa: la cabecera nombra a propósito todo lo
 * que el módulo NO consume, y escanear el texto produce falsos positivos.
 */
const CODIGO = srcProfileValidation
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

const usaIdentificador = (id: string) =>
  new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(CODIGO);

const ACT: ActivityProfile = {
  dailyLife: 'DL2',
  habitualTraining: { trainsHabitually: true, daysPerWeek: 5, habitualSessionMinutes: 60 },
};

const crudo = (over: Partial<ProfileInput> = {}): ProfileInput => ({
  sex: 'Hombre', goal: 'Bajar grasa', ageYears: 35, heightCm: 178, weightKg: 82,
  pregnantOrLactating: false, requiresTherapeuticDiet: false, activityProfile: ACT, ...over,
});

const mal = (over: Record<string, unknown>) => () =>
  validateNutritionProfile({ ...crudo(), ...over } as ProfileInput);

// ═════════════════════════════════════════════════════════════════════════════
// 1 · MAPEO DE SEXO · delegado a biologicalSexFrom
// ═════════════════════════════════════════════════════════════════════════════
describe('ProfileValidation · 1 · sexo', () => {
  it("'Hombre' → male", () => {
    expect(validateNutritionProfile(crudo({ sex: 'Hombre' })).sex).toBe('male');
  });

  it("'Mujer' → female", () => {
    expect(validateNutritionProfile(crudo({ sex: 'Mujer' })).sex).toBe('female');
  });

  it("acepta los canónicos 'male'/'female' porque biologicalSexFrom ya los soporta", () => {
    expect(validateNutritionProfile(crudo({ sex: 'male' })).sex).toBe('male');
    expect(validateNutritionProfile(crudo({ sex: 'female' })).sex).toBe('female');
  });

  it('acepta las variantes normalizadas que soporta el mapeador', () => {
    expect(validateNutritionProfile(crudo({ sex: '  hombre  ' })).sex).toBe('male');
    expect(validateNutritionProfile(crudo({ sex: 'MUJER' })).sex).toBe('female');
  });

  it("'' lanza (no asume ningún sexo, al contrario que el legacy)", () => {
    expect(mal({ sex: '' })).toThrow(InvalidProfileInputError);
    expect(mal({ sex: '   ' })).toThrow(InvalidProfileInputError);
  });

  it('un sexo desconocido lanza', () => {
    for (const v of ['Otro', 'other', 'nonbinary', 'H', 'M', 'x', null, undefined, 1, {}]) {
      expect(mal({ sex: v }), `valor: ${String(v)}`).toThrow(InvalidProfileInputError);
    }
  });

  it('el error se atribuye al campo del PERFIL, no a la capa de mantenimiento', () => {
    try {
      validateNutritionProfile(crudo({ sex: '' }));
      expect.unreachable('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidProfileInputError);
      expect((e as InvalidProfileInputError).name).toBe('InvalidProfileInputError');
      expect((e as InvalidProfileInputError).field).toBe('sex');
      expect((e as InvalidProfileInputError).received).toBe('');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2 · MAPEO DE OBJETIVO · delegado a canonicalGoalFrom
// ═════════════════════════════════════════════════════════════════════════════
describe('ProfileValidation · 2 · objetivo', () => {
  const PARES: Array<[string, string]> = [
    ['Bajar grasa', 'FAT_LOSS'],
    ['Recomposición', 'RECOMPOSITION'],
    ['Ganar músculo', 'MUSCLE_GAIN'],
    ['Subir masa muscular', 'MUSCLE_GAIN'],
    ['Bienestar integral', 'MAINTENANCE'],
  ];

  for (const [raw, canonico] of PARES) {
    it(`'${raw}' → ${canonico}`, () => {
      expect(validateNutritionProfile(crudo({ goal: raw })).goal).toBe(canonico);
    });
  }

  it('los cuatro objetivos canónicos pasan tal cual', () => {
    for (const g of ['FAT_LOSS', 'RECOMPOSITION', 'MUSCLE_GAIN', 'MAINTENANCE']) {
      expect(validateNutritionProfile(crudo({ goal: g })).goal).toBe(g);
    }
  });

  it('las cinco representaciones colapsan a CUATRO destinos', () => {
    const destinos = new Set(PARES.map(([raw]) => validateNutritionProfile(crudo({ goal: raw })).goal));
    expect(destinos.size).toBe(4);
  });

  it('un objetivo desconocido lanza', () => {
    for (const v of ['', '   ', 'perder peso', 'tonificar', 'definir', 'subir',
      'masa muscular', 'Bajar', null, undefined, 1, {}]) {
      expect(mal({ goal: v }), `valor: ${String(v)}`).toThrow(InvalidProfileInputError);
    }
  });

  it('el error se atribuye al campo goal', () => {
    try {
      validateNutritionProfile(crudo({ goal: 'tonificar' }));
      expect.unreachable('debió lanzar');
    } catch (e) {
      expect((e as InvalidProfileInputError).field).toBe('goal');
      expect((e as InvalidProfileInputError).received).toBe('tonificar');
    }
  });

  it('NO replica la tabla de mapeo: no hay un segundo switch de objetivos', () => {
    // Prueba contractual + estructural: el módulo no declara ningún mapeo propio.
    for (const s of ['bajar grasa', 'bienestar integral', 'subir masa muscular',
      'ganar musculo', 'recomposicion', 'Subir masa muscular', 'Ganar músculo']) {
      expect(CODIGO, `no debe contener la cadena '${s}'`).not.toContain(s);
    }
    expect(CODIGO).not.toMatch(/switch\s*\(/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3 · EDAD · finita aquí, el umbral de 19 NO
// ═════════════════════════════════════════════════════════════════════════════
describe('ProfileValidation · 3 · edad', () => {
  for (const v of [NaN, Infinity, -Infinity, '35', null, undefined, {}, []]) {
    it(`ageYears = ${String(v)} lanza`, () => {
      expect(mal({ ageYears: v })).toThrow(InvalidProfileInputError);
    });
  }

  it('18 es ESTRUCTURALMENTE VÁLIDO: queda fuera por Scope Guard, no por error', () => {
    for (const age of [18, 18.999, 16, 13, 1, 0]) {
      const p = validateNutritionProfile(crudo({ ageYears: age }));
      expect(p.ageYears, `edad ${age}`).toBe(age);
    }
  });

  it('el umbral de 19 NO se evalúa aquí (no aparece el número)', () => {
    expect(CODIGO).not.toMatch(/\b19\b/);
    expect(usaIdentificador('ADULT_ROUTE_MIN_AGE_YEARS')).toBe(false);
  });

  it('exige FINITUD porque el Scope Guard compara `< 19` y NaN se colaría', () => {
    // NaN < 19 es false: sin este requisito, un perfil roto pasaría como
    // «dentro de alcance» y reventaría más abajo con el error equivocado.
    expect(NaN < 19).toBe(false);
    expect(mal({ ageYears: NaN })).toThrow(/finito/);
  });

  it('no hay tope superior: 70, 85 y 120 pasan', () => {
    for (const age of [19, 65, 70, 85, 100, 120]) {
      expect(validateNutritionProfile(crudo({ ageYears: age })).ageYears).toBe(age);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4 · TALLA Y PESO · solo tipo; `> 0` y finitud son de MaintenanceEstimate
// ═════════════════════════════════════════════════════════════════════════════
describe('ProfileValidation · 4 · talla y peso', () => {
  for (const v of ['178', null, undefined, {}, [], true]) {
    it(`heightCm = ${String(v)} lanza (no numérico)`, () => {
      expect(mal({ heightCm: v })).toThrow(InvalidProfileInputError);
    });
    it(`weightKg = ${String(v)} lanza (no numérico)`, () => {
      expect(mal({ weightKg: v })).toThrow(InvalidProfileInputError);
    });
  }

  it('NO duplica el `> 0` de MaintenanceEstimate: 0 y negativos PASAN aquí', () => {
    // Deliberado: el motor de abajo ya los rechaza y su error identifica el
    // campo igual de bien. Duplicar la regla crearía dos fuentes de verdad.
    for (const v of [0, -1, -178, NaN, Infinity]) {
      expect(() => validateNutritionProfile(crudo({ heightCm: v })), `heightCm ${v}`).not.toThrow();
      expect(() => validateNutritionProfile(crudo({ weightKg: v })), `weightKg ${v}`).not.toThrow();
    }
  });

  it('no inventa límites fisiológicos', () => {
    for (const [h, w] of [[1, 1], [300, 500], [120, 30], [220, 300]]) {
      expect(() => validateNutritionProfile(crudo({ heightCm: h, weightKg: w }))).not.toThrow();
    }
    // Y no aparece ninguno de los rangos del onboarding legacy.
    expect(CODIGO).not.toMatch(/\b120\b|\b220\b|\b300\b|\b18\.5\b/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5 · EMBARAZO / LACTANCIA · booleano, nunca un error de scope
// ═════════════════════════════════════════════════════════════════════════════
describe('ProfileValidation · 5 · embarazo/lactancia', () => {
  for (const v of ['si', 'no', 'true', 1, 0, null, undefined, {}]) {
    it(`pregnantOrLactating = ${String(v)} lanza (debe ser booleano)`, () => {
      expect(mal({ pregnantOrLactating: v })).toThrow(InvalidProfileInputError);
    });
  }

  it('true es un dato VÁLIDO: no es un error, lo interpreta el Scope Guard', () => {
    const p = validateNutritionProfile(crudo({ pregnantOrLactating: true }));
    expect(p.pregnantOrLactating).toBe(true);
  });

  it('false pasa igual', () => {
    expect(validateNutritionProfile(crudo({ pregnantOrLactating: false })).pregnantOrLactating)
      .toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6 · ACTIVITY PROFILE · solo presencia; la forma es del clasificador
// ═════════════════════════════════════════════════════════════════════════════
describe('ProfileValidation · 6 · activityProfile', () => {
  for (const v of [null, undefined, 'DL1', 42, true]) {
    it(`activityProfile = ${String(v)} lanza (ausente)`, () => {
      expect(mal({ activityProfile: v })).toThrow(InvalidProfileInputError);
    });
  }

  it('NO valida la forma interna: un DL inválido PASA aquí', () => {
    // Autoridad de ActivityClassifier. Que pase es lo que permite el
    // cortocircuito del Scope Guard con un perfil de actividad roto.
    const roto = { dailyLife: 'DL9', habitualTraining: { trainsHabitually: 'x' } };
    expect(() => validateNutritionProfile(crudo({ activityProfile: roto as unknown as ActivityProfile })))
      .not.toThrow();
  });

  it('pasa el objeto por referencia, sin copiarlo ni normalizarlo', () => {
    const p = validateNutritionProfile(crudo({ activityProfile: ACT }));
    expect(p.activityProfile).toBe(ACT);
  });

  it('no menciona los campos cuya autoridad es del clasificador', () => {
    for (const s of ['dailyLife', 'trainsHabitually', 'daysPerWeek', 'habitualSessionMinutes',
      'DL1', 'DL4', 'weeklyTrainingMinutes']) {
      expect(usaIdentificador(s), `no debe validar ${s}`).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7 · SIN DEFAULTS SILENCIOSOS
// ═════════════════════════════════════════════════════════════════════════════
describe('ProfileValidation · 7 · sin defaults silenciosos', () => {
  it('ningún campo ausente se rellena: todos lanzan', () => {
    const campos: Array<keyof ProfileInput> = ['sex', 'goal', 'ageYears', 'heightCm',
      'weightKg', 'pregnantOrLactating', 'activityProfile'];
    for (const campo of campos) {
      const sinCampo = { ...crudo() } as Record<string, unknown>;
      delete sinCampo[campo];
      expect(() => validateNutritionProfile(sinCampo as unknown as ProfileInput), `falta ${campo}`)
        .toThrow(InvalidProfileInputError);
    }
  });

  it('NO reproduce los defaults del parseObData legacy', () => {
    // El legacy rellenaba 'Hombre', 28, 170, 70 y 'Moderada'.
    expect(CODIGO).not.toMatch(/\|\|\s*'Hombre'|\|\|\s*28\b|\|\|\s*170\b|\|\|\s*70\b/);
    expect(CODIGO).not.toContain('Moderada');
    expect(usaIdentificador('parseObData')).toBe(false);
  });

  it('un perfil válido devuelve EXACTAMENTE los valores recibidos', () => {
    const p = validateNutritionProfile(crudo({
      sex: 'Mujer', goal: 'Recomposición', ageYears: 41.5, heightCm: 163.2, weightKg: 58.7,
      pregnantOrLactating: false,
    }));
    expect(p.ageYears).toBe(41.5);
    expect(p.heightCm).toBe(163.2);
    expect(p.weightKg).toBe(58.7);
    expect(p.sex).toBe('female');
    expect(p.goal).toBe('RECOMPOSITION');
  });

  it('el objeto resultante no lleva campos sobrantes', () => {
    const p = validateNutritionProfile(crudo());
    expect(Object.keys(p).sort()).toEqual([
      'activityProfile', 'ageYears', 'goal', 'heightCm', 'pregnantOrLactating',
      'requiresTherapeuticDiet', 'sex', 'weightKg',
    ]);
  });

  it('ignora campos ajenos adjuntos al input', () => {
    const base = validateNutritionProfile(crudo());
    const conBasura = validateNutritionProfile({
      ...crudo(), grasa: 25, pesoMeta: 60, activity: 'Atleta', conditions: 'renal',
    } as unknown as ProfileInput);
    expect(conBasura).toEqual(base);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8 · ESTRUCTURA, DETERMINISMO Y MARCA DE TIPO
// ═════════════════════════════════════════════════════════════════════════════
describe('ProfileValidation · 8 · estructura y determinismo', () => {
  for (const v of [null, undefined, 'perfil', 42, true]) {
    it(`input = ${String(v)} lanza`, () => {
      expect(() => validateNutritionProfile(v as unknown as ProfileInput))
        .toThrow(InvalidProfileInputError);
    });
  }

  it('mismo input → mismo resultado (50 veces)', () => {
    const input = crudo();
    const primero = validateNutritionProfile(input);
    for (let i = 0; i < 50; i++) expect(validateNutritionProfile(input)).toEqual(primero);
  });

  it('no muta el input', () => {
    const input = crudo();
    const copia = structuredClone(input);
    validateNutritionProfile(input);
    expect(input).toEqual(copia);
  });

  it('la marca de tipo no existe en tiempo de ejecución (no viaja serializada)', () => {
    const p: ValidatedNutritionProfile = validateNutritionProfile(crudo());
    expect(Object.getOwnPropertySymbols(p)).toHaveLength(0);
    expect(JSON.parse(JSON.stringify(p))).toEqual({
      sex: 'male', goal: 'FAT_LOSS', ageYears: 35, heightCm: 178, weightKg: 82,
      pregnantOrLactating: false, requiresTherapeuticDiet: false, activityProfile: ACT,
    });
  });

  it('no lee reloj, aleatoriedad ni entorno', () => {
    expect(CODIGO).not.toMatch(/Math\.random/);
    expect(CODIGO).not.toMatch(/Date\.now|new Date\(/);
    expect(CODIGO).not.toMatch(/localStorage|sessionStorage|process\.env|import\.meta\.env/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9 · AISLAMIENTO DE AUTORIDAD · prueba sobre el grafo de imports
// ═════════════════════════════════════════════════════════════════════════════
describe('ProfileValidation · 9 · aislamiento de autoridad', () => {
  const importados = [...new Set(
    CODIGO.split('\n')
      .map((l) => l.match(/from\s+'([^']+)'/)?.[1])
      .filter((x): x is string => !!x),
  )].sort();

  it('importa EXACTAMENTE los tres módulos de la cadena, nada más', () => {
    expect(importados).toEqual(['./activityClassifier', './energyPrescription', './maintenanceEstimate']);
  });

  it('NO depende de ninguna autoridad legacy', () => {
    const PROHIBIDAS = [
      'nutritionTargets', 'computeNutritionTargets', 'parseObData', 'tdee', 'calcTDEE',
      'ACTIVITY_FACTORS', 'activityFactor', 'goalFactor', 'wellnessMode', 'sexFloor',
      'Mifflin', 'Katch', 'bmr', 'BMR', 'targetWeight', 'pesoMeta', 'bodyFat', 'grasa',
      'obData', 'actIdx', 'useAppStore', 'supabase', 'completedSessions', 'workout_log',
      'trainingFrequency', 'planGoal', 'PLAN_ENGINE_VERSION',
    ];
    for (const p of PROHIBIDAS) {
      expect(usaIdentificador(p), `no debe usar ${p}`).toBe(false);
    }
  });

  it('`targetWeight` no es un input de este boundary', () => {
    const p = validateNutritionProfile(crudo());
    expect('targetWeight' in p).toBe(false);
    expect('pesoMeta' in p).toBe(false);
  });
});
