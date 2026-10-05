import { describe, it, expect } from 'vitest';
import srcState from '../nutritionEnergyState.ts?raw';
import {
  resolveNutritionEnergyState,
  buildEnergySnapshot,
  parseEnergySnapshot,
  energyInputIdentity,
  currentEngineVersions,
  ENERGY_IDENTITY_FIELDS,
  ENERGY_SNAPSHOT_SCHEMA_VERSION,
  NUTRITION_ENERGY_STATUSES,
  isIsoUtcTimestamp,
  type EnergySnapshotV1,
} from '../nutritionEnergyState';
import { ACTIVITY_CLASSIFIER_VERSION } from '../activityClassifier';
import { MAINTENANCE_ESTIMATE_VERSION } from '../maintenanceEstimate';
import { ENERGY_PRESCRIPTION_VERSION } from '../energyPrescription';
import { ORCHESTRATOR_VERSION } from '../nutritionEnergyOrchestrator';
import { InvalidActivityProfileError } from '../activityClassifier';
import { InvalidProfileInputError } from '../profileValidation';
import type { PersistedObData } from '../nutritionProfileInput';
import type { ProfileInput } from '../profileValidation';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE C2 · ESTADO ENERGÉTICO + SNAPSHOT V1 + INPUT IDENTITY
//
// Todo lo que C4 necesitará, probado y todavía INERTE. Lo que fijan estos tests:
//   · los SEIS estados se producen desde `obData`, y los errores que NO son
//     «perfil ilegible» se PROPAGAN en vez de disfrazarse de estado
//   · el snapshot lleva exactamente la información que su estado tiene — ni una
//     cifra, ni un mantenimiento ni una clasificación inventados
//   · la identidad es canónica: dos escrituras del mismo hecho nutricional dan el
//     mismo hash, y los datos sin autoridad energética no lo mueven
//   · el parser distingue ausente de versión desconocida de corrupto, y nunca
//     hace `as` sobre un JSON que no ha validado
//   · CERO consumidores productivos
// ─────────────────────────────────────────────────────────────────────────────

const CODIGO = srcState
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

/** Cuerpo de una función exportada, hasta la siguiente declaración de nivel raíz. */
function cuerpoDe(nombre: string): string {
  const i = CODIGO.indexOf(`export function ${nombre}(`);
  expect(i, `no se encontró ${nombre}`).toBeGreaterThan(-1);
  const resto = CODIGO.slice(i + 1);
  const j = resto.indexOf('\nexport ');
  return j === -1 ? resto : resto.slice(0, j);
}

const AHORA = '2026-10-02T12:00:00.000Z';

/** Adulto normal que entrena 4 × 60 → PRESCRIBED. */
const OB: PersistedObData = {
  sex: 'Hombre', goal: 'Bajar grasa', edad: 34, estatura: 178, peso: 82,
  embarazo: 0, dailyLife: 'DL2', trainsHabitually: 1,
  trainingDaysPerWeek: 4, trainingSessionMinutes: 60,
};
const ob = (over: PersistedObData = {}): PersistedObData => ({ ...OB, ...over });
const sin = (...keys: string[]): PersistedObData => {
  const o = ob();
  for (const k of keys) delete o[k];
  return o;
};

