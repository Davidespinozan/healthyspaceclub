/* Handler de Web Push — se importa dentro del service worker generado por
   workbox (vite.config: workbox.importScripts). Muestra la notificación cuando
   llega un push (app cerrada) y enfoca/abre la app al tocarla. */

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

  const title = data.title || 'Healthy Space Club';
  const options = {
    body: data.body || '',
    icon: data.icon || 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-192.png',
    badge: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* El navegador puede cambiar el endpoint de una suscripción cuando quiere (rota
   llaves, caduca el registro). Sin este handler la fila de la base se queda
   apuntando a un endpoint muerto: esa persona deja de recibir notificaciones
   para siempre y nada en pantalla lo dice.

   El service worker no tiene sesión, así que no puede escribir la fila él mismo
   —no sabe de quién es—. Se vuelve a suscribir y le pide a la base que mueva la
   fila con `rotar_push_subscription`, que la encuentra por el endpoint viejo.

   Si el navegador no entrega `oldSubscription` no hay nada que buscar en la base,
   y la rotación queda para la próxima vez que se abra la app: ahí el cliente ya
   tiene sesión y reconcilia solo (ver sincronizarPush en src/utils/push.ts). */
const SUPABASE_URL = 'https://ltveorvqvvlyivjwxjlc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dmVvcnZxdnZseWl2and4amxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODEzNTAsImV4cCI6MjA4Nzk1NzM1MH0.BpBc3lM6VpDyL5299H1MwQK0VBOBjKWQQconfpcCsfU';
const VAPID_PUBLIC_KEY = 'BE17eMxR6ktn2KCWakJvWZkAbU56O5h2HQLd29Fv1ih2gbues-OrTYmA3TGAJwTLS_HIdOF7wuqP1SokLChMhrQ';

function vapidBytes(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const vieja = event.oldSubscription || null;
      // Algunos navegadores ya entregan la nueva; si no, hay que crearla.
      let nueva = event.newSubscription
        || await self.registration.pushManager.getSubscription();
      if (!nueva) {
        nueva = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidBytes(VAPID_PUBLIC_KEY),
        });
      }
      if (!nueva) return;

      const n = nueva.toJSON();
      const v = vieja ? vieja.toJSON() : null;
      // Sin el endpoint y la llave viejos no se puede identificar la fila. Se deja
      // para que el cliente reconcilie al abrir la app, que sí tiene sesión.
      if (!v || !v.endpoint || !v.keys || !v.keys.auth) return;
      if (!n.endpoint || !n.keys || !n.keys.p256dh || !n.keys.auth) return;

      await fetch(SUPABASE_URL + '/rest/v1/rpc/rotar_push_subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON,
          Authorization: 'Bearer ' + SUPABASE_ANON,
        },
        body: JSON.stringify({
          p_endpoint_viejo: v.endpoint,
          p_endpoint_nuevo: n.endpoint,
          p_p256dh: n.keys.p256dh,
          p_auth: n.keys.auth,
          p_auth_viejo: v.keys.auth,
        }),
      });
    } catch (e) {
      /* Si falla, el cliente reconcilia al abrir la app. */
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          // Antes solo enfocaba → si la app ya estaba abierta, el deep-link se
          // perdía. Ahora navega a la ruta del push (si el navegador lo soporta).
          if ('navigate' in client && targetUrl) { try { client.navigate(targetUrl); } catch (e) { /* noop */ } }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
