// Parte 2 · Co-presencia en vivo de pareja durante el workout.
//
// Usa Supabase Realtime BROADCAST (efímero, sin DB) en un canal determinístico
// por pareja (UUIDs ordenados → ambos calculan el mismo nombre). Cada quien
// transmite su posición (ejercicio/serie/descanso/terminado) y recibe la del
// otro. Si realtime no conecta, falla en silencio (el player sigue funcionando).

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// Si no recibimos NINGUNA señal del compañero en este lapso, lo damos por
// desconectado (cerró la app / perdió red). Sin esto, su último estado
// (done:false) persiste para siempre y, en turnos estrictos, bloquea al otro
// para terminar la sesión. El heartbeat (abajo) reemite cada 6s aunque no haya
// cambio de posición, así que sólo expira si de verdad se fue.
const PARTNER_STALE_MS = 18_000;
const HEARTBEAT_MS = 6_000;

export interface PartnerProgress {
  exIndex: number;   // ejercicio actual del compañero
  setsDone: number;  // sets completados de ese ejercicio
  done: boolean;     // terminó toda la sesión
}

export function usePartnerPresence(
  enabled: boolean,
  myId: string | null,
  partnerId: string | null,
  myProgress: PartnerProgress,
): PartnerProgress | null {
  const [partner, setPartner] = useState<PartnerProgress | null>(null);
  const [ready, setReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSeenRef = useRef<number>(0);

  // Unirse al canal de la pareja.
  useEffect(() => {
    if (!enabled || !myId || !partnerId) return;
    const key = [myId, partnerId].sort().join('_');
    const channel = supabase.channel(`partner:${key}`, {
      config: { broadcast: { self: false } },
    });
    channel.on('broadcast', { event: 'progress' }, (msg) => {
      const p = msg.payload as Partial<PartnerProgress>;
      lastSeenRef.current = Date.now();
      setPartner({
        exIndex: p.exIndex ?? 0,
        setsDone: p.setsDone ?? 0,
        done: !!p.done,
      });
    });
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') setReady(true); });
    channelRef.current = channel;
    return () => {
      setReady(false);
      try { supabase.removeChannel(channel); } catch { /* noop */ }
      channelRef.current = null;
      lastSeenRef.current = 0;
    };
  }, [enabled, myId, partnerId]);

  // Transmitir mi posición. Reemite con heartbeat aunque no cambie nada, para
  // que el otro lado distinga "en reposo" de "se fue".
  useEffect(() => {
    if (!ready || !channelRef.current) return;
    const emit = () => channelRef.current?.send({
      type: 'broadcast',
      event: 'progress',
      payload: { ...myProgress, from: myId },
    });
    emit();
    const id = setInterval(emit, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [ready, myProgress.exIndex, myProgress.setsDone, myProgress.done, myId]);

  // Vigilante de inactividad: si el compañero no manda señal en PARTNER_STALE_MS,
  // lo damos por desconectado → null (fail-open, el otro puede terminar).
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (lastSeenRef.current && Date.now() - lastSeenRef.current > PARTNER_STALE_MS) {
        setPartner(null);
        lastSeenRef.current = 0;
      }
    }, 3_000);
    return () => clearInterval(id);
  }, [enabled]);

  return enabled ? partner : null;
}
