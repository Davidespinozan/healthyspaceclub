import { supabase } from '../lib/supabase';

export interface AIProxyMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIProxyRequest {
  messages: AIProxyMessage[];
  system?: string;
  max_tokens?: number;
  model?: string;
}

export interface AIProxyResponse {
  content: Array<{ type: 'text'; text: string }>;
  [key: string]: unknown; // mismo shape que Anthropic Messages API
}

export class AIProxyError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'AIProxyError';
  }
}

/**
 * Race una promesa contra un AbortSignal.
 * supabase.functions.invoke NO soporta signal nativamente — esto NO cancela
 * el request server-side, pero libera al cliente para soltar el spinner /
 * mostrar el error de timeout. Mismo efecto de UX que el AbortController previo.
 */
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      );
    }),
  ]);
}

/**
 * Llama al Edge Function ai-proxy de Supabase.
 * El proxy valida JWT, aplica rate limit, hace fetch a Anthropic server-side.
 * La API key de Anthropic NUNCA viaja al cliente.
 *
 * Errores (AIProxyError con .status):
 * - 401: sesión inválida o expirada
 * - 402: requiere suscripción activa / trial expirado
 * - 429: límite diario excedido
 * - 502: error en Anthropic
 * - AbortError: timeout o cancelación del cliente (se propaga sin envolver)
 */
export async function callAI(
  req: AIProxyRequest,
  signal?: AbortSignal,
): Promise<AIProxyResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new AIProxyError(401, 'No hay sesión activa', 'no_session');
  }

  try {
    const { data, error } = await withAbort(
      supabase.functions.invoke('ai-proxy', {
        body: {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          ...req,
        },
      }),
      signal,
    );

    if (error) {
      // FunctionsHttpError: el body real ({ message, code }) está en
      // error.context, que es un Response — hay que parsearlo.
      const ctx = (error as { context?: Response }).context;
      let status = 500;
      let message = error.message ?? 'Error en el servidor de IA';
      let code: string | undefined;
      if (ctx && typeof ctx.status === 'number') {
        status = ctx.status;
        if (typeof ctx.json === 'function') {
          try {
            const body = await ctx.json();
            if (body?.message) message = body.message;
            if (body?.code) code = body.code;
          } catch {
            /* body no-JSON — usar message genérico */
          }
        }
      }
      throw new AIProxyError(status, message, code);
    }

    return data as AIProxyResponse;
  } catch (e) {
    if (e instanceof AIProxyError) throw e;
    if ((e as Error).name === 'AbortError') throw e;
    throw new AIProxyError(500, (e as Error).message || 'Error desconocido');
  }
}

const FN_URL = (import.meta.env.VITE_SUPABASE_URL ?? 'https://ltveorvqvvlyivjwxjlc.supabase.co') + '/functions/v1/ai-proxy';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dmVvcnZxdnZseWl2and4amxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODEzNTAsImV4cCI6MjA4Nzk1NzM1MH0.BpBc3lM6VpDyL5299H1MwQK0VBOBjKWQQconfpcCsfU';

/**
 * Igual que callAI pero en STREAMING: invoca onText con cada fragmento de texto
 * conforme Anthropic lo va generando (efecto "escribe en vivo" en el coach).
 * Devuelve el texto completo al terminar.
 */
export async function callAIStream(
  req: AIProxyRequest,
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new AIProxyError(401, 'No hay sesión activa', 'no_session');

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, ...req, stream: true }),
    signal,
  });

  if (!res.ok || !res.body) {
    let message = `Error ${res.status}`;
    try { const j = await res.json(); if (j?.message) message = j.message; } catch { /* noop */ }
    throw new AIProxyError(res.status, message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split('\n\n');
    buf = events.pop() ?? '';
    for (const ev of events) {
      const dataLine = ev.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) continue;
      const data = dataLine.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        // Anthropic puede emitir un evento `error` a mitad del stream (overloaded,
        // etc.) DESPUÉS de mandar headers 200. Si lo ignoramos, el stream termina
        // y se commitea una respuesta vacía/parcial como si fuera buena. Lo
        // propagamos para que el caller muestre un error real.
        if (json.type === 'error') {
          throw new AIProxyError(503, json.error?.message ?? 'stream_error', json.error?.type);
        }
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          const piece = json.delta.text as string;
          full += piece;
          onText(piece);
        }
      } catch (e) {
        if (e instanceof AIProxyError) throw e;
        /* eventos no-JSON (ping, etc.) → ignorar */
      }
    }
  }
  return full;
}
