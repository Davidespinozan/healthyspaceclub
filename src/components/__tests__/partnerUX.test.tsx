import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// PARTNER-UX-1 · P0 · pruebas de presentación state-driven de CompanerosScreen.
// NO prueban autoridad (partners.ts/RPC/realtime) — la mockeamos. Prueban la
// jerarquía por estado (cero / conectado / solicitudes), campos seguros, la
// distinción invitar(referral)≠conectar(partner), y accesibilidad.
// ═══════════════════════════════════════════════════════════════════════════

const h = vi.hoisted(() => ({ shareProps: null as unknown }));

vi.mock('../../utils/analytics', () => ({ track: () => {} }));
vi.mock('../../utils/partners', () => ({
  searchUsers: vi.fn(async () => []),
  sendInvite: vi.fn(async () => 'sent'),
  respondInvite: vi.fn(async () => 'accepted'),
  listPartnerships: vi.fn(async () => []),
  getPartnerTrainingProfile: vi.fn(async () => null),
  countSessionsWith: vi.fn(async () => 0),
  removePartnership: vi.fn(async () => true),
  getPartnerTodayStatus: vi.fn(async () => null),
}));
vi.mock('../../utils/referral', () => ({
  inviteLink: vi.fn((u: string) => `https://hsc.test/u/${u}?ref=${u}`),
  getMyReferrer: vi.fn(async () => null),
}));
vi.mock('../ShareStudio', () => ({ default: (p: unknown) => { h.shareProps = p; return null; } }));
vi.mock('../UsernameSetupSheet', () => ({ default: () => null }));
vi.mock('../../lib/supabase', () => {
  const chan: Record<string, () => unknown> = {};
  chan.on = () => chan; chan.subscribe = () => chan;
  return { supabase: { channel: () => chan, removeChannel: () => {} } };
});

import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useAppStore } from '../../store';
import { dayKey } from '../../utils/localDate';
import * as partners from '../../utils/partners';
import CompanerosScreen from '../CompanerosScreen';
import cssSrc from '../companeros.css?raw';
import compSrc from '../CompanerosScreen.tsx?raw';

const today = dayKey(new Date());
const P = partners as unknown as Record<string, ReturnType<typeof vi.fn>>;

function accepted(over: Partial<partners.Partnership> = {}): partners.Partnership {
  return { partnership_id: 'pa1', other_id: 'o1', other_username: 'magaly', other_name: 'Magaly Ruiz', other_avatar: null, other_streak: 4, status: 'accepted', direction: 'outgoing', created_at: '', ...over };
}
function incoming(over: Partial<partners.Partnership> = {}): partners.Partnership {
  return { partnership_id: 'pi1', other_id: 'i1', other_username: 'pedro', other_name: 'Pedro', other_avatar: null, other_streak: 2, status: 'pending', direction: 'incoming', created_at: '', ...over };
}

beforeEach(() => {
  h.shareProps = null;
  for (const k of Object.keys(P)) P[k].mockClear?.();
  P.searchUsers.mockResolvedValue([]);
  P.sendInvite.mockResolvedValue('sent');
  P.respondInvite.mockResolvedValue('accepted');
  P.listPartnerships.mockResolvedValue([]);
  P.countSessionsWith.mockResolvedValue(0);
  P.removePartnership.mockResolvedValue(true);
  P.getPartnerTodayStatus.mockResolvedValue(null);
  useAppStore.setState({
    user: { id: 'u1' } as never,
    username: 'me' as never,
    lastActiveDate: '2000-01-01' as never,   // no entrené hoy (por defecto)
    streakCount: 5 as never,
  });
});
afterEach(() => cleanup());

// ── A · ZERO (IA corregida: BUSCAR primario visible, invitar secundario) ──────
describe('A · estado cero — buscar primario, invitar secundario', () => {
  it('el buscador es visible de inmediato (sin toggle); invitar externo es secundario', async () => {
    render(<CompanerosScreen />);
    // Título primario "¿Con quién quieres entrenar?"
    expect(await screen.findByText('¿Con quién quieres entrenar?')).toBeTruthy();
    // El textbox de búsqueda está visible YA (primario, sin revelar).
    expect(screen.getByRole('textbox', { name: /buscar personas en healthy space/i })).toBeTruthy();
    // Invitar externo (Referral) presente pero SECUNDARIO (link "Invítalo a unirse").
    expect(screen.getByText('¿Todavía no está en Healthy Space?')).toBeTruthy();
    expect(screen.getByRole('button', { name: /invítalo a unirse/i })).toBeTruthy();
    // Preview de modos y sin caja dashed vieja.
    expect(screen.getByText('Juntos, en vivo')).toBeTruthy();
    expect(screen.queryByText('Todo es mejor con alguien al lado')).toBeNull();
  });

  it('el título del estado cero NO es "Tus compañeros"', async () => {
    render(<CompanerosScreen />);
    await screen.findByText('¿Con quién quieres entrenar?');
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/tus compañeros/i);
  });

  // TEST 3 · orden IA: el buscador aparece ANTES que la invitación externa en el DOM.
  it('el buscador precede a la invitación externa en el DOM', async () => {
    const { container } = render(<CompanerosScreen />);
    await screen.findByText('¿Con quién quieres entrenar?');
    const input = screen.getByRole('textbox', { name: /buscar personas/i });
    const inviteLink = screen.getByRole('button', { name: /invítalo a unirse/i });
    // compareDocumentPosition: input viene antes que inviteLink.
    expect(input.compareDocumentPosition(inviteLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container).toBeTruthy();
  });
});

