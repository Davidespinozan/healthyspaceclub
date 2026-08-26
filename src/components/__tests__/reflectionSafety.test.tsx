import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// REFLECTION-1 · P0 · el histórico de reflexiones que se serializa al modelo
// (daily-review pastSummary) NUNCA debe contener texto de una reflexión URGENT.
// Además prueba CASE 5: sin entreno hoy, el bloque de hechos no dice "descanso".
// ═══════════════════════════════════════════════════════════════════════════

// Capturamos toda llamada al proxy de IA (única en este flujo: la reseña de 800 tokens).
const callAI = vi.fn(async (..._args: unknown[]): Promise<{ content: Array<{ text: string }> }> => ({ content: [{ text: 'reseña generada' }] }));
vi.mock('../../utils/aiProxy', () => ({ callAI: (...a: unknown[]) => callAI(...a) }));
// Aislar de Supabase/outbox: la persistencia no es lo que se prueba aquí.
vi.mock('../../utils/hsmOutbox', () => ({ enqueueReflection: () => {}, flushHSMOutbox: async () => {}, dequeueReflection: () => {} }));
vi.mock('../../lib/supabase', () => {
  // Chain plano y "thenable": cualquier método encadena; await → {data:null,error:null}.
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'upsert', 'insert', 'update', 'delete', 'single', 'maybeSingle']) {
    chain[m] = () => chain;
  }
  chain.then = (res: (v: { data: null; error: null }) => unknown) => Promise.resolve({ data: null, error: null }).then(res);
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
      from: () => chain,
    },
  };
});

import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useAppStore } from '../../store';
import { dayKey } from '../../utils/localDate';
import TuEspacioFlow from '../TuEspacioFlow';

const today = dayKey(new Date());
const daysAgo = (n: number) => dayKey(new Date(Date.now() - n * 86400000));
const SENTINEL = 'URGENT_SENTINEL_DO_NOT_LEAK_7391';
const OB = { sex: 'Hombre', peso: 80, estatura: 180, edad: 30, activity: 'Alta', goal: 'Bajar grasa', trainingGoal: 'hipertrofia' };

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  callAI.mockClear();
  useAppStore.setState({
    user: { id: 'u1' } as never,
    subscriptionStatus: 'active' as never,      // Pro → corre la reseña de IA
    userName: 'Dae', obData: OB as never, startDate: daysAgo(12), streakCount: 4,
    shoppingDay: new Date().getDay(),
    weeklyPlan: { days: [{ day: 1, meals: [] }], selectedDays: [1,2,3,4,5,6,7], mealPlanKey: 'planA', shoppingList: [], preferences: '' } as never,
    mealChecks: {}, mealResolvedByLog: {}, foodLog: [], workoutLog: [],
    completedSessions: [{ sessionId: 's1', date: today, modality: 'fuerza', exerciseIds: ['press-horizontal'], exercises: [{ id: 'press-horizontal', sets: [{ reps: 8, kg: 80 }] }] }] as never,
    // Sin dailyWorkout de HOY (fecha pasada) → CASE 5: "no hay entreno generado hoy".
    dailyWorkout: { date: daysAgo(2), generatedAt: '', plan: { exercises: [] } } as never,
    // Reflexión URGENT de hace 10 días (fuera de la ventana de 7d → no dispara AI-question).
    dailyHSMResponses: [
      { date: daysAgo(10), dimension: 'Metas', question: 'q', response: SENTINEL, dimensionId: 'goals', questionIndex: 0, questionKey: 'goals#0', safetyLevel: 'URGENT' },
    ] as never,
    hsmProfile: null as never, hsmDailyReview: null as never,
  });
});
afterEach(() => cleanup());

describe('REFLECTION-1 · URGENT histórico excluido de la reseña de IA', () => {
  it('CASE 4 · el sentinel URGENT de un día previo NO aparece en el prompt de la reseña', async () => {
    render(<TuEspacioFlow onClose={() => {}} />);

    // Responder la pregunta obligatoria (texto normal, no URGENT).
    const ta = await screen.findByRole('textbox');
    fireEvent.change(ta, { target: { value: 'hoy sí avancé un poco' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente|terminar|listo|completar/i }));

    // Cerrar el día para gatillar la reseña (botón Terminar aparece tras la 1ª).
    await waitFor(() => {
      const fin = screen.queryByRole('button', { name: /terminar/i });
      if (fin) fireEvent.click(fin);
      expect(callAI).toHaveBeenCalled();
    }, { timeout: 3000 });

    const content = String((callAI.mock.calls[0][0] as { messages: Array<{ content: string }> }).messages[0].content);
    // Invariante de seguridad: cero texto crudo URGENT.
    expect(content).not.toContain(SENTINEL);
    // El prompt SÍ es la reseña diaria con hechos de HSC.
    expect(content).toMatch(/HECHOS ACTUALES DE HSC/);
    // CASE 5: sin entreno hoy → no lo llama "día de descanso".
    expect(content).toMatch(/no hay entreno generado hoy/i);
    expect(content).not.toMatch(/día de descanso(?!\))/i);
    // Hecho conductual real presente (1 sesión esta semana).
    expect(content).toMatch(/1 sesi(ó|o)n\(es\) completada/i);
  });
});
