import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';

// ═══════════════════════════════════════════════════════════════════════════
// TEST DE INTEGRACIÓN · RUTA DE RENDER REAL (no helpers sueltos).
//
// Por qué existe: el harness previo probaba los helpers de display en aislamiento y
// estaba VERDE, pero la pantalla real seguía rota (captura: "4 ejercicios / 25 min /
// Saltos Básicos ×3 / video en el steady de 51 min"). Ese incidente fue DEPLOY (la app
// corría un commit sin el fix), NO un bug de código — pero un test que atraviese el
// componente REAL (WorkoutPlan) blinda el contrato de render y cubre el hueco de robustez
// ante objetos legacy/cache (cardioMainBlock presente, ex.cardio ausente).
//
// El objeto que llega a WorkoutPlan se construye por la MISMA ruta que handleGenerate:
// cardioBlocksToExercises(CardioMainPlan) + cardioMainBlock sellado. El render atraviesa
// el componente WorkoutPlan de verdad (RTL), no una llamada directa a los helpers.
// ═══════════════════════════════════════════════════════════════════════════

// Mock de supabase: el fetch de videos de WorkoutPlan devuelve un clip por estación → así
// podemos verificar que el STEADY largo (51 min) usa PÓSTER estático (sin autoplay/loop), no un
// clip de saltos en loop (fix C1: identidad de la actividad sin el clip engañoso).
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

import WorkoutPlan from '../WorkoutPlan';
import { cardioBlocksToExercises } from '../../../utils/cardioMain';
import { useAppStore } from '../../../store';
import type { Exercise, WorkoutDayDecision, Equipment, Modality } from '../../../types';