// ── TEST 1 · IDENTIDAD DEL INPUT (regresión de foco/remount) ──────────────────
describe('regresión · el input de búsqueda NO se remonta por tecleo', () => {
  it('tras enfocar, teclear "magaly" conserva el MISMO nodo y el foco', async () => {
    render(<CompanerosScreen />);
    const original = await screen.findByRole('textbox', { name: /buscar personas/i }) as HTMLInputElement;
    original.focus();
    expect(document.activeElement).toBe(original);
    // Teclea carácter por carácter (cada change = un re-render de CompanerosScreen).
    for (const value of ['m', 'ma', 'mag', 'maga', 'magal', 'magaly']) {
      fireEvent.change(original, { target: { value } });
    }
    // El textbox actual debe ser EXACTAMENTE el mismo nodo (no remontado)…
    const now = screen.getByRole('textbox', { name: /buscar personas/i });
    expect(now).toBe(original);
    // …con el foco intacto y el valor acumulado.
    expect(document.activeElement).toBe(original);
    expect((now as HTMLInputElement).value).toBe('magaly');
  });
});

// ── B · CONECTADO ─────────────────────────────────────────────────────────────
describe('B · estado conectado (las tarjetas son el héroe)', () => {
  beforeEach(() => {
    P.listPartnerships.mockResolvedValue([accepted()]);
    P.countSessionsWith.mockResolvedValue(3);
    P.getPartnerTodayStatus.mockResolvedValue({ trainedToday: true, streak: 4, duoStreak: 12 });
    useAppStore.setState({ lastActiveDate: today as never });
  });

  it('tarjeta de compañero primaria con campos seguros + acción Entrenar juntos', async () => {
    render(<CompanerosScreen />);
    expect(await screen.findByText('Magaly Ruiz')).toBeTruthy();
    expect(screen.getByRole('button', { name: /crear entrenamiento juntos/i })).toBeTruthy();
    // Racha de dúo visible.
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('días juntos')).toBeTruthy();
    // Estado de hoy en positivo (ya apareció), sin lenguaje de culpa.
    expect(screen.getByText('Ya apareció')).toBeTruthy();
    // Título = "Tus compañeros", NO el hero de cero.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/tus compañeros/i);
    // Adquirir recede a "Añadir compañero".
    expect(screen.getByRole('button', { name: /añadir compañero/i })).toBeTruthy();
  });

  it('múltiples compañeros → todas las tarjetas', async () => {
    P.listPartnerships.mockResolvedValue([accepted(), accepted({ partnership_id: 'pa2', other_id: 'o2', other_username: 'luis', other_name: 'Luis' })]);
    P.getPartnerTodayStatus.mockResolvedValue({ trainedToday: false, streak: 1, duoStreak: 0 });
    render(<CompanerosScreen />);
    expect(await screen.findByText('Magaly Ruiz')).toBeTruthy();
    expect(screen.getByText('Luis')).toBeTruthy();
  });
});

// ── C · DATOS SEGUROS ──────────────────────────────────────────────────────────
describe('C · la tarjeta conectada nunca muestra datos sensibles', () => {
  it('sin pesos/reps/nutrición/salud/email en el render', async () => {
    P.listPartnerships.mockResolvedValue([accepted()]);
    P.countSessionsWith.mockResolvedValue(3);
    P.getPartnerTodayStatus.mockResolvedValue({ trainedToday: true, streak: 9, duoStreak: 12 });
    useAppStore.setState({ lastActiveDate: today as never });
    const { container } = render(<CompanerosScreen />);
    await screen.findByText('Magaly Ruiz');
    const txt = (container.textContent || '').toLowerCase();
    for (const bad of ['kg', 'reps', 'kcal', 'macro', 'readiness', 'injury', 'lesión', 'proteína', 'grasa', 'peso corporal', '@gmail', '.com', 'password']) {
      expect(txt).not.toContain(bad);
    }
  });
});

// ── D · SOLICITUDES ─────────────────────────────────────────────────────────────
describe('D · solicitudes entrantes promovidas', () => {
  it('sección de solicitudes con aceptar/rechazar; aceptar llama al RPC', async () => {
    P.listPartnerships.mockResolvedValue([incoming()]);
    render(<CompanerosScreen />);
    expect(await screen.findByText('Invitaciones')).toBeTruthy();
    expect(screen.getByText('Pedro')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /aceptar/i }));
    await waitFor(() => expect(P.respondInvite).toHaveBeenCalledWith('pi1', true, 'i1'));
  });
});

