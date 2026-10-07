import { describe, it, expect } from 'vitest';
import srcModality from '../trainingModality.ts?raw';
import srcMacro from '../macroPrescription.ts?raw';
import srcStore from '../../store/index.ts?raw';
import srcOnboarding from '../../screens/OnboardingScreen.tsx?raw';
import srcEdit from '../../components/sheets/EditDataSheet.tsx?raw';
import srcPlanner from '../../components/WeeklyNutritionPlanner.tsx?raw';
import {
  deriveProteinActivityClass,
  readTrainingModalities,
  serializeTrainingModalities,
  declaredTrainingModalitiesForForm,
  TRAINING_MODALITIES,
  TRAINING_MODALITIES_KEY,
  type TrainingModality,
} from '../trainingModality';
import { resolveMacroPrescription, isServableMacroPrescription, MACRO_PRESCRIPTION_VERSION } from '../macroPrescription';
import {
  resolveNutritionEnergyState,
  buildEnergySnapshot,
  energyInputIdentity,
  ENERGY_IDENTITY_FIELDS,
} from '../nutritionEnergyState';
import { decideEnergyHydration } from '../energyHydration';
import { nutritionProfileInputFrom } from '../nutritionProfileInput';
import { weeklyPlanCurrentness } from '../weeklyPlanState';
import { PLAN_ENGINE_VERSION } from '../planEngine';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 2 · A2 · MODALIDAD DE ENTRENAMIENTO DECLARADA
//
// La clase de actividad proteica sale SOLO de `trainsHabitually` + la modalidad
// declarada. Minutos y bandas T0–T4 son CARGA: otra dimensión.
// ─────────────────────────────────────────────────────────────────────────────

const sinComentarios = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const cls = (trains: boolean, ms?: TrainingModality[] | null) => {
  const r = deriveProteinActivityClass(trains, ms);
  return r.kind === 'CLASS' ? r.activityClass : r.kind;
};

