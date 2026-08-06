import { supabase } from '../lib/supabase';

// Captura y atribución de referidos. El link de invitación es
// `${origin}/?ref=<@usuario>`. Al abrir la app con ?ref se guarda; al registrarse
// un usuario NUEVO se atribuye vía RPC (record_referral) y se limpia.

const KEY = 'hsc_ref';

/** Lee ?ref= de la URL, lo guarda y limpia la URL. Llamar al arrancar la app. */
export function captureRefFromUrl(): void {
  try {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && /^[a-z0-9_.]{2,30}$/i.test(ref)) {
      localStorage.setItem(KEY, ref.toLowerCase());
      params.delete('ref');
      const qs = params.toString();
      const clean = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
    }
  } catch { /* noop */ }
}

/** Si hay un referidor guardado, lo atribuye (idempotente) y lo limpia.
 *  Llamar SOLO tras un signup nuevo con sesión. */
export async function recordReferralIfAny(): Promise<void> {
  try {
    const ref = localStorage.getItem(KEY);
    if (!ref) return;
    await supabase.rpc('record_referral', { referrer_username: ref });
    localStorage.removeItem(KEY);
  } catch { /* noop — no bloquear el signup por esto */ }
}

/** Link de invitación para compartir (aterriza en la raíz + atribuye). */
export function inviteLink(username: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?ref=${encodeURIComponent(username)}`;
}

/** Deep-link al perfil del usuario (+ atribución). Para compartir: el que recibe
 *  aterriza en TU perfil (contenido real), no en la app genérica. Lo consume el
 *  dashboard tras autenticar; un no-usuario cae al landing con el ?ref capturado y,
 *  al registrarse, llega al perfil. */
export function profileLink(username: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const u = encodeURIComponent(username);
  return `${origin}/u/${u}?ref=${u}`;
}

export interface ReferrerInfo {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Quién me invitó a la app (si me registré por un ?ref=). Sirve para empujar al
 *  referido a conectarse/entrenar con quien lo trajo — cerrando el handoff
 *  "invitación → togetherness". null si no fui referido. */
export async function getMyReferrer(): Promise<ReferrerInfo | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: row } = await supabase
      .from('referrals')
      .select('referrer_id')
      .eq('referee_id', user.id)
      .maybeSingle();
    if (!row?.referrer_id) return null;
    const { data: prof } = await supabase
      .from('public_profiles')
      .select('user_id, username, display_name, avatar_url')
      .eq('user_id', row.referrer_id)
      .maybeSingle();
    return {
      id: row.referrer_id,
      username: prof?.username ?? null,
      displayName: prof?.display_name ?? null,
      avatarUrl: prof?.avatar_url ?? null,
    };
  } catch {
    return null;
  }
}
