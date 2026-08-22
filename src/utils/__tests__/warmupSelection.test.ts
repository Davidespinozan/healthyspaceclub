import { describe, it, expect } from 'vitest';
import {
  isRaiseEligible, isActivateEligible, hasWarmupPhase, warmupSafe,
  isCooldownMovement, selectCooldown, phaseMovementPrescription, sealPhaseVariantId,
} from '../warmupSelection';
import { pickWarmupRaise, pickSpecificActivation, warmupRegion } from '../strengthWarmup';
import { resolveMovementCapabilities } from '../movementCapabilities';
import { exercises as BANK } from '../../data/exercises';
import type { Exercise } from '../../types';

const byId = new Map(BANK.map(e => [e.id, e]));
const ex = (id: string) => byId.get(id)!;
const GYM = ['gym', 'cuerpo'] as const;
const CUERPO = ['cuerpo'] as const;

// Banco con TODOS los overrides de capabilities/prescriptionType eliminados = estado "pre-metadata".
const strip = (e: Exercise): Exercise => ({
  ...e, capabilities: undefined, prescriptionType: undefined,
  variants: e.variants?.map(v => ({ ...v, capabilities: undefined })),
});
const STRIPPED = BANK.map(strip);

// ── A · Phase-1 equivalence (metadata NO cambia la selección de warmup) ─────────
describe('9C.2A Phase-1 · equivalencia de selección warmup', () => {
  it('A · pickWarmupRaise: banco real == banco stripped (raise metadata es selection-neutral)', () => {
    for (const gym of [true, false]) {
      for (const eq of [GYM, CUERPO]) {
        expect(pickWarmupRaise(BANK, [...eq], gym)?.id ?? null).toBe(pickWarmupRaise(STRIPPED, [...eq], gym)?.id ?? null);
      }
    }
  });
  it('A · pickSpecificActivation: banco real == stripped por región', () => {
    for (const region of ['upper', 'lower', 'mixed', 'core'] as const) {
      for (const eq of [GYM, CUERPO]) {
        expect(pickSpecificActivation(BANK, region, [...eq])?.id ?? null).toBe(pickSpecificActivation(STRIPPED, region, [...eq])?.id ?? null);
      }
    }
  });
  it('A · warmupRegion sin cambio', () => {
    const exs = [{ id: 'press-horizontal' }, { id: 'sentadilla-bilateral' }];
    expect(warmupRegion(exs, BANK)).toBe(warmupRegion(exs, STRIPPED));
  });
});

// ── RAISE ───────────────────────────────────────────────────────────────────────
describe('9C.2A · Raise', () => {
  it('B · cardio-maquina raise capability-driven (warmupPhases raise) + elegible', () => {
    expect(hasWarmupPhase(ex('cardio-maquina'), 'raise')).toBe(true);
    expect(isRaiseEligible(ex('cardio-maquina'), [...GYM])).toBe(true);
  });
  it('B · raise NO borra conditioning (roles/workModes derivados intactos)', () => {
    expect(resolveMovementCapabilities(ex('cardio-maquina')).roles).toContain('conditioning');
  });
  it('D/E · alto impacto / fallRisk rechazados (saltos, running-drills)', () => {
    expect(warmupSafe(ex('saltos-basicos'))).toBe(false);
    expect(isRaiseEligible(ex('saltos-basicos'), [...CUERPO])).toBe(false);
    expect(isRaiseEligible(ex('running-drills'), [...CUERPO])).toBe(false);
  });
  it('F · equipment respetado: cardio-maquina no elegible sin gym', () => {
    expect(isRaiseEligible(ex('cardio-maquina'), [...CUERPO])).toBe(false);   // máquinas requieren gym
  });
});

// ── COOLDOWN ────────────────────────────────────────────────────────────────────
describe('9C.2A · Cooldown', () => {
  it('L · estático gentil elegible (child-pose, pigeon, forward-fold)', () => {
    for (const id of ['child-pose', 'pigeon-pose', 'seated-forward-fold', 'supine-twist', 'camel-pose']) {
      expect(isCooldownMovement(ex(id))).toBe(true);
    }
  });
  it('J/K · skill/balance yoga NO cooldown (crow, wheel, side-plank, boat)', () => {
    for (const id of ['crow-pose', 'wheel-pose', 'side-plank-yoga', 'boat-pose', 'warrior-iii']) {
      expect(isCooldownMovement(ex(id))).toBe(false);
    }
  });
  it('I · dinámico NO cooldown (cat-cow, sun-salutation, lunges)', () => {
    for (const id of ['cat-cow', 'sun-salutation-a', 'low-lunge', 'lizard-lunge', 'warrior-i']) {
      expect(isCooldownMovement(ex(id))).toBe(false);
    }
  });
  it('C · video NO otorga capability: side-plank-yoga (con video) sigue NO cooldown', () => {
    expect(isCooldownMovement(ex('side-plank-yoga'))).toBe(false);   // tiene video pero es skill → fuera
  });
  it('P · selectCooldown determinista + solo estáticos', () => {
    const a = selectCooldown(BANK, [...GYM], 2).map(e => e.id);
    const b = selectCooldown(BANK, [...GYM], 2).map(e => e.id);
    expect(a).toEqual(b);
    expect(a.length).toBe(2);
    a.forEach(id => expect(isCooldownMovement(ex(id))).toBe(true));
  });
  it('exactamente 8 poses afirmadas como cooldown (las GREEN estáticas)', () => {
    const cd = BANK.filter(isCooldownMovement).map(e => e.id).sort();
    expect(cd).toEqual(['bridge-pose', 'camel-pose', 'child-pose', 'pigeon-pose', 'puppy-pose', 'seated-forward-fold', 'seated-twist', 'supine-twist']);
  });
});

