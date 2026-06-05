// Parte 2 · Co-presencia en vivo de pareja durante el workout.
//
// Usa Supabase Realtime BROADCAST (efímero, sin DB) en un canal determinístico
// por pareja (UUIDs ordenados → ambos calculan el mismo nombre). Cada quien
// transmite su posición (ejercicio/serie/descanso/terminado) y recibe la del
// otro. Si realtime no conecta, falla en silencio (el player sigue funcionando).

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

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

  // Unirse al canal de la pareja.
  useEffect(() => {
    if (!enabled || !myId || !partnerId) return;
    const key = [myId, partnerId].sort().join('_');
    const channel = supabase.channel(`partner:${key}`, {
      config: { broadcast: { self: false } },
    });
    channel.on('broadcast', { event: 'progress' }, (msg) => {
      const p = msg.payload as Partial<PartnerProgress>;
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
    };
  }, [enabled, myId, partnerId]);

  // Transmitir mi posición cuando cambia (y al quedar listo el canal).
  useEffect(() => {
    if (!ready || !channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'progress',
      payload: { ...myProgress, from: myId },
    });
  }, [ready, myProgress.exIndex, myProgress.setsDone, myProgress.done, myId]);

  return enabled ? partner : null;
}
