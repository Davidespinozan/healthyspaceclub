// validate-email — validación de email SIN fricción, previa al signup.
//
// Rechaza: formato inválido, dominios desechables, y dominios que no existen
// (sin MX ni A). NO confirma propiedad del correo (eso sería el flujo con clic).
// El usuario real no nota nada; corta los fakes obvios (asdf@asdf.com, etc.).
//
// verify_jwt = false: se llama ANTES de autenticarse (el usuario aún no existe).
// Fail-open ante errores transitorios de DNS → nunca bloquea a un usuario real
// por un hipo de infraestructura.

import { corsHeaders, json } from '../_shared/cors.ts';

// Dominios desechables más comunes. Lista corta a propósito (cubre el 95%);
// se puede ampliar sin redeploy del cliente.
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', '10minutemail.com',
  'tempmail.com', 'temp-mail.org', 'throwawaymail.com', 'getnada.com', 'nada.email',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'maildrop.cc', 'dispostable.com',
  'fakeinbox.com', 'mailnesia.com', 'mintemail.com', 'mohmal.com', 'tempinbox.com',
  'emailondeck.com', 'spamgourmet.com', 'mytemp.email', 'tempmailo.com', 'mailcatch.com',
  'discard.email', 'inboxbear.com', 'tempr.email', 'moakt.com', 'luxusmail.org',
]);

async function domainExists(domain: string): Promise<boolean> {
  // ¿Acepta correo? MX, o A/AAAA como fallback (RFC: sin MX, el correo va al A).
  try {
    const mx = await Deno.resolveDns(domain, 'MX');
    if (mx && mx.length > 0) return true;
  } catch (_e) { /* sigue al A */ }
  try {
    const a = await Deno.resolveDns(domain, 'A');
    if (a && a.length > 0) return true;
  } catch (_e) { /* nada */ }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { email } = await req.json();
    const e = String(email || '').trim().toLowerCase();
    const m = e.match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
    if (!m) return json({ valid: false, reason: 'format' });

    const domain = m[1];
    // Acota el input de DNS a hostnames reales (solo [a-z0-9.-], ≤253 chars):
    // evita usar el endpoint como resolver de DNS arbitrario con payloads raros.
    if (domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) {
      return json({ valid: false, reason: 'format' });
    }
    if (DISPOSABLE.has(domain)) return json({ valid: false, reason: 'disposable' });

    let exists: boolean;
    try {
      exists = await domainExists(domain);
    } catch (_e) {
      return json({ valid: true, reason: 'dns-error-failopen' }); // no bloquear por hipo de DNS
    }
    if (!exists) return json({ valid: false, reason: 'no-domain' });

    return json({ valid: true });
  } catch (_e) {
    return json({ valid: true, reason: 'error-failopen' }); // fail-open
  }
});
