import { describe, it, expect } from 'vitest';
import { getExercises } from '../../data/exercises';
import { filterNoSupportsBank } from '../../data/matOnly';
import { deriveCapabilities, type Gear } from '../equipmentImplement';
import { cardioEquipmentFor, filterByModality, hasPlayableVariant } from '../workoutPlanner';
import { getCardioCapabilities, buildCardioMain, cardioBlocksToExercises, cardioPlayableMinutes, resolveCardioStyle } from '../cardioMain';
import { composeSession } from '../sessionBlocks';
import type { CardioStyle, Exercise, MuscleGroup } from '../../types';

// ────────────────────────────────────────────────────────────────────────────
// REGRESIÓN — BUG DE PRODUCCIÓN: "cardio no genera / da error".
// Causa raíz: orchestrateWorkout (IA) corría para cardio y podía TIRAR la generación
// (timeout/JSON inválido/validación) aunque su output se DESCARTA — el contenido
// ejecutable de cardio sale 100% de buildCardioMain → cardioBlocksToExercises.
// Fix: cardio ya NO depende de la IA. Este test recorre esa ruta determinista
// (banco real + capability real) y garantiza que TODA combinación seleccionable en UI
// produce una sesión ejecutable sin IA. Antes del fix, la generación real podía fallar
// en la capa IA; después, cardio es determinista y no puede fallar por esa causa.
// ────────────────────────────────────────────────────────────────────────────

const exerciseBank = getExercises('es');
const GEARS: { label: string; gear: Gear[] }[] = [
  { label: 'gym', gear: ['gym'] },
  { label: 'casa/bodyweight', gear: [] },
  { label: 'solo tapete', gear: ['tapete'] },
];
const STYLES: CardioStyle[] = ['correr', 'funcional', 'lowImpact', 'explosividad'];
const TIMES = [30, 45, 60, 90, 120];
const LEVELS = ['principiante', 'intermedio', 'avanzado'];

// Replica EXACTA de la ruta de cardio de DailyTrainer (pool + buildCardioMain), sin IA.
function cardioSession(gear: Gear[], style: CardioStyle, time: number, level: string) {
  const caps = deriveCapabilities(gear);
  const bank = caps.noSupport ? filterNoSupportsBank(exerciseBank) : exerciseBank;
  const cardioEq = cardioEquipmentFor(caps.hasFullGym ? ['gym'] : ['cuerpo']);
  const cardioCaps = getCardioCapabilities(bank, cardioEq);
  const modalityFiltered = filterByModality(bank, 'cardio');
  const pool = modalityFiltered.filter(ex =>
    ex.equipment.some(e => cardioEq.includes(e)) && hasPlayableVariant(ex, cardioEq, caps.allowedImplements));
  const budgetMain = composeSession({
    totalMinutes: time, isStrengthDay: false, isYogaDay: false, objective: 'Bajar grasa',
    dayMuscles: [] as MuscleGroup[], equipment: caps.equipmentList, bank,
  }).budget.main;
  const plan = buildCardioMain({ mainBudgetMinutes: budgetMain, style, level, pool: pool as Exercise[] });
  return { caps, cardioCaps, plan, exs: cardioBlocksToExercises(plan), uiAvailable: cardioCaps[style] };
}

describe('CARDIO · generabilidad determinista (sin IA) — regresión del bug real', () => {
  it('INVARIANTE DE CONTRATO: capability=true ⇒ buildCardioMain no vacío (0 violaciones en toda la matriz UI)', () => {
    const violations: string[] = [];
    let tested = 0;
    for (const { label, gear } of GEARS) for (const style of STYLES) for (const time of TIMES) for (const level of LEVELS) {
      const { uiAvailable, plan } = cardioSession(gear, style, time, level);
      if (!uiAvailable) continue; // la UI la deshabilita (capability=false) → no seleccionable
      tested++;
      if (plan.totalMinutes === 0 || plan.blocks.length === 0) {
        violations.push(`${label}/${style}/${time}min/${level}: capability=true pero builder VACÍO`);
      }
    }
    expect(tested).toBeGreaterThan(30); // la matriz UI-disponible no es trivial
    expect(violations, violations.join(' | ')).toEqual([]);
  });

  it('toda sesión cardio UI-disponible produce ejercicios ejecutables (>0) y playableMinutes>0', () => {
    for (const { gear } of GEARS) for (const style of STYLES) for (const time of TIMES) {
      const { uiAvailable, plan, exs } = cardioSession(gear, style, time, 'intermedio');
      if (!uiAvailable) continue;
      expect(exs.length, `${gear}/${style}/${time} sin ejercicios`).toBeGreaterThan(0);
      expect(cardioPlayableMinutes(plan)).toBeGreaterThan(0);
    }
  });

  it('running SIEMPRE genera (casa/gym/tapete · 60/120) — identidad estricta, sin error', () => {
    for (const gear of [['gym'], [], ['tapete']] as Gear[][]) for (const time of [60, 120]) {
      const { plan, exs } = cardioSession(gear, 'correr', time, 'intermedio');
      expect(plan.blocks.length, `correr ${gear}/${time} sin bloques`).toBeGreaterThan(0);
      expect(exs.length).toBeGreaterThan(0);
    }
  });

  it('estilos capability=false (lowImpact/explosividad en casa) declaran content gap, NO producen basura', () => {
    // casa: lowImpact/explosividad = false → si se forzara, buildCardioMain devuelve gap (0), no infra.
    const { plan } = cardioSession([], 'explosividad', 60, 'intermedio');
    expect(plan.totalMinutes === 0 || plan.blocks.length === 0).toBe(true);
    expect(plan.earlyEndReason ?? '').toContain('content gap');
  });

  it('STATE FIX: un cardioStyle inválido tras cambio de gear cae a uno disponible (no error)', () => {
    // Reproduce el 2º camino al error: elegir lowImpact en gym → cambiar a casa (lowImpact=false).
    const caps = getCardioCapabilities(exerciseBank, cardioEquipmentFor(['cuerpo'])); // casa
    expect(caps.lowImpact).toBe(false); // en casa hoy no hay lowImpact reproducible
    const resolved = resolveCardioStyle('lowImpact', caps); // estilo stale/ inválido
    expect(caps[resolved], `resolvió a ${resolved} que tampoco está disponible`).toBe(true);
    // y generar con el estilo resuelto SÍ produce contenido (no content gap)
    const s = cardioSession([], resolved, 60, 'intermedio');
    expect(s.exs.length).toBeGreaterThan(0);
  });

  it('resolveCardioStyle deja intacto un estilo que SÍ está disponible', () => {
    const caps = getCardioCapabilities(exerciseBank, cardioEquipmentFor(['gym']));
    expect(resolveCardioStyle('funcional', caps)).toBe('funcional');
    expect(resolveCardioStyle('correr', caps)).toBe('correr');
  });

  it('solo tapete no rompe running/funcional válidos (pool mat-only reproducible > 0)', () => {
    for (const style of ['correr', 'funcional'] as CardioStyle[]) {
      const { uiAvailable, exs } = cardioSession(['tapete'], style, 60, 'intermedio');
      expect(uiAvailable, `tapete/${style} debería estar disponible`).toBe(true);
      expect(exs.length).toBeGreaterThan(0);
    }
  });
});