// ═════════════════════════════════════════════════════════════════════════════
// A · DERIVACIÓN
// ═════════════════════════════════════════════════════════════════════════════
describe('A2 · A · deriveProteinActivityClass', () => {
  it('no entrena → NO_STRUCTURED_TRAINING, aunque quede una modalidad rancia', () => {
    expect(cls(false, [])).toBe('NO_STRUCTURED_TRAINING');
    expect(cls(false, ['strength'])).toBe('NO_STRUCTURED_TRAINING');
    expect(cls(false, ['specialized_sport'])).toBe('NO_STRUCTURED_TRAINING');
  });

  it('entrena sin declarar → TRAINING_MODALITY_REQUIRED, sin clase', () => {
    expect(cls(true, undefined)).toBe('TRAINING_MODALITY_REQUIRED');
    expect(cls(true, null)).toBe('TRAINING_MODALITY_REQUIRED');
    expect(cls(true, [])).toBe('TRAINING_MODALITY_REQUIRED');
    expect(deriveProteinActivityClass(true, []).kind).toBe('TRAINING_MODALITY_REQUIRED');
  });

  it('solo baja demanda → LOW_DEMAND', () => {
    expect(cls(true, ['low_demand'])).toBe('LOW_DEMAND');
  });

  it('fuerza → STRENGTH (la baja demanda es secundaria)', () => {
    expect(cls(true, ['strength'])).toBe('STRENGTH');
    expect(cls(true, ['strength', 'low_demand'])).toBe('STRENGTH');
  });

  it('resistencia → ENDURANCE_GENERAL', () => {
    expect(cls(true, ['endurance'])).toBe('ENDURANCE_GENERAL');
    expect(cls(true, ['endurance', 'low_demand'])).toBe('ENDURANCE_GENERAL');
  });

  it('equipo → TEAM_INTERMITTENT', () => {
    expect(cls(true, ['team_intermittent'])).toBe('TEAM_INTERMITTENT');
    expect(cls(true, ['team_intermittent', 'low_demand'])).toBe('TEAM_INTERMITTENT');
  });

  it('dos o más estructuradas → MIXED', () => {
    expect(cls(true, ['strength', 'endurance'])).toBe('MIXED');
    expect(cls(true, ['strength', 'team_intermittent'])).toBe('MIXED');
    expect(cls(true, ['endurance', 'team_intermittent'])).toBe('MIXED');
    expect(cls(true, ['strength', 'endurance', 'team_intermittent'])).toBe('MIXED');
    expect(cls(true, ['strength', 'endurance', 'low_demand'])).toBe('MIXED');
  });

  it('deporte especializado domina todo', () => {
    expect(cls(true, ['specialized_sport'])).toBe('SPECIALIZED_SPORT');
    expect(cls(true, ['specialized_sport', 'strength'])).toBe('SPECIALIZED_SPORT');
    expect(cls(true, ['specialized_sport', 'strength', 'endurance', 'low_demand'])).toBe('SPECIALIZED_SPORT');
  });

  it('el orden y los duplicados no cambian el resultado', () => {
    expect(cls(true, ['endurance', 'strength'])).toBe(cls(true, ['strength', 'endurance']));
    expect(cls(true, ['strength', 'strength'])).toBe('STRENGTH');
  });

  it('`mixed` y «no entreno» no son valores declarables', () => {
    expect(TRAINING_MODALITIES).toEqual(['strength', 'endurance', 'team_intermittent', 'low_demand', 'specialized_sport']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · LECTURA / SANEAMIENTO DEL VALOR PERSISTIDO
// ═════════════════════════════════════════════════════════════════════════════
describe('A2 · B · lectura del valor persistido', () => {
  it('ausente o vacío → MISSING', () => {
    for (const raw of [undefined, null, '', '  ', ',']) {
      expect(readTrainingModalities(raw).kind, String(raw)).toBe('MISSING');
    }
  });

  it('CSV válido → DECLARED, deduplicado y en orden canónico', () => {
    expect(readTrainingModalities('endurance, strength,strength')).toEqual({
      kind: 'DECLARED', modalities: ['strength', 'endurance'],
    });
  });

  it('un valor desconocido → INVALID; no se reinterpreta ni se descarta en silencio', () => {
    for (const raw of ['mixed', 'yoga', 'strength,crossfit', 'STRENGTH', 3]) {
      expect(readTrainingModalities(raw).kind, String(raw)).toBe('INVALID');
    }
  });

  it('serializar → leer es identidad', () => {
    const ms: TrainingModality[] = ['low_demand', 'strength', 'endurance', 'strength'];
    const csv = serializeTrainingModalities(ms);
    expect(csv).toBe('strength,endurance,low_demand');
    expect(readTrainingModalities(csv)).toEqual({ kind: 'DECLARED', modalities: ['strength', 'endurance', 'low_demand'] });
  });

  it('el formulario solo pre-rellena valores válidos', () => {
    expect(declaredTrainingModalitiesForForm('strength,crossfit')).toEqual(['strength']);
    expect(declaredTrainingModalitiesForForm(undefined)).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · INTEGRACIÓN CON LA PROTEÍNA · carga ≠ modalidad
// ═════════════════════════════════════════════════════════════════════════════
const BASE = {
  sex: 'Hombre', goal: 'Bienestar integral', edad: 30, estatura: 180, peso: 80,
  embarazo: 0, dailyLife: 'DL2', trainsHabitually: 1,
  trainingDaysPerWeek: 4, trainingSessionMinutes: 60,             // 240 min/sem → T2
} as Record<string, string | number>;
const ob = (over: Record<string, string | number> = {}) => ({ ...BASE, ...over });
const resolve = (o: Record<string, string | number>) => resolveMacroPrescription(resolveNutritionEnergyState(o), o);
const band = (o: Record<string, string | number>) => {
  const s = resolveNutritionEnergyState(o);
  if (s.status !== 'PRESCRIBED') throw new Error('debería ser PRESCRIBED');
  return s.classification.matrixCell.trainingBand;
};

describe('A2 · C · mismos minutos, distinta clase', () => {
  const casos: [string, Record<string, string | number>, string, string][] = [
    ['240 min fuerza', ob({ trainingModalities: 'strength' }), 'T2', 'STRENGTH'],
    ['240 min resistencia', ob({ trainingModalities: 'endurance' }), 'T2', 'ENDURANCE_GENERAL'],
    ['240 min fuerza + resistencia', ob({ trainingModalities: 'strength,endurance' }), 'T2', 'MIXED'],
    ['240 min equipo', ob({ trainingModalities: 'team_intermittent' }), 'T2', 'TEAM_INTERMITTENT'],
    ['240 min especializado', ob({ trainingModalities: 'specialized_sport' }), 'T2', 'SPECIALIZED_SPORT'],
    ['90 min fuerza', ob({ trainingDaysPerWeek: 2, trainingSessionMinutes: 45, trainingModalities: 'strength' }), 'T1', 'STRENGTH'],
    ['90 min solo yoga', ob({ trainingDaysPerWeek: 2, trainingSessionMinutes: 45, trainingModalities: 'low_demand' }), 'T1', 'LOW_DEMAND'],
    ['sin entrenamiento', ob({ trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 }), 'T0', 'NO_STRUCTURED_TRAINING'],
  ];
  for (const [nombre, o, t, esperada] of casos) {
    it(`${nombre} → ${t} + ${esperada}`, () => {
      expect(band(o)).toBe(t);
      const r = resolve(o);
      expect(r.kind).toBe('RESOLVED');
      expect(r.prescription?.activityClass).toBe(esperada);
    });
  }

  it('especializado → SPORTS_SCOPE, sin gramos', () => {
    const m = resolve(ob({ trainingModalities: 'specialized_sport' })).prescription;
    expect(m?.status).toBe('SPORTS_SCOPE');
    expect(isServableMacroPrescription(m)).toBe(false);
  });

  it('baja demanda 1.2 frente a fuerza 1.6 con los MISMOS minutos', () => {
    expect(resolve(ob({ trainingModalities: 'low_demand' })).prescription?.proteinFactor).toBe(1.2);
    expect(resolve(ob({ trainingModalities: 'strength' })).prescription?.proteinFactor).toBe(1.6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · INVARIANTE ENERGÉTICO
// ═════════════════════════════════════════════════════════════════════════════
describe('A2 · D · la modalidad NO toca la energía', () => {
  const variantes = ['strength', 'endurance', 'strength,endurance', 'low_demand', 'specialized_sport', ''];

  it('la energía prescrita es idéntica para cualquier modalidad', () => {
    const energias = variantes.map((m) => {
      const s = resolveNutritionEnergyState(ob({ trainingModalities: m }));
      if (s.status !== 'PRESCRIBED') throw new Error('debería ser PRESCRIBED');
      return [s.prescribedEnergy, s.maintenance.initialMaintenance];
    });
    for (const e of energias) expect(e).toEqual(energias[0]);
  });

  it('la identidad energética no incluye la modalidad', () => {
    expect(ENERGY_IDENTITY_FIELDS).not.toContain(TRAINING_MODALITIES_KEY);
    const ids = variantes.map((m) => {
      const r = nutritionProfileInputFrom(ob({ trainingModalities: m }));
      if (!r.complete) throw new Error('perfil completo');
      return energyInputIdentity(r.profile);
    });
    for (const id of ids) expect(id).toBe(ids[0]);
  });

  it('cambiar SOLO la modalidad no invalida el snapshot energético: la hidratación ADOPTA', () => {
    const at = '2026-10-07T00:00:00.000Z';
    const { snapshot } = buildEnergySnapshot(ob({ trainingModalities: 'strength' }), at);
    const d = decideEnergyHydration({
      obData: ob({ trainingModalities: 'endurance' }), rawSnapshot: snapshot, computedAt: at, previousMealPlanKey: 'planA',
    });
    expect(d.action).toBe('ADOPT');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · USUARIOS EXISTENTES · PERSISTENCIA · HIDRATACIÓN
// ═════════════════════════════════════════════════════════════════════════════
describe('A2 · E · usuarios existentes y persistencia', () => {
  it('Caso A · no entrena, sin modalidad → NO_STRUCTURED_TRAINING, sin pregunta', () => {
    const r = resolve(ob({ trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 }));
    expect(r.kind).toBe('RESOLVED');
    expect(r.prescription?.activityClass).toBe('NO_STRUCTURED_TRAINING');
  });

  it('Caso B · entrena, sin modalidad → INPUT_REQUIRED; NO se usa ningún default', () => {
    const r = resolve(ob());
    expect(r).toEqual({ kind: 'INPUT_REQUIRED', missing: 'TRAINING_MODALITY_REQUIRED' });
    expect(r.prescription).toBeUndefined();
  });

  it('no entrena con modalidad rancia → la ignora', () => {
    const r = resolve(ob({ trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0, trainingModalities: 'specialized_sport' }));
    expect(r.prescription?.activityClass).toBe('NO_STRUCTURED_TRAINING');
  });

  it('valor persistido inválido → se vuelve a pedir; no se convierte en otra clase', () => {
    for (const raw of ['mixed', 'strength,crossfit', 'yoga']) {
      expect(resolve(ob({ trainingModalities: raw })).kind, raw).toBe('INPUT_REQUIRED');
    }
  });

  it('el onboarding guarda la modalidad ANTES del cálculo final, y la exige con «Sí»', () => {
    const code = sinComentarios(srcOnboarding);
    const efecto = code.slice(code.indexOf("if (step !== 11) return;"));
    const guarda = efecto.indexOf('setObData(TRAINING_MODALITIES_KEY, entrenaHabitualmente ? serializeTrainingModalities(trainingModalities) : \'\');');
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(efecto.indexOf('finishOnboardingCalc'));
    expect(code).toContain('trainingMinutesValid && trainingModalities.length > 0');
  });

  it('la hoja de datos edita, exige al menos una con «Sí», vacía con «No» y recalcula', () => {
    const code = sinComentarios(srcEdit);
    expect(code).toContain("setError(t('editData.errModality'))");
    expect(code).toContain("setObData(TRAINING_MODALITIES_KEY, '');");
    const escribe = code.indexOf('setObData(TRAINING_MODALITIES_KEY, serializeTrainingModalities(modalities));');
    expect(escribe).toBeGreaterThan(-1);
    expect(escribe).toBeLessThan(code.indexOf('await recalcFromObData()'));
    // Pre-relleno: solo lo declarado y válido. Nada inferido.
    expect(code).toContain('declaredTrainingModalitiesForForm(obData[TRAINING_MODALITIES_KEY])');
  });

  it('el store deriva las macros del `obData` en recálculo e hidratación (ADOPT)', () => {
    const code = sinComentarios(srcStore);
    expect(code).toContain('const macroResolution = resolveMacroPrescription(energyState, obData);');
    expect(code).toContain('const macroResolution = resolveMacroPrescription(decision.state, get().obData);');
    expect(code.match(/macroTargets: macroResolution\.prescription \?\? null,/g)).toHaveLength(2);
  });

  it('una prescripción persistida de otra versión (minutos → clase) no se adopta', () => {
    expect(MACRO_PRESCRIPTION_VERSION).toBeGreaterThanOrEqual(2);
    expect(sinComentarios(srcStore)).toContain('p.macroTargets.version !== MACRO_PRESCRIPTION_VERSION');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · VIGENCIA
// ═════════════════════════════════════════════════════════════════════════════
describe('A2 · F · vigencia del plan', () => {
  const grams = (o: Record<string, string | number>) => {
    const m = resolve(o).prescription;
    if (!isServableMacroPrescription(m)) throw new Error('servible');
    return { kcal: m.energyKcal, proteinG: m.proteinG, fatG: m.fatG, carbG: m.carbG };
  };

  it('cambiar la modalidad recalcula la proteína y deja el plan STALE', () => {
    const fuerza = grams(ob({ trainingModalities: 'strength' }));
    const yoga = grams(ob({ trainingModalities: 'low_demand' }));
    expect(yoga.kcal).toBe(fuerza.kcal);                 // la energía no cambia
    expect(yoga.proteinG).not.toBe(fuerza.proteinG);     // la proteína sí
    const plan = { days: [{}], engineVersion: PLAN_ENGINE_VERSION,
      gen: { kcal: fuerza.kcal, protG: fuerza.proteinG, fatG: fuerza.fatG, carbG: fuerza.carbG } };
    const v = (m: typeof fuerza) => weeklyPlanCurrentness({
      status: 'PRESCRIBED', planGoal: m.kcal, macros: m, weeklyPlan: plan, currentVersion: PLAN_ENGINE_VERSION,
    });
    expect(v(fuerza)).toBe('ACTIVE');
    expect(v(yoga)).toBe('STALE');
  });

  it('falta la modalidad → sin macros servibles → el plan guardado NO está vigente (ni se borra)', () => {
    const r = resolve(ob());
    const macros = isServableMacroPrescription(r.prescription) ? r.prescription : null;
    expect(macros).toBeNull();
    expect(weeklyPlanCurrentness({
      status: 'PRESCRIBED', planGoal: 2500, macros, weeklyPlan: { days: [{}], engineVersion: PLAN_ENGINE_VERSION, gen: { kcal: 2500 } },
      currentVersion: PLAN_ENGINE_VERSION,
    })).toBe('NOT_CURRENT');
  });

  it('el planner no genera sin macros servibles y pide la modalidad', () => {
    const code = sinComentarios(srcPlanner);
    expect(code).toContain('if (planGoal == null || !isServableMacroPrescription(macroTargets)) {');
    expect(code).toContain("macroResolution?.kind === 'INPUT_REQUIRED'");
    expect(code).toContain("t('nutritionPlanner.modalityRequired')");
    expect(code).not.toMatch(/clearWeeklyPlan\([^)]*\)[^\n]*modalit/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G · NINGUNA RUTA DE MINUTOS / BANDA / HISTORIAL A LA CLASE
// ═════════════════════════════════════════════════════════════════════════════
describe('A2 · G · la inferencia por minutos está retirada', () => {
  const TODO = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const PRODUCTIVOS = Object.entries(TODO)
    .filter(([p]) => !p.includes('/__tests__/') && !/\.test\.tsx?$/.test(p))
    .map(([p, src]) => [p, sinComentarios(src)] as const);

  it('no existe `STRUCTURED_BANDS` ni `proteinActivityClassFrom`', () => {
    for (const [p, src] of PRODUCTIVOS) {
      expect(src, p).not.toMatch(/\bSTRUCTURED_BANDS\b|\bproteinActivityClassFrom\b/);
    }
  });

  it('la derivación de la clase no lee minutos, banda T ni historial', () => {
    const modality = sinComentarios(srcModality);
    expect(modality).not.toMatch(/\b(trainingBand|TrainingBand|weeklyTrainingMinutes|matrixCell|classification)\b/);
    for (const src of [modality, sinComentarios(srcMacro)]) {
      expect(src).not.toMatch(/\b(completedSessions|workout_log|workoutLog|activityLog|trainingGoal|cardioStyle|dailyWorkout|Modality)\b/);
    }
  });

  it('en el adaptador, la banda solo va a la prioridad de carbohidrato (A4), nunca a la clase', () => {
    const macro = sinComentarios(srcMacro);
    expect(macro).not.toMatch(/\bweeklyTrainingMinutes\b/);
    // La clase sale de `trainsHabitually` + modalidad declarada, y nada más.
    const llamada = macro.slice(macro.indexOf('deriveProteinActivityClass('), macro.indexOf('if (cls.kind'));
    expect(llamada).not.toMatch(/trainingBand|matrixCell|classification/);
    expect(macro).toContain('activityClass: cls.activityClass,');
    // La única lectura de la banda en el adaptador alimenta `trainingBand` (→ prioridad).
    expect(macro.match(/state\.classification/g)).toEqual(['state.classification']);
    expect(macro).toContain('trainingBand: state.classification.matrixCell.trainingBand,');
  });

  it('ningún OTRO fichero productivo une banda/minutos con la clase proteica', () => {
    const culpables = PRODUCTIVOS
      .filter(([p]) => !p.endsWith('/macroPrescription.ts'))
      .filter(([, src]) => /\bProteinActivityClass\b|\bactivityClass\b/.test(src))
      .filter(([, src]) => /\btrainingBand\b|\bweeklyTrainingMinutes\b|\bT[234]\b/.test(src))
      .map(([p]) => p);
    expect(culpables).toEqual([]);
  });
});
