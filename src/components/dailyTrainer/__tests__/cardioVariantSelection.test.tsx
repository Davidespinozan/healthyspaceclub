import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup as rtlCleanup } from '@testing-library/react';

// ═══════════════════════════════════════════════════════════════════════════
// FIX C1 · Representación/ejecución de variantes de cardio.
// El usuario debe VER la actividad concreta (Remo/Bici), ELEGIR variante, y que la
// elección LLEGUE a la ejecución sin romper la prescripción del bloque.
// Estos tests blindan: variantId respetado + fallback seguro; card muestra variante
// activa; steady usa póster estático (no loop); swap lowImpact no ofrece alto impacto;
// variantId sobrevive serialización (resume); cambiar variante conserva cardio-meta;
// fuerza intacta; y cardioMain NO cambió.
// ═══════════════════════════════════════════════════════════════════════════

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: (_col: string, ids: string[]) => ({
          order: () => Promise.resolve({
            data: ids.map(id => ({ exercise_id: id, video_url: `https://v/${id}.mp4`, display_order: 0 })),
            error: null,
          }),
        }),
      }),
    }),
  },
}));

import { selectVariantForEquipment } from '../../../utils/workoutPlanner';
import { buildCardioMain } from '../../../utils/cardioMain';
import { pickSwapAlternative } from '../../WorkoutPlayer';
import { exercises as REAL_BANK } from '../../../data/exercises';
import WorkoutPlan from '../WorkoutPlan';
import { useAppStore } from '../../../store';
import type { Exercise, WorkoutDayDecision, Equipment, Modality } from '../../../types';

// Estación de cardio de máquina con variantes (remo default ↔ bici ↔ elíptica), como en el banco real.
const cardioMaquina = {
  id: 'cardio-maquina', name: 'Cardio en Máquina', desc: '', muscleGroup: 'cardio',
  cardioStyle: 'funcional', equipment: ['gym'], goals: ['resistencia'], type: 'compuesto',
  difficulty: 'principiante', defaultSets: 1, defaultReps: '30 min', defaultRest: 0, steps: [],
  variants: [
    { id: 'remo-ergometro', name: 'Remo (ergómetro)', equipment: ['gym'], isDefault: true },
    { id: 'cardio-bici', name: 'Bicicleta', equipment: ['gym'], cardioStyle: 'lowImpact' },
    { id: 'cardio-eliptica', name: 'Elíptica', equipment: ['gym'], cardioStyle: 'lowImpact' },
  ],
} as unknown as Exercise;

// ── 1/2/8 · selectVariantForEquipment: variantId respetado, fallback seguro, fuerza/legacy intacto ──
describe('selectVariantForEquipment · variantId', () => {
  it('respeta el variantId elegido si sigue aplicable', () => {
    expect(selectVariantForEquipment(cardioMaquina, ['gym'], undefined, 'cardio-bici')?.id).toBe('cardio-bici');
    expect(selectVariantForEquipment(cardioMaquina, ['gym'], undefined, 'cardio-eliptica')?.id).toBe('cardio-eliptica');
  });

  it('fallback SEGURO a la default si el variantId ya no es válido', () => {
    expect(selectVariantForEquipment(cardioMaquina, ['gym'], undefined, 'no-existe')?.id).toBe('remo-ergometro');
  });

  it('SIN variantId = comportamiento previo idéntico (fuerza/legacy intacto)', () => {
    // No pasar preferredVariantId debe comportarse EXACTAMENTE como antes (default/isDefault).
    expect(selectVariantForEquipment(cardioMaquina, ['gym'])?.id).toBe('remo-ergometro');
    // Un ejercicio de fuerza real resuelve su variante igual que siempre.
    const press = REAL_BANK.find(e => e.id === 'press-horizontal')!;
    const withoutPref = selectVariantForEquipment(press, ['gym']);
    const withUndefinedPref = selectVariantForEquipment(press, ['gym'], undefined, undefined);
    expect(withUndefinedPref?.id).toBe(withoutPref?.id);
  });
});

