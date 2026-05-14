import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { RateLimitResult, UserAccess } from './types.ts';

// Límites diarios por plan. -1 = ilimitado.
const DAILY_LIMITS: Record<string, number> = {
  none: 0,
  trial: 20,
  basico: 10,
  pro: -1,
  elite: -1,
};

/**
 * Determina si el usuario puede hacer una request de IA hoy.
 * - admin → ilimitado
 * - pro / elite → ilimitado
 * - trial → 20/día (rechaza si trial_ends_at venció)
 * - basico → 10/día
 * - none → 0
 *
 * El conteo usa ai_usage_log filtrado por success=true del día UTC actual,
 * así las requests fallidas (error de Anthropic) no queman la cuota del usuario.
 */
export async function checkRateLimit(
  supabaseAdmin: SupabaseClient,
  access: UserAccess,
): Promise<RateLimitResult> {
  // Admin: bypass total.
  if (access.isAdmin) return { allowed: true, limit: -1, used: 0 };

  // Trial expirado → se trata como 'none'.
  if (access.plan === 'trial' && access.trialEndsAt) {
    if (new Date(access.trialEndsAt).getTime() < Date.now()) {
      return { allowed: false, reason: 'trial_expired', limit: 0, used: 0 };
    }
  }

  const limit = DAILY_LIMITS[access.plan] ?? 0;

  if (limit === -1) return { allowed: true, limit: -1, used: 0 };
  if (limit === 0) return { allowed: false, reason: 'no_plan', limit: 0, used: 0 };

  // Conteo de requests exitosas del día UTC actual.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', access.userId)
    .eq('success', true)
    .gte('created_at', startOfDay.toISOString());

  // Si el conteo falla, permitimos la request (fail-open) — no bloqueamos
  // al usuario por un problema de infra. Se loguea para debugging.
  if (error) {
    console.error('[rateLimit] count query failed:', error.message);
    return { allowed: true, limit, used: 0 };
  }

  const used = count ?? 0;
  return {
    allowed: used < limit,
    reason: used >= limit ? 'limit_reached' : undefined,
    limit,
    used,
  };
}
