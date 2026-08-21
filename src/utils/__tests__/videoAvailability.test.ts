import { describe, it, expect, afterEach } from 'vitest';
import { hasVideo, registerAvailableVideos, clearRegisteredVideos, videoPolicyFor } from '../videoAvailability';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';
import { hasPlayableVariant } from '../workoutPlanner';
import { isPlayableForCardioPhase } from '../cardioPlayability';
import type { Exercise } from '../../types';

afterEach(() => clearRegisteredVideos());   // el overlay nunca se filtra entre tests

// Fixtures: una estación cardio CONTINUA (marcha) cuya variante NO está en el snapshot → videoless.
const marcha = {
  id: 'marcha-x', name: 'Marcha', type: 'cardio', muscleGroup: 'cardio', cardioStyle: 'lowImpact',
  impact: 'low', fallRisk: false, equipment: ['cuerpo'],
  variants: [{ id: 'marcha-x-basico', equipment: ['cuerpo'] }],
} as unknown as Exercise;

// ── 1 · BYTE-IDENTICAL: con overlay vacío, hasVideo === VIDEO_VARIANT_IDS.has ─────────────────
describe('F2C-9A · fuente única — baseline byte-identical', () => {
  it('con overlay vacío, hasVideo coincide EXACTAMENTE con el snapshot para toda muestra', () => {
    const sample = [...VIDEO_VARIANT_IDS].slice(0, 40).concat(['no-existe-1', 'no-existe-2', 'marcha-x-basico']);
    for (const id of sample) expect(hasVideo(id)).toBe(VIDEO_VARIANT_IDS.has(id));
  });
  it('un id del snapshot sigue disponible; uno inexistente no', () => {
    const anyReal = [...VIDEO_VARIANT_IDS][0];
    expect(hasVideo(anyReal)).toBe(true);
    expect(hasVideo('jamas-existira')).toBe(false);
  });
});

// ── 2 · OVERLAY aditivo (fuente unificable en runtime) ───────────────────────────────────────
describe('F2C-9A · overlay de runtime (registerAvailableVideos)', () => {
  it('registrar un id lo vuelve disponible; limpiar lo revierte; es aditivo (no quita)', () => {
    expect(hasVideo('marcha-x-basico')).toBe(false);
    registerAvailableVideos(['marcha-x-basico']);
    expect(hasVideo('marcha-x-basico')).toBe(true);
    // no quita nada del snapshot
    expect(hasVideo([...VIDEO_VARIANT_IDS][0])).toBe(true);
    clearRegisteredVideos();
    expect(hasVideo('marcha-x-basico')).toBe(false);
  });
});

// ── 3 · PRUEBA CLAVE: agregar/mapear un video vuelve elegible el movimiento SIN tocar el programador ──
describe('F2C-9A · agregar video → elegible sin modificar el programador', () => {
  it('marcha videoless NO es playable; tras registrar su clip, SÍ — sin cambiar cardioMain/workoutPlanner', () => {
    // ANTES: sin clip en el snapshot, hasPlayableVariant lo excluye (gate de video del planner).
    expect(hasPlayableVariant(marcha, ['cuerpo'])).toBe(false);
    // SIMULA "mapear un video" (lo que hará la app al cargar exercise_videos): registrar el id.
    registerAvailableVideos(['marcha-x-basico']);
    // DESPUÉS: el MISMO gate del programador ahora lo ve disponible — sin editar el programador.
    expect(hasPlayableVariant(marcha, ['cuerpo'])).toBe(true);
  });
});

// ── 4 · POLÍTICA central required/preferred ──────────────────────────────────────────────────
describe('F2C-9A · política central de video', () => {
  it('fuerza y cardio intenso = required; cardio continuo = preferred', () => {
    expect(videoPolicyFor({ role: 'strength' })).toBe('required');
    expect(videoPolicyFor({ role: 'cardioIntense' })).toBe('required');
    expect(videoPolicyFor({ role: 'cardioContinuous' })).toBe('preferred');
  });
});

// ── 5 · El flip preferred→required es un cambio de POLÍTICA, no de arquitectura ───────────────
describe('F2C-9A · flip de política sin cambiar arquitectura', () => {
  it('cardio continuo videoless: default (preferred) → playable; con required → no playable, MISMO code path', () => {
    // default: cardio continuo = preferred → marcha videoless es playable (F2C-6/7/8 intacto).
    expect(isPlayableForCardioPhase(marcha, ['cuerpo'], 'steady')).toBe(true);
    // override 'required' (simula el flip futuro): el MISMO gate ahora exige clip → fuera.
    expect(isPlayableForCardioPhase(marcha, ['cuerpo'], 'steady', undefined, 'required')).toBe(false);
    // con clip registrado, vuelve a ser playable incluso bajo 'required' (video real gana).
    registerAvailableVideos(['marcha-x-basico']);
    expect(isPlayableForCardioPhase(marcha, ['cuerpo'], 'steady', undefined, 'required')).toBe(true);
  });
  it('trabajo intenso (interval) sigue required por defecto: videoless jamás pasa', () => {
    // un movimiento funcional videoless nunca es playable como interval (política required implícita)
    const burpeeless = { id: 'bx', name: 'B', type: 'cardio', muscleGroup: 'cardio', cardioStyle: 'funcional',
      impact: 'high', fallRisk: true, equipment: ['cuerpo'], variants: [{ id: 'bx-v', equipment: ['cuerpo'] }] } as unknown as Exercise;
    expect(isPlayableForCardioPhase(burpeeless, ['cuerpo'], 'interval')).toBe(false);
  });
});
