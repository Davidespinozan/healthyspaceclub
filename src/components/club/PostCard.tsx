import { useState, useEffect, useRef } from 'react';
import { Flame, MessageCircle } from 'lucide-react';
import { useT } from '../../i18n';
import { plural } from '../../i18n/format';
import type { TranslationKey } from '../../i18n/es';
import './post-card.css';

// Tipo loose para t() — evita acoplar a la signature exacta de useT.
type TFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface ClubPost {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  streak: number | null;
  workout_summary: string | null;
  photo_url: string | null;
  text: string | null;
  fire_count: number;
  comments_count: number;
  aspect_ratio: '1:1' | '3:4' | '4:3';
  created_at: string;
  // Colab estilo Instagram + contexto enriquecido.
  coauthor_id?: string | null;
  coauthor_username?: string | null;
  coauthor_avatar_url?: string | null;
  coauthor_accepted?: boolean | null;
  meal_summary?: string | null;
  post_context?: 'workout' | 'meal' | 'free' | null;
}

interface Props {
  post: ClubPost;
  currentUserId: string | null;
  hasFire: boolean;
  onFireToggle: (postId: string) => void;
  onAuthorTap: (userId: string) => void;
  onCommentTap?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  showAuthor?: boolean;
}

function timeAgo(dateStr: string, t: TFn): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return t('post.timeJustNow');
  if (diffMin < 60) return t('post.timeMin', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('post.timeHour', { n: diffH });
  const diffD = Math.floor(diffH / 24);
  return t('post.timeDay', { n: diffD });
}

export default function PostCard({
  post,
  currentUserId,
  hasFire,
  onFireToggle,
  onAuthorTap,
  onCommentTap,
  onDelete,
  showAuthor = true,
}: Props) {
  const { t } = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwn = currentUserId === post.user_id;
  const streak = post.streak ?? 0;
  // La atribución dual solo se muestra cuando el coautor ACEPTÓ la colaboración.
  const isCollab = !!post.coauthor_id && post.coauthor_accepted === true;
  // Tag de contexto: comida si el post nació en una comida, si no el entreno.
  const contextTag = post.post_context === 'meal' ? post.meal_summary : post.workout_summary;

  // Cerrar el dropdown del kebab al tap fuera (patrón UX universal).
  // Usamos mousedown + touchstart (no click) para responsividad en mobile.
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [menuOpen]);

  return (
    <article className="post-card">
      {isOwn && onDelete && (
        <div className="post-card-menu" ref={menuRef}>
          <button
            type="button"
            className="post-card-menu-trigger"
            aria-label={t('post.ariaOptions')}
            onClick={() => setMenuOpen(o => !o)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="post-card-menu-dropdown">
              <button
                type="button"
                className="post-card-menu-item"
                onClick={() => { setMenuOpen(false); onDelete(post.id); }}
              >
                {t('post.delete')}
              </button>
            </div>
          )}
        </div>
      )}

      {showAuthor && (
        <div className="post-card-head">
          <div
            className="post-card-author"
            role="button"
            tabIndex={0}
            onClick={() => onAuthorTap(post.user_id)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') onAuthorTap(post.user_id);
            }}
          >
            <div className={`post-card-avatar${isCollab ? ' is-collab' : ''}`}>
              {post.avatar_url
                ? <img src={post.avatar_url} alt="" />
                : <span>{(post.username || '?')[0].toUpperCase()}</span>
              }
              {isCollab && (
                <div className="post-card-avatar-co">
                  {post.coauthor_avatar_url
                    ? <img src={post.coauthor_avatar_url} alt="" />
                    : <span>{(post.coauthor_username || '?')[0].toUpperCase()}</span>
                  }
                </div>
              )}
            </div>
            <div className="post-card-meta">
              <div className="post-card-name">
                <span className="post-card-username">{post.username || t('post.anonymous')}</span>
                {isCollab && (
                  <span
                    className="post-card-collab"
                    onClick={e => { e.stopPropagation(); if (post.coauthor_id) onAuthorTap(post.coauthor_id); }}
                  >
                    {' '}{t('post.collabWith', { name: post.coauthor_username || '' })}
                  </span>
                )}
                {streak > 0 && (
                  <span className="post-card-streak"> {plural(streak, {
                    one: t('post.streakDaysOne', { streak }),
                    other: t('post.streakDaysOther', { streak }),
                  })}</span>
                )}
              </div>
              <div className="post-card-time">{timeAgo(post.created_at, t)}</div>
            </div>
          </div>

          {contextTag && (
            <span className="post-card-tag">{contextTag}</span>
          )}
        </div>
      )}

      {/* En el perfil (showAuthor=false) no se ve la cabecera; si es colab,
          mostramos una tira compacta con ambos autores. */}
      {!showAuthor && isCollab && (
        <div className="post-card-collab-strip">
          <div className="post-card-collab-avs">
            <div className="post-card-collab-av">
              {post.avatar_url
                ? <img src={post.avatar_url} alt="" />
                : <span>{(post.username || '?')[0].toUpperCase()}</span>}
            </div>
            <div className="post-card-collab-av post-card-collab-av--2">
              {post.coauthor_avatar_url
                ? <img src={post.coauthor_avatar_url} alt="" />
                : <span>{(post.coauthor_username || '?')[0].toUpperCase()}</span>}
            </div>
          </div>
          <span className="post-card-collab-names">
            @{post.username} · @{post.coauthor_username}
          </span>
        </div>
      )}

      {post.photo_url && (
        <div className="post-card-media" data-aspect={post.aspect_ratio}>
          <img src={post.photo_url} alt="" loading="lazy" />
        </div>
      )}

      {post.text && <p className="post-card-text">{post.text}</p>}

      <div className="post-card-actions">
        <button
          type="button"
          className={`post-card-fire${hasFire ? ' is-active' : ''}`}
          onClick={() => onFireToggle(post.id)}
          aria-label={hasFire ? t('post.ariaRemoveFire') : t('post.ariaAddFire')}
          aria-pressed={hasFire}
        >
          <Flame size={16} strokeWidth={1.6} fill={hasFire ? 'currentColor' : 'none'} />
          <span>{post.fire_count}</span>
        </button>
        <button
          type="button"
          className="post-card-comments"
          onClick={() => onCommentTap?.(post.id)}
          aria-label={plural(post.comments_count, {
            one: t('post.ariaCommentsOne', { count: post.comments_count }),
            other: t('post.ariaCommentsOther', { count: post.comments_count }),
          })}
        >
          <MessageCircle size={16} strokeWidth={1.6} />
          {post.comments_count > 0 && <span>{post.comments_count}</span>}
        </button>
      </div>
    </article>
  );
}
