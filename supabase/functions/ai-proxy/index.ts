// ════════════════════════════════════════════════════════════════
// ai-proxy — Edge Function (Deno)
// Proxy autenticado a Anthropic. Valida JWT de Supabase Auth, aplica
// rate limiting por user_plan, hace la request con CLAUDE_API_KEY
// server-side, loguea a ai_usage_log y devuelve la respuesta cruda
// de Anthropic (mismo shape: { content: [{ text }], usage, model... }).
//
// La key de Anthropic NUNCA viaja al cliente.
// ════════════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkRateLimit } from './rateLimit.ts';
import type { AIProxyRequest, UserAccess, UserPlan } from './types.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// deno-lint-ignore no-explicit-any
async function logUsage(
  supabaseAdmin: any,
  userId: string,
  model: string | null,
  tokensIn: number | null,
  tokensOut: number | null,
  success: boolean,
  errorCode: string | null,
  latencyMs: number,
): Promise<void> {
  try {
    await supabaseAdmin.from('ai_usage_log').insert({
      user_id: userId,
      endpoint: 'ai-proxy',
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      success,
      error_code: errorCode,
      latency_ms: latencyMs,
    });
  } catch (e) {
    // El log no debe tumbar la request — solo se reporta.
    console.error('[ai-proxy] logUsage failed:', e instanceof Error ? e.message : e);
  }
}

