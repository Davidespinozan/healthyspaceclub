// ════════════════════════════════════════════════════════════════
// stripe-webhook — Edge Function (Deno) · verify_jwt = FALSE
// Recibe eventos de Stripe, verifica firma (async + Web Crypto), aplica
// idempotencia y sincroniza user_profiles con el status autoritativo de la
// suscripción. ESCRIBE con service_role (el trigger lo permite).
//
// verify_jwt = false en config.toml: Stripe NO manda JWT de Supabase.
// ════════════════════════════════════════════════════════════════
import { getStripe, Stripe } from '../_shared/stripe.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import {
  mapStripeStatusToPlan,
  billingCycleFromInterval,
} from '../_shared/planMapping.ts';

// El SDK v22 puede exponer current_period_end a nivel de subscription o de item
// según la apiVersion default. Lo leemos de ambos lados para no romper.
// deno-lint-ignore no-explicit-any
function periodEndISO(sub: any): string | null {
  const item = sub?.items?.data?.[0];
  const epoch = sub?.current_period_end ?? item?.current_period_end ?? null;
  return typeof epoch === 'number' ? new Date(epoch * 1000).toISOString() : null;
}

// deno-lint-ignore no-explicit-any
function priceOf(sub: any): { id: string | null; interval: string | null } {
  const price = sub?.items?.data?.[0]?.price ?? null;
  return {
    id: price?.id ?? null,
    interval: price?.recurring?.interval ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  const sig = req.headers.get('stripe-signature');
  const whSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!sig || !whSecret) {
    return new Response('Falta firma o secret', { status: 400 });
  }

  // Body CRUDO: la firma se valida sobre el payload tal cual (NO req.json()).
  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    // Variante ASYNC + Web Crypto: la sync usa crypto de Node y no corre en Deno.
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      whSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (e) {
    console.error('[stripe-webhook] firma inválida:', e instanceof Error ? e.message : e);
    return new Response('Firma inválida', { status: 400 });
  }

  const admin = getAdmin();

  // ── Idempotencia: insert-or-ignore por event.id ─────────────
  const { data: inserted, error: idemErr } = await admin
    .from('stripe_webhook_events')
    .upsert({ id: event.id, type: event.type }, { onConflict: 'id', ignoreDuplicates: true })
    .select('id');

  if (idemErr) {
    console.error('[stripe-webhook] idempotencia falló:', idemErr.message);
    return new Response('Error de idempotencia', { status: 500 });
  }
  if (!inserted || inserted.length === 0) {
    // Ya procesado → ack sin reprocesar.
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // deno-lint-ignore no-explicit-any
        const sub = event.data.object as any;
        const customerId: string = typeof sub.customer === 'string'
          ? sub.customer
          : sub.customer?.id;

        const plan = event.type === 'customer.subscription.deleted'
          ? 'none'
          : mapStripeStatusToPlan(sub.status);

        const { id: planId, interval } = priceOf(sub);
        const billingCycle = interval ? billingCycleFromInterval(interval) : null;
        const periodEnd = periodEndISO(sub);

        const updated = await applyToUser(admin, stripe, customerId, sub, {
          subscription_status: plan,
          subscription_period_end: periodEnd,
          plan_id: planId,
          billing_cycle: billingCycle,
          cancel_at_period_end: event.type === 'customer.subscription.deleted'
            ? false
            : (sub.cancel_at_period_end ?? false),
        });

        if (!updated) {
          console.error('[stripe-webhook] no se encontró user para customer', customerId);
          // 200 igual: reintentar no ayudaría (el user no existe en nuestra DB).
        }
        break;
      }
      default:
        // Evento no manejado → ignorar con 200.
        break;
    }
  } catch (e) {
    console.error('[stripe-webhook] error procesando', event.type, ':', e instanceof Error ? e.message : e);
    // Borramos el registro de idempotencia para que el reintento de Stripe SÍ
    // reprocese (si no, el retry saldría temprano como duplicado y se perdería).
    await admin.from('stripe_webhook_events').delete().eq('id', event.id);
    return new Response('Error de procesamiento', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});

// Busca el user por stripe_customer_id; si no hay match, cae al metadata del customer.
// deno-lint-ignore no-explicit-any
async function applyToUser(
  // deno-lint-ignore no-explicit-any
  admin: any,
  // deno-lint-ignore no-explicit-any
  stripe: any,
  customerId: string,
  // deno-lint-ignore no-explicit-any
  _sub: any,
  fields: Record<string, unknown>,
): Promise<boolean> {
  // 1) match directo por customer_id
  const { data: byCustomer } = await admin
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  let userId: string | null = byCustomer?.user_id ?? null;

  // 2) fallback: leer metadata.supabase_user_id del customer en Stripe
  if (!userId && customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      userId = customer?.metadata?.supabase_user_id ?? null;
      // Backfill del customer_id si lo resolvimos por metadata.
      if (userId) {
        await admin
          .from('user_profiles')
          .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: 'user_id' });
      }
    } catch (e) {
      console.error('[stripe-webhook] retrieve customer falló:', e instanceof Error ? e.message : e);
    }
  }

  if (!userId) return false;

  const { error } = await admin
    .from('user_profiles')
    .update(fields)
    .eq('user_id', userId);

  if (error) {
    console.error('[stripe-webhook] update user_profiles falló:', error.message);
    throw new Error(error.message);
  }
  return true;
}
