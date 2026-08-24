import { describe, it, expect } from 'vitest';
import { deriveMovementCapabilities, resolveMovementCapabilities, hasMovementCapability } from '../movementCapabilities';
import { exercises } from '../../data/exercises';
import type { Exercise, MovementCapabilities } from '../../types';

const byId = new Map(exercises.map(e => [e.id, e]));
const ex = (id: string): Exercise => byId.get(id)!;
const variant = (id: string, vid: string) => (ex(id).variants ?? []).find(v => v.id === vid);
const caps = (id: string, vid?: string): MovementCapabilities => resolveMovementCapabilities(ex(id), vid ? variant(id, vid) : undefined);

// ── A/B/S · pureza, no-mutación, orden determinista ─────────────────────────
describe('9B.1 · pureza / no-mutación / determinismo', () => {
  it('A · determinista: mismos inputs → deepEqual', () => {
    expect(deriveMovementCapabilities(ex('marcha-en-lugar'))).toEqual(deriveMovementCapabilities(ex('marcha-en-lugar')));
  });
  it('B · no muta el Exercise ni sus variantes', () => {
    const before = JSON.stringify(ex('cardio-maquina'));
    deriveMovementCapabilities(ex('cardio-maquina'), variant('cardio-maquina', 'cardio-bici'));
    resolveMovementCapabilities(ex('cardio-maquina'));
    expect(JSON.stringify(ex('cardio-maquina'))).toBe(before);
  });
  it('S/R · arrays ordenados y sin duplicados', () => {
    const c = caps('marcha-en-lugar');
    expect(c.roles).toEqual([...new Set(c.roles)]);
    expect(c.workModes).toEqual([...new Set(c.workModes)]);
    // orden estable (roles antes de workModes por su propio orden)
    expect(deriveMovementCapabilities(ex('core-dinamico')).roles).toEqual(['strength', 'conditioning']);
  });
});

// ── Reality matrix (banco REAL) ──────────────────────────────────────────────
describe('9B.1 · reality matrix (catálogo real)', () => {
  it('D/E · push-up = strength, reps; NO conditioning ni continuous (metadata actual)', () => {
    const c = caps('press-horizontal');
    expect(c.roles).toContain('strength');
    expect(c.roles).not.toContain('conditioning');
    expect(c.workModes).toContain('reps');
    expect(c.workModes).not.toContain('continuous');
  });
  it('F · burpee = conditioning + interval; NO continuous', () => {
    const c = caps('burpee-sprawl');
    expect(c.roles).toContain('conditioning');
    expect(c.workModes).toContain('interval');
    expect(c.workModes).not.toContain('continuous');
    expect(c.roles).not.toContain('locomotion');
  });
  it('G · march = conditioning + continuous + locomotion', () => {
    const c = caps('marcha-en-lugar');
    expect(c.roles).toEqual(expect.arrayContaining(['conditioning', 'locomotion']));
    expect(c.workModes).toContain('continuous');
  });
  it('G · side-step = conditioning + continuous, NO locomotion (F2C-9D.1: vaivén lateral ≠ gait)', () => {
    // El paso lateral es cardio de bajo impacto CONTINUO válido, pero NO locomoción por gait (override de
    // metadata en exercises.ts): no debe sustituir un rodaje de correr. Sigue siendo continuo para lowImpact.
    const c = caps('paso-lateral');
    expect(c.roles).not.toContain('locomotion');
    expect(c.roles).toContain('conditioning');
    expect(c.workModes).toContain('continuous');
  });
  it('H · running-drills / high-knees NO locomotion continuous (alto impacto)', () => {
    const c = caps('running-drills');
    expect(c.roles).not.toContain('locomotion');
    expect(c.workModes).not.toContain('continuous');
    expect(c.workModes).toContain('interval');
  });
  it('I · variantes de máquina REFINAN al parent', () => {
    const bici = caps('cardio-maquina', 'cardio-bici');
    const caminadora = caps('cardio-maquina', 'cardio-caminadora');
    const remo = caps('cardio-maquina', 'remo-ergometro');
    // bici/remo: continuous pero NO locomotion (estacionarias)
    expect(bici.workModes).toContain('continuous');
    expect(bici.roles).not.toContain('locomotion');
    expect(remo.roles).not.toContain('locomotion');
    // caminadora (correr): locomotion + continuous
    expect(caminadora.roles).toContain('locomotion');
    expect(caminadora.workModes).toContain('continuous');
  });
  it('J · wall-balls = NO continuous (movimiento funcional, no máquina steady)', () => {
    const c = caps('cardio-maquina', 'wall-balls');
    expect(c.workModes).not.toContain('continuous');
  });
  it('bici/elíptica/caminadora/remo continuous (I extendido)', () => {
    for (const v of ['cardio-bici', 'cardio-eliptica', 'cardio-caminadora', 'remo-ergometro']) {
      expect(caps('cardio-maquina', v).workModes).toContain('continuous');
    }
  });
  it('K · mobility = warmup + cooldown (mobilise)', () => {
    const mov = exercises.find(e => e.type === 'movilidad')!;
    const c = resolveMovementCapabilities(mov);
    expect(c.roles).toEqual(expect.arrayContaining(['warmup', 'cooldown']));
    expect(c.warmupPhases).toContain('mobilise');
  });
  it('L · activation = warmup.activate', () => {
    const act = exercises.find(e => e.type === 'activacion')!;
    const c = resolveMovementCapabilities(act);
    expect(c.roles).toContain('warmup');
    expect(c.warmupPhases).toContain('activate');
  });
  it('K(multi) · un movimiento puede ser strength + conditioning sin duplicar id', () => {
    const c = caps('core-dinamico');
    expect(c.roles).toEqual(expect.arrayContaining(['strength', 'conditioning']));
  });
});

