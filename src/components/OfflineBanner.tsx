import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useT } from '../i18n';

/**
 * Banner global de "sin conexión". Siendo PWA con service worker agresivo, el
 * shell abre sin red pero toda llamada a Supabase falla en silencio; sin esto el
 * usuario ve datos viejos como si estuvieran al día y no distingue "no hay datos"
 * de "no hay red". Escucha navigator.onLine + eventos online/offline.
 */
export default function OfflineBanner() {
  const { t } = useT();
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999,
        background: '#B4453C', color: '#fff', padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 14, fontWeight: 700, textAlign: 'center',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
      }}
    >
      <WifiOff size={16} strokeWidth={2.2} aria-hidden="true" />
      {t('common.offline')}
    </div>
  );
}
