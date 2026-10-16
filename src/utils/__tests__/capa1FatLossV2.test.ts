import { describe, it, expect } from 'vitest';
import {
  prescribeEnergy,
  ENERGY_PRESCRIPTION_VERSION,
  FAT_LOSS_RELATIVE_DEFICIT,
  FAT_LOSS_ABSOLUTE_DEFICIT_CAP,
  HSC_FAT_LOSS_SCOPE_MIN_ENERGY,
  MUSCLE_GAIN_RELATIVE_SURPLUS,
  type CanonicalGoal,
} from '../energyPrescription';
import { resolveNutritionEnergyState, buildEnergySnapshot, ENERGY_SNAPSHOT_SCHEMA_VERSION } from '../nutritionEnergyState';
import { decideEnergyHydration } from '../energyHydration';
import { prescribeMacros, MACRO_PRESCRIPTION_VERSION } from '../macroPrescription';
import { ORCHESTRATOR_VERSION } from '../nutritionEnergyOrchestrator';
import { NUTRITION_PROFILE_INPUT_VERSION } from '../nutritionProfileInput';
import { PLAN_ENGINE_VERSION } from '../planEngine';
import ES from '../../i18n/es.ts?raw';
import EN from '../../i18n/en.ts?raw';

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 3 · CAPA 1 V2 · FAT_LOSS = M − min(0.20·M, 750). El gate de 1200 sigue
// sobre el crudo con `<=`. Ninguna otra política ni versión cambia.
// ─────────────────────────────────────────────────────────────────────────────

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 35, estatura: 178, peso: 82, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const NOW = '2026-10-15T12:00:00.000Z';

describe('POLÍTICA V2', () => {
  it('20 % / 750, gate 1200, superávit 5 % y versión 2', () => {
    expect([FAT_LOSS_RELATIVE_DEFICIT, FAT_LOSS_ABSOLUTE_DEFICIT_CAP, HSC_FAT_LOSS_SCOPE_MIN_ENERGY, MUSCLE_GAIN_RELATIVE_SURPLUS])
      .toEqual([0.20, 750, 1200, 0.05]);
    expect(ENERGY_PRESCRIPTION_VERSION).toBe(2);
  });
  it('el resto de versiones no se mueve', () => {
    expect({ ENERGY_SNAPSHOT_SCHEMA_VERSION, ORCHESTRATOR_VERSION, NUTRITION_PROFILE_INPUT_VERSION, MACRO_PRESCRIPTION_VERSION, PLAN_ENGINE_VERSION })
      .toEqual({ ENERGY_SNAPSHOT_SCHEMA_VERSION: 1, ORCHESTRATOR_VERSION: 1, NUTRITION_PROFILE_INPUT_VERSION: 1, MACRO_PRESCRIPTION_VERSION: 4, PLAN_ENGINE_VERSION: 34 });   // 34 · MENÚ V1 · B1 (motor de platillos), no CAPA 1
  });
});

describe('REJILLA · el motor real cumple la política en toda la cadena', () => {
  // perfiles reales recorridos por la cadena completa (perfil → alcance → actividad → mantenimiento → prescripción)
  const perfiles: Record<string, unknown>[] = [];
  for (const sex of ['Hombre', 'Mujer']) for (const edad of [19, 30, 45, 64]) for (const estatura of [140, 155, 170, 185, 200])
    for (const imc of [19, 22, 26, 30, 36]) for (const dailyLife of ['DL1', 'DL2', 'DL3', 'DL4'])
      for (const [trainsHabitually, trainingDaysPerWeek, trainingSessionMinutes] of [[0, 0, 0], [1, 3, 45], [1, 6, 75]] as const) {
        perfiles.push({ ...OB, sex, edad, estatura, peso: Math.round(imc * (estatura / 100) ** 2), dailyLife, trainsHabitually,
          trainingDaysPerWeek, trainingSessionMinutes, trainingModalities: trainsHabitually ? 'strength' : '' });
      }
  const goals: [string, CanonicalGoal][] = [['Bajar grasa', 'FAT_LOSS'], ['Ganar músculo', 'MUSCLE_GAIN'], ['Recomposición', 'RECOMPOSITION'], ['Bienestar integral', 'MAINTENANCE']];

  it(`${perfiles.length * 4} resoluciones: cada objetivo aplica exactamente su fórmula`, () => {
    let fatLossPrescribed = 0, fatLossOutside = 0;
    for (const p of perfiles) for (const [goal, canonical] of goals) {
      const s = resolveNutritionEnergyState({ ...p, goal } as never);
      if (s.status !== 'PRESCRIBED' && s.status !== 'OUTSIDE_HSC_FAT_LOSS_SCOPE') continue;
      const M = s.maintenance!.initialMaintenance;
      const expectedRaw = canonical === 'FAT_LOSS' ? M - Math.min(0.20 * M, 750)
        : canonical === 'MUSCLE_GAIN' ? M + 0.05 * M : M;
      expect(s.rawPrescribedEnergy!, `${goal} M=${M}`).toBeCloseTo(expectedRaw, 9);
      if (canonical === 'FAT_LOSS') {
        // gate sobre el crudo, `<=`
        expect(s.status, `M=${M}`).toBe(expectedRaw <= 1200 ? 'OUTSIDE_HSC_FAT_LOSS_SCOPE' : 'PRESCRIBED');
        if (s.status === 'PRESCRIBED') { fatLossPrescribed++; expect(s.prescribedEnergy).toBe(Math.round(expectedRaw)); } else fatLossOutside++;
      } else {
        expect(s.status).toBe('PRESCRIBED');
      }
    }
    expect(fatLossPrescribed).toBeGreaterThan(0);
    expect(fatLossOutside).toBeGreaterThan(0);
  });
});

