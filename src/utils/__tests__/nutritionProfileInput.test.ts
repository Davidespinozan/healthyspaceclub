import { describe, it, expect } from 'vitest';
import srcMapper from '../nutritionProfileInput.ts?raw';
import {
  nutritionProfileInputFrom,
  InvalidPersistedProfileError,
  MISSING_PROFILE_FIELDS,
  PERSISTED_BOOLEAN_KEYS,
  type PersistedObData,
} from '../nutritionProfileInput';
import { validateNutritionProfile } from '../profileValidation';
import { classifyActivity } from '../activityClassifier';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE B · NUTRITION PROFILE INPUT
//
// El mapper es puro, así que todo esto es comportamiento REAL, no contrato de
// texto. Lo que fija:
//   · los cuatro DL, el camino `false` y el camino `true`
//   · que `0` NO desaparezca por ser falsy — el error más fácil de cometer aquí
//   · que lo MALFORMADO no se degrade a «no respondido»
//   · que un `embarazo` ausente NUNCA se resuelva como `false`
//   · que no exista ningún fallback: ni `activity`, ni `nivel`, ni sesiones
//
// Se invocan `validateNutritionProfile` y `classifyActivity` —módulos CLOSED— para
// comprobar que la salida del mapper es aceptada en el boundary real. NO se invoca
// `resolveNutritionEnergy`: conectarlo es la Fase C, y el aislamiento de autoridad
// se demuestra aparte.
// ─────────────────────────────────────────────────────────────────────────────

const CODIGO = srcMapper
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

const usa = (id: string) =>
  new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(CODIGO);

/** Perfil mínimo completo: entrena 4 × 60. */
const BASE: PersistedObData = {
  sex: 'Hombre',
  goal: 'Bajar grasa',
  edad: 34,
  estatura: 178,
  peso: 82,
  embarazo: 0,
  requiresTherapeuticDiet: 0,
  dailyLife: 'DL2',
  trainsHabitually: 1,
  trainingDaysPerWeek: 4,
  trainingSessionMinutes: 60,
};

const perfil = (over: PersistedObData = {}): PersistedObData => ({ ...BASE, ...over });

/** Quita claves (para simular un perfil legacy que nunca las declaró). */
const sin = (...keys: string[]): PersistedObData => {
  const ob = perfil();
  for (const k of keys) delete ob[k];
  return ob;
};

const completo = (ob: PersistedObData) => {
  const r = nutritionProfileInputFrom(ob);
  if (!r.complete) throw new Error(`esperaba completo, faltó: ${r.missing.join(', ')}`);
  return r.profile;
};

