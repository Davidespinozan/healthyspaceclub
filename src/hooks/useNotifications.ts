import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface AppNotification {
  id: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
  type: 'fire' | 'comment' | 'collab' | 'partner_invite' | 'partner_accept' | 'follow' | 'reminder';
  post_id: string | null;
  preview: string | null;
  read: boolean;
  created_at: string;
}

/**
 * Centro de notificaciones: carga las últimas, mantiene el contador de no
 * leídas y se suscribe en vivo a nuevas inserciones (la campana parpadea sin
 * recargar). Marcar leído es optimista.
 */
export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40);
      if (data) {
        setItems(data as AppNotification[]);
        setUnread((data as AppNotification[]).filter(n => !n.read).length);
      }
    } catch (e) {
      console.warn('[useNotifications] reload failed:', e);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || loadedRef.current) return;
    loadedRef.current = true;
    reload();
  }, [userId, reload]);

  // Realtime: nuevas notificaciones aparecen al instante.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notif:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev].slice(0, 40));
          setUnread(u => u + 1);
        },
      )
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch { /* noop */ } };
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId || unread === 0) return;
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    } catch (e) {
      console.warn('[useNotifications] markAllRead failed:', e);
    }
  }, [userId, unread]);

  return { items, unread, reload, markAllRead };
}