// ── E · SEARCH ──────────────────────────────────────────────────────────────────
describe('E · búsqueda', () => {
  it('resultado invitable → Conectar (partner authority); no-results; error de invitación visible', async () => {
    P.searchUsers.mockResolvedValue([{ user_id: 'x1', username: 'ana', display_name: 'Ana', avatar_url: null, streak_count: 3 }]);
    render(<CompanerosScreen />);
    // El buscador es primario y visible directamente (sin toggle).
    const input = await screen.findByRole('textbox', { name: /buscar personas/i });
    fireEvent.change(input, { target: { value: 'ana' } });
    const connect = await screen.findByRole('button', { name: /conectar/i });
    // Conectar usa autoridad de PAREJA (sendInvite), no el referral link.
    P.sendInvite.mockResolvedValueOnce('error');
    fireEvent.click(connect);
    await waitFor(() => expect(P.sendInvite).toHaveBeenCalledWith('x1'));
    // Falla → banner de error recuperable (role alert).
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('sin resultados → mensaje noResults', async () => {
    P.searchUsers.mockResolvedValue([]);
    render(<CompanerosScreen />);
    fireEvent.change(await screen.findByRole('textbox', { name: /buscar personas/i }), { target: { value: 'zzz' } });
    expect(await screen.findByText(/nadie encontrado/i)).toBeTruthy();
  });
});

// ── F · INVITAR (referral) ≠ CONECTAR (partner) ────────────────────────────────
describe('F · invitar(referral) ≠ conectar(partner)', () => {
  it('invitar externo NO crea partnership (referral ≠ partner authority)', async () => {
    render(<CompanerosScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /invítalo a unirse/i }));
    // "Invítalo a unirse" es ADQUISICIÓN (referral): jamás llama a la autoridad de
    // pareja (sendInvite). Esa autoridad sólo la usa "Conectar" en la búsqueda (test E).
    await new Promise(r => setTimeout(r, 30));
    expect(P.sendInvite).not.toHaveBeenCalled();
  });

  it('el botón de invitar está cableado al link de referral (inviteLink), no a sendInvite', () => {
    // Prueba de cableado a nivel de fuente: la CTA de invitar usa inviteLink(username).
    expect(compSrc).toMatch(/function doInviteShare[\s\S]*?inviteLink\(username\)/);
    expect(compSrc).toMatch(/onClick=\{doInviteShare\}/);
  });
});

// ── G · DUO / SHARE privacy ────────────────────────────────────────────────────
describe('G · duo streak solo número a ShareStudio', () => {
  it('compartir dúo pasa solo el número, jamás identidad de pareja', async () => {
    P.listPartnerships.mockResolvedValue([accepted()]);
    P.getPartnerTodayStatus.mockResolvedValue({ trainedToday: true, streak: 4, duoStreak: 12 });
    useAppStore.setState({ lastActiveDate: today as never });
    render(<CompanerosScreen />);
    await screen.findByText('Magaly Ruiz');
    fireEvent.click(screen.getByRole('button', { name: /compartir/i }));
    await waitFor(() => expect(h.shareProps).toBeTruthy());
    const props = h.shareProps as { input: { duo?: { days: number } }; preferredKind: string };
    expect(props.preferredKind).toBe('duo');
    expect(props.input.duo?.days).toBe(12);
    const blob = JSON.stringify(props.input).toLowerCase();
    for (const bad of ['magaly', 'ruiz', 'o1', 'username', 'avatar', 'name']) expect(blob).not.toContain(bad);
  });
});

// ── I/J · CONTRATO RESPONSIVE + A11Y (source + DOM) ─────────────────────────────
describe('I/J · contrato responsive + a11y', () => {
  it('workspace ≤900px, 2-col desktop / 1-col móvil, sin caja dashed, CTA no viewport-width', () => {
    expect(cssSrc).toMatch(/\.comp-root\s*\{[^}]*max-width:\s*900px/s);
    expect(cssSrc).toMatch(/\.comp-zero\s*\{[^}]*grid-template-columns:\s*1fr/s);   // móvil = 1 columna
    // desktop 2-col: hay un media query ≥720px que re-columna .comp-zero a 1.05fr
    expect(cssSrc).toMatch(/@media\s*\(min-width:\s*720px\)/);
    expect(cssSrc).toMatch(/\.comp-zero\s*\{\s*grid-template-columns:\s*1\.05fr/);
    expect(cssSrc).not.toMatch(/comp-empty-rich/);                                  // caja dashed eliminada
    expect(cssSrc).not.toMatch(/width:\s*100vw/);                                   // ningún CTA a viewport
    expect(cssSrc).toMatch(/\.comp-cta-primary[^{]*\{[^}]*width:\s*100%/s);         // CTA = ancho de columna
  });

  it('jerarquía de headings (h1 + h2) y previews de modo NO interactivos', async () => {
    P.listPartnerships.mockResolvedValue([accepted()]);
    render(<CompanerosScreen />);
    await screen.findByText('Magaly Ruiz');
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
  });

  it('en cero, los modos son texto (no botones)', async () => {
    render(<CompanerosScreen />);
    await screen.findByText('Juntos, en vivo');
    expect(screen.queryByRole('button', { name: /juntos, en vivo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /a distancia/i })).toBeNull();
  });
});