// ═════════════════════════════════════════════════════════════════════════════
// A · DAILY LIFE
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · los cuatro niveles de movimiento diario', () => {
  it('DL1–DL4 pasan tal cual y el clasificador los acepta', () => {
    for (const dl of ['DL1', 'DL2', 'DL3', 'DL4'] as const) {
      const p = completo(perfil({ dailyLife: dl }));
      expect(p.activityProfile.dailyLife).toBe(dl);
      expect(() => classifyActivity(p.activityProfile)).not.toThrow();
    }
  });

  it('cada DL produce una clasificación distinta del vecino con el mismo volumen', () => {
    const ranks = (['DL1', 'DL2', 'DL3', 'DL4'] as const).map((dl) =>
      classifyActivity(completo(perfil({ dailyLife: dl })).activityProfile),
    );
    // No se asume monotonía de kcal; sí que la celda de la matriz cambia.
    const celdas = ranks.map((r) => r.matrixCell.dailyLife);
    expect(new Set(celdas).size).toBe(4);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · ENTRENAMIENTO HABITUAL
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · entrenamiento habitual', () => {
  it('trainsHabitually = 0 → boolean false y 0/0', () => {
    const p = completo(perfil({ trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 }));
    const ht = p.activityProfile.habitualTraining;
    expect(ht.trainsHabitually).toBe(false);
    expect(typeof ht.trainsHabitually).toBe('boolean');
    expect(ht.daysPerWeek).toBe(0);
    expect(ht.habitualSessionMinutes).toBe(0);
    expect(classifyActivity(p.activityProfile).weeklyTrainingMinutes).toBe(0);
  });

  it('«0» como cadena (round trip) también → false y 0/0', () => {
    const p = completo(perfil({ trainsHabitually: '0', trainingDaysPerWeek: '0', trainingSessionMinutes: '0' }));
    expect(p.activityProfile.habitualTraining)
      .toEqual({ trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 });
  });

  it('«1» como cadena → true con sus días y minutos', () => {
    const p = completo(perfil({ trainsHabitually: '1', trainingDaysPerWeek: 3, trainingSessionMinutes: 45 }));
    expect(p.activityProfile.habitualTraining)
      .toEqual({ trainsHabitually: true, daysPerWeek: 3, habitualSessionMinutes: 45 });
  });

  it('con «No», unos días/minutos obsoletos de un «Sí» anterior quedan neutralizados', () => {
    const p = completo(perfil({ trainsHabitually: 0, trainingDaysPerWeek: 4, trainingSessionMinutes: 60 }));
    expect(p.activityProfile.habitualTraining.daysPerWeek).toBe(0);
    expect(p.activityProfile.habitualTraining.habitualSessionMinutes).toBe(0);
    expect(classifyActivity(p.activityProfile).weeklyTrainingMinutes).toBe(0);
  });

  it('trainsHabitually = 1 → boolean true con días y minutos declarados', () => {
    const p = completo(perfil({ trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 75 }));
    const ht = p.activityProfile.habitualTraining;
    expect(ht).toEqual({ trainsHabitually: true, daysPerWeek: 5, habitualSessionMinutes: 75 });
    expect(classifyActivity(p.activityProfile).weeklyTrainingMinutes).toBe(375);
  });

  it('los 7 días × los minutos declarados dan weekly = días × minutos', () => {
    for (const d of [1, 2, 3, 4, 5, 6, 7]) {
      for (const m of [20, 30, 45, 50, 60, 90, 120, 150]) {
        const p = completo(perfil({ trainingDaysPerWeek: d, trainingSessionMinutes: m }));
        expect(classifyActivity(p.activityProfile).weeklyTrainingMinutes).toBe(d * m);
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · MINUTOS ARBITRARIOS · no se discretizan
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · la duración declarada se preserva exacta', () => {
  it('20 · 50 · 60 · 120 · 150 · 300 sobreviven sin redondeo', () => {
    for (const m of [20, 50, 60, 120, 150, 300]) {
      const p = completo(perfil({ trainingSessionMinutes: m }));
      expect(p.activityProfile.habitualTraining.habitualSessionMinutes).toBe(m);
    }
  });

  it('50 minutos persisten como 50, no como el atajo más cercano', () => {
    const p = completo(perfil({ trainingSessionMinutes: 50 }));
    expect(p.activityProfile.habitualTraining.habitualSessionMinutes).toBe(50);
    expect(p.activityProfile.habitualTraining.habitualSessionMinutes).not.toBe(45);
    expect(p.activityProfile.habitualTraining.habitualSessionMinutes).not.toBe(60);
  });

  it('un valor fuera del rango de UI sigue siendo aceptado por el motor si es válido', () => {
    // La UI acota a [1, 300]; el rango estructural del clasificador es [0, 1440] y
    // no se toca. El mapper no reimplementa ninguno de los dos.
    const p = completo(perfil({ trainingDaysPerWeek: 1, trainingSessionMinutes: 600 }));
    expect(classifyActivity(p.activityProfile).weeklyTrainingMinutes).toBe(600);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · 0 NO DESAPARECE
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · 0 es una respuesta, no una ausencia', () => {
  it('trainsHabitually = 0 NO se reporta como missing', () => {
    const r = nutritionProfileInputFrom(perfil({ trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 }));
    expect(r.complete).toBe(true);
  });

  it('trainsHabitually ausente SÍ se reporta como missing', () => {
    const r = nutritionProfileInputFrom(sin('trainsHabitually'));
    expect(r.complete).toBe(false);
    if (r.complete) return;
    expect(r.missing).toContain('trainsHabitually');
  });

  it('0 y ausente son resultados DISTINTOS para la misma clave', () => {
    const cero = nutritionProfileInputFrom(perfil({ trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 }));
    const ausente = nutritionProfileInputFrom(sin('trainsHabitually'));
    expect(cero.complete).toBe(true);
    expect(ausente.complete).toBe(false);
  });

  it('embarazo = 0 NO se reporta como missing', () => {
    expect(nutritionProfileInputFrom(perfil({ embarazo: 0 })).complete).toBe(true);
  });

  it('el mapper no decide presencia por truthiness', () => {
    // Si usara `if (ob.trainsHabitually)` o `||`, los ceros se leerían como ausentes.
    expect(CODIGO).not.toMatch(/if\s*\(\s*ob\.(trainsHabitually|embarazo|trainingDaysPerWeek|trainingSessionMinutes)\s*\)/);
    expect(CODIGO).not.toMatch(/ob\.(trainsHabitually|embarazo|trainingDaysPerWeek|trainingSessionMinutes)\s*\|\|/);
    expect(CODIGO).toContain("in ob");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · EMBARAZO · decisión 15.2
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · embarazo / lactancia', () => {
  it('ausente → INCOMPLETE con pregnantOrLactating en missing', () => {
    const r = nutritionProfileInputFrom(sin('embarazo'));
    expect(r.complete).toBe(false);
    if (r.complete) return;
    expect(r.missing).toContain('pregnantOrLactating');
  });

  it('ausente NUNCA se resuelve como false', () => {
    const r = nutritionProfileInputFrom(sin('embarazo'));
    expect(r.profile).toBeUndefined();
  });

  it('0 · «0» → false · 1 · «1» → true', () => {
    expect(completo(perfil({ embarazo: 0 })).pregnantOrLactating).toBe(false);
    expect(completo(perfil({ embarazo: '0' })).pregnantOrLactating).toBe(false);
    expect(completo(perfil({ embarazo: 1 })).pregnantOrLactating).toBe(true);
    expect(completo(perfil({ embarazo: '1' })).pregnantOrLactating).toBe(true);
  });

  it('un valor no interpretable LANZA, no se coerciona a false ni a missing', () => {
    for (const v of ['si', 2, '2', 'true', -1, 'no']) {
      expect(() => nutritionProfileInputFrom(perfil({ embarazo: v })), String(v))
        .toThrow(InvalidPersistedProfileError);
    }
  });

  it('el error identifica la clave PERSISTIDA y el valor recibido', () => {
    try {
      nutritionProfileInputFrom(perfil({ embarazo: 'si' }));
      throw new Error('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidPersistedProfileError);
      const err = e as InvalidPersistedProfileError;
      expect(err.key).toBe('embarazo');
      expect(err.received).toBe('si');
      expect(err.name).toBe('InvalidPersistedProfileError');
      expect(err.message).toContain('obData.embarazo');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · ESTATURA Y SU ALIAS LEGACY
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · estatura / altura', () => {
  it('lee la clave canónica estatura', () => {
    expect(completo(perfil({ estatura: 165 })).heightCm).toBe(165);
  });

  it('con estatura ausente, lee el alias legacy altura', () => {
    const ob = sin('estatura');
    ob.altura = 171;
    expect(completo(ob).heightCm).toBe(171);
  });

  it('estatura tiene PRIORIDAD sobre altura', () => {
    expect(completo(perfil({ estatura: 180, altura: 150 })).heightCm).toBe(180);
  });

  it('sin ninguna de las dos → missing heightCm', () => {
    const r = nutritionProfileInputFrom(sin('estatura'));
    expect(r.complete).toBe(false);
    if (r.complete) return;
    expect(r.missing).toContain('heightCm');
  });

  it('el alias NO sale del mapper: la salida es heightCm', () => {
    const ob = sin('estatura');
    ob.altura = 171;
    expect(Object.keys(completo(ob))).not.toContain('altura');
    expect(Object.keys(completo(ob))).not.toContain('estatura');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G · MISSING EXACTO · perfil legacy
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · perfil legacy incompleto', () => {
  it('un perfil legacy sin ActivityProfile reporta exactamente lo que falta', () => {
    const r = nutritionProfileInputFrom(
      sin('dailyLife', 'trainsHabitually', 'trainingDaysPerWeek', 'trainingSessionMinutes'),
    );
    expect(r.complete).toBe(false);
    if (r.complete) return;
    // days/minutes NO se reclaman: dependen de una pregunta que todavía no se hizo.
    expect([...r.missing]).toEqual(['dailyLife', 'trainsHabitually']);
  });

  it('declaró que SÍ entrena pero faltan los detalles → se reclaman los dos', () => {
    const ob = sin('trainingDaysPerWeek', 'trainingSessionMinutes');
    const r = nutritionProfileInputFrom(ob);
    expect(r.complete).toBe(false);
    if (r.complete) return;
    expect([...r.missing]).toEqual(['trainingDaysPerWeek', 'trainingSessionMinutes']);
  });

  it('declaró que NO entrena → no se reclama ningún detalle', () => {
    const ob = sin('trainingDaysPerWeek', 'trainingSessionMinutes');
    ob.trainsHabitually = 0;
    expect(nutritionProfileInputFrom(ob).complete).toBe(true);
  });

  it('un obData vacío reclama los campos base, el alcance de salud (A7) y los dos de actividad', () => {
    const r = nutritionProfileInputFrom({});
    expect(r.complete).toBe(false);
    if (r.complete) return;
    expect([...r.missing]).toEqual([
      'sex', 'goal', 'ageYears', 'heightCm', 'weightKg',
      'pregnantOrLactating', 'requiresTherapeuticDiet', 'dailyLife', 'trainsHabitually',
    ]);
  });

  it('null / undefined no lanzan: devuelven incompleto', () => {
    expect(nutritionProfileInputFrom(null).complete).toBe(false);
    expect(nutritionProfileInputFrom(undefined).complete).toBe(false);
  });

  it('missing respeta el orden estable de MISSING_PROFILE_FIELDS', () => {
    const r = nutritionProfileInputFrom({});
    if (r.complete) throw new Error('esperaba incompleto');
    const orden = MISSING_PROFILE_FIELDS.filter((f) => r.missing.includes(f));
    expect([...r.missing]).toEqual(orden);
  });

  it('una cadena vacía cuenta como NO DECLARADA, no como inválida', () => {
    for (const k of ['sex', 'goal', 'dailyLife']) {
      const r = nutritionProfileInputFrom(perfil({ [k]: '' }));
      expect(r.complete, k).toBe(false);
    }
  });

  it('incompleto NUNCA acarrea un profile', () => {
    const r = nutritionProfileInputFrom({});
    expect(r.profile).toBeUndefined();
  });

  it('completo NUNCA acarrea missing', () => {
    const r = nutritionProfileInputFrom(perfil());
    expect(r.missing).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H · MALFORMED ≠ MISSING
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · lo malformado no se degrada a «no respondido»', () => {
  it('dailyLife inválido llega COMPLETO y lo rechaza el clasificador', () => {
    const p = completo(perfil({ dailyLife: 'DL9' }));
    expect(p.activityProfile.dailyLife).toBe('DL9');
    expect(() => classifyActivity(p.activityProfile)).toThrow(/dailyLife/);
  });

  it('días fuera de rango llegan completos y los rechaza el clasificador', () => {
    for (const d of [8, -1, 2.5]) {
      const p = completo(perfil({ trainingDaysPerWeek: d }));
      expect(() => classifyActivity(p.activityProfile)).toThrow(/daysPerWeek/);
    }
  });

  it('0 días con «Sí» es incoherente y lo rechaza el clasificador, no el mapper', () => {
    const p = completo(perfil({ trainsHabitually: 1, trainingDaysPerWeek: 0 }));
    expect(() => classifyActivity(p.activityProfile)).toThrow(/daysPerWeek/);
  });

  it('minutos inválidos llegan completos y los rechaza el clasificador', () => {
    for (const m of [-1, 1441, 10.5]) {
      const p = completo(perfil({ trainingSessionMinutes: m }));
      expect(() => classifyActivity(p.activityProfile)).toThrow(/habitualSessionMinutes/);
    }
  });

  it('trainsHabitually no interpretable LANZA desde el mapper: no es un «No»', () => {
    for (const v of [2, '2', 'si', 'true', -1]) {
      expect(() => nutritionProfileInputFrom(perfil({ trainsHabitually: v })), String(v))
        .toThrow(InvalidPersistedProfileError);
    }
    try {
      nutritionProfileInputFrom(perfil({ trainsHabitually: 2 }));
      throw new Error('debió lanzar');
    } catch (e) {
      expect((e as InvalidPersistedProfileError).key).toBe('trainsHabitually');
    }
  });

  it('PERSISTENCE MALFORMED no se degrada nunca a missing', () => {
    for (const key of PERSISTED_BOOLEAN_KEYS) {
      const r = () => nutritionProfileInputFrom(perfil({ [key]: 'basura' }));
      expect(r, key).toThrow(InvalidPersistedProfileError);
    }
  });

  it('edad no numérica llega completa y la rechaza Profile Validation', () => {
    const p = completo(perfil({ edad: 'treinta' }));
    expect(Number.isNaN(p.ageYears)).toBe(true);
    expect(() => validateNutritionProfile(p)).toThrow(/ageYears/);
  });

  it('un sexo no mapeable llega completo y lo rechaza Profile Validation', () => {
    const p = completo(perfil({ sex: 'Marciano' }));
    expect(() => validateNutritionProfile(p)).toThrow(/sex/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// I · ROUND TRIP JSON
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · round trip de persistencia', () => {
  const idaYVuelta = (ob: PersistedObData) => JSON.parse(JSON.stringify(ob)) as PersistedObData;

  it('el perfil completo sobrevive la serialización a jsonb', () => {
    const antes = completo(perfil());
    const despues = completo(idaYVuelta(perfil()));
    expect(despues).toEqual(antes);
  });

  it('el 0 de «No entrena» sobrevive y sigue sin ser missing', () => {
    const ob = idaYVuelta(perfil({ trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 }));
    expect(ob.trainsHabitually).toBe(0);
    const p = completo(ob);
    expect(p.activityProfile.habitualTraining.trainsHabitually).toBe(false);
  });

  it('una clave ausente sigue ausente tras el round trip', () => {
    const ob = idaYVuelta(sin('dailyLife'));
    expect('dailyLife' in ob).toBe(false);
    expect(nutritionProfileInputFrom(ob).complete).toBe(false);
  });

  it('valores guardados como string (jsonb) se leen igual', () => {
    const p = completo(perfil({
      edad: '34', estatura: '178', peso: '82',
      trainsHabitually: '1', trainingDaysPerWeek: '4', trainingSessionMinutes: '50',
      embarazo: '0',
    }));
    expect(p.ageYears).toBe(34);
    expect(p.heightCm).toBe(178);
    expect(p.weightKg).toBe(82);
    expect(p.pregnantOrLactating).toBe(false);
    expect(p.activityProfile.habitualTraining)
      .toEqual({ trainsHabitually: true, daysPerWeek: 4, habitualSessionMinutes: 50 });
  });

  it('determinista: 50 llamadas dan el mismo resultado', () => {
    const primero = nutritionProfileInputFrom(perfil());
    for (let i = 0; i < 50; i++) expect(nutritionProfileInputFrom(perfil())).toEqual(primero);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// J · OUTPUT EXACTO
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · forma exacta del ProfileInput', () => {
  it('exactamente las 8 claves del contrato, sin sobrantes', () => {
    expect(Object.keys(completo(perfil())).sort()).toEqual([
      'activityProfile', 'ageYears', 'goal', 'heightCm',
      'pregnantOrLactating', 'requiresTherapeuticDiet', 'sex', 'weightKg',
    ]);
  });

  it('activityProfile tiene exactamente su forma anidada', () => {
    const ap = completo(perfil()).activityProfile;
    expect(Object.keys(ap).sort()).toEqual(['dailyLife', 'habitualTraining']);
    expect(Object.keys(ap.habitualTraining).sort())
      .toEqual(['daysPerWeek', 'habitualSessionMinutes', 'trainsHabitually']);
  });

  it('no aparece ninguna clave de obData en la salida', () => {
    const p = completo(perfil());
    const fuera = ['edad', 'estatura', 'peso', 'embarazo', 'activity', 'nivel',
      'dailyLife', 'trainsHabitually', 'trainingDaysPerWeek', 'trainingSessionMinutes',
      'pesoMeta', 'grasa', 'movilidad', 'conditions', 'avoid', 'country'];
    for (const k of fuera) expect(Object.keys(p)).not.toContain(k);
  });

  it('la salida es aceptada por Profile Validation', () => {
    expect(() => validateNutritionProfile(completo(perfil()))).not.toThrow();
  });

  it('INVARIANTE · con complete:true los booleanos que canonicaliza el mapper SON booleanos', () => {
    // Barrido del producto cartesiano de las representaciones admitidas, en los dos
    // caminos (entrena / no entrena) y con días y minutos como número y como cadena.
    const emb: (string | number)[] = [0, '0', 1, '1'];
    const tra: (string | number)[] = [0, '0', 1, '1'];
    let vistos = 0;
    for (const embarazo of emb) {
      for (const trainsHabitually of tra) {
        for (const dias of [4, '4'] as (string | number)[]) {
          for (const mins of [50, '50'] as (string | number)[]) {
            const r = nutritionProfileInputFrom(perfil({
              embarazo, trainsHabitually,
              trainingDaysPerWeek: dias, trainingSessionMinutes: mins,
            }));
            expect(r.complete).toBe(true);
            if (!r.complete) continue;
            expect(typeof r.profile.pregnantOrLactating).toBe('boolean');
            expect(typeof r.profile.activityProfile.habitualTraining.trainsHabitually).toBe('boolean');
            vistos++;
          }
        }
      }
    }
    expect(vistos).toBe(64);
  });

  it('INVARIANTE · se cumple también en los casos de DOMAIN MALFORMED', () => {
    // Un `'DL9'` o 8 días siguen llegando completos —su dueño es otro módulo—, pero
    // los dos booleanos del mapper siguen siendo booleanos.
    for (const over of [
      { dailyLife: 'DL9' }, { trainingDaysPerWeek: 8 }, { trainingDaysPerWeek: 0 },
      { trainingSessionMinutes: 1441 }, { edad: 'treinta' }, { sex: 'Marciano' },
    ]) {
      const p = completo(perfil(over));
      expect(typeof p.pregnantOrLactating, JSON.stringify(over)).toBe('boolean');
      expect(typeof p.activityProfile.habitualTraining.trainsHabitually).toBe('boolean');
    }
  });

  it('sex y goal viajan como los escribe el producto (sin normalizar aquí)', () => {
    const p = completo(perfil({ sex: 'Mujer', goal: 'Subir masa muscular' }));
    expect(p.sex).toBe('Mujer');
    expect(p.goal).toBe('Subir masa muscular');
    // Y Profile Validation es quien los canonicaliza.
    const v = validateNutritionProfile(p);
    expect(v.sex).toBe('female');
    expect(v.goal).toBe('MUSCLE_GAIN');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// K · SIN FALLBACKS NI DEFAULTS
// ═════════════════════════════════════════════════════════════════════════════
describe('mapper · ningún fallback, ningún default', () => {
  it('los cinco valores de activity NO cambian el resultado', () => {
    const esperado = completo(perfil());
    for (const activity of ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta']) {
      expect(completo(perfil({ activity }))).toEqual(esperado);
    }
  });

  it('sin ActivityProfile, activity NO lo rellena', () => {
    for (const activity of ['Sedentaria', 'Moderada', 'Atleta']) {
      const ob = sin('dailyLife', 'trainsHabitually');
      ob.activity = activity;
      const r = nutritionProfileInputFrom(ob);
      expect(r.complete).toBe(false);
      if (r.complete) return;
      expect(r.missing).toContain('dailyLife');
    }
  });

  it('los tres valores de nivel NO cambian el resultado', () => {
    const esperado = completo(perfil());
    for (const nivel of ['principiante', 'intermedio', 'avanzado']) {
      expect(completo(perfil({ nivel }))).toEqual(esperado);
    }
  });

  it('sin ActivityProfile, nivel NO lo rellena', () => {
    const ob = sin('dailyLife', 'trainsHabitually');
    ob.nivel = 'avanzado';
    expect(nutritionProfileInputFrom(ob).complete).toBe(false);
  });

  it('las sesiones observadas de HSC NO rellenan nada', () => {
    const ob = sin('dailyLife', 'trainsHabitually');
    ob.completedSessions = 40;
    ob.trainingFrequency = 5;
    const r = nutritionProfileInputFrom(ob);
    expect(r.complete).toBe(false);
    if (r.complete) return;
    expect([...r.missing]).toEqual(['dailyLife', 'trainsHabitually']);
  });

  it('pesoMeta y grasa no entran en la salida ni la alteran', () => {
    const esperado = completo(perfil());
    expect(completo(perfil({ pesoMeta: 70, grasa: 22 }))).toEqual(esperado);
  });

  it('el source no menciona ningún identificador prohibido', () => {
    for (const id of [
      'activity', 'actividad', 'nivel', 'levelFromObData', 'levelFromActivity',
      'completedSessions', 'workout_log', 'trainingFrequency', 'readiness',
      'pesoMeta', 'targetWeight', 'grasa', 'bodyFat',
      'computeNutritionTargets', 'parseObData', 'calcTDEE', 'ACTIVITY_FACTORS', 'actIdx',
      'useAppStore', 'supabase', 'Date', 'Math',
    ]) {
      expect(usa(id), `no debe usar ${id}`).toBe(false);
    }
  });

  it('el source no contiene defaults numéricos ni de cadena', () => {
    expect(CODIGO).not.toMatch(/\|\|\s*(28|70|170|60|30|3|1)\b/);
    expect(CODIGO).not.toMatch(/\?\?\s*(28|70|170|60|30|3|1)\b/);
    expect(CODIGO).not.toMatch(/\|\|\s*['"]DL[1-4]['"]/);
    expect(CODIGO).not.toMatch(/\?\?\s*['"]DL[1-4]['"]/);
    expect(CODIGO).not.toMatch(/\|\|\s*['"](Hombre|Mujer|Moderada)['"]/);
  });

  it('no calcula nada: ni kcal, ni IMC, ni minutos semanales', () => {
    for (const id of [
      'weeklyTrainingMinutes', 'trainingBandOf', 'classifyActivity',
      'estimateMaintenance', 'prescribeEnergy', 'bmi', 'kcal', 'eer', 'pal',
    ]) {
      expect(usa(id), `no debe usar ${id}`).toBe(false);
    }
  });
});
