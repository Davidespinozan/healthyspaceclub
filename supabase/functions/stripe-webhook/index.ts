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

        const eventAt = new Date(event.created * 1000).toISOString();
        const { ok, userId, applied } = await applyToUser(admin, stripe, customerId, sub, {
          subscription_status: plan,
          subscription_period_end: periodEnd,
          plan_id: planId,
          billing_cycle: billingCycle,
          cancel_at_period_end: event.type === 'customer.subscription.deleted'
            ? false
            : (sub.cancel_at_period_end ?? false),
          payment_past_due: event.type === 'customer.subscription.deleted'
            ? false
            : (sub.status === 'past_due'),
          last_sub_event_at: eventAt,
        }, eventAt);

        if (!ok || !userId) {
          console.error('[stripe-webhook] no se encontró user para customer', customerId);
          // 200 igual: reintentar no ayudaría (el user no existe en nuestra DB).
          break;
        }

        // ── Historial de estados ──────────────────────────────────────────
        // a_estado captura lo que subscription_status NO puede: past_due
        // (impago en curso) y cancelada (baja definitiva) son estados propios,
        // no valores de none|trial|pro.
        const aEstado = event.type === 'customer.subscription.deleted'
          ? 'cancelada'
          : (sub.status === 'past_due' || sub.status === 'unpaid')
            ? 'past_due'
            : plan; // 'trial' | 'pro' | 'none'
        const deEstado = await ultimoEstadoSub(admin, userId);
        // Solo se asienta si (a) el update se APLICÓ —un evento fuera de orden
        // se ignoró y no debe inventar transición— y (b) de verdad CAMBIÓ de
        // estado. Una renovación (subscription.updated sin cambio de status) es
        // un movimiento de dinero, no un evento de estado.
        if (applied && aEstado !== deEstado) {
          const motivo = aEstado === 'cancelada'
            ? 'cancelacion'
            : (deEstado == null || deEstado === 'none')
              ? 'alta'
              : (deEstado === 'trial' && aEstado === 'pro')
                ? 'conversion_trial'
                : aEstado === 'past_due'
                  ? 'pago_fallido'
                  : deEstado === 'past_due'
                    ? 'pago_recuperado'
                    : 'cambio_estado';
          await registrarEvento(admin, {
            userId, de: deEstado, a: aEstado, motivo,
            referencia: event.id, ocurridoEn: eventAt,
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        // Señal de respaldo del banner past_due (independiente de que llegue o
        // no el subscription.updated→past_due).
        // deno-lint-ignore no-explicit-any
        const inv = event.data.object as any;
        const customerId: string = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
        if (customerId) await applyToUser(admin, stripe, customerId, inv, { payment_past_due: true });
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        // Se regularizó el pago → limpia el banner.
        // deno-lint-ignore no-explicit-any
        const inv = event.data.object as any;
        const customerId: string = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
        if (customerId) await applyToUser(admin, stripe, customerId, inv, { payment_past_due: false });

        // Y registrar el COBRO. Hasta acá el monto llegaba dentro del evento y
        // se descartaba: no había forma de saber cuánto factura el Club. Ni
        // MRR, ni LTV, ni ingreso mensual — todo vivía solo en Stripe.
        await registrarCobro(admin, inv, customerId);
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

// Asienta un cobro en el libro contable del Club.
//
// Idempotente por el id de la factura: Stripe reintenta la entrega, y sin esa
// llave cada reintento sumaría el ingreso otra vez, en silencio. El error 23505
// (llave duplicada) es el caso ESPERADO en un reintento, no una falla.
//
// NO revienta el webhook si algo sale mal: el cobro ya ocurrió en Stripe y lo
// importante es no perder el resto del procesamiento (limpiar `past_due`). Se
// loguea y sigue — un ingreso que falta se recupera después con el backfill,
// pero un banner de impago que no se limpia lo ve el socio en pantalla.
// deno-lint-ignore no-explicit-any
async function registrarCobro(admin: any, inv: any, customerId: string | null) {
  try {
    const centavos = typeof inv?.amount_paid === 'number' ? inv.amount_paid : 0;
    if (centavos <= 0 || !inv?.id) return;

    let userId: string | null = null;
    if (customerId) {
      const { data } = await admin
        .from('user_profiles')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      userId = data?.user_id ?? null;
    }

    // La fecha del PAGO, no la del webhook: si Stripe reintenta la entrega dos
    // días después, el ingreso sigue perteneciendo al mes en que se cobró.
    const pagadoEn = typeof inv?.status_transitions?.paid_at === 'number'
      ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
      : new Date().toISOString();

    const { error } = await admin.from('movimientos_dinero').insert({
      negocio: 'hsc',
      ocurrido_en: pagadoEn,
      monto_centavos: centavos,
      // Lo que diga Stripe. No se asume la moneda: si el Club cobra en más de
      // una, cada factura queda con la suya y el libro nace derecho.
      moneda: (inv.currency || 'mxn').toUpperCase(),
      concepto: 'suscripcion',
      metodo: 'stripe',
      referencia_externa: inv.id,
      cliente_id: userId,
      metadata: {
        stripe_customer: customerId,
        numero_factura: inv.number ?? null,
        periodo_inicio: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
        periodo_fin: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      },
    });

    if (error && error.code !== '23505') {
      console.error('[stripe-webhook] no se pudo asentar el cobro', inv.id, ':', error.message);
    }
  } catch (e) {
    console.error('[stripe-webhook] registrarCobro:', e instanceof Error ? e.message : e);
  }
}

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
  // Si viene, se ignora el evento cuando es MÁS VIEJO que el último de
  // suscripción ya aplicado (anti out-of-order). Solo para eventos de sub.
  guardEventAt?: string,
): Promise<{ ok: boolean; userId: string | null; applied: boolean }> {
  // 1) match directo por customer_id
  const { data: byCustomer } = await admin
    .from('user_profiles')
    .select('user_id, last_sub_event_at')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  let userId: string | null = byCustomer?.user_id ?? null;

  // Guardia de orden: si ya aplicamos un evento de suscripción más nuevo, este
  // (reintento/entrega tardía) no debe pisar el estado fresco.
  if (guardEventAt && byCustomer?.last_sub_event_at
      && new Date(guardEventAt) <= new Date(byCustomer.last_sub_event_at)) {
    return { ok: true, userId, applied: false }; // "manejado" (intencionalmente ignorado)
  }

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

  if (!userId) return { ok: false, userId: null, applied: false };

  const { error } = await admin
    .from('user_profiles')
    .update(fields)
    .eq('user_id', userId);

  if (error) {
    console.error('[stripe-webhook] update user_profiles falló:', error.message);
    throw new Error(error.message);
  }
  return { ok: true, userId, applied: true };
}

// ── Historial de estados (eventos_estado) ───────────────────────────────────
// El último a_estado registrado para el socio = su estado ANTERIOR. Se usa la
// propia tabla de historial como fuente de "de dónde venía", porque past_due y
// cancelada NO viven en user_profiles.subscription_status (que solo es
// none|trial|pro): reconstruirlos desde ahí sería imposible.
async function ultimoEstadoSub(
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('eventos_estado')
    .select('a_estado')
    .eq('negocio', 'hsc').eq('entidad', 'suscripcion').eq('entidad_id', userId)
    .order('ocurrido_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.a_estado ?? null;
}

// Asienta una transición de estado. Idempotente por referencia_externa (el
// event.id de Stripe): un reintento no duplica. No revienta el webhook si algo
// sale mal — el estado ya quedó aplicado en user_profiles; el historial es
// medición, no operación.
async function registrarEvento(
  // deno-lint-ignore no-explicit-any
  admin: any,
  args: { userId: string; de: string | null; a: string; motivo: string; referencia: string; ocurridoEn: string },
): Promise<void> {
  try {
    const { error } = await admin.from('eventos_estado').insert({
      negocio: 'hsc',
      entidad: 'suscripcion',
      entidad_id: args.userId,
      de_estado: args.de,
      a_estado: args.a,
      motivo: args.motivo,
      referencia_externa: args.referencia,
      ocurrido_en: args.ocurridoEn,
    });
    if (error && error.code !== '23505') {
      console.error('[stripe-webhook] eventos_estado falló:', error.message);
    }
  } catch (e) {
    console.error('[stripe-webhook] eventos_estado excepción:', e instanceof Error ? e.message : e);
  }
}