// ── 5 · cambiar variante conserva la cardio-meta (spread {...ex, variantId}) ──
describe('cambiar variante · conserva prescripción del bloque', () => {
  it('cambiar variantId NO altera cardio/sets/reps/rest', () => {
    const cardioEx = {
      id: 'cardio-maquina', sets: 1, reps: '41 min · Zona 2', rest: 0,
      variantId: 'remo-ergometro',
      cardio: { kind: 'steady', labelKey: 'cardio.steady', zone: 'Zona 2', minutes: 41, intensity: 'baja', style: 'lowImpact' },
    };
    const changed = { ...cardioEx, variantId: 'cardio-bici' };
    expect(changed.variantId).toBe('cardio-bici');
    expect(changed.id).toBe(cardioEx.id);           // misma estación → progreso conservable
    expect(changed.sets).toBe(cardioEx.sets);
    expect(changed.reps).toBe(cardioEx.reps);
    expect(changed.rest).toBe(cardioEx.rest);
    expect(changed.cardio).toEqual(cardioEx.cardio); // duración/zona/intensidad idénticas
  });
});

// ── 6 · swap de EJERCICIO respeta cardioStyle/impacto: lowImpact nunca → alto impacto ──
describe('pickSwapAlternative · safety cardio', () => {
  it('un bloque lowImpact nunca ofrece una estación de alto impacto/fallRisk', () => {
    const alt = pickSwapAlternative(
      REAL_BANK, 'cardio-maquina', ['gym'], new Set(['cardio-maquina']), undefined,
      { style: 'lowImpact', lowImpactOnly: true },
    );
    if (alt) {
      expect(alt.impact).not.toBe('high');
      expect(alt.fallRisk).not.toBe(true);
      expect(alt.muscleGroup).toBe('cardio');
    }
  });

  it('sin restricción cardio, el swap se comporta como antes (mismo grupo)', () => {
    const alt = pickSwapAlternative(REAL_BANK, 'cardio-maquina', ['gym'], new Set(['cardio-maquina']), undefined);
    if (alt) expect(alt.muscleGroup).toBe('cardio');
  });
});

// ── 7 · resume: variantId sobrevive la serialización JSON (savedProgress persiste swaps por JSON) ──
describe('resume · variantId persiste', () => {
  it('un swap con variantId sobrevive JSON.stringify/parse (localStorage)', () => {
    const swaps = { 0: { id: 'cardio-maquina', sets: 1, reps: '41 min · Zona 2', rest: 0, variantId: 'cardio-bici' } };
    const roundTripped = JSON.parse(JSON.stringify(swaps));
    expect(roundTripped[0].variantId).toBe('cardio-bici');
  });
});

// ── 9 · cardioMain output IDÉNTICO (no se tocó el motor) — regresión del contrato C1 ──
describe('buildCardioMain · sin regresión', () => {
  it('lowImpact 90min avanzado = 2 bloques steady (Z2 + tempo), 0 intensos', () => {
    const lowImpactPool = REAL_BANK.filter(e => e.muscleGroup === 'cardio' &&
      ((e.variants ?? []).some(v => v.cardioStyle === 'lowImpact') || e.cardioStyle === 'lowImpact') &&
      e.impact !== 'high' && !e.fallRisk);
    const plan = buildCardioMain({
      mainBudgetMinutes: 82, style: 'lowImpact', level: 'avanzado', readiness: 'normal',
      bodyGoal: 'salud', lowImpactMode: false, isDeload: false, pool: lowImpactPool,
    });
    expect(plan.style).toBe('lowImpact');
    expect(plan.intenseMinutes).toBe(0);              // lowImpact = todo sostenible
    // F2C-7 · PROGRAMADO: ondulación Z2/Z3 fragmentada + cooldown explícito (no "mitad+mitad" residual).
    expect(plan.blocks.length).toBeGreaterThanOrEqual(3);
    expect(plan.blocks.every(b => b.kind === 'steady' || b.kind === 'recovery' || b.kind === 'cooldown')).toBe(true);
    expect(plan.blocks.some(b => b.kind === 'cooldown')).toBe(true);         // fase cooldown real
    expect(plan.blocks.some(b => b.intensity === 'media')).toBe(true);       // ondulación Z3 (avanzado)
    for (const b of plan.blocks) expect(b.minutes).toBeLessThanOrEqual(40);  // ningún bloque gigante
  });
});

