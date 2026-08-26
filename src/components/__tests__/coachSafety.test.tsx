import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// COACH-SAFETY-1 · el chat del Coach aplica el clasificador de crisis del HSM.
// URGENT → corte local: 0 llamadas al modelo, texto no persistido; panel de apoyo.
// CONCERNING → el modelo responde, con reflejo de apoyo no-diagnóstico en el prompt.
// NORMAL → flujo intacto. El prompt SIEMPRE lleva el límite clínico/no-diagnóstico/ED.
// ═══════════════════════════════════════════════════════════════════════════

// Mock del proxy de IA: capturamos toda llamada (para probar el invariante 0-llamadas).
const callAIStream = vi.fn(async (..._args: unknown[]): Promise<string> => 'respuesta del coach');
vi.mock('../../utils/aiProxy', () => ({
  callAIStream: (...a: unknown[]) => callAIStream(...a),
  AIProxyError: class extends Error {},
}));
// Supabase no debe tocarse en este test (sheets/aiProxy lo importan).
vi.mock('../../lib/supabase', () => ({ supabase: { auth: {}, from: () => ({}) } }));

import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { buildCoachSystemPrompt } from '../../ai/prompts/coach';
import { classifySafety } from '../../utils/hsmSafety';
import { useAppStore } from '../../store';
import TabCoach from '../TabCoach';

const state = () => useAppStore.getState();

// jsdom no implementa scrollIntoView (el efecto de auto-scroll del chat lo usa).
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  callAIStream.mockClear();
  useAppStore.setState({
    user: { id: 'u1' } as never,
    coachChatHistory: [],
    coachChatDate: '',
    coachPrefilledMessage: null,
  });
});
afterEach(() => cleanup());

// ── §7/§9/§12J · el prompt SIEMPRE trae el límite clínico + ED ────────────────
describe('buildCoachSystemPrompt · límites de seguridad', () => {
  it('J · NORMAL: incluye no-clínico + no-diagnóstico + límite ED; sin reflejo CONCERNING', () => {
    const p = buildCoachSystemPrompt(state(), 'es', 'NORMAL');
    expect(p).toMatch(/no eres psic[oó]logo/i);
    expect(p).toMatch(/nunca diagnostiques/i);
    expect(p).toMatch(/restricci[oó]n extrema/i);          // límite ED
    expect(p).not.toMatch(/sugiere posible malestar/i);    // reflejo CONCERNING ausente
  });
  it('E · CONCERNING: añade el reflejo de apoyo no-diagnóstico', () => {
    const p = buildCoachSystemPrompt(state(), 'es', 'CONCERNING');
    expect(p).toMatch(/sugiere posible malestar/i);
    expect(p).toMatch(/nunca diagnostiques/i);             // el límite base sigue
  });
  it('el límite existe también en inglés (locale en)', () => {
    const p = buildCoachSystemPrompt(state(), 'en', 'NORMAL');
    expect(p).toMatch(/no eres psic[oó]logo/i);            // el bloque de seguridad es ES fijo, siempre presente
  });
});

// ── §12 A/B/C/F/G/H · clasificación de los escenarios del Coach ───────────────
describe('classifySafety · escenarios del Coach', () => {
  it('B/C · autolesión/suicidio explícito → URGENT', () => {
    for (const m of ['quiero matarme', 'me quiero suicidar', 'voy a hacerme daño', 'i want to kill myself'])
      expect(classifySafety(m)).toBe('URGENT');
  });
  it('F/G · relación / motivación / disciplina / frustración → NORMAL (no bloquear)', () => {
    for (const m of [
      'Me cuesta ser disciplinado.',
      'Estoy peleando mucho con mi pareja.',
      'No sé qué quiero hacer con mi vida.',
      'Hoy no tengo motivación.',
      'Estoy frustrado porque no bajé de peso.',
      'Quiero organizar mejor mis hábitos.',
    ]) expect(classifySafety(m)).toBe('NORMAL');
  });
  it('H · "creo que tengo depresión" → NO es URGENT (no diagnóstico forzado; sigue el flujo)', () => {
    expect(classifySafety('creo que tengo depresión')).not.toBe('URGENT');
  });
});

// ── §12 A/B/D · integración del gate en el envío ─────────────────────────────
describe('TabCoach · gate de crisis en send()', () => {
  const typeAndSend = (text: string) => {
    const input = screen.getByPlaceholderText(/./) as HTMLInputElement;
    fireEvent.change(input, { target: { value: text } });
    // el botón de envío es el único habilitado con texto
    const btn = document.querySelector('.tc-send') as HTMLButtonElement;
    fireEvent.click(btn);
  };

  it('B · URGENT: CERO llamadas al modelo, texto NO persistido, panel de apoyo visible', async () => {
    render(<TabCoach />);
    typeAndSend('quiero matarme');
    // panel de apoyo (copy del journal reutilizado)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(callAIStream).not.toHaveBeenCalled();                 // AI_PROXY_CALLS = 0
    expect(state().coachChatHistory).toHaveLength(0);            // texto urgente NO guardado
    // D · como no se guardó, jamás puede re-entrar al contexto de IA en turnos futuros
    expect(JSON.stringify(state().coachChatHistory)).not.toContain('matarme');
  });

  it('A · NORMAL: llama al modelo y persiste el mensaje del usuario', async () => {
    render(<TabCoach />);
    typeAndSend('Me cuesta ser disciplinado.');
    await waitFor(() => expect(callAIStream).toHaveBeenCalledTimes(1));
    expect(state().coachChatHistory.some(m => m.role === 'user')).toBe(true);
  });

  it('E · CONCERNING: llama al modelo con el reflejo de apoyo en el system prompt', async () => {
    render(<TabCoach />);
    typeAndSend('quiero desaparecer');                            // patrón CONCERNING
    await waitFor(() => expect(callAIStream).toHaveBeenCalledTimes(1));
    const req = callAIStream.mock.calls[0][0] as { system: string };
    expect(req.system).toMatch(/sugiere posible malestar/i);     // reflejo inyectado
  });
});
