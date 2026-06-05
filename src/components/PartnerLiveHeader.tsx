// Cabecera "en vivo" de entrenamiento en pareja: los dos avatares (tú + tu
// compañero) + "Entrenando con X" con punto pulsante. Reutilizada en la tarjeta
// de rutina de hoy y dentro del WorkoutPlan (antes del start). Si una foto falla
// o no existe, cae a la inicial.

import { useState } from 'react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import './partner-live-header.css';

function Av({ url, name, cls }: { url: string | null; name: string; cls: string }) {
  const [err, setErr] = useState(false);
  if (url && !err) {
    return <img className={cls} src={url} alt="" onError={() => setErr(true)} />;
  }
  return <span className={`${cls} pl-av--fb`}>{(name.trim().charAt(0) || '?').toUpperCase()}</span>;
}

export default function PartnerLiveHeader({
  partnerName,
  partnerAvatar,
}: {
  partnerName: string;
  partnerAvatar: string | null;
}) {
  const { t } = useT();
  const avatarUrl = useAppStore(s => s.avatarUrl);
  const userName = useAppStore(s => s.userName);

  return (
    <div className="pl-live">
      <div className="pl-avatars">
        <Av url={avatarUrl} name={userName || 'Tú'} cls="pl-av" />
        <Av url={partnerAvatar} name={partnerName} cls="pl-av pl-av--2" />
      </div>
      <span className="pl-live-text">
        <span className="pl-live-dot" />
        <span className="pl-live-label">{t('hoy.trainingWith', { name: partnerName })}</span>
      </span>
    </div>
  );
}
