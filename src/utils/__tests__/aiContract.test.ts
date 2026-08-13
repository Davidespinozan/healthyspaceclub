import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del PROXY de IA (no de la lógica determinista). Controlamos la RESPUESTA del modelo
// para atacar los límites del contrato: la IA puede elegir/componer, pero NO escapar del
// universo permitido por el motor.
vi.mock('../aiProxy', () => ({ callAI: vi.fn(), callAIStream: vi.fn() }));

import { callAI } from '../aiProxy';
import { orchestrateWorkout } from '../workoutOrchestration';
import { validateWorkout, type CachedWorkout } from '../workoutCache';
import { exercises } from '../../data/exercises';
import { selectStrengthCandidates, firstUnfit } from './sim/genPipeline';
import { DAY_TYPE_CONFIG } from '../workoutPlanner';
import type { Equipment, MuscleGroup } from '../../types';

const mockedCallAI = vi.mocked(callAI);
const modelReturns = (workout: unknown) =>
  mockedCallAI.mockResolvedValue({ content: [{ text: JSON.stringify(workout) }] } as never);

// Contexto real: candidatos de fuerza (gym, full-body) ya filtrados por TODOS los filtros.
const equipmentList: Equipment[] = ['gym'];
const dayMuscles = (DAY_TYPE_CONFIG['full-body']?.muscleGroups ?? []).filter(m => m !== 'core') as MuscleGroup[];
const candidates = selectStrengthCandidates({ bank: exercises, equipmentList, muscleGroups: dayMuscles, goal: 'hipertrofia', level: 'intermedio', lowImpactMode: false, time: 60 });
const candidateIds = new Set(candidates.slice(0, 15).map(c => c.id));
const validIds = new Set(exercises.map(e => e.id));

// Réplica EXACTA de la validación del caller (DailyTrainer): tipos+id-en-banco, universo de
// candidatos (seguridad sobrevive a la IA), y equipo/video (fitsEquipment).
function callerAccepts(w: CachedWorkout): { ok: boolean; reason?: string } {
  if (!validateWorkout(w, validIds)) return { ok: false, reason: 'validateWorkout (id-en-banco/tipos)' };
  const escaped = w.exercises.find(ex => !candidateIds.has(ex.id));
  if (escaped) return { ok: false, reason: `escapó del universo: ${escaped.id}` };
  if (firstUnfit(w.exercises.map(e => exercises.find(x => x.id === e.id)!).filter(Boolean), equipmentList)) return { ok: false, reason: 'fitsEquipment' };
  return { ok: true };
}

const mk = (ids: string[]): CachedWorkout => ({
  type: 'strength', intensity: 'media',
  exercises: ids.map(id => ({ id, sets: 3, reps: '8-12', rest: 90 })),
  warmup: '', cooldown: '', note: '',
} as unknown as CachedWorkout);

const orchestrate = () => orchestrateWorkout({
  candidates: candidates.slice(0, 15), equipment: equipmentList, targetCount: 5,
  goal: 'hipertrofia', intensity: 'media', userName: 'Test', dayLabel: 'Full body', context: '-',
});

describe('CONTRATO IA · la IA compone, pero no escapa del universo del motor', () => {
  beforeEach(() => mockedCallAI.mockReset());

  it('respuesta VÁLIDA (ids dentro de candidatos) → aceptada', async () => {
    const ids = [...candidateIds].slice(0, 5);
    modelReturns(mk(ids));
    const w = await orchestrate() as CachedWorkout;
    expect(callerAccepts(w).ok).toBe(true);
  });

  it('ID INVENTADO (no existe en el banco) → rechazado', async () => {
    modelReturns(mk(['ejercicio-fantasma-999', ...[...candidateIds].slice(0, 3)]));
    const w = await orchestrate() as CachedWorkout;
    expect(callerAccepts(w).ok).toBe(false);
  });

  it('ID FUERA DE CANDIDATOS (existe en banco pero no se ofreció) → rechazado (seguridad sobrevive)', async () => {
    // un id real del banco que NO está en los candidatos del día
    const outsider = exercises.find(e => !candidateIds.has(e.id) && !e.isYoga)!;
    modelReturns(mk([outsider.id, ...[...candidateIds].slice(0, 3)]));
    const w = await orchestrate() as CachedWorkout;
    const res = callerAccepts(w);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('escapó');
  });

  it('estructura INVÁLIDA (sets no numérico) → rechazado por validateWorkout', async () => {
    modelReturns({ type: 'strength', intensity: 'media', exercises: [{ id: [...candidateIds][0], sets: 'muchas', reps: '8' }], warmup: '', cooldown: '', note: '' });
    const w = await orchestrate() as CachedWorkout;
    expect(callerAccepts(w).ok).toBe(false);
  });

  it('respuesta INCOMPLETA (exercises vacío) → rechazado', async () => {
    modelReturns({ type: 'strength', intensity: 'media', exercises: [], warmup: '', cooldown: '', note: '' });
    const w = await orchestrate() as CachedWorkout;
    expect(callerAccepts(w).ok).toBe(false);
  });

  it('JSON malformado / truncado → orchestrateWorkout lanza (no expone SyntaxError)', async () => {
    mockedCallAI.mockResolvedValue({ content: [{ text: '{ "exercises": [ {' }] } as never);
    await expect(orchestrate()).rejects.toThrow();
  });

  it('DUPLICADOS: hoy pasan validateWorkout (limitación conocida) — documentado como design question', async () => {
    const dup = [...candidateIds][0];
    modelReturns(mk([dup, dup, [...candidateIds][1]]));
    const w = await orchestrate() as CachedWorkout;
    // validateWorkout NO detecta duplicados; el reparador estructural los deja pasar.
    // Se documenta: no rompe seguridad (mismo ejercicio jugable) pero es subóptimo.
    expect(w.exercises.filter(e => e.id === dup).length).toBe(2);
  });
});
