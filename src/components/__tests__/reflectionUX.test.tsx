import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// REFLECTION-UX-1 · P0 · pruebas de presentación/orquestación del flujo de
// reflexión (TuEspacioFlow). NO prueban la inteligencia (eso vive en
// reflectionSafety.test.tsx y en los tests de motor); prueban los estados de
// llegada, el bifurcador opcional, el retorno del mismo día, Free/Pro, la
// invariante de seguridad URGENT (sin IA) y la accesibilidad.
// ═══════════════════════════════════════════════════════════════════════════

// Capturamos la IA (reseña / 5ª pregunta). Por defecto responde texto.
const callAI = vi.fn(async (..._args: unknown[]): Promise<{ content: Array<{ text: string }> }> => ({ content: [{ text: 'reseña IA generada' }] }));
vi.mock('../../utils/aiProxy', () => ({ callAI: (...a: unknown[]) => callAI(...a) }));
vi.mock('../../utils/hsmOutbox', () => ({ enqueueReflection: () => {}, flushHSMOutbox: async () => {}, dequeueReflection: () => {} }));
vi.mock('../../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'upsert', 'insert', 'update', 'delete', 'single', 'maybeSingle']) chain[m] = () => chain;
  chain.then = (res: (v: { data: null; error: null }) => unknown) => Promise.resolve({ data: null, error: null }).then(res);
  return { supabase: { auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) }, from: () => chain } };
});

import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { useAppStore } from '../../store';
import { dayKey } from '../../utils/localDate';
import TuEspacioFlow from '../TuEspacioFlow';
import cssSrc from '../../index.css?raw';
import flowSrc from '../TuEspacioFlow.tsx?raw';

const today = dayKey(new Date());
const daysAgo = (n: number) => dayKey(new Date(Date.now() - n * 86400000));

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = vi.fn();

// Snapshot mínimo del store; los tests sobreescriben dailyHSMResponses/subscription.
function seed(over: Record<string, unknown> = {}) {
  useAppStore.setState({
    user: { id: 'u1' } as never,
    subscriptionStatus: 'none' as never,   // Free por defecto (reseña base, sin IA)
    userName: 'Dae',
    startDate: daysAgo(12), streakCount: 3,
    dailyHSMResponses: [] as never,
    hsmProfile: null as never,
    hsmDailyReview: null as never,
    ...over,
  });
}

beforeEach(() => { callAI.mockClear(); seed(); });
afterEach(() => cleanup());