describe('CURRENTNESS · un snapshot de la política anterior queda obsoleto', () => {
  it('snapshot con versions.prescription = 1 → RECALC por stale_versions', () => {
    const { snapshot } = buildEnergySnapshot(OB as never, NOW);
    expect(snapshot.versions?.prescription).toBe(2);
    const v1 = { ...snapshot, versions: { ...snapshot.versions!, prescription: 1 } };
    expect(decideEnergyHydration({ obData: OB as never, rawSnapshot: v1, computedAt: NOW, previousMealPlanKey: 'planA' }))
      .toEqual({ action: 'RECALC', reason: 'stale_versions' });
  });
  it('un snapshot v2 recién construido se adopta', () => {
    const { snapshot } = buildEnergySnapshot(OB as never, NOW);
    expect(decideEnergyHydration({ obData: OB as never, rawSnapshot: snapshot, computedAt: NOW, previousMealPlanKey: 'planA' }).action).toBe('ADOPT');
  });
  it('aun con la versión correcta, una cifra V1 guardada no se adopta (contradice al motor)', () => {
    const { snapshot } = buildEnergySnapshot(OB as never, NOW);
    const M = snapshot.maintenance!.initialMaintenance;
    const v1Figure = { ...snapshot, prescribedEnergy: Math.round(M - Math.min(0.15 * M, 500)), rawPrescribedEnergy: M - Math.min(0.15 * M, 500) };
    expect(decideEnergyHydration({ obData: OB as never, rawSnapshot: v1Figure, computedAt: NOW, previousMealPlanKey: 'planA' }).action).toBe('RECALC');
  });
});

describe('MACROS · misma fórmula; solo cambia la energía de entrada', () => {
  it('para una misma energía, la prescripción de macros es la de siempre (versión 4)', () => {
    const m = prescribeMacros({ energyKcal: 2100, goal: 'FAT_LOSS', weightKg: 80, heightCm: 180, activityClass: 'MIXED', trainingBand: 'T2' });
    expect(MACRO_PRESCRIPTION_VERSION).toBe(4);
    expect(m.status).toBe('VALID');
    // mismos gramos que el fixture vigente de coachContext/reflectionContext (energía fija)
    expect(m.status === 'VALID' && [m.proteinG, m.fatG, m.carbG]).toEqual([144, 58, 251]);
  });
});

describe('UNA SOLA AUTORIDAD · sin fórmula paralela', () => {
  const CODE = import.meta.glob('../*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  it('las constantes del déficit solo se usan dentro de energyPrescription', () => {
    const users = Object.entries(CODE).filter(([p, src]) => !p.endsWith('energyPrescription.ts')
      && /FAT_LOSS_RELATIVE_DEFICIT|FAT_LOSS_ABSOLUTE_DEFICIT_CAP/.test(src)).map(([p]) => p);
    expect(users).toEqual([]);
  });
  it('ningún módulo de src/utils calcula un déficit 15 % / 500 propio', () => {
    for (const [p, src] of Object.entries(CODE)) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(/\*\s*0\.15\b[\s\S]{0,80}\b500\b|Math\.min\([^)]*0\.15[^)]*500/.test(code), p).toBe(false);
    }
  });
  it('prescribeEnergy es la única vía: el déficit sale de sus constantes', () => {
    const r = prescribeEnergy({ goal: 'FAT_LOSS', maintenance: buildEnergySnapshot(OB as never, NOW).snapshot.maintenance as never, heightCm: 178, weightKg: 82 });
    expect(r.appliedDeficit).toBeCloseTo(Math.min(FAT_LOSS_RELATIVE_DEFICIT * r.maintenance.initialMaintenance, FAT_LOSS_ABSOLUTE_DEFICIT_CAP), 9);
  });
});

describe('COPY · la UI no promete déficits ni superávits fijos', () => {
  it.each([['es', ES], ['en', EN]])('%s: sin −500 / +300 / −200 kcal en los resultados de objetivo', (_, src) => {
    expect(src).not.toMatch(/[-−]\s?500 kcal|\+\s?300 kcal|[-−]\s?200 kcal/);
    expect(src).toMatch(/resultLose: '[^'\d]*'/);
    expect(src).toMatch(/resultGain: '[^'\d]*'/);
    expect(src).toMatch(/resultRecomp: '[^'\d]*'/);
  });
});