// ── ACTIVATE workMode gap ────────────────────────────────────────────────────────
describe('9C.2A · Activate workMode', () => {
  it('O · plancha isométrica → workMode isometric (prescriptionType time)', () => {
    expect(resolveMovementCapabilities(ex('anti-extension-isometrica')).workModes).toContain('isometric');
  });
  it('O · caminata-monstruo NO isometric (reps/locomoción, sin prescriptionType)', () => {
    expect(resolveMovementCapabilities(ex('caminata-lateral-monstruo')).workModes).not.toContain('isometric');
  });
  it('activate: activacion elegible (capability OR legacy), no-activacion no', () => {
    expect(isActivateEligible(ex('anti-extension-isometrica'), [...GYM])).toBe(true);
    expect(isActivateEligible(ex('press-horizontal'), [...GYM])).toBe(false);
  });
});

// ── 9C.2B.1 · prescripción ejecutable + variantId ────────────────────────────────
describe('9C.2B.1 · phaseMovementPrescription', () => {
  it('C · raise → time fijo (pulse-raiser suave)', () => {
    expect(phaseMovementPrescription(ex('cardio-maquina'), 'raise')).toEqual({ kind: 'time', seconds: 120 });
  });
  it('F · plancha isométrica (prescriptionType time) → time', () => {
    const p = phaseMovementPrescription(ex('anti-extension-isometrica'), 'mobilise');
    expect(p?.kind).toBe('time');
    expect((p as { seconds: number }).seconds).toBeGreaterThan(0);
  });
  it('G · movimiento por reps → reps (perSide si "por lado")', () => {
    const p = phaseMovementPrescription(ex('caminata-lateral-monstruo'), 'activate');
    expect(p?.kind).toBe('reps');
  });
  it('O · sin metadata prescribible honesta → null (CONTENT_LIMITED, no bloquea)', () => {
    const bare = { ...ex('press-horizontal'), defaultReps: '', defaultDuration: undefined, prescriptionType: undefined } as typeof BANK[number];
    expect(phaseMovementPrescription(bare, 'mobilise')).toBeNull();
  });
  it('P/Q · sealPhaseVariantId sella una máquina concreta (no undefined) para cardio-maquina', () => {
    const vid = sealPhaseVariantId(ex('cardio-maquina'), [...GYM]);
    expect(typeof vid).toBe('string');
    expect((ex('cardio-maquina').variants ?? []).some(v => v.id === vid)).toBe(true);   // variante real del banco
  });
  it('determinista + no muta', () => {
    const before = JSON.stringify(ex('cardio-maquina'));
    expect(phaseMovementPrescription(ex('cardio-maquina'), 'raise')).toEqual(phaseMovementPrescription(ex('cardio-maquina'), 'raise'));
    sealPhaseVariantId(ex('cardio-maquina'), [...GYM]);
    expect(JSON.stringify(ex('cardio-maquina'))).toBe(before);
  });
  // ── 9C.2B.2 · cooldown prescription (reusa la derivación de mobilise) ──
  it('9C.2B.2 · cooldown: poses estáticas afirmadas → prescripción time honesta', () => {
    for (const id of ['child-pose', 'pigeon-pose', 'seated-forward-fold', 'bridge-pose', 'camel-pose']) {
      const p = phaseMovementPrescription(ex(id), 'cooldown');
      expect(p?.kind).toBe('time');
      expect((p as { seconds: number }).seconds).toBeGreaterThan(0);
    }
  });
  it('9C.2B.2 · las 8 cooldown afirmadas son prescribibles (ejecutables)', () => {
    const pool = BANK.filter(e => resolveMovementCapabilities(e).roles.includes('cooldown') && (resolveMovementCapabilities(e).warmupPhases ?? []).length === 0);
    expect(pool.length).toBe(8);
    expect(pool.every(m => phaseMovementPrescription(m, 'cooldown') != null)).toBe(true);
  });
});

// ── pureza / no-mutación ─────────────────────────────────────────────────────────
describe('9C.2A · pureza', () => {
  it('R · no muta el banco', () => {
    const before = JSON.stringify(ex('child-pose'));
    isCooldownMovement(ex('child-pose'));
    selectCooldown(BANK, [...GYM], 2);
    expect(JSON.stringify(ex('child-pose'))).toBe(before);
  });
  it('U · yoga: poses siguen existiendo con su type/isYoga (capabilities additive, no rompen yoga)', () => {
    expect(ex('child-pose').type).toBe('movilidad');
    expect(ex('child-pose').isYoga).toBe(true);
  });
});