// ── Overrides (M/N/O) ────────────────────────────────────────────────────────
describe('9B.1 · override reemplaza el eje derivado', () => {
  const base = { id: 'x', name: 'X', type: 'compuesto', muscleGroup: 'pecho', equipment: ['cuerpo'], goals: ['fuerza'], variants: [] } as unknown as Exercise;
  it('M · override.roles reemplaza los roles derivados', () => {
    const withOv = { ...base, capabilities: { roles: ['conditioning', 'warmup'] } } as Exercise;
    expect(resolveMovementCapabilities(withOv).roles).toEqual(['conditioning', 'warmup']);   // ya no 'strength'
  });
  it('N · override.workModes reemplaza los workModes derivados', () => {
    const withOv = { ...base, capabilities: { workModes: ['interval'] } } as Exercise;
    expect(resolveMovementCapabilities(withOv).workModes).toEqual(['interval']);
  });
  it('O · override.warmupPhases reemplaza las fases derivadas', () => {
    const mov = { ...base, type: 'movilidad', capabilities: { warmupPhases: ['raise'] } } as unknown as Exercise;
    expect(resolveMovementCapabilities(mov).warmupPhases).toEqual(['raise']);
  });
  it('P · variant.capabilities gana sobre ex.capabilities', () => {
    const exOv = { ...base, capabilities: { roles: ['strength'] }, variants: [{ id: 'x-v', equipment: ['cuerpo'], capabilities: { roles: ['conditioning'] } }] } as unknown as Exercise;
    expect(resolveMovementCapabilities(exOv, exOv.variants![0]).roles).toEqual(['conditioning']);
  });
  it('Q · legacy sin override → deriva normal', () => {
    expect(resolveMovementCapabilities(base).roles).toContain('strength');
  });
});

// ── T · hasMovementCapability exacto ─────────────────────────────────────────
describe('9B.1 · hasMovementCapability', () => {
  it('T · consulta role + workMode exacta', () => {
    const c = caps('marcha-en-lugar');
    expect(hasMovementCapability(c, 'locomotion')).toBe(true);
    expect(hasMovementCapability(c, 'locomotion', 'continuous')).toBe(true);
    expect(hasMovementCapability(c, 'locomotion', 'interval')).toBe(false);
    expect(hasMovementCapability(c, 'power')).toBe(false);
  });
});

// ── C · independiente de video (no importa 9A) ───────────────────────────────
describe('9B.1 · capability independiente de video', () => {
  it('C · agregar/quitar disponibilidad de video NO cambia derive/resolve', async () => {
    const { registerAvailableVideos, clearRegisteredVideos } = await import('../videoAvailability');
    const before = resolveMovementCapabilities(ex('marcha-en-lugar'));
    registerAvailableVideos(['marcha-en-lugar-basico', 'press-horizontal']);
    const after = resolveMovementCapabilities(ex('marcha-en-lugar'));
    clearRegisteredVideos();
    expect(after).toEqual(before);
  });
});