Deno.serve(async (req: Request) => {
  const startedAt = Date.now();

  // ── CORS preflight ──────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ message: 'Método no permitido' }, 405);
  }

  // Cliente service-role: bypassa RLS para leer el perfil e insertar el log.
  // SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── 1. Validar JWT ──────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ message: 'Sesión expirada' }, 401);

  const jwt = authHeader.replace('Bearer ', '').trim();
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !user) {
    return json({ message: 'Sesión expirada' }, 401);
  }

  // ── Auto-admin por email (ADMIN_EMAILS env var) ─────────────
  // Permite mantener admin sin tocar la DB — útil para cuentas de testing
  // que se recrean (cada signup nuevo pierde el flag is_admin en user_profiles).
  const adminEmails = (Deno.env.get('ADMIN_EMAILS') ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  const userEmail = (user.email ?? '').toLowerCase();
  const isAdminByEmail = adminEmails.includes(userEmail);

  // ── 2. Leer perfil (plan + admin + trial) ───────────────────
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('user_plan, is_admin, trial_ends_at')
    .eq('user_id', user.id)
    .maybeSingle();

  // Admin si CUALQUIERA de los dos caminos aplica: email en env var O flag en DB.
  const isAdmin = isAdminByEmail || profile?.is_admin === true;

  const access: UserAccess = {
    userId: user.id,
    plan: (profile?.user_plan ?? 'none') as UserPlan,
    isAdmin,
    trialEndsAt: profile?.trial_ends_at ?? null,
  };

  console.log(JSON.stringify({
    user_id: user.id,
    email: userEmail,
    action: 'rate_limit_check',
    is_admin: isAdmin,
    admin_source: isAdminByEmail ? 'email_env' : (profile?.is_admin ? 'db_flag' : 'none'),
    plan: profile?.user_plan ?? 'none',
  }));

  // ── 3. Rate limit ───────────────────────────────────────────
  const rl = await checkRateLimit(supabaseAdmin, access);
  if (!rl.allowed) {
    const status = rl.reason === 'limit_reached' ? 429 : 402;
    const message =
      rl.reason === 'limit_reached'
        ? 'Límite diario alcanzado. Intenta mañana.'
        : rl.reason === 'trial_expired'
        ? 'Tu trial expiró. Se requiere suscripción activa.'
        : 'Se requiere suscripción activa.';
    console.log(JSON.stringify({
      user_id: user.id, action: 'ai-proxy', plan: access.plan,
      allowed: false, reason: rl.reason, used: rl.used, limit: rl.limit,
      latency_ms: Date.now() - startedAt,
    }));
    return json({ message }, status);
  }

  // ── 4. Parsear body del cliente ─────────────────────────────
  let body: AIProxyRequest;
  try {
    body = await req.json();
  } catch {
    return json({ message: 'Body inválido' }, 400);
  }
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ message: 'Falta el campo messages' }, 400);
  }

  // ── 5. Fetch a Anthropic con key server-side ────────────────
  // Anti-amplificación de costo: el cliente NO elige libremente modelo ni
  // max_tokens. Solo se permiten los modelos que la app usa de verdad; cualquier
  // otro cae al default barato (Haiku). max_tokens se capa a 4096.
  const ALLOWED_MODELS = new Set([
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
  ]);
  const model = (typeof body.model === 'string' && ALLOWED_MODELS.has(body.model)) ? body.model : DEFAULT_MODEL;
  const reqMaxTokens = typeof body.max_tokens === 'number' ? body.max_tokens : 1024;
  const max_tokens = Math.max(1, Math.min(reqMaxTokens, 4096));
  const anthropicBody: Record<string, unknown> = {
    model,
    max_tokens,
    messages: body.messages,
  };
  if (body.system) anthropicBody.system = body.system;

  // ── 5b. Modo STREAMING (coach): pipea el SSE de Anthropic al cliente ──
  const wantsStream = (body as { stream?: boolean }).stream === true;
  if (wantsStream) {
    anthropicBody.stream = true;
    let sRes: Response;
    try {
      sRes = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': Deno.env.get('CLAUDE_API_KEY')!,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(anthropicBody),
      });
    } catch (e) {
      await logUsage(supabaseAdmin, user.id, model, null, null, false, 'fetch_failed', Date.now() - startedAt);
      console.error('[ai-proxy] stream fetch failed:', e instanceof Error ? e.message : e);
      return json({ message: 'No se pudo contactar el servicio de IA. Intenta de nuevo.' }, 502);
    }
    if (!sRes.ok || !sRes.body) {
      const errorCode = `anthropic_${sRes.status}`;
      await logUsage(supabaseAdmin, user.id, model, null, null, false, errorCode, Date.now() - startedAt);
      return json({ message: `El servicio de IA tuvo un problema (${sRes.status}). Intenta de nuevo.` }, 502);
    }
    // Cuenta la request para el rate limit (tokens imprecisos en streaming).
    await logUsage(supabaseAdmin, user.id, model, null, null, true, null, Date.now() - startedAt);
    return new Response(sRes.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  let anthropicData: Record<string, unknown> | null = null;
  try {
    const aRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('CLAUDE_API_KEY')!,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!aRes.ok) {
      const errorCode = `anthropic_${aRes.status}`;
      const errText = await aRes.text();
      await logUsage(supabaseAdmin, user.id, model, null, null, false, errorCode, Date.now() - startedAt);
      console.log(JSON.stringify({
        user_id: user.id, action: 'ai-proxy', plan: access.plan,
        allowed: true, success: false, error_code: errorCode,
        latency_ms: Date.now() - startedAt,
      }));
      return json(
        { message: `El servicio de IA tuvo un problema (${aRes.status}). Intenta de nuevo.`, detail: errText.slice(0, 200) },
        502,
      );
    }

    anthropicData = await aRes.json();
  } catch (e) {
    await logUsage(supabaseAdmin, user.id, model, null, null, false, 'fetch_failed', Date.now() - startedAt);
    console.error('[ai-proxy] anthropic fetch failed:', e instanceof Error ? e.message : e);
    return json({ message: 'No se pudo contactar el servicio de IA. Intenta de nuevo.' }, 502);
  }

  // ── 6. Loggear uso ──────────────────────────────────────────
  const usage = (anthropicData?.usage ?? {}) as { input_tokens?: number; output_tokens?: number };
  const tokensIn = usage.input_tokens ?? null;
  const tokensOut = usage.output_tokens ?? null;
  await logUsage(
    supabaseAdmin, user.id,
    (anthropicData?.model as string) ?? model,
    tokensIn, tokensOut, true, null, Date.now() - startedAt,
  );

  console.log(JSON.stringify({
    user_id: user.id, action: 'ai-proxy', plan: access.plan,
    allowed: true, success: true,
    tokens_in: tokensIn, tokens_out: tokensOut,
    latency_ms: Date.now() - startedAt,
  }));

  // ── 7. Devolver respuesta cruda de Anthropic (mismo shape) ──
  return json(anthropicData, 200);
});
