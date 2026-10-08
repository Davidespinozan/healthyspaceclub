import { describe, it, expect } from 'vitest';
import srcCompletion from '../profileCompletion.ts?raw';
import srcSheet from '../../components/sheets/ProfileCompletionSheet.tsx?raw';
import {
  nutritionCompletionSteps, withAnswers, answerTrainsHabitually, type CompletionAnswers,
} from '../profileCompletion';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import { resolveMacroPrescription, isServableMacroPrescription } from '../macroPrescription';
import { resolveTargetWeightState } from '../targetWeightSafety';
import { weeklyPlanCurrentness } from '../weeklyPlanState';
import { PLAN_ENGINE_VERSION } from '../planEngine';

// ─────────────────────────────────────────────────────────────────────────────
// A10 · completar el perfil de Nutrition de un usuario existente
//
// Perfil «de producción»: lo que guardaba el onboarding de `main` (sexo, objetivo,
// edad, peso, estatura, embarazo, actividad legacy…) SIN los campos nuevos.
// ─────────────────────────────────────────────────────────────────────────────

const sinComentarios = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

type Ob = Record<string, string | number>;
const LEGACY: Ob = {
  sex: 'Mujer', goal: 'Bajar grasa', edad: 34, peso: 66, estatura: 165, activity: 'Moderada',
  embarazo: 0, movilidad: 'ninguna', conditions: 'renal', avoid: '', pesoMeta: 44,
};

/** Responde paso a paso como lo haría el socio, usando SOLO lo que pide el dominio. */
function completar(ob: Ob, responder: (step: string) => CompletionAnswers): { draft: Ob; pasos: string[] } {
  let answers: CompletionAnswers = {};
  const pasos: string[] = [];
  for (let i = 0; i < 12; i++) {
    const steps = nutritionCompletionSteps(withAnswers(ob, answers));
    if (steps.length === 0) break;
    pasos.push(steps[0]);
    answers = { ...answers, ...responder(steps[0]) };
  }
  return { draft: withAnswers(ob, answers) as Ob, pasos };
}
const RESPUESTAS_NORMALES = (s: string): CompletionAnswers => ({
  requiresTherapeuticDiet: { requiresTherapeuticDiet: 0 },
  dailyLife: { dailyLife: 'DL2' },
  trainsHabitually: answerTrainsHabitually(true),
  trainingDaysPerWeek: { trainingDaysPerWeek: 4 },
  trainingSessionMinutes: { trainingSessionMinutes: 60 },
  trainingModalities: { trainingModalities: 'strength' },
} as Record<string, CompletionAnswers>)[s] ?? {};

