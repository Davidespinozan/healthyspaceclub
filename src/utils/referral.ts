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

/** Link de invitación para compartir. */
export function inviteLink(username: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?ref=${encodeURIComponent(username)}`;
}
