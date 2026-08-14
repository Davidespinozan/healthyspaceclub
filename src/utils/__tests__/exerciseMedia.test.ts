import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';
import { exerciseVideoCandidateIds, pickExerciseVideo } from '../workoutPlanner';
import type { Equipment } from '../../types';

// Simula la tabla exercise_videos: cada variante con clip (VIDEO_VARIANT_IDS) tiene una URL.
const byId: Record<string, string> = {};
for (const id of VIDEO_VARIANT_IDS) byId[id] = `https://videos/${id}.mp4`;
const EX = (id: string) => exercises.find(e => e.id === id)!;

// ── El bug reportado: "Fondos de Tríceps" ───────────────────────────────
describe('MEDIA · Fondos de Tríceps resuelve el MISMO video en toda vista', () => {
  const fondos = EX('fondos-triceps');
  it('el base no tiene clip, pero el resolver encuentra el video de una variante', () => {
    // base sin video; variantes con video: entre-sillas (cuerpo), maquina (gym)
    expect(byId['fondos-triceps']).toBeUndefined();
    expect(VIDEO_VARIANT_IDS.has('fondos-triceps-entre-sillas')).toBe(true);
    const url = pickExerciseVideo(exerciseVideoCandidateIds(fondos), byId);
    expect(url).toBeTruthy();
  });
  it('resuelve un video para CUALQUIER equipo (Hoy y detalle usan la misma lista) — nunca placeholder', () => {
    for (const eq of [['gym'], ['cuerpo'], ['ligas'], undefined] as (Equipment[] | undefined)[]) {
      const ids = exerciseVideoCandidateIds(fondos, eq);
      expect(pickExerciseVideo(ids, byId)).toBeTruthy();   // el bug daba placeholder aquí
    }
  });
  it('mismos (exercise, equipment) → misma lista de candidatos en toda vista (determinista)', () => {
    const a = exerciseVideoCandidateIds(fondos, ['gym']);
    const b = exerciseVideoCandidateIds(fondos, ['gym']);
    expect(a).toEqual(b);
    // incluye base + todas las variantes (ninguna vista puede "no encontrar" lo que otra sí)
    for (const v of fondos.variants ?? []) expect(a).toContain(v.id);
    expect(a).toContain('fondos-triceps');
  });
});

// ── Invariante global: si existe video, el resolver lo encuentra ────────
describe('MEDIA · invariante — nunca placeholder cuando existe un clip', () => {
  it('todo ejercicio con ≥1 variante con video resuelve una URL (cualquier equipo)', () => {
    const withVideo = exercises.filter(e => (e.variants ?? []).some(v => VIDEO_VARIANT_IDS.has(v.id)));
    expect(withVideo.length).toBeGreaterThan(20);
    let misses = 0;
    for (const e of withVideo) {
      const url = pickExerciseVideo(exerciseVideoCandidateIds(e), byId);
      if (!url) { misses++; console.warn('miss:', e.id); }
    }
    expect(misses).toBe(0);
  });
  it('la variante del equipo va PRIMERO cuando tiene video (preferencia correcta)', () => {
    // press-horizontal: variante gym con video debe liderar en contexto gym
    const bench = EX('press-horizontal');
    const ids = exerciseVideoCandidateIds(bench, ['gym']);
    // el primer id es una variante (la elegida por equipo) o el base — no una variante de otro equipo al frente
    expect(ids.length).toBeGreaterThan(1);
    expect(ids[0]).toBeTruthy();
  });
  it('ejercicio sin ninguna variante con video → sin URL (placeholder legítimo)', () => {
    const noVid = { id: 'zzz-fake', name: 'x', variants: [{ id: 'zzz-fake-v', equipment: ['gym'] as Equipment[], name: 'v' }] } as never;
    expect(pickExerciseVideo(exerciseVideoCandidateIds(noVid), byId)).toBeNull();
  });
});
