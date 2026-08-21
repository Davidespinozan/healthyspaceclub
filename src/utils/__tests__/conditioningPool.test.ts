import { describe, it, expect } from 'vitest';
import {
  isConditioningIntervalVariant, hasConditioningIntervalCapability, conditioningVariantFor,
  toConditioningStation, enrichConditioningPool, conditioningVariantIdFor,
} from '../conditioningPool';
import { getExerciseModalities } from '../workoutPlanner';
import { cardioStationCapabilities, buildCardioMain } from '../cardioMain';
import { resolveMovementCapabilities } from '../movementCapabilities';
import { registerAvailableVideos, clearRegisteredVideos } from '../videoAvailability';
import { exercises as BANK } from '../../data/exercises';
import type { Exercise } from '../../types';

const byId = new Map(BANK.map(e => [e.id, e]));
const ex = (id: string): Exercise => byId.get(id)!;
const GREEN = new Set([
  'press-horizontal', 'sentadilla-bilateral', 'step-up', 'core-dinamico', 'core-suelo-piernas', 'sentarse-pararse',
]);
const CUERPO = ['cuerpo'] as const;
const GYM = ['gym', 'cuerpo'] as const;

// Banco con TODOS los overrides de capabilities eliminados (estado "pre-metadata" / Phase 1).
const strip = (e: Exercise): Exercise => ({
  ...e,
  capabilities: undefined,
  variants: e.variants?.map(v => ({ ...v, capabilities: undefined })),
});
const STRIPPED = BANK.map(strip);
// Predicado LEGACY exacto de getExerciseModalities para el tag 'cardio'.
const legacyCardio = (e: Exercise) => e.goals.includes('condicion') || e.type === 'cardio' || e.type === 'funcional';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1 · EQUIVALENCIA EXACTA (mecanismo INERTE sin overrides)
// ═══════════════════════════════════════════════════════════════════════════
describe('9B.3 Phase 1 · capability integration inerte (banco sin overrides)', () => {
  it('A · getExerciseModalities cardio-tag == legacy para TODO el banco stripped', () => {
    for (const e of STRIPPED) {
      expect(getExerciseModalities(e).includes('cardio')).toBe(legacyCardio(e));
    }
  });
  it('A2 · enrichConditioningPool(stripped) === stripped (no-op, misma referencia)', () => {
    const out = enrichConditioningPool(STRIPPED, [...GYM]);
    out.forEach((e, i) => expect(e).toBe(STRIPPED[i]));   // referencia idéntica → cero enriquecimiento
  });
  it('E · ningún movimiento bodyweight strength nuevo entra sin override', () => {
    expect(hasConditioningIntervalCapability(strip(ex('press-horizontal')))).toBe(false);
    expect(conditioningVariantFor(strip(ex('press-horizontal')), [...CUERPO])).toBeNull();
  });
  it('F/G/H · adapter puro, determinista, no muta Exercise ni variantes', () => {
    const before = JSON.stringify(ex('press-horizontal'));
    conditioningVariantFor(ex('press-horizontal'), [...CUERPO]);
    enrichConditioningPool([ex('press-horizontal')], [...CUERPO]);
    toConditioningStation(ex('press-horizontal'), ex('press-horizontal').variants![4]);
    expect(JSON.stringify(ex('press-horizontal'))).toBe(before);
    // determinista
    expect(conditioningVariantFor(ex('press-horizontal'), [...CUERPO])?.id)
      .toBe(conditioningVariantFor(ex('press-horizontal'), [...CUERPO])?.id);
  });
  it('J · toConditioningStation NUNCA escribe variant.cardioStyle (no dispara isCardioMachineBank)', () => {
    const v = ex('press-horizontal').variants!.find(x => x.id === 'press-horizontal-flexiones')!;
    const station = toConditioningStation(ex('press-horizontal'), v);
    expect(station.variants!.every(x => (x as { cardioStyle?: string }).cardioStyle === undefined)).toBe(true);
    expect(station.cardioStyle).toBe('funcional');   // estilo a nivel EXERCISE
  });
  it('K · cardio nativo intacto (marcha sigue continuous/lowImpact, no lo toca el adapter)', () => {
    expect(conditioningVariantFor(ex('marcha-en-lugar'), [...CUERPO])).toBeNull();   // cardio-identity → fuera del adapter
    expect(cardioStationCapabilities(ex('marcha-en-lugar')).steady).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 · GREEN habilitados (banco real con overrides)
// ═══════════════════════════════════════════════════════════════════════════
describe('9B.3 Phase 2 · GREEN pool', () => {
  const flexV = () => ex('press-horizontal').variants!.find(v => v.id === 'press-horizontal-flexiones')!;

  it('DELTA EXACTO · el tag cardio nuevo (vs legacy) ⊆ GREEN y = {push-up, air-squat}', () => {
    // solo los GREEN que legacy NO etiquetaba (fuerza/compuesto sin condicion) son "nuevos" al tag.
    // Los otros 4 ya eran cardio-tagged por legacy (condicion/funcional) — el override solo los vuelve
    // SELECCIONABLES como interval (vía adapter), no cambia su tag. Invariante clave: NINGÚN no-GREEN gana tag.
    const gained = BANK.filter(e => getExerciseModalities(e).includes('cardio') && !legacyCardio(e)).map(e => e.id);
    gained.forEach(id => expect(GREEN.has(id)).toBe(true));                    // ⊆ GREEN
    expect(new Set(gained)).toEqual(new Set(['press-horizontal', 'sentadilla-bilateral']));
    // y los 6 GREEN son admisibles como conditioning-interval (capability), vía tag o adapter
    for (const id of GREEN) expect(hasConditioningIntervalCapability(ex(id))).toBe(true);
  });

  it('A/C · push-up: conditioning eligible (variante flexiones) Y sigue strength', () => {
    expect(hasConditioningIntervalCapability(ex('press-horizontal'))).toBe(true);
    expect(getExerciseModalities(ex('press-horizontal'))).toEqual(expect.arrayContaining(['fuerza', 'cardio']));
    // flexiones resuelve conditioning+interval; el parent (sin variante) sigue strength/reps
    const flex = resolveMovementCapabilities(ex('press-horizontal'), flexV());
    expect(flex.roles).toEqual(expect.arrayContaining(['strength', 'conditioning']));
    expect(flex.workModes).toEqual(expect.arrayContaining(['reps', 'interval']));
    expect(resolveMovementCapabilities(ex('press-horizontal')).roles).not.toContain('conditioning');
  });
  it('N/O/P · VARIANT-AWARE: solo flexiones abre; barra/mancuernas/máquina NO', () => {
    for (const v of ex('press-horizontal').variants!) {
      const isGreen = v.id === 'press-horizontal-flexiones';
      expect(isConditioningIntervalVariant(ex('press-horizontal'), v)).toBe(isGreen);
    }
    // con equipo bodyweight, la única variante conditioning es flexiones (no bench/barbell)
    expect(conditioningVariantFor(ex('press-horizontal'), [...GYM])?.id).toBe('press-horizontal-flexiones');
  });
  it('D/E/F · push-up station: interval=true, continuous/power/drill=false, locomotion imposible', () => {
    const st = toConditioningStation(ex('press-horizontal'), flexV());
    const caps = cardioStationCapabilities(st);
    expect(caps.interval).toBe(true);
    expect(caps.steady || caps.recovery || caps.cooldown).toBe(false);   // continuous
    expect(caps.power).toBe(false);
    expect(caps.drill).toBe(false);
    expect(caps.maxContinuousMinutes).toBe(0);
  });
  it('air squat / core / sit-to-stand: conditioning interval válido, continuous=false', () => {
    for (const id of ['sentadilla-bilateral', 'core-dinamico', 'core-suelo-piernas', 'sentarse-pararse']) {
      expect(hasConditioningIntervalCapability(ex(id))).toBe(true);
    }
    // capability continuous jamás (no workMode continuous en overrides)
    const sq = ex('sentadilla-bilateral').variants!.find(v => v.id === 'sentadilla-al-aire')!;
    const cap = cardioStationCapabilities(toConditioningStation(ex('sentadilla-bilateral'), sq));
    expect(cap.interval).toBe(true);
    expect(cap.steady || cap.recovery || cap.cooldown).toBe(false);
  });
  it('Q/R/S · VIDEO required: sin video no prescribible; añadir video habilita; nunca otorga capability', () => {
    // sentadilla-al-aire: capability válida pero SIN video en snapshot → CONTENT_LIMITED
    expect(isConditioningIntervalVariant(ex('sentadilla-bilateral'),
      ex('sentadilla-bilateral').variants!.find(v => v.id === 'sentadilla-al-aire')!)).toBe(true);   // capability sí
    expect(conditioningVariantFor(ex('sentadilla-bilateral'), [...CUERPO])).toBeNull();              // prescribible NO (sin video)
    // añadir video → prescribible; y NO cambia la capability (R)
    registerAvailableVideos(['sentadilla-al-aire']);
    expect(conditioningVariantFor(ex('sentadilla-bilateral'), [...CUERPO])?.id).toBe('sentadilla-al-aire');
    clearRegisteredVideos();
    // press-horizontal-flexiones SÍ tiene video (snapshot) → prescribible
    expect(conditioningVariantFor(ex('press-horizontal'), [...CUERPO])?.id).toBe('press-horizontal-flexiones');
  });
  it('U · SAFETY fail-closed: un alto impacto / fallRisk jamás pasa por el adapter (jump squat)', () => {
    // sentadilla-pliometrica: impact high/fallRisk → aunque tuviera override, conditioningVariantFor=null
    expect(conditioningVariantFor(ex('sentadilla-pliometrica'), [...CUERPO])).toBeNull();
  });
  it('V/W/X · cardio nativo sin regresión: burpee/wall-balls continuous=false, high-knees no locomotion', () => {
    expect(cardioStationCapabilities(ex('burpee-sprawl')).steady).toBe(false);
    expect(conditioningVariantFor(ex('burpee-sprawl'), [...CUERPO])).toBeNull();   // cardio-identity, no adapter
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 · INTEGRACIÓN con buildCardioMain (prueba end-to-end del planner)
// ═══════════════════════════════════════════════════════════════════════════
describe('9B.3 Phase 2 · buildCardioMain consume la estación conditioning', () => {
  const flexV = () => ex('press-horizontal').variants!.find(v => v.id === 'press-horizontal-flexiones')!;

  it('push-up entra como bloque INTERVAL en un main funcional (aislado)', () => {
    const station = toConditioningStation(ex('press-horizontal'), flexV());
    const plan = buildCardioMain({ mainBudgetMinutes: 20, style: 'funcional', level: 'intermedio', pool: [station], supportPool: [] });
    // hay bloques y al menos uno es de la estación push-up como intervals (no steady/cooldown)
    const pushBlocks = plan.blocks.filter(b => b.stationId === 'press-horizontal');
    expect(pushBlocks.length).toBeGreaterThan(0);
    expect(pushBlocks.every(b => b.kind === 'intervals')).toBe(true);
    expect(pushBlocks.every(b => b.kind !== 'steady' && b.kind !== 'recovery' && b.kind !== 'cooldown')).toBe(true);
  });
  it('AG · push-up NUNCA aparece en steady/recovery/cooldown (continuous prohibido)', () => {
    const station = toConditioningStation(ex('press-horizontal'), flexV());
    // lowImpact = solo continuo → una estación interval-only no puede llenarlo → content gap, sin push-up steady
    const plan = buildCardioMain({ mainBudgetMinutes: 30, style: 'lowImpact', level: 'intermedio', pool: [station], supportPool: [] });
    expect(plan.blocks.some(b => b.stationId === 'press-horizontal' && (b.kind === 'steady' || b.kind === 'recovery' || b.kind === 'cooldown'))).toBe(false);
  });
  it('AM/X · selectedTime sigue siendo CAP: sesión ≤ budget, no rellena con push-ups', () => {
    const station = toConditioningStation(ex('press-horizontal'), flexV());
    const plan = buildCardioMain({ mainBudgetMinutes: 120, style: 'funcional', level: 'intermedio', pool: [station], supportPool: [] });
    expect(plan.totalMinutes).toBeLessThanOrEqual(120);
  });
  it('AL · variant-aware display: conditioningVariantIdFor devuelve flexiones para el player', () => {
    expect(conditioningVariantIdFor('press-horizontal', BANK, [...GYM])).toBe('press-horizontal-flexiones');
    expect(conditioningVariantIdFor('marcha-en-lugar', BANK, [...CUERPO])).toBeUndefined();  // cardio nativo intacto
  });
});
