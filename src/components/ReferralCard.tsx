import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useT } from '../i18n';
import { inviteLink } from '../utils/referral';
import { track } from '../utils/analytics';
import './referral-card.css';

// Hace VISIBLE el programa de referidos (antes invisible → nadie lo usaba). Muestra
// el premio, el link para compartir y cuánta gente has invitado. El otorgamiento del
// premio (Stripe) va aparte; aquí solo se invita y se muestra el avance.
export default function ReferralCard({ username, userId }: { username: string | null; userId: string }) {
  const { t } = useT();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const { count: n } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', userId);
      if (active) setCount(n ?? 0);
    })();
    return () => { active = false; };
  }, [userId]);

  if (!username) return null;

  async function invite() {
    track('referral_invite_opened');
    const link = inviteLink(username!);
    try {
      if (navigator.share) await navigator.share({ text: t('profile.referralShareText'), url: link });
      else await navigator.clipboard.writeText(link);
    } catch { /* canceló el share nativo */ }
  }

  return (
    <div className="refc">
      <div className="refc-icon" aria-hidden="true"><Gift size={20} strokeWidth={2} /></div>
      <div className="refc-body">
        <div className="refc-title">{t('profile.referralTitle')}</div>
        <div className="refc-sub">{t('profile.referralSub')}</div>
        {count != null && count > 0 && (
          <div className="refc-count">{t('profile.referralCount', { n: count })}</div>
        )}
      </div>
      <button type="button" className="refc-cta" onClick={invite}>{t('profile.referralCta')}</button>
    </div>
  );
}