// CardioMainPlan que reproduce la estructura EXACTA de la captura (funcional/explosividad):
// burpee (intervals) + saltos steady 7' + saltos intervals + saltos steady 51'.
const cardioPlan = {
  style: 'funcional',
  budgetMinutes: 75, totalMinutes: 75, intenseMinutes: 16, steadyMinutes: 58,
  earlyEnd: false, earlyEndReason: '',
  blocks: [
    { kind: 'intervals', minutes: 12, stationId: 'burpee', stationName: 'Burpee / Sprawl', intensity: 'alta', labelKey: 'cardio.intervals', zone: undefined, rpe: 8, workSec: 40, restSec: 20, rounds: 12, cue: '' },
    { kind: 'steady', minutes: 7, stationId: 'marcha', stationName: 'Marcha en el Lugar', intensity: 'media', labelKey: 'cardio.steady', zone: 'Zona 2', rpe: 5, workSec: undefined, restSec: undefined, rounds: undefined, cue: '' },
    { kind: 'intervals', minutes: 12, stationId: 'saltos', stationName: 'Saltos Básicos', intensity: 'alta', labelKey: 'cardio.intervals', zone: undefined, rpe: 8, workSec: 40, restSec: 20, rounds: 12, cue: '' },
    { kind: 'steady', minutes: 51, stationId: 'marcha', stationName: 'Marcha en el Lugar', intensity: 'media', labelKey: 'cardio.steady', zone: 'Zona 2', rpe: 5, workSec: undefined, restSec: undefined, rounds: undefined, cue: '' },
  ],
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// cardioMainBlock sellado EXACTAMENTE como DailyTrainer al guardar (incluye style + blocks).
const cardioMainBlock = {
  style: cardioPlan.style, totalMinutes: cardioPlan.totalMinutes, intenseMinutes: cardioPlan.intenseMinutes,
  earlyEnd: false, earlyEndReason: '',
  blocks: cardioPlan.blocks.map((b: Record<string, unknown>) => ({
    kind: b.kind, minutes: b.minutes, stationId: b.stationId, stationName: b.stationName,
    intensity: b.intensity, labelKey: b.labelKey, zone: b.zone, rpe: b.rpe,
    workSec: b.workSec, restSec: b.restSec, rounds: b.rounds, cue: b.cue,
  })),
};

// Banco: las estaciones técnicas existen con su nombre humano — así, si el render CAYERA al
// stationId (bug), veríamos "Saltos Básicos" (la regresión que reproducimos abajo).
const bank = [
  { id: 'burpee', name: 'Burpee / Sprawl', desc: '', muscleGroup: 'cardio', equipment: ['gym'], goals: ['resistencia'], type: 'compuesto', difficulty: 'intermedio', defaultSets: 3, defaultReps: '10', defaultRest: 30, steps: [] },
  { id: 'saltos', name: 'Saltos Básicos', desc: '', muscleGroup: 'cardio', equipment: ['gym'], goals: ['resistencia'], type: 'compuesto', difficulty: 'intermedio', defaultSets: 3, defaultReps: '10', defaultRest: 30, steps: [] },
  // Estación continua REALISTA (marcha) — su identidad accionable es la ACTIVIDAD, no una variante-posición.
  { id: 'marcha', name: 'Marcha en el Lugar', desc: '', muscleGroup: 'cardio', cardioStyle: 'lowImpact', equipment: ['cuerpo'], goals: ['resistencia'], type: 'compuesto', difficulty: 'principiante', defaultSets: 1, defaultReps: '10 min', defaultRest: 0, steps: [] },
] as unknown as Exercise[];

const decision: WorkoutDayDecision = { type: 'cardio', reason: '', source: 'auto' } as unknown as WorkoutDayDecision;

const baseProps = (exercises: unknown[], mainBlock: unknown) => ({
  plan: { type: 'cardio', intensity: 'media', exercises, cardioMainBlock: mainBlock } as never,
  regenBlocked: false, regensLeft: 3,
  selectedEquipment: 'gym' as Equipment,
  selectedModality: 'cardio' as Modality,
  selectedTime: 75,
  todayDecision: decision,
  exerciseBank: bank,
  addCompletedSession: () => {},
  markActiveDay: async () => {},
  onRegenerate: () => {},
  todayDayName: 'Lunes', todayDateShort: '17 ago',
});

beforeEach(() => {
  useAppStore.setState({ language: 'es' } as never);
  cleanup();
});

describe('WorkoutPlan · render REAL de cardio dedicado (ruta de la pantalla)', () => {
  it('rutina NUEVA (ex.cardio sellado): bloques, duración real, identidad por actividad, steady sin video', async () => {
    const exercises = cardioBlocksToExercises(cardioPlan); // MISMA construcción que handleGenerate
    render(<WorkoutPlan {...baseProps(exercises, cardioMainBlock)} />);

    // (5) NUNCA "25 min": la duración sale de cardioMainBlock.totalMinutes (75), no del estimador de fuerza.
    expect(screen.getByText(/75 min/i)).toBeInTheDocument();
    expect(screen.queryByText(/^25 min/i)).not.toBeInTheDocument();

    // (4) el CHIP del header dice "bloques", no "ejercicios" (el label de progreso es otra cadena).
    const metaChip = document.querySelector('.dt2-plan-meta') as HTMLElement;
    expect(within(metaChip).getByText(/4 bloques/i)).toBeInTheDocument();
    expect(within(metaChip).queryByText(/4 ejercicios/i)).not.toBeInTheDocument();

    // (6) identidad = ACTIVIDAD, nunca el stationId técnico repetido.
    expect(screen.queryByText('Saltos Básicos')).not.toBeInTheDocument();
    expect(screen.queryByText('Burpee / Sprawl')).not.toBeInTheDocument();
    // identidad = actividad: steady funcional → "Trabajo sostenible"; intervals → "Circuito funcional".
    expect(screen.getAllByText('Trabajo sostenible').length).toBe(2);   // los dos steady
    expect(screen.getAllByText('Circuito funcional').length).toBe(2);   // los dos intervals

    // (7) el steady de 51 min conserva su duración legible.
    expect(screen.getByText(/51 min/i)).toBeInTheDocument();

    // Fix C1: intervals hacen mini-demo (autoplay+loop); steady muestra PÓSTER estático
    // (video presente pero SIN autoplay/loop) → identidad de la actividad sin el clip engañoso.
    const cards = document.querySelectorAll('.dt2-ex');
    expect(cards.length).toBe(4);
    await waitFor(() => {
      expect(cards[0].querySelector('video')).toBeTruthy();
    });
    const iv = cards[0].querySelector('video') as HTMLVideoElement; // intervals → demo
    expect(iv.hasAttribute('autoplay')).toBe(true);
    expect(iv.hasAttribute('loop')).toBe(true);
    const steady = cards[3].querySelector('video') as HTMLVideoElement; // steady 51' → póster estático
    expect(steady).toBeTruthy();
    expect(steady.hasAttribute('autoplay')).toBe(false); // NUNCA loop de saltos 51 min
    expect(steady.hasAttribute('loop')).toBe(false);
  });

  it('rutina LEGACY/CACHE (ex.cardio ausente, cardioMainBlock presente): se DERIVA la identidad → sigue correcto', async () => {
    // Simula el objeto que produce una versión previa (o una entrada de workout_cache vieja):
    // ejercicios SIN metadata sellada, pero cardioMainBlock con los bloques persistidos.
    const legacyExercises = cardioBlocksToExercises(cardioPlan).map(({ cardio: _c, ...rest }) => rest);
    render(<WorkoutPlan {...baseProps(legacyExercises, cardioMainBlock)} />);

    expect(screen.getByText(/4 bloques/i)).toBeInTheDocument();
    expect(screen.getByText(/75 min/i)).toBeInTheDocument();
    // La derivación desde cardioMainBlock.blocks evita el fallback al stationId.
    expect(screen.queryByText('Saltos Básicos')).not.toBeInTheDocument();
    const cards = document.querySelectorAll('.dt2-ex');
    await waitFor(() => { expect(cards[3].querySelector('video')).toBeTruthy(); });
    const steady = cards[3].querySelector('video') as HTMLVideoElement; // steady 51' → póster estático (legacy)
    expect(steady.hasAttribute('autoplay')).toBe(false);
    expect(steady.hasAttribute('loop')).toBe(false);
  });

  it('REGRESIÓN (guard): objeto SIN metadata NI blocks reproduce la pantalla rota (contrato negativo)', async () => {
    // Sin ex.cardio y sin cardioMainBlock.blocks el render NO puede derivar identidad: cae al
    // stationId. Esto documenta el fallo original y garantiza que el fix depende de esa metadata.
    const naked = cardioBlocksToExercises(cardioPlan).map(({ cardio: _c, ...rest }) => rest);
    const mainNoBlocks = { ...cardioMainBlock, blocks: undefined };
    render(<WorkoutPlan {...baseProps(naked, mainNoBlocks)} />);
    // Sin blocks, sí reaparece el stationId — exactamente el bug de la captura.
    expect(screen.getAllByText('Saltos Básicos').length).toBeGreaterThan(0);
  });
});
