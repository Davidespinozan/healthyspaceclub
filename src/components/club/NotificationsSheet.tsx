import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { X, Flame, MessageCircle, Users, UserPlus, Check, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/es';
import type { AppNotification } from '../../hooks/useNotifications';
import './notifications-sheet.css';

type TFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface Props {
  open: boolean;
  items: AppNotification[];
  onClose: () => void;
  onTapPost?: (postId: string) => void;
  onTapActor?: (userId: string) => void;
}

function timeAgo(dateStr: string, t: TFn): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return t('notif.timeJustNow');
  if (diffMin < 60) return t('notif.timeMin', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('notif.timeHour', { n: diffH });
  return t('notif.timeDay', { n: Math.floor(diffH / 24) });
}

function iconFor(type: AppNotification['type']) {
  switch (type) {
    case 'fire': return <Flame size={15} strokeWidth={2} />;
    case 'comment': return <MessageCircle size={15} strokeWidth={2} />;
    case 'collab': return <Users size={15} strokeWidth={2} />;
    case 'partner_invite': return <UserPlus size={15} strokeWidth={2} />;
    case 'partner_accept': return <Check size={15} strokeWidth={2} />;
    case 'follow': return <UserCheck size={15} strokeWidth={2} />;
  }
}

function textFor(n: AppNotification, t: TFn): string {
  switch (n.type) {
    case 'fire': return t('notif.fire');
    case 'comment': return n.preview ? t('notif.comment', { preview: n.preview }) : t('notif.commentNoPreview');
    case 'collab': return t('notif.collab');
    case 'partner_invite': return t('notif.partnerInvite');
    case 'partner_accept': return t('notif.partnerAccept');
    case 'follow': return t('notif.follow');
  }
}

export default function NotificationsSheet({ open, items, onClose, onTapPost, onTapActor }: Props) {
  const { t } = useT();
  // Estado local de respuesta a colaboraciones (aceptada/rechazada).
  const [collabResp, setCollabResp] = useState<Record<string, 'accepted' | 'rejected'>>({});

  async function respondCollab(notifId: string, postId: string, accept: boolean) {
    setCollabResp(prev => ({ ...prev, [notifId]: accept ? 'accepted' : 'rejected' }));
    try {
      if (accept) {
        await supabase.from('club_posts').update({ coauthor_accepted: true }).eq('id', postId);
      } else {
        // Rechazar: el post deja de ser colaboración (se queda solo del autor).
        await supabase.from('club_posts')
          .update({ coauthor_id: null, coauthor_username: '', coauthor_avatar_url: '', coauthor_accepted: false })
          .eq('id', postId);
      }
    } catch (e) {
      console.warn('[NotificationsSheet] collab respond failed:', e);
    }
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="nts-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="nts-sheet" onClick={e => e.stopPropagation()}>
        <header className="nts-head">
          <div className="nts-handle" />
          <h2 className="nts-title">{t('notif.title')}</h2>
          <button type="button" className="nts-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </header>

        <div className="nts-list">
          {items.length === 0 ? (
            <p className="nts-empty">{t('notif.empty')}</p>
          ) : (
            items.map(n => {
              const name = n.actor_username || t('notif.someone');
              const tappable = !!(n.post_id && onTapPost);
              return (
                <div
                  key={n.id}
                  className={`nts-item${n.read ? '' : ' is-unread'}${tappable ? ' is-tappable' : ''}`}
                  onClick={() => { if (n.post_id && onTapPost) onTapPost(n.post_id); }}
                >
                  <div
                    className="nts-avatar"
                    onClick={(e) => { e.stopPropagation(); if (n.actor_id && onTapActor) onTapActor(n.actor_id); }}
                  >
                    {n.actor_avatar_url
                      ? <img src={n.actor_avatar_url} alt="" />
                      : <span>{name[0].toUpperCase()}</span>}
                    <span className={`nts-badge nts-badge--${n.type}`}>{iconFor(n.type)}</span>
                  </div>
                  <div className="nts-body">
                    <p className="nts-text">
                      <span className="nts-name">{name}</span>{' '}{textFor(n, t)}
                    </p>
                    <span className="nts-time">{timeAgo(n.created_at, t)}</span>
                    {/* Colaboración: aceptar/rechazar inline (estilo Instagram). */}
                    {n.type === 'collab' && n.post_id && (
                      collabResp[n.id] ? (
                        <span className={`nts-collab-result nts-collab-result--${collabResp[n.id]}`}>
                          {collabResp[n.id] === 'accepted' ? t('notif.collabAccepted') : t('notif.collabRejected')}
                        </span>
                      ) : (
                        <div className="nts-collab-actions" onClick={e => e.stopPropagation()}>
                          <button type="button" className="nts-collab-accept" onClick={() => respondCollab(n.id, n.post_id!, true)}>
                            {t('notif.accept')}
                          </button>
                          <button type="button" className="nts-collab-reject" onClick={() => respondCollab(n.id, n.post_id!, false)}>
                            {t('notif.reject')}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                  {!n.read && <span className="nts-dot" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
