// Web Push (cliente): pide permiso, se suscribe vía PushManager y guarda la
// suscripción en Supabase. El envío lo hace la edge function push-send con la
// llave VAPID privada. iOS exige PWA instalada (Add to Home Screen) + iOS 16.4+.
import { supabase } from '../lib/supabase';

// Llave pública VAPID (es pública por diseño — va en el cliente).
const VAPID_PUBLIC_KEY = 'BE17eMxR6ktn2KCWakJvWZkAbU56O5h2HQLd29Fv1ih2gbues-OrTYmA3TGAJwTLS_HIdOF7wuqP1SokLChMhrQ';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/** ¿La app corre como PWA instalada (standalone)? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua)
    || (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1);
}

/** En iOS el push EXIGE la PWA instalada a inicio. Si es iOS y NO está
 *  instalada, hay que pedirle al usuario que la instale primero (si no, iOS
 *  ni muestra el diálogo de permiso). */
export function pushNeedsInstall(): boolean {
  return isIOS() && !isStandalone();
}

export async function getPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub && Notification.permission === 'granted';
  } catch { return false; }
}

export type EnablePushResult = 'enabled' | 'denied' | 'unsupported' | 'error';

export async function enablePush(): Promise<EnablePushResult> {
  if (!pushSupported()) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
    const json = sub.toJSON();
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    if (!me || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'error';
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: me,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }, { onConflict: 'endpoint' });
    if (error) { console.warn('[push] save sub failed:', error.message); return 'error'; }
    return 'enabled';
  } catch (e) {
    console.warn('[push] enable failed:', e);
    return 'error';
  }
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
  } catch (e) { console.warn('[push] disable failed:', e); }
}

/**
 * Reconcilia la suscripción del navegador con la que está guardada.
 *
 * El navegador puede rotar el endpoint por su cuenta. El service worker intenta
 * moverlo en cuanto pasa (`pushsubscriptionchange`), pero no siempre puede: hay
 * navegadores que no entregan `oldSubscription`, y entonces no hay forma de saber
 * qué fila mover. Aquí sí hay sesión, así que se resuelve sin ambigüedad.
 *
 * Se llama al abrir la app. Si el endpoint vivo no está guardado, se guarda y se
 * borran los del mismo usuario que ya no existen — son los que hacen que
 * `push-send` intente entregar a un buzón muerto.
 */
export async function sincronizarPush(): Promise<void> {
  if (!pushSupported()) return;
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;                       // no está suscrito: nada que reconciliar

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id;
    if (!me) return;

    const { data: guardadas, error } = await supabase
      .from('push_subscriptions').select('endpoint').eq('user_id', me);
    if (error) { console.warn('[push] sync: no pude leer suscripciones:', error.message); return; }

    const vigente = (guardadas ?? []).some((s) => s.endpoint === json.endpoint);
    if (!vigente) {
      await supabase.from('push_subscriptions').upsert({
        user_id: me, endpoint: json.endpoint,
        p256dh: json.keys.p256dh, auth: json.keys.auth,
      }, { onConflict: 'endpoint' });
    }

    // Los endpoints viejos de este mismo usuario ya no reciben nada: solo hacen
    // que cada envío falle en silencio.
    const muertos = (guardadas ?? []).map((s) => s.endpoint).filter((e) => e !== json.endpoint);
    if (muertos.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', muertos);
    }
  } catch (e) {
    console.warn('[push] sync falló:', e);
  }
}