const PERFIL: ProfileInput = {
  sex: 'Hombre', goal: 'Bajar grasa', ageYears: 34, heightCm: 178, weightKg: 82,
  pregnantOrLactating: false,
  activityProfile: {
    dailyLife: 'DL2',
    habitualTraining: { trainsHabitually: true, daysPerWeek: 4, habitualSessionMinutes: 60 },
  },
};
const perfil = (over: Partial<ProfileInput> = {}): ProfileInput => ({ ...PERFIL, ...over });
const conActividad = (over: Partial<ProfileInput['activityProfile']['habitualTraining']>,
  dailyLife = PERFIL.activityProfile.dailyLife): ProfileInput => ({
  ...PERFIL,
  activityProfile: {
    dailyLife,
    habitualTraining: { ...PERFIL.activityProfile.habitualTraining, ...over },
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// A · LOS SEIS ESTADOS
// ═════════════════════════════════════════════════════════════════════════════
describe('C2 · estado productivo · los seis estados', () => {
  it('perfil válido con objetivo alcanzable → PRESCRIBED', () => {
    const s = resolveNutritionEnergyState(ob());
    expect(s.status).toBe('PRESCRIBED');
    expect(s.prescribedEnergy).toBeTypeOf('number');
  });

  it('IMC < 18.5 con pérdida de grasa → FAT_LOSS_BLOCKED', () => {
    // 50 kg a 190 cm → IMC 13.9
    const s = resolveNutritionEnergyState(ob({ peso: 50, estatura: 190 }));
    expect(s.status).toBe('FAT_LOSS_BLOCKED');
    expect(s.prescribedEnergy).toBeUndefined();
  });

  it('pérdida de grasa con raw <= 1200 → OUTSIDE_HSC_FAT_LOSS_SCOPE', () => {
    // Mujer mayor y muy bajita con IMC apenas sobre 18.5: el único rincón donde
    // el gate de 1200 es alcanzable sin que el guard de IMC dispare antes.
    const s = resolveNutritionEnergyState(ob({
      sex: 'Mujer', edad: 64, estatura: 143, peso: 39,
      dailyLife: 'DL1', trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0,
    }));
    expect(s.status).toBe('OUTSIDE_HSC_FAT_LOSS_SCOPE');
    expect(s.prescribedEnergy).toBeUndefined();
    expect(s.rawPrescribedEnergy).toBeTypeOf('number');
    expect(s.rawPrescribedEnergy!).toBeLessThanOrEqual(1200);
  });

  it('menor de 19 → OUTSIDE_HSC_NUTRITION_SCOPE', () => {
    const s = resolveNutritionEnergyState(ob({ edad: 16 }));
    expect(s.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(s.scopeReason).toBe('age_under_19');
    expect(s.maintenance).toBeUndefined();
    expect(s.classification).toBeUndefined();
  });

  it('65 años o más → OUTSIDE_HSC_NUTRITION_SCOPE / age_65_or_over', () => {
    // C4-PRE · Nutrition V1 prescribe 19–64 inclusive.
    for (const edad of [65, 70, 90]) {
      const s = resolveNutritionEnergyState(ob({ edad }));
      expect(s.status, `edad ${edad}`).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
      expect(s.scopeReason, `edad ${edad}`).toBe('age_65_or_over');
      expect(s.maintenance, `edad ${edad}`).toBeUndefined();
      expect(s.classification, `edad ${edad}`).toBeUndefined();
      expect(s.prescribedEnergy, `edad ${edad}`).toBeUndefined();
    }
    // 18 y 64 son las dos fronteras: fuera por abajo, dentro por arriba.
    expect(resolveNutritionEnergyState(ob({ edad: 18 })).scopeReason).toBe('age_under_19');
    expect(resolveNutritionEnergyState(ob({ edad: 64 })).status).toBe('PRESCRIBED');
  });

  it('el snapshot de >= 65 no inventa mantenimiento ni clasificación', () => {
    const s = buildEnergySnapshot(ob({ edad: 70 }), AHORA).snapshot;
    expect(s.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(s.maintenance).toBeUndefined();
    expect(s.classification).toBeUndefined();
    expect(s.prescribedEnergy).toBeUndefined();
    // Sí lleva identidad y versiones: el perfil es canónico y el orquestador corrió.
    expect(s.inputIdentity).toMatch(/^[0-9a-f]{8}$/);
    expect(s.versions).toEqual(currentEngineVersions());
    expect(parseEnergySnapshot(JSON.parse(JSON.stringify(s))).ok).toBe(true);
  });

  it('la edad entra en la identidad también al cruzar la frontera de 64/65', () => {
    const a = buildEnergySnapshot(ob({ edad: 64 }), AHORA).snapshot.inputIdentity;
    const b = buildEnergySnapshot(ob({ edad: 65 }), AHORA).snapshot.inputIdentity;
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a).not.toBe(b);
  });

  it('embarazo o lactancia → OUTSIDE_HSC_NUTRITION_SCOPE', () => {
    const s = resolveNutritionEnergyState(ob({ sex: 'Mujer', embarazo: 1 }));
    expect(s.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(s.scopeReason).toBe('pregnancy_or_lactation');
  });

  it('falta una respuesta requerida → PROFILE_INCOMPLETE con el missing exacto', () => {
    const s = resolveNutritionEnergyState(sin('dailyLife', 'trainsHabitually'));
    expect(s.status).toBe('PROFILE_INCOMPLETE');
    if (s.status !== 'PROFILE_INCOMPLETE') return;
    expect([...s.missing]).toEqual(['dailyLife', 'trainsHabitually']);
  });

  it('un 0/1 persistido ilegible → PROFILE_UNREADABLE con la clave exacta', () => {
    const s = resolveNutritionEnergyState(ob({ trainsHabitually: 2 }));
    expect(s.status).toBe('PROFILE_UNREADABLE');
    if (s.status !== 'PROFILE_UNREADABLE') return;
    expect(s.key).toBe('trainsHabitually');

    const e = resolveNutritionEnergyState(ob({ embarazo: 'si' }));
    expect(e.status).toBe('PROFILE_UNREADABLE');
    if (e.status !== 'PROFILE_UNREADABLE') return;
    expect(e.key).toBe('embarazo');
  });

  it('los seis estados son alcanzables y ninguno más', () => {
    const vistos = new Set([
      resolveNutritionEnergyState(ob()).status,
      resolveNutritionEnergyState(ob({ peso: 50, estatura: 190 })).status,
      resolveNutritionEnergyState(ob({ sex: 'Mujer', edad: 64, estatura: 143, peso: 39, dailyLife: 'DL1', trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 })).status,
      resolveNutritionEnergyState(ob({ edad: 16 })).status,
      resolveNutritionEnergyState(sin('dailyLife')).status,
      resolveNutritionEnergyState(ob({ trainsHabitually: 2 })).status,
    ]);
    expect(vistos.size).toBe(6);
    for (const s of vistos) expect(NUTRITION_ENERGY_STATUSES).toContain(s);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · LOS ERRORES QUE NO SON «ILEGIBLE» SE PROPAGAN
// ═════════════════════════════════════════════════════════════════════════════
describe('C2 · un fallo desconocido NO se disfraza de estado', () => {
  it('un dailyLife inválido LANZA: es dato inválido, no perfil ilegible', () => {
    expect(() => resolveNutritionEnergyState(ob({ dailyLife: 'DL9' })))
      .toThrow(InvalidActivityProfileError);
  });

  it('días o minutos fuera de rango LANZAN', () => {
    expect(() => resolveNutritionEnergyState(ob({ trainingDaysPerWeek: 8 })))
      .toThrow(InvalidActivityProfileError);
    expect(() => resolveNutritionEnergyState(ob({ trainingSessionMinutes: 1441 })))
      .toThrow(InvalidActivityProfileError);
    // 0 días declarando que entrena: incoherente, lo rechaza el clasificador.
    expect(() => resolveNutritionEnergyState(ob({ trainingDaysPerWeek: 0 })))
      .toThrow(InvalidActivityProfileError);
  });

  it('un sexo o un objetivo no mapeables LANZAN', () => {
    expect(() => resolveNutritionEnergyState(ob({ sex: 'Marciano' })))
      .toThrow(InvalidProfileInputError);
    expect(() => resolveNutritionEnergyState(ob({ goal: 'Volar' })))
      .toThrow(InvalidProfileInputError);
  });

  it('una edad no numérica LANZA', () => {
    expect(() => resolveNutritionEnergyState(ob({ edad: 'treinta' })))
      .toThrow(InvalidProfileInputError);
  });

  it('el try/catch captura EXCLUSIVAMENTE InvalidPersistedProfileError', () => {
    expect(CODIGO.match(/\btry\s*\{/g)).toHaveLength(1);
    expect(CODIGO).toContain('if (e instanceof InvalidPersistedProfileError) return { kind: \'unreadable\', key: e.key };');
    expect(CODIGO).toContain('throw e;');
    // Ni un catch que se tragara cualquier cosa.
    expect(CODIGO).not.toMatch(/catch[^\n]*\{\s*return\s*\{\s*status/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · INPUT IDENTITY · canonicalización
// ═════════════════════════════════════════════════════════════════════════════
describe('C2 · input identity · misma semántica, misma identidad', () => {
  it('es estable y determinista', () => {
    const a = energyInputIdentity(perfil());
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    for (let i = 0; i < 20; i++) expect(energyInputIdentity(perfil())).toBe(a);
  });

  it('70 vs «70» → misma identidad (vía el mapper)', () => {
    const num = resolveNutritionEnergyState(ob());
    const str = resolveNutritionEnergyState(ob({ edad: '34', estatura: '178', peso: '82' }));
    expect(num.status).toBe('PRESCRIBED');
    expect(str.status).toBe('PRESCRIBED');
    expect(buildEnergySnapshot(ob(), AHORA).snapshot.inputIdentity)
      .toBe(buildEnergySnapshot(ob({ edad: '34', estatura: '178', peso: '82' }), AHORA).snapshot.inputIdentity);
  });

  it('1 vs «1» → misma identidad', () => {
    expect(buildEnergySnapshot(ob({ trainsHabitually: 1, embarazo: 0 }), AHORA).snapshot.inputIdentity)
      .toBe(buildEnergySnapshot(ob({ trainsHabitually: '1', embarazo: '0' }), AHORA).snapshot.inputIdentity);
  });

  it('estatura vs el alias legacy altura → misma identidad', () => {
    const conAltura = sin('estatura');
    conAltura.altura = 178;
    expect(buildEnergySnapshot(conAltura, AHORA).snapshot.inputIdentity)
      .toBe(buildEnergySnapshot(ob(), AHORA).snapshot.inputIdentity);
  });

  it('alias de objetivo equivalentes → misma identidad', () => {
    expect(energyInputIdentity(perfil({ goal: 'Subir masa muscular' })))
      .toBe(energyInputIdentity(perfil({ goal: 'MUSCLE_GAIN' })));
    expect(energyInputIdentity(perfil({ goal: 'Ganar músculo' })))
      .toBe(energyInputIdentity(perfil({ goal: 'MUSCLE_GAIN' })));
    expect(energyInputIdentity(perfil({ goal: 'Bajar grasa' })))
      .toBe(energyInputIdentity(perfil({ goal: 'FAT_LOSS' })));
  });

  it('representaciones de sexo equivalentes → misma identidad', () => {
    expect(energyInputIdentity(perfil({ sex: 'Hombre' })))
      .toBe(energyInputIdentity(perfil({ sex: 'male' })));
    expect(energyInputIdentity(perfil({ sex: 'Mujer' })))
      .toBe(energyInputIdentity(perfil({ sex: 'female' })));
  });

  it('con trainsHabitually=false, días y minutos obsoletos NO cambian la identidad', () => {
    const cero = energyInputIdentity(conActividad({ trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 }));
    const stale = energyInputIdentity(conActividad({ trainsHabitually: false, daysPerWeek: 4, habitualSessionMinutes: 60 }));
    expect(stale).toBe(cero);
  });

  it('cambiar cada uno de los diez inputs CAMBIA la identidad', () => {
    const base = energyInputIdentity(perfil());
    const variantes: [string, ProfileInput][] = [
      ['sex', perfil({ sex: 'Mujer' })],
      ['ageYears', perfil({ ageYears: 35 })],
      ['heightCm', perfil({ heightCm: 179 })],
      ['weightKg', perfil({ weightKg: 83 })],
      ['goal', perfil({ goal: 'Recomposición' })],
      ['pregnantOrLactating', perfil({ sex: 'Mujer', pregnantOrLactating: true })],
      ['dailyLife', conActividad({}, 'DL3')],
      ['trainsHabitually', conActividad({ trainsHabitually: false })],
      ['daysPerWeek', conActividad({ daysPerWeek: 5 })],
      ['habitualSessionMinutes', conActividad({ habitualSessionMinutes: 75 })],
    ];
    for (const [nombre, p] of variantes) {
      expect(energyInputIdentity(p), `${nombre} debe cambiar la identidad`).not.toBe(base);
    }
    // Y las diez variantes son distintas entre sí.
    expect(new Set(variantes.map(([, p]) => energyInputIdentity(p))).size).toBe(10);
  });

  it('los datos SIN autoridad energética NO cambian la identidad', () => {
    const base = buildEnergySnapshot(ob(), AHORA).snapshot.inputIdentity;
    const ruido: PersistedObData[] = [
      { activity: 'Sedentaria' }, { activity: 'Atleta' }, { actividad: 'Alta' },
      { nivel: 'avanzado' }, { nivel: 'principiante' },
      { country: 'espana' }, { movilidad: 'articular' },
      { conditions: 'renal,diabetes' }, { avoid: 'lacteos' },
      { grasa: 22 }, { pesoMeta: 70 },
      { completedSessions: 40 }, { trainingFrequency: 5 },
    ];
    for (const extra of ruido) {
      expect(buildEnergySnapshot(ob(extra), AHORA).snapshot.inputIdentity, JSON.stringify(extra))
        .toBe(base);
    }
  });

  it('el orden de los campos es EXPLÍCITO, no derivado de Object.keys', () => {
    expect(ENERGY_IDENTITY_FIELDS).toEqual([
      'sex', 'ageYears', 'heightCm', 'weightKg', 'goal', 'pregnantOrLactating',
      'dailyLife', 'trainsHabitually', 'daysPerWeek', 'habitualSessionMinutes',
    ]);
    // Acotado a la función de identidad: el parser estricto SÍ usa `Object.keys`
    // para detectar propiedades desconocidas, y eso es correcto.
    expect(cuerpoDe('energyInputIdentity')).not.toMatch(/Object\.keys/);
  });

  it('el hash NO incluye el reloj ni las versiones de motor', () => {
    const a = buildEnergySnapshot(ob(), '2026-01-01T00:00:00.000Z').snapshot;
    const b = buildEnergySnapshot(ob(), '2027-12-31T23:59:59.000Z').snapshot;
    expect(a.inputIdentity).toBe(b.inputIdentity);
    expect(a.computedAt).not.toBe(b.computedAt);
    // Las versiones viajan APARTE: si cambia un motor, la identidad no se mueve y
    // la decisión de recomputar la toma C4 comparando `versions`.
    const cuerpo = CODIGO.slice(CODIGO.indexOf('export function energyInputIdentity'));
    const hasta = cuerpo.indexOf('\nexport ');
    const fn = hasta === -1 ? cuerpo : cuerpo.slice(0, hasta);
    for (const id of ['computedAt', 'Date', 'VERSION', 'versions']) {
      expect(fn, `la identidad no debe usar ${id}`).not.toMatch(new RegExp(`\\b${id}`));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · SNAPSHOT POR ESTADO
// ═════════════════════════════════════════════════════════════════════════════
describe('C2 · snapshot · exactamente la información que el estado tiene', () => {
  const snap = (o: PersistedObData) => buildEnergySnapshot(o, AHORA).snapshot;

  it('PRESCRIBED · cifra, raw, mantenimiento, clasificación, identidad y versiones', () => {
    const s = snap(ob());
    expect(s.schemaVersion).toBe(1);
    expect(s.status).toBe('PRESCRIBED');
    expect(s.prescribedEnergy).toBeTypeOf('number');
    expect(s.rawPrescribedEnergy).toBeTypeOf('number');
    expect(s.maintenance?.initialMaintenance).toBeTypeOf('number');
    expect(s.maintenance?.confidence).toMatch(/^(CLEAR|BORDERLINE)$/);
    expect(s.classification).toEqual({ dailyLife: 'DL2', trainingBand: 'T2', weeklyTrainingMinutes: 240 });
    expect(s.inputIdentity).toMatch(/^[0-9a-f]{8}$/);
    expect(s.versions).toEqual(currentEngineVersions());
    expect(s.computedAt).toBe(AHORA);
  });

  it('FAT_LOSS_BLOCKED · SIN cifra, pero con mantenimiento y clasificación', () => {
    const s = snap(ob({ peso: 50, estatura: 190 }));
    expect(s.status).toBe('FAT_LOSS_BLOCKED');
    expect(s.prescribedEnergy).toBeUndefined();
    expect(s.rawPrescribedEnergy).toBeUndefined();
    expect(s.maintenance).toBeDefined();
    expect(s.classification).toBeDefined();
    expect(s.inputIdentity).toBeDefined();
    expect(s.versions).toBeDefined();
  });

  it('OUTSIDE_HSC_FAT_LOSS_SCOPE · sin cifra, CON raw para explicar el porqué', () => {
    const s = snap(ob({ sex: 'Mujer', edad: 64, estatura: 143, peso: 39, dailyLife: 'DL1', trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 }));
    expect(s.status).toBe('OUTSIDE_HSC_FAT_LOSS_SCOPE');
    expect(s.prescribedEnergy).toBeUndefined();
    expect(s.rawPrescribedEnergy).toBeTypeOf('number');
    expect(s.maintenance).toBeDefined();
    expect(s.classification).toBeDefined();
  });

  it('OUTSIDE_HSC_NUTRITION_SCOPE · NO se inventa mantenimiento ni clasificación', () => {
    // El orquestador cortocircuita antes de ejecutar un solo motor.
    for (const o of [ob({ edad: 16 }), ob({ sex: 'Mujer', embarazo: 1 })]) {
      const s = snap(o);
      expect(s.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
      expect(s.prescribedEnergy).toBeUndefined();
      expect(s.rawPrescribedEnergy).toBeUndefined();
      expect(s.maintenance).toBeUndefined();
      expect(s.classification).toBeUndefined();
      // Identidad y versiones SÍ: el perfil es canónico y el orquestador corrió.
      expect(s.inputIdentity).toMatch(/^[0-9a-f]{8}$/);
      expect(s.versions).toEqual(currentEngineVersions());
    }
  });

  it('PROFILE_INCOMPLETE · sin identidad ni versiones: no hay perfil canónico', () => {
    const s = snap(sin('dailyLife', 'trainsHabitually'));
    expect(s.status).toBe('PROFILE_INCOMPLETE');
    expect(s.inputIdentity).toBeUndefined();
    expect(s.versions).toBeUndefined();
    expect(s.maintenance).toBeUndefined();
    expect(s.classification).toBeUndefined();
    expect(s.prescribedEnergy).toBeUndefined();
    expect(Object.keys(s).sort()).toEqual(['computedAt', 'schemaVersion', 'status']);
  });

  it('PROFILE_UNREADABLE · idéntico principio', () => {
    const s = snap(ob({ trainsHabitually: 2 }));
    expect(s.status).toBe('PROFILE_UNREADABLE');
    expect(Object.keys(s).sort()).toEqual(['computedAt', 'schemaVersion', 'status']);
  });

  it('devuelve el estado junto al snapshot, y coinciden siempre', () => {
    for (const o of [ob(), ob({ edad: 16 }), sin('dailyLife'), ob({ trainsHabitually: 2 })]) {
      const { state, snapshot } = buildEnergySnapshot(o, AHORA);
      expect(snapshot.status).toBe(state.status);
      expect(state.status).toBe(resolveNutritionEnergyState(o).status);
    }
  });

  it('las versiones son las REALES de los módulos CLOSED, no literales', () => {
    expect(currentEngineVersions()).toEqual({
      classifier: ACTIVITY_CLASSIFIER_VERSION,
      maintenance: MAINTENANCE_ESTIMATE_VERSION,
      prescription: ENERGY_PRESCRIPTION_VERSION,
      orchestrator: ORCHESTRATOR_VERSION,
    });
    // Y se obtienen por constante importada, sin duplicar el número.
    expect(CODIGO).toContain('classifier: ACTIVITY_CLASSIFIER_VERSION');
    expect(CODIGO).toContain('maintenance: MAINTENANCE_ESTIMATE_VERSION');
    expect(CODIGO).toContain('prescription: ENERGY_PRESCRIPTION_VERSION');
    expect(CODIGO).toContain('orchestrator: ORCHESTRATOR_VERSION');
    expect(CODIGO).not.toMatch(/classifier:\s*\d/);
  });

  it('`currentEngineVersions` devuelve una copia: nadie muta el módulo', () => {
    const a = currentEngineVersions();
    a.classifier = 999;
    expect(currentEngineVersions().classifier).toBe(ACTIVITY_CLASSIFIER_VERSION);
  });

  it('el módulo NO lee el reloj', () => {
    expect(CODIGO).not.toMatch(/\bDate\.now\b/);
    expect(CODIGO).not.toMatch(/\bMath\.random\b/);
    // `new Date()` sin argumentos sí leería el reloj; `new Date(t)` con un
    // timestamp explícito solo parsea, y es lo que usa el validador de ISO.
    expect(CODIGO).not.toMatch(/new Date\(\s*\)/);
    expect(CODIGO).toContain('new Date(t).toISOString() === v');
  });

  it('el snapshot sobrevive el round trip a jsonb', () => {
    for (const o of [ob(), ob({ edad: 16 }), ob({ peso: 50, estatura: 190 }), sin('dailyLife'), ob({ trainsHabitually: 2 })]) {
      const s = snap(o);
      const vuelta = parseEnergySnapshot(JSON.parse(JSON.stringify(s)));
      expect(vuelta.ok, o.edad === 16 ? 'menor' : JSON.stringify(o).slice(0, 40)).toBe(true);
      if (!vuelta.ok) continue;
      expect(vuelta.snapshot).toEqual(s);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · PARSER
// ═════════════════════════════════════════════════════════════════════════════
describe('C2 · parser de jsonb no confiable', () => {
  const V1: EnergySnapshotV1 = buildEnergySnapshot(OB, AHORA).snapshot;

  it('null y undefined → absent, no malformed', () => {
    expect(parseEnergySnapshot(null)).toEqual({ ok: false, reason: 'absent' });
    expect(parseEnergySnapshot(undefined)).toEqual({ ok: false, reason: 'absent' });
  });

  it('un objeto vacío o un no-objeto → malformed', () => {
    for (const v of [{}, [], 'x', 7, true]) {
      const r = parseEnergySnapshot(v);
      expect(r.ok, JSON.stringify(v)).toBe(false);
      if (r.ok) continue;
      expect(r.reason).toBe('malformed');
    }
  });

  it('schemaVersion desconocido → unknown_schema, NO malformed', () => {
    const r = parseEnergySnapshot({ ...V1, schemaVersion: 2 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('unknown_schema');
    expect(r.detail).toContain('2');
  });

  it('status inválido → malformed', () => {
    for (const status of ['NOPE', '', 7, null, undefined]) {
      const r = parseEnergySnapshot({ ...V1, status });
      expect(r.ok, String(status)).toBe(false);
    }
  });

  it('campos requeridos ausentes → malformed', () => {
    const sinCampo = (k: string) => {
      const c: Record<string, unknown> = { ...V1 };
      delete c[k];
      return parseEnergySnapshot(c);
    };
    expect(sinCampo('computedAt').ok).toBe(false);
    expect(sinCampo('status').ok).toBe(false);
    expect(sinCampo('schemaVersion').ok).toBe(false);
    // PRESCRIBED sin cifra es una combinación que el contrato prohíbe.
    const r = sinCampo('prescribedEnergy');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.detail).toContain('PRESCRIBED sin prescribedEnergy');
  });

  it('una cifra en un estado SIN prescripción → malformed', () => {
    const r = parseEnergySnapshot({ ...V1, status: 'FAT_LOSS_BLOCKED', prescribedEnergy: 1800 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.detail).toContain('prescribedEnergy en FAT_LOSS_BLOCKED');
  });

  it('NaN e Infinity → malformed', () => {
    for (const v of [NaN, Infinity, -Infinity]) {
      expect(parseEnergySnapshot({ ...V1, prescribedEnergy: v }).ok, String(v)).toBe(false);
      expect(parseEnergySnapshot({ ...V1, rawPrescribedEnergy: v }).ok, String(v)).toBe(false);
    }
  });

  it('tipos incorrectos en los bloques anidados → malformed', () => {
    const casos: Record<string, unknown>[] = [
      { maintenance: 'no' },
      { maintenance: { initialMaintenance: 'x', confidence: 'CLEAR', category: 'ACTIVE' } },
      { maintenance: { initialMaintenance: 2000, confidence: 'OTRA' } },
      { maintenance: { initialMaintenance: 2000, confidence: 'CLEAR' } },              // sin category
      { maintenance: { initialMaintenance: 2000, confidence: 'CLEAR', category: 'NOPE' } },
      { maintenance: { initialMaintenance: 2000, confidence: 'BORDERLINE', lowerCategory: 'ACTIVE' } },
      { classification: 'no' },
      { classification: { dailyLife: 'DL9', trainingBand: 'T2', weeklyTrainingMinutes: 1 } },
      { classification: { dailyLife: 'DL2', trainingBand: 'T9', weeklyTrainingMinutes: 1 } },
      { classification: { dailyLife: 'DL2', trainingBand: 'T2', weeklyTrainingMinutes: 'x' } },
      { inputIdentity: '' },
      { inputIdentity: 7 },
      { versions: 'no' },
      { versions: { classifier: 1, maintenance: 1, prescription: 1 } },                 // falta orchestrator
      { versions: { classifier: 'x', maintenance: 1, prescription: 1, orchestrator: 1 } },
    ];
    for (const over of casos) {
      const r = parseEnergySnapshot({ ...V1, ...over });
      expect(r.ok, JSON.stringify(over).slice(0, 70)).toBe(false);
      if (r.ok) continue;
      expect(r.reason).toBe('malformed');
    }
  });

  it('acepta un V1 válido de cada uno de los seis estados', () => {
    const obs = [ob(), ob({ peso: 50, estatura: 190 }),
      ob({ sex: 'Mujer', edad: 64, estatura: 143, peso: 39, dailyLife: 'DL1', trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 }),
      ob({ edad: 16 }), sin('dailyLife'), ob({ trainsHabitually: 2 })];
    const estados = new Set<string>();
    for (const o of obs) {
      const s = buildEnergySnapshot(o, AHORA).snapshot;
      const r = parseEnergySnapshot(JSON.parse(JSON.stringify(s)));
      expect(r.ok, s.status).toBe(true);
      estados.add(s.status);
    }
    expect(estados.size).toBe(6);
  });

  it('NO muta el input', () => {
    const entrada = JSON.parse(JSON.stringify(V1));
    const copia = JSON.parse(JSON.stringify(entrada));
    parseEnergySnapshot(entrada);
    expect(entrada).toEqual(copia);
  });

  it('NO hace `as EnergySnapshotV1` sobre un JSON sin validar', () => {
    expect(CODIGO).not.toMatch(/as\s+EnergySnapshotV1/);
    expect(CODIGO).not.toMatch(/as\s+unknown\s+as/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G · CONTRATO PERSISTIDO ENDURECIDO
// ═════════════════════════════════════════════════════════════════════════════
describe('C2 · computedAt debe ser ISO UTC canónico', () => {
  const VALIDOS = [
    '2026-10-03T06:00:00.000Z',
    '2026-01-01T00:00:00.000Z',
    '1999-12-31T23:59:59.999Z',
  ];
  const INVALIDOS = [
    '', 'hola', '123', '2026-99-99', '2026-13-01T00:00:00.000Z',
    '2026-02-31T00:00:00.000Z',          // Date.parse lo normaliza a marzo
    '2026-10-03T06:00:00Z',              // sin milisegundos
    '2026-10-03T06:00:00.000+00:00',     // offset en vez de Z
    '2026-10-03 06:00:00.000Z',          // sin la T
    '2026-10-03T06:00:00.000z',          // z minúscula
    7, null, undefined, {}, [],
  ];

  it('acepta exactamente lo que produce Date.toISOString()', () => {
    for (const v of VALIDOS) expect(isIsoUtcTimestamp(v), v).toBe(true);
  });

  it('rechaza todo lo demás, incluidas variantes del mismo instante', () => {
    for (const v of INVALIDOS) expect(isIsoUtcTimestamp(v), JSON.stringify(v)).toBe(false);
  });

  it('`buildEnergySnapshot` LANZA con un computedAt inválido', () => {
    for (const v of ['', 'hola', '2026-02-31T00:00:00.000Z', '2026-10-03T06:00:00Z']) {
      expect(() => buildEnergySnapshot(ob(), v), JSON.stringify(v)).toThrow(/computedAt/);
    }
  });

  it('el parser marca malformed un computedAt no canónico', () => {
    const base = buildEnergySnapshot(OB, AHORA).snapshot;
    for (const v of INVALIDOS) {
      const r = parseEnergySnapshot({ ...base, computedAt: v });
      expect(r.ok, JSON.stringify(v)).toBe(false);
      if (r.ok) continue;
      expect(r.reason).toBe('malformed');
      expect(r.detail).toContain('computedAt');
    }
  });
});

describe('C2 · formato de inputIdentity', () => {
  const base = buildEnergySnapshot(OB, AHORA).snapshot;

  it('la identidad emitida cumple el formato que el parser exige', () => {
    for (const o of [ob(), ob({ edad: 16 }), ob({ peso: 50, estatura: 190 })]) {
      const s = buildEnergySnapshot(o, AHORA).snapshot;
      expect(s.inputIdentity).toMatch(/^[0-9a-f]{8}$/);
      expect(parseEnergySnapshot(JSON.parse(JSON.stringify(s))).ok).toBe(true);
    }
  });

  it('rechaza cualquier otro formato', () => {
    const malas: unknown[] = [
      '', '1234567', '123456789',          // longitud
      'ABCDEF12', '0123456G', 'deadbeeZ',  // no hex / mayúsculas
      ' 1234567', '1234567 ',              // espacios
      1234567, null, {}, [],
    ];
    for (const v of malas) {
      const r = parseEnergySnapshot({ ...base, inputIdentity: v });
      expect(r.ok, JSON.stringify(v)).toBe(false);
      if (r.ok) continue;
      expect(r.detail).toContain('inputIdentity');
    }
  });
});

describe('C2 · invariantes del parser por familia de estado', () => {
  const MOTOR = ['PRESCRIBED', 'FAT_LOSS_BLOCKED', 'OUTSIDE_HSC_FAT_LOSS_SCOPE', 'OUTSIDE_HSC_NUTRITION_SCOPE'] as const;
  const PRE = ['PROFILE_INCOMPLETE', 'PROFILE_UNREADABLE'] as const;

  /** Snapshot real de cada estado, construido por el builder. */
  const porEstado = (() => {
    const m = new Map<string, EnergySnapshotV1>();
    for (const o of [ob(), ob({ peso: 50, estatura: 190 }),
      ob({ sex: 'Mujer', edad: 64, estatura: 143, peso: 39, dailyLife: 'DL1', trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 }),
      ob({ edad: 16 }), sin('dailyLife'), ob({ trainsHabitually: 2 })]) {
      const s = buildEnergySnapshot(o, AHORA).snapshot;
      m.set(s.status, s);
    }
    return m;
  })();

  it('los seis estados tienen un snapshot real para probar contra', () => {
    expect(porEstado.size).toBe(6);
  });

  it('un estado de MOTOR sin inputIdentity → malformed', () => {
    for (const status of MOTOR) {
      const c: Record<string, unknown> = { ...porEstado.get(status)! };
      delete c.inputIdentity;
      const r = parseEnergySnapshot(c);
      expect(r.ok, status).toBe(false);
      if (r.ok) continue;
      expect(r.detail).toBe(`${status} sin inputIdentity`);
    }
  });

  it('un estado de MOTOR sin versions → malformed', () => {
    for (const status of MOTOR) {
      const c: Record<string, unknown> = { ...porEstado.get(status)! };
      delete c.versions;
      const r = parseEnergySnapshot(c);
      expect(r.ok, status).toBe(false);
      if (r.ok) continue;
      expect(r.detail).toBe(`${status} sin versions`);
    }
  });

  it('PRESCRIBED sin cifra o sin raw → malformed', () => {
    for (const campo of ['prescribedEnergy', 'rawPrescribedEnergy', 'maintenance', 'classification']) {
      const c: Record<string, unknown> = { ...porEstado.get('PRESCRIBED')! };
      delete c[campo];
      const r = parseEnergySnapshot(c);
      expect(r.ok, campo).toBe(false);
      if (r.ok) continue;
      expect(r.detail).toBe(`PRESCRIBED sin ${campo}`);
    }
  });

  it('OUTSIDE_HSC_NUTRITION_SCOPE con maintenance o classification → malformed', () => {
    const base = porEstado.get('OUTSIDE_HSC_NUTRITION_SCOPE')!;
    const prescrito = porEstado.get('PRESCRIBED')!;
    for (const [campo, valor] of [['maintenance', prescrito.maintenance], ['classification', prescrito.classification]] as const) {
      const r = parseEnergySnapshot({ ...base, [campo]: valor });
      expect(r.ok, campo).toBe(false);
      if (r.ok) continue;
      expect(r.detail).toBe(`${campo} en OUTSIDE_HSC_NUTRITION_SCOPE`);
    }
  });

  it('PROFILE_INCOMPLETE con inputIdentity → malformed', () => {
    const r = parseEnergySnapshot({ ...porEstado.get('PROFILE_INCOMPLETE')!, inputIdentity: 'deadbeef' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.detail).toBe('inputIdentity en PROFILE_INCOMPLETE');
  });

  it('PROFILE_UNREADABLE con versions → malformed', () => {
    const r = parseEnergySnapshot({ ...porEstado.get('PROFILE_UNREADABLE')!, versions: currentEngineVersions() });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.detail).toBe('versions en PROFILE_UNREADABLE');
  });

  it('un estado PRE-MOTOR con cualquier campo de motor → malformed', () => {
    const prescrito = porEstado.get('PRESCRIBED')!;
    const intrusos: [string, unknown][] = [
      ['prescribedEnergy', 1800],
      ['rawPrescribedEnergy', 1800.4],
      ['maintenance', prescrito.maintenance],
      ['classification', prescrito.classification],
      ['inputIdentity', 'deadbeef'],
      ['versions', currentEngineVersions()],
    ];
    for (const status of PRE) {
      for (const [campo, valor] of intrusos) {
        const r = parseEnergySnapshot({ ...porEstado.get(status)!, [campo]: valor });
        expect(r.ok, `${status} + ${campo}`).toBe(false);
        if (r.ok) continue;
        expect(r.detail).toBe(`${campo} en ${status}`);
      }
    }
  });

  it('el snapshot válido de un estado PRE-MOTOR tiene EXACTAMENTE tres claves', () => {
    for (const status of PRE) {
      expect(Object.keys(porEstado.get(status)!).sort()).toEqual(['computedAt', 'schemaVersion', 'status']);
    }
  });
});

describe('C2 · parser estricto · propiedades desconocidas', () => {
  const base = buildEnergySnapshot(OB, AHORA).snapshot;

  it('una propiedad desconocida de nivel superior → malformed', () => {
    for (const k of ['macros', 'protG', 'planGoal', 'bmi', 'extra', 'activity', '__proto__x']) {
      const r = parseEnergySnapshot({ ...base, [k]: 1 });
      expect(r.ok, k).toBe(false);
      if (r.ok) continue;
      expect(r.reason).toBe('malformed');
      expect(r.detail).toBe(`propiedad desconocida: ${k}`);
    }
  });

  it('una clave inesperada dentro de maintenance → malformed, en ambas variantes', () => {
    // DL2 × T1 (2 × 45 = 90 min/sem) cae en una celda CLEAR; DL2 × T2 en una
    // BORDERLINE. Cada variante tiene su juego exacto de claves.
    const claro = buildEnergySnapshot(ob({ trainingDaysPerWeek: 2, trainingSessionMinutes: 45 }), AHORA).snapshot;
    expect(claro.maintenance?.confidence).toBe('CLEAR');
    expect(base.maintenance?.confidence).toBe('BORDERLINE');

    // CLEAR no puede acarrear lower/upperCategory: la unión cerrada lo prohíbe.
    const a = parseEnergySnapshot({ ...claro, maintenance: { ...claro.maintenance!, lowerCategory: 'ACTIVE' } });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.detail).toContain('maintenance.lowerCategory inesperada en CLEAR');

    // …y BORDERLINE no puede acarrear `category`.
    const b = parseEnergySnapshot({ ...base, maintenance: { ...base.maintenance!, category: 'ACTIVE' } });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.detail).toContain('maintenance.category inesperada en BORDERLINE');

    // Y una clave que no pertenece a ninguna de las dos.
    const c = parseEnergySnapshot({ ...base, maintenance: { ...base.maintenance!, eer: 2000 } });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.detail).toContain('maintenance.eer inesperada');
  });

  it('una clave inesperada dentro de classification o versions → malformed', () => {
    const a = parseEnergySnapshot({ ...base, classification: { ...base.classification!, category: 'ACTIVE' } });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.detail).toContain('classification.category inesperada');

    const b = parseEnergySnapshot({ ...base, versions: { ...currentEngineVersions(), macros: 1 } });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.detail).toContain('versions.macros inesperada');
  });

  it('el formato es versionado: añadir un campo exige subir schemaVersion', () => {
    // Documenta la política: un V1 con un campo nuevo NO se lee «a medias».
    expect(parseEnergySnapshot({ ...base, adaptedMaintenance: 2100 }).ok).toBe(false);
    expect(parseEnergySnapshot({ ...base, schemaVersion: 2, adaptedMaintenance: 2100 }))
      .toEqual({ ok: false, reason: 'unknown_schema', detail: 'schemaVersion=2' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · INERTE · cero consumidores productivos
// ═════════════════════════════════════════════════════════════════════════════
describe('C2 · nada de esto está conectado', () => {
  const TODO = import.meta.glob('/src/**/*.{ts,tsx}', {
    query: '?raw', import: 'default', eager: true,
  }) as Record<string, string>;

  const sinComentarios = (s: string): string =>
    s.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//'))
      .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

  const PRODUCTIVOS = Object.entries(TODO)
    .filter(([p]) => !p.includes('__tests__') && !/\.(test|spec)\.tsx?$/.test(p))
    .map(([p, src]) => [p, sinComentarios(src)] as const);

  it('el barrido ve el árbol completo', () => {
    expect(PRODUCTIVOS.length).toBeGreaterThan(100);
    expect(PRODUCTIVOS.some(([p]) => p.endsWith('/nutritionEnergyState.ts'))).toBe(true);
  });

  it('CERO consumidores productivos de todo lo nuevo', () => {
    const propio = (p: string) => p.endsWith('/nutritionEnergyState.ts');
    for (const id of ['nutritionEnergyState', 'resolveNutritionEnergyState',
      'NutritionEnergyState', 'EnergySnapshotV1', 'buildEnergySnapshot',
      'parseEnergySnapshot', 'energyInputIdentity', 'currentEngineVersions']) {
      const consumidores = PRODUCTIVOS
        .filter(([p]) => !propio(p))
        .filter(([, src]) => new RegExp(`\\b${id}\\b`).test(src))
        .map(([p]) => p);
      expect(consumidores, id).toEqual([]);
    }
  });

  it('CERO lectores y escritores productivos de energy_snapshot', () => {
    const consumidores = PRODUCTIVOS
      .filter(([p]) => !p.endsWith('/database.ts') && !p.endsWith('/nutritionEnergyState.ts'))
      .filter(([, src]) => /energy_snapshot/.test(src))
      .map(([p]) => p);
    expect(consumidores).toEqual([]);
  });

  it('resolveNutritionEnergy sigue sin consumidores productivos fuera de C2', () => {
    const consumidores = PRODUCTIVOS
      .filter(([p]) => !p.endsWith('/nutritionEnergyOrchestrator.ts') && !p.endsWith('/nutritionEnergyState.ts'))
      .filter(([, src]) => /resolveNutritionEnergy\b/.test(src))
      .map(([p]) => p);
    expect(consumidores).toEqual([]);
  });

  it('la autoridad energética VISIBLE sigue siendo la legacy', () => {
    const store = sinComentarios(TODO['/src/store/index.ts']);
    expect(store).toMatch(/computeNutritionTargets/);
    expect(store).not.toMatch(/resolveNutritionEnergy|energy_snapshot|EnergySnapshot/);
    // Y C1 sigue intacto: la composición legacy con un solo argumento.
    const targets = TODO['/src/utils/nutritionTargets.ts'];
    expect(targets).toContain('export function computeNutritionTargets(o: ObInput): NutritionTargets');
  });

  it('C2 no calcula energía ni macros por su cuenta', () => {
    for (const id of ['ACTIVITY_FACTORS', 'goalFactor', 'sexFloor', 'Mifflin', 'Katch',
      'computeNutritionTargets', 'legacyEnergy', 'legacyMacros', 'parseObData',
      'protG', 'fatG', 'carbG', 'actIdx', 'planGoal', 'tdee',
      'useAppStore', 'supabase']) {
      expect(CODIGO, `C2 no debe usar ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
  });

  it('el schemaVersion es 1 y está en un solo sitio', () => {
    expect(ENERGY_SNAPSHOT_SCHEMA_VERSION).toBe(1);
    expect(CODIGO).toContain('export const ENERGY_SNAPSHOT_SCHEMA_VERSION = 1;');
  });
});