// ── A · ARRIVAL ───────────────────────────────────────────────────────────────
describe('A · llegada (arrival) diferenciada', () => {
  it('primera vez (0 reflexiones) → intro filosófica, no la llegada diaria', () => {
    seed({ dailyHSMResponses: [] });
    render(<TuEspacioFlow onClose={() => {}} />);
    expect(screen.getByText(/te conoces mejor/i)).toBeTruthy();     // introTitle refinado
    expect(screen.queryByText('Tu espacio de hoy')).toBeNull();     // arrivalTitle NO
    expect(screen.getByText('TU ESPACIO')).toBeTruthy();            // eyebrow
    expect(screen.queryByRole('textbox')).toBeNull();               // aún no hay pregunta
  });

  it('retorno (con historial, nada hoy) → llegada diaria rápida, no la filosofía', () => {
    seed({ dailyHSMResponses: [{ date: daysAgo(2), dimension: 'Metas', question: 'q', response: 'ayer escribí', dimensionId: 'goals', questionKey: 'goals#0' }] as never });
    render(<TuEspacioFlow onClose={() => {}} />);
    expect(screen.getByText('Tu espacio de hoy')).toBeTruthy();     // arrivalTitle
    expect(screen.queryByText(/te conoces mejor/i)).toBeNull();     // introTitle NO
    expect(screen.queryByRole('textbox')).toBeNull();               // llegada, no pregunta directa
  });

  it('ya completó hoy → espejo/reseña, no llegada ni pregunta', () => {
    seed({ hsmDailyReview: { date: today, text: 'tu reseña', source: 'base' } as never });
    render(<TuEspacioFlow onClose={() => {}} />);
    expect(screen.getByText('Listo por hoy.')).toBeTruthy();        // completion
    expect(screen.queryByText('TU ESPACIO')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

// ── B · PREGUNTA ESENCIAL ──────────────────────────────────────────────────────
describe('B · pantalla de pregunta', () => {
  it('tras entrar: pregunta con textarea nombrado, cierre=button, sin "N/5"', () => {
    render(<TuEspacioFlow onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));
    // textarea con nombre accesible (label sr-only)
    expect(screen.getByRole('textbox', { name: /tu reflexión/i })).toBeTruthy();
    // cierre es un <button> con nombre
    expect(screen.getByRole('button', { name: /cerrar|close/i })).toBeTruthy();
    // progreso honesto, no "1/5"
    expect(screen.queryByText(/\d\s*\/\s*\d/)).toBeNull();
    expect(screen.getByText('Tu reflexión de hoy')).toBeTruthy();
    // la esencial se marca como esencial
    expect(screen.getByText('Esencial de hoy')).toBeTruthy();
  });
});

// ── C · BIFURCADOR OPCIONAL ────────────────────────────────────────────────────
describe('C · bifurcador tras la esencial', () => {
  async function answerMandatory() {
    render(<TuEspacioFlow onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));
    const ta = await screen.findByRole('textbox', { name: /tu reflexión/i });
    fireEvent.change(ta, { target: { value: 'hoy avancé un poco' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente|completar/i }));
    await screen.findByText('Ya cumpliste por hoy.');
  }

  it('no auto-cae en la opcional: aparece el bifurcador "Ya cumpliste por hoy."', async () => {
    await answerMandatory();
    expect(screen.getByText('Ya cumpliste por hoy.')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();               // NO salta a otra pregunta
    expect(screen.getByRole('button', { name: /ver mi reflexión/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /seguir profundizando/i })).toBeTruthy();
  });

  it('"Ver mi reflexión" → reseña/completion', async () => {
    await answerMandatory();
    fireEvent.click(screen.getByRole('button', { name: /ver mi reflexión/i }));
    await waitFor(() => expect(screen.getByText('Listo por hoy.')).toBeTruthy());
  });

  it('"Seguir profundizando" → pregunta opcional (etiqueta veraz)', async () => {
    await answerMandatory();
    fireEvent.click(screen.getByRole('button', { name: /seguir profundizando/i }));
    const ta = await screen.findByRole('textbox', { name: /tu reflexión/i });
    expect(ta).toBeTruthy();
    expect(screen.getByText('Opcional')).toBeTruthy();              // ya no es "Esencial"
    expect(screen.queryByText('Esencial de hoy')).toBeNull();
  });
});

// ── D · RETORNO EL MISMO DÍA (sin reinicio ni duplicado) ───────────────────────
describe('D · retorno el mismo día', () => {
  it('reabrir tras completar: espejo + "Seguir profundizando"; opcional sin reiniciar la esencial; 1 sola escritura', async () => {
    const realAdd = useAppStore.getState().addHSMResponse;
    const addSpy = vi.fn(realAdd);
    useAppStore.setState({ addHSMResponse: addSpy as never });

    // Sesión 1: entrar, responder esencial, ver reflexión (Free → base instantánea).
    const { unmount } = render(<TuEspacioFlow onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));
    const ta = await screen.findByRole('textbox', { name: /tu reflexión/i });
    fireEvent.change(ta, { target: { value: 'lo esencial de hoy' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente|completar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ver mi reflexión/i }));
    await screen.findByText('Listo por hoy.');
    unmount();

    // Sesión 2 (mismo día): reabrir → completion directo, con re-entrada opcional.
    render(<TuEspacioFlow onClose={() => {}} />);
    expect(screen.getByText('Listo por hoy.')).toBeTruthy();
    expect(screen.queryByText('TU ESPACIO')).toBeNull();            // no re-onboarding
    const cont = screen.getByRole('button', { name: /seguir profundizando/i });
    fireEvent.click(cont);
    const ta2 = await screen.findByRole('textbox', { name: /tu reflexión/i });
    expect(ta2).toBeTruthy();
    expect(screen.getByText('Opcional')).toBeTruthy();              // esencial NO reiniciada
    // La esencial se escribió exactamente una vez (sin duplicado al reabrir).
    expect(addSpy).toHaveBeenCalledTimes(1);
  });
});

// ── E · FREE / PRO ──────────────────────────────────────────────────────────────
describe('E · Free vs Pro (presentación)', () => {
  it('Free → reseña base determinista, válida como completion, SIN llamar a IA', async () => {
    seed({ subscriptionStatus: 'none' });
    render(<TuEspacioFlow onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));
    const ta = await screen.findByRole('textbox', { name: /tu reflexión/i });
    fireEvent.change(ta, { target: { value: 'algo honesto' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente|completar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ver mi reflexión/i }));
    await screen.findByText('Listo por hoy.');
    expect(screen.getByText('Lo que veo en ti')).toBeTruthy();      // etiqueta espejo
    expect(callAI).not.toHaveBeenCalled();                          // Free no gasta IA
  });

  it('Pro → si la IA falla, cae a la reseña base (nunca pantalla vacía)', async () => {
    seed({ subscriptionStatus: 'active' });
    callAI.mockRejectedValueOnce(new Error('AI down'));
    render(<TuEspacioFlow onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));
    const ta = await screen.findByRole('textbox', { name: /tu reflexión/i });
    fireEvent.change(ta, { target: { value: 'reflexión pro' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente|completar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ver mi reflexión/i }));
    await waitFor(() => expect(screen.getByText('Lo que veo en ti')).toBeTruthy(), { timeout: 3000 });
    // Reseña presente (texto base rotativo), no vacía.
    expect(screen.getByText('Lo que veo en ti').parentElement?.querySelector('.te-review-text')?.textContent).toBeTruthy();
  });
});

// ── F · SEGURIDAD URGENT (invariante dura) ─────────────────────────────────────
describe('F · URGENT no llama a IA y muestra el panel de apoyo', () => {
  it('con una respuesta URGENT de hoy, el completado corta la IA y muestra role="alert"', async () => {
    // Semilla: una respuesta URGENT de hoy con dimensión "fuera de banco" → NO cuenta
    // como dimensión respondida (la esencial se responde normal), PERO sí vive en
    // todayResponses → el efecto de completado detecta URGENT → ruta segura sin IA.
    seed({
      subscriptionStatus: 'active',   // Pro: probamos que ni Pro llama a IA en URGENT
      dailyHSMResponses: [{ date: today, dimension: '__SEED_URGENT__', question: 'q', response: 'texto sensible', questionKey: 'seed#0', safetyLevel: 'URGENT' }] as never,
    });
    // Ya hay una respuesta hoy (la semilla URGENT) → sin pantalla de llegada:
    // el flujo entra directo a la pregunta esencial.
    render(<TuEspacioFlow onClose={() => {}} />);
    const ta = await screen.findByRole('textbox', { name: /tu reflexión/i });
    fireEvent.change(ta, { target: { value: 'respuesta normal a la esencial' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente|completar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ver mi reflexión/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByText('Estamos contigo')).toBeTruthy();       // panel de apoyo
    expect(callAI).not.toHaveBeenCalled();                          // ninguna llamada a IA
  });
});

// ── H · CONTRATO RESPONSIVE (source/CSS scan) ──────────────────────────────────
describe('H · contrato responsive (columna-ritual, sin CTA a ancho de viewport)', () => {
  it('existe --te-col ≤ 560px y la columna-ritual la usa', () => {
    const m = cssSrc.match(/--te-col:\s*([\d.]+)rem/);
    expect(m).toBeTruthy();
    expect(parseFloat(m![1]) * 16).toBeLessThanOrEqual(560);       // 34rem = 544px
    expect(cssSrc).toMatch(/\.te-ritual\s*\{[^}]*max-width:\s*var\(--te-col\)/s);
    expect(cssSrc).toMatch(/\.te-question-area\s*\{[^}]*max-width:\s*var\(--te-col\)/s);
    expect(cssSrc).toMatch(/\.te-complete\s*\{[^}]*max-width:\s*var\(--te-col\)/s);
  });
  it('el CTA llena la columna, no el viewport; y el bug viejo de .te-intro full-width no existe', () => {
    expect(cssSrc).toMatch(/\.te-submit\s*\{[^}]*width:\s*100%/s);  // 100% del contenedor capado
    // El bug original: .te-intro sin max-width + justify-content:center. Ya no se renderiza.
    expect(flowSrc).not.toMatch(/te-intro/);
  });
  it('viewport dinámico + safe-area presentes (teclado móvil)', () => {
    expect(cssSrc).toMatch(/100dvh/);
    expect(cssSrc).toMatch(/env\(safe-area-inset-bottom/);
  });
  it('la pregunta usa serif de sistema (sin import de fuente externa)', () => {
    expect(cssSrc).toMatch(/\.te-question\s*\{[^}]*font-family:\s*Georgia/s);
    expect(cssSrc).not.toMatch(/@font-face[^}]*serif/i);
  });
});

// ── G · ACCESIBILIDAD ──────────────────────────────────────────────────────────
describe('G · accesibilidad', () => {
  it('overlay = dialog modal; hay heading; Escape cierra; cierre es button', async () => {
    const onClose = vi.fn();
    render(<TuEspacioFlow onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));
    // dialog + aria-modal
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    // heading presente (la pregunta es <h2>)
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    // cierre accesible por teclado (es <button>)
    expect(screen.getByRole('button', { name: /cerrar|close/i }).tagName).toBe('BUTTON');
    // Escape cierra
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(onClose).toHaveBeenCalled();
  });
});
