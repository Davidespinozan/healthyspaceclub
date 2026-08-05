// Edge Function: detección de país por IP SIN terceros.
// Netlify resuelve la geo de la IP en su propia red (context.geo) y aquí solo
// devolvemos el código de país. La IP del usuario nunca sale hacia un servicio
// externo (a diferencia de ipapi.co, que queda como fallback en el cliente).
import type { Context } from 'https://edge.netlify.com';

export default async (_request: Request, context: Context): Promise<Response> => {
  const code = context.geo?.country?.code ?? null;
  return new Response(JSON.stringify({ country_code: code }), {
    headers: {
      'content-type': 'application/json',
      // Cacheable por CDN a nivel de edge; la geo de una IP no cambia seguido.
      'cache-control': 'public, max-age=3600',
    },
  });
};

export const config = { path: '/api/geo' };