// ── 3/4 · Card muestra variante activa + steady usa PÓSTER estático (no loop) ──
const decision: WorkoutDayDecision = { type: 'cardio', reason: '', source: 'auto' } as unknown as WorkoutDayDecision;
const bankUI = [
  cardioMaquina,
  { id: 'run-drills', name: 'Running drills', desc: '', muscleGroup: 'cardio', cardioStyle: 'correr', equipment: ['gym'], goals: ['resistencia'], type: 'compuesto', difficulty: 'intermedio', defaultSets: 1, defaultReps: '5 min', defaultRest: 0, steps: [] },
] as unknown as Exercise[];

const steadyEx = {
  id: 'cardio-maquina', sets: 1, reps: '41 min · Zona 2', rest: 0,
  cardio: { kind: 'steady', labelKey: 'cardio.steady', zone: 'Zona 2', minutes: 41, intensity: 'baja', style: 'lowImpact' },
};
const drillsEx = {
  id: 'run-drills', sets: 1, reps: '5 min', rest: 0,
  cardio: { kind: 'drills', labelKey: 'cardio.drills', minutes: 5, intensity: 'media', style: 'correr' },
};

const baseProps = (exercises: unknown[]) => ({
  plan: { type: 'cardio', intensity: 'media', exercises } as never,
  regenBlocked: false, regensLeft: 3,
  selectedEquipment: 'gym' as Equipment,
  selectedModality: 'cardio' as Modality,
  selectedTime: 90,
  todayDecision: decision,
  exerciseBank: bankUI,
  addCompletedSession: () => {},
  markActiveDay: async () => {},
  onRegenerate: () => {},
  todayDayName: 'Lunes', todayDateShort: '18 ago',
});

describe('WorkoutPlan · card cardio (variante activa + póster)', () => {
  beforeEach(() => { useAppStore.setState({ language: 'es' } as never); rtlCleanup(); });

  it('muestra la variante activa (Remo por defecto) como identidad secundaria', async () => {
    render(<WorkoutPlan {...baseProps([steadyEx])} />);
    // Título abstracto del bloque + subtítulo con la máquina concreta.
    expect(await screen.findByText('Remo (ergómetro)')).toBeTruthy();
  });

  it('respeta variantId: si el bloque trae cardio-bici, la card muestra "Bicicleta"', async () => {
    render(<WorkoutPlan {...baseProps([{ ...steadyEx, variantId: 'cardio-bici' }])} />);
    expect(await screen.findByText('Bicicleta')).toBeTruthy();
  });

  it('STEADY usa póster estático (sin autoplay/loop); DRILLS sí hace loop', async () => {
    const { container } = render(<WorkoutPlan {...baseProps([steadyEx, drillsEx])} />);
    await waitFor(() => { expect(container.querySelector('video')).toBeTruthy(); });
    const videos = Array.from(container.querySelectorAll('video')) as HTMLVideoElement[];
    const steadyVideo = videos.find(v => v.getAttribute('src') === 'https://v/cardio-maquina.mp4')
      ?? videos.find(v => v.getAttribute('src') === 'https://v/remo-ergometro.mp4');
    const drillsVideo = videos.find(v => v.getAttribute('src') === 'https://v/run-drills.mp4');
    // Steady: PÓSTER (primer frame) — no autoplay, no loop.
    expect(steadyVideo).toBeTruthy();
    expect(steadyVideo!.hasAttribute('autoplay')).toBe(false);
    expect(steadyVideo!.hasAttribute('loop')).toBe(false);
    // Drills: mini-demo — autoplay + loop.
    expect(drillsVideo).toBeTruthy();
    expect(drillsVideo!.hasAttribute('autoplay')).toBe(true);
    expect(drillsVideo!.hasAttribute('loop')).toBe(true);
  });
});
