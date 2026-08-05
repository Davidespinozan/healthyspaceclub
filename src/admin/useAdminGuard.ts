import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Estado del guard del panel. El guard es SOLO UX — la muralla real es la RLS
// (policy hsc_is_admin() sobre user_profiles/movimientos_dinero/eventos_estado).
// Aunque alguien fuerce el render del panel, sin is_admin no puede LEER nada.
export type GuardState = 'loading' | 'no-auth' | 'not-admin' | 'ok';

export function useAdminGuard(): { state: GuardState; email: string | null } {
  const [state, setState] = useState<GuardState>('loading');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session?.user) { setState('no-auth'); return; }
        setEmail(session.user.email ?? null);

        const { data, error } = await supabase
          .from('user_profiles')
          .select('is_admin')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (cancelled) return;
        setState(!error && data?.is_admin ? 'ok' : 'not-admin');
      } catch (e) {
        // getSession() o la query rechazaron (p.ej. refresh token inválido). SIN
        // este catch el guard quedaba en 'loading' para siempre = "Cargando…" eterno
        // al entrar a /admin. Fail-open a login: que el dueño re-autentique.
        if (cancelled) return;
        console.error('[adminGuard] getSession/query falló, mostrando login:', e);
        setState('no-auth');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { state, email };
}
