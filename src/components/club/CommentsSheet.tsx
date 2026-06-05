import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/es';
import './comments-sheet.css';

type TFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface Comment {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  text: string;
  created_at: string;
}

interface Props {
  postId: string | null;
  currentUserId: string | null;
  onClose: () => void;
  /** Avisa al feed para ajustar el contador del post de forma optimista. */
  onCountChange?: (postId: string, delta: number) => void;
  onAuthorTap?: (userId: string) => void;
}

const MAX_COMMENT = 300;

function timeAgo(dateStr: string, t: TFn): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 1) return t('comments.timeJustNow');
  if (diffMin < 60) return t('comments.timeMin', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('comments.timeHour', { n: diffH });
  return t('comments.timeDay', { n: Math.floor(diffH / 24) });
}

export default function CommentsSheet({ postId, currentUserId, onClose, onCountChange, onAuthorTap }: Props) {
  const { t } = useT();
  const { userName } = useAppStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [myAvatar, setMyAvatar] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const open = postId !== null;

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('club_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (data) setComments(data as Comment[]);
    } catch (e) {
      console.warn('[CommentsSheet] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!open) { setComments([]); setDraft(''); return; }
    load();
  }, [open, load]);

  // Avatar propio para el insert (username viene del store).
  useEffect(() => {
    if (!open || !currentUserId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .eq('user_id', currentUserId)
          .single();
        if (data?.avatar_url) setMyAvatar(data.avatar_url);
      } catch { /* noop */ }
    })();
  }, [open, currentUserId]);

  // Lock scroll del body mientras está abierta.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  async function handleSend() {
    const text = draft.trim().slice(0, MAX_COMMENT);
    if (!text || !postId || !currentUserId || sending) return;
    setSending(true);
    // Optimista: pinta el comentario al instante.
    const optimistic: Comment = {
      id: `tmp-${Date.now()}`,
      user_id: currentUserId,
      username: userName || t('comments.anonymous'),
      avatar_url: myAvatar,
      text,
      created_at: new Date().toISOString(),
    };
    setComments(prev => [...prev, optimistic]);
    setDraft('');
    onCountChange?.(postId, 1);
    try {
      const { data, error } = await supabase
        .from('club_comments')
        .insert({
          post_id: postId,
          user_id: currentUserId,
          username: userName || t('comments.anonymous'),
          avatar_url: myAvatar,
          text,
        })
        .select()
        .single();
      if (error) throw error;
      // Reemplaza el optimista por el real (id correcto para borrar).
      if (data) {
        setComments(prev => prev.map(c => c.id === optimistic.id ? (data as Comment) : c));
      }
    } catch (e) {
      console.warn('[CommentsSheet] send failed:', e);
      // Revierte el optimista.
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
      onCountChange?.(postId, -1);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!postId) return;
    if (!window.confirm(t('comments.deleteConfirm'))) return;
    const prev = comments;
    setComments(c => c.filter(x => x.id !== id));
    onCountChange?.(postId, -1);
    try {
      await supabase.from('club_comments').delete().eq('id', id);
    } catch (e) {
      console.warn('[CommentsSheet] delete failed:', e);
      setComments(prev);
      onCountChange?.(postId, 1);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="cms-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cms-sheet" onClick={e => e.stopPropagation()}>
        <header className="cms-head">
          <div className="cms-handle" />
          <h2 className="cms-title">{t('comments.title')}</h2>
          <button type="button" className="cms-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </header>

        <div className="cms-list">
          {loading ? (
            <div className="cms-loading"><div className="cms-spinner" /></div>
          ) : comments.length === 0 ? (
            <p className="cms-empty">{t('comments.empty')}</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="cms-item">
                <div
                  className="cms-avatar"
                  role={onAuthorTap ? 'button' : undefined}
                  onClick={() => onAuthorTap?.(c.user_id)}
                >
                  {c.avatar_url
                    ? <img src={c.avatar_url} alt="" />
                    : <span>{(c.username || '?')[0].toUpperCase()}</span>}
                </div>
                <div className="cms-body">
                  <div className="cms-meta">
                    <span className="cms-name">{c.username || t('comments.anonymous')}</span>
                    <span className="cms-time">{timeAgo(c.created_at, t)}</span>
                  </div>
                  <p className="cms-text">{c.text}</p>
                </div>
                {c.user_id === currentUserId && !c.id.startsWith('tmp-') && (
                  <button
                    type="button"
                    className="cms-del"
                    onClick={() => handleDelete(c.id)}
                    aria-label={t('comments.delete')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="cms-compose">
          <input
            ref={inputRef}
            className="cms-input"
            placeholder={t('comments.placeholder')}
            value={draft}
            maxLength={MAX_COMMENT}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          />
          <button
            type="button"
            className="cms-send"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            aria-label={t('comments.send')}
          >
            <Send size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
