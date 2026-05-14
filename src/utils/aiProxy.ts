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
