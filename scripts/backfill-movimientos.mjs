// scripts/backfill-movimientos.mjs
// ───────────────────────────────────────────────────────────────────
// Trae a `movimientos_dinero` las facturas que Stripe ya cobró.
//
// POR QUÉ: el webhook asienta los cobros a partir del día en que se despliega.
// Todo lo cobrado ANTES vive solo dentro de Stripe, así que el Club aparecería
// facturando casi nada. Este script recorre las facturas pagadas y las asienta.
//
// SEGURO DE CORRER VARIAS VECES: la idempotencia la da el índice único sobre
// (negocio, referencia_externa) — la referencia es el id de la factura. Un
// segundo pase no duplica; reporta cuántas ya estaban.
//
// SOLO CUENTA LO DEL CLUB: la cuenta de Stripe está COMPARTIDA con SALA. El
// filtro es que el customer esté en `user_profiles`. Sin eso, los cobros de
// los gyms de SALA entrarían como ingreso de HSC.
//
// Uso (la service role key NO está en el repo; sacala del dashboard de
// Supabase → Project Settings → API):
//   SUPABASE_SERVICE_ROLE_KEY=... STRIPE_SECRET_KEY=sk_live_... \
//     node --env-file=.env scripts/backfill-movimientos.mjs --dry
//
//   --dry   ensayo: muestra qué haría, sin escribir. Corrélo primero.
// ───────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const DRY = process.argv.includes('--dry');

const SB_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SK = process.env.STRIPE_SECRET_KEY;

if (!SB_URL || !SB_KEY || !SK) {
  console.error('✗ Faltan variables de entorno:');
  if (!SB_URL) console.error('  - SUPABASE_URL / VITE_SUPABASE_URL (usá --env-file=.env)');
  if (!SB_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  if (!SK) console.error('  - STRIPE_SECRET_KEY');
  process.exit(1);
}
if (SK.startsWith('sk_test_')) {
  console.warn('⚠  Clave de TEST: las facturas serán de prueba.\n');
}

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const stripe = new Stripe(SK, { apiVersion: '2024-06-20' });

// ── 1. Qué customers son del Club ───────────────────────────────────
const { data: perfiles, error } = await db
  .from('user_profiles')
  .select('user_id, stripe_customer_id')
  .not('stripe_customer_id', 'is', null);

if (error) {
  console.error('✗ No se pudo leer user_profiles:', error.message);
  process.exit(1);
}

const userDe = new Map();
for (const p of perfiles ?? []) userDe.set(p.stripe_customer_id, p.user_id);

if (userDe.size === 0) {
  console.error('✗ Ningún perfil tiene stripe_customer_id. No hay nada que traer.');
  process.exit(1);
}
console.log(`→ ${userDe.size} socios con customer de Stripe.\n`);

// ── 2. Recorrer las facturas pagadas ────────────────────────────────
let vistas = 0, ajenas = 0, insertadas = 0, yaEstaban = 0;
// Por moneda, nunca en un solo total: sumar pesos con dólares da un número
// inventado. Si el Club cobra en las dos, acá se va a ver separado.
const totalPorMoneda = new Map();

for await (const inv of stripe.invoices.list({ status: 'paid', limit: 100 })) {
  vistas++;
  const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
  const userId = customerId ? userDe.get(customerId) : null;

  if (!userId) { ajenas++; continue; }

  const centavos = typeof inv.amount_paid === 'number' ? inv.amount_paid : 0;
  if (centavos <= 0) continue;

  const pagadoEn = typeof inv.status_transitions?.paid_at === 'number'
    ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
    : new Date(inv.created * 1000).toISOString();

  const moneda = (inv.currency || 'mxn').toUpperCase();
  const fila = {
    negocio: 'hsc',
    ocurrido_en: pagadoEn,
    monto_centavos: centavos,
    moneda,
    concepto: 'suscripcion',
    metodo: 'stripe',
    referencia_externa: inv.id,
    cliente_id: userId,
    metadata: {
      backfill: true,
      stripe_customer: customerId,
      numero_factura: inv.number ?? null,
      periodo_inicio: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
      periodo_fin: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
    },
  };

  const suma = () => totalPorMoneda.set(moneda, (totalPorMoneda.get(moneda) ?? 0) + centavos);

  if (DRY) {
    console.log(`  [dry] ${pagadoEn.substring(0, 10)}  ${(centavos / 100).toFixed(2)} ${moneda}  ${inv.id}`);
    insertadas++; suma();
    continue;
  }

  const { error: errIns } = await db.from('movimientos_dinero').insert(fila);
  if (errIns) {
    // 23505 = ya estaba. Esperado en un segundo pase.
    if (errIns.code === '23505') { yaEstaban++; continue; }
    console.error(`✗ Insertando ${inv.id}: ${errIns.message}`);
    process.exit(1);
  }
  insertadas++; suma();
  console.log(`  ✓ ${pagadoEn.substring(0, 10)}  ${(centavos / 100).toFixed(2)} ${moneda}  ${inv.id}`);
}

console.log(`
─────────────────────────────────────────────
Facturas pagadas en Stripe:    ${vistas}
  de otro negocio (ignoradas): ${ajenas}
  ya estaban en el libro:      ${yaEstaban}
  ${DRY ? 'se registrarían' : 'registradas'}:              ${insertadas}

Total ${DRY ? 'a registrar' : 'registrado'}:
${[...totalPorMoneda].map(([m, c]) => `  ${(c / 100).toFixed(2)} ${m}`).join('\n') || '  (nada)'}
─────────────────────────────────────────────${DRY ? '\n\nEsto fue un ensayo. Sacá --dry para escribir de verdad.' : ''}`);