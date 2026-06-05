// Edge function: envía Web Push a las suscripciones de un usuario.
// Se invoca por un Database Webhook en INSERT sobre `notifications` (payload
// { type, record }), construye el mensaje según el tipo y manda el push a cada
// suscripción guardada. Borra suscripciones caídas (410/404).
//
// Requiere secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:tu@correo.com)
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.)

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hola@healthyspace.club';

const configured = !!VAPID_PUBLIC && !!VAPID_PRIVATE;
if (configured) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface NotifRecord {
  user_id: string;
  actor_username?: string | null;
  type: string;
  preview?: string | null;
  post_id?: string | null;
}

// Texto del push (ES — el push no conoce el locale del receptor con certeza).
function buildMessage(n: NotifRecord): { title: string; body: string } {
  const who = n.actor_username ? `@${n.actor_username}` : 'Alguien';
  switch (n.type) {
    case 'fire': return { title: 'Healthy Space Club', body: `${who} le dio fire a tu publicación` };
    case 'comment': return { title: 'Healthy Space Club', body: n.preview ? `${who} comentó: ${n.preview}` : `${who} comentó tu publicación` };
    case 'collab': return { title: 'Healthy Space Club', body: `${who} quiere colaborar contigo en una foto` };
    case 'follow': return { title: 'Healthy Space Club', body: `${who} te empezó a seguir` };
    case 'partner_invite': return { title: 'Healthy Space Club', body: `${who} te invitó a entrenar` };
    case 'partner_accept': return { title: 'Healthy Space Club', body: `${who} aceptó entrenar contigo` };
    case 'reminder': return { title: 'Healthy Space Club', body: n.preview || 'Tienes un recordatorio' };
    default: return { title: 'Healthy Space Club', body: 'Tienes una nueva notificación' };
  }
}

Deno.serve(async (req) => {
  try {
    if (!configured) {
      return new Response(JSON.stringify({ error: 'VAPID keys not set' }), { status: 200 });
    }
    const payload = await req.json();
    const record: NotifRecord | undefined = payload?.record;
    if (!record?.user_id || !record?.type) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', record.user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const msg = buildMessage(record);
    const body = JSON.stringify({ title: msg.title, body: msg.body, url: '/', tag: record.type });

    let sent = 0;
    await Promise.all(subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(subscription, body);
        sent++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Suscripción caída → la limpiamos.
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
    }));

    return new Response(JSON.stringify({ sent }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