describe('A10 · fuente canónica de lo que falta', () => {
  it('A · falta todo lo nuevo → pide, en orden y condicionalmente, todo lo necesario', () => {
    expect(nutritionCompletionSteps(LEGACY)).toEqual(['requiresTherapeuticDiet', 'dailyLife', 'trainsHabitually']);
    const { pasos } = completar(LEGACY, RESPUESTAS_NORMALES);
    expect(pasos).toEqual([
      'requiresTherapeuticDiet', 'dailyLife', 'trainsHabitually',
      'trainingDaysPerWeek', 'trainingSessionMinutes', 'trainingModalities',
    ]);
  });

  it('B · ya tiene movimiento y entrenamiento, solo falta la respuesta de salud', () => {
    const ob = { ...LEGACY, dailyLife: 'DL2', trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 };
    expect(nutritionCompletionSteps(ob)).toEqual(['requiresTherapeuticDiet']);
  });

  it('C · entrena con días y minutos pero sin modalidad → solo la modalidad', () => {
    const ob = { ...LEGACY, requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 3, trainingSessionMinutes: 45 };
    expect(nutritionCompletionSteps(ob)).toEqual(['trainingModalities']);
  });

  it('D · no entrena → ni días, ni minutos, ni modalidad', () => {
    const { pasos, draft } = completar(LEGACY, (s) => s === 'trainsHabitually' ? answerTrainsHabitually(false) : RESPUESTAS_NORMALES(s));
    expect(pasos).toEqual(['requiresTherapeuticDiet', 'dailyLife', 'trainsHabitually']);
    expect(draft).toMatchObject({ trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0, trainingModalities: '' });
  });

  it('E · completa y queda dentro de alcance → vuelven energía y macros', () => {
    expect(resolveNutritionEnergyState(LEGACY).status).toBe('PROFILE_INCOMPLETE');
    const { draft } = completar(LEGACY, RESPUESTAS_NORMALES);
    const s = resolveNutritionEnergyState(draft);
    expect(s.status).toBe('PRESCRIBED');
    const m = resolveMacroPrescription(s, draft).prescription;
    expect(isServableMacroPrescription(m)).toBe(true);
  });

  it('F · responde «Sí» a la dieta terapéutica → alcance canónico, sin forzar «normal»', () => {
    const { draft } = completar(LEGACY, (s) => s === 'requiresTherapeuticDiet' ? { requiresTherapeuticDiet: 1 } : RESPUESTAS_NORMALES(s));
    const s = resolveNutritionEnergyState(draft);
    expect(s.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(s.scopeReason).toBe('therapeutic_diet_required');
    expect(nutritionCompletionSteps(draft)).toEqual([]);
  });

  it('G · declara deporte especializado → SPORTS_SCOPE', () => {
    const { draft } = completar(LEGACY, (s) => s === 'trainingModalities' ? { trainingModalities: 'specialized_sport' } : RESPUESTAS_NORMALES(s));
    const s = resolveNutritionEnergyState(draft);
    expect(resolveMacroPrescription(s, draft).prescription?.status).toBe('SPORTS_SCOPE');
    expect(nutritionCompletionSteps(draft)).toEqual([]);
  });

  it('H · un peso meta legacy inválido no bloquea ni aparece en el flujo', () => {
    expect(resolveTargetWeightState(LEGACY).status).toBe('INVALID');            // 44 kg a 1,65 m
    const { pasos, draft } = completar(LEGACY, RESPUESTAS_NORMALES);
    expect(pasos).not.toContain('pesoMeta');
    expect(resolveNutritionEnergyState(draft).status).toBe('PRESCRIBED');
    expect(draft.pesoMeta).toBe(44);                                              // no se toca
  });

  it('la lista legacy de condiciones no entra en el flujo', () => {
    expect(nutritionCompletionSteps({ ...LEGACY, conditions: 'renal,diabetes' })).toEqual(nutritionCompletionSteps(LEGACY));
  });

  it('una exclusión ya conocida no pide nada (A7.1)', () => {
    const ob = { ...LEGACY, edad: 70, dailyLife: 'DL2', trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 };
    expect(nutritionCompletionSteps(ob)).toEqual([]);
  });

  it('datos base ausentes → paso `core` (se completan en «Editar mis datos»)', () => {
    const { peso: _p, ...sinPeso } = LEGACY;
    expect(nutritionCompletionSteps(sinPeso)[0]).toBe('core');
  });

  it('un dato presente pero inválido no se «completa» con preguntas', () => {
    expect(nutritionCompletionSteps({ ...LEGACY, embarazo: 'si' })).toEqual([]);
  });
});

describe('A10 · el plan guardado y la vigencia', () => {
  it('incompleto → plan NOT_CURRENT (no se borra); tras completar → STALE (lo regenera la vía autorizada)', () => {
    const plan = { days: [{}], engineVersion: 30, gen: { kcal: 1800, protG: 120, fatG: 60, carbG: 200 } };
    const antes = resolveNutritionEnergyState(LEGACY);
    expect(weeklyPlanCurrentness({ status: antes.status, planGoal: null, macros: null, weeklyPlan: plan, currentVersion: PLAN_ENGINE_VERSION }))
      .toBe('NOT_CURRENT');
    const { draft } = completar(LEGACY, RESPUESTAS_NORMALES);
    const s = resolveNutritionEnergyState(draft);
    const m = resolveMacroPrescription(s, draft).prescription;
    if (!isServableMacroPrescription(m)) throw new Error('servible');
    expect(weeklyPlanCurrentness({ status: s.status, planGoal: m.energyKcal, macros: m, weeklyPlan: plan, currentVersion: PLAN_ENGINE_VERSION }))
      .toBe('STALE');
  });
});

describe('A10 · sin segunda autoridad', () => {
  it('los pasos salen de la cadena real; no hay matriz de reglas en la UI', () => {
    const code = sinComentarios(srcCompletion);
    expect(code).toContain('resolveNutritionEnergyState(obData)');
    expect(code).toContain('resolveMacroPrescription(state, obData)');
    const sheet = sinComentarios(srcSheet);
    expect(sheet).toContain('nutritionCompletionSteps(withAnswers(obData, answers))');
    expect(sheet).toContain("recalcFromObData('profile-completion')");
    // Ni kcal ni macros calculadas en la UI.
    expect(sheet).not.toMatch(/prescribeMacros|prescribeEnergy|estimateMaintenance|proteinG|energyKcal/);
  });
});
