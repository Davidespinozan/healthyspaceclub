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
