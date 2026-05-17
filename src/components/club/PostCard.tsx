import { useState } from 'react';
import { Flame, MessageCircle } from 'lucide-react';
import './post-card.css';

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
  aspect_ratio: '1:1' | '4:5' | '4:3';
  created_at: string;
}

interface Props {
  post: ClubPost;
  currentUserId: string | null;
  hasFire: boolean;
  onFireToggle: (postId: string) => void;
  onAuthorTap: (userId: string) => void;
  onDelete?: (postId: string) => void;
  showAuthor?: boolean;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

export default function PostCard({
  post,
  currentUserId,
  hasFire,
  onFireToggle,
  onAuthorTap,
  onDelete,
  showAuthor = true,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwn = currentUserId === post.user_id;
  const streak = post.streak ?? 0;

  return (
    <article className="post-card">
      {isOwn && onDelete && (
        <div className="post-card-menu">
          <button
            type="button"
            className="post-card-menu-trigger"
            aria-label="Opciones del post"
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
                Borrar
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
            <div className="post-card-avatar">
              {post.avatar_url
                ? <img src={post.avatar_url} alt="" />
                : <span>{(post.username || '?')[0].toUpperCase()}</span>
              }
            </div>
            <div className="post-card-meta">
              <div className="post-card-name">
                <span className="post-card-username">{post.username || 'Anónimo'}</span>
                {streak > 0 && <span className="post-card-streak"> · {streak} días</span>}
              </div>
              <div className="post-card-time">{timeAgo(post.created_at)}</div>
            </div>
          </div>

          {post.workout_summary && (
            <span className="post-card-tag">{post.workout_summary}</span>
          )}
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
          aria-label={hasFire ? 'Quitar fire' : 'Dar fire'}
          aria-pressed={hasFire}
        >
          <Flame size={16} strokeWidth={1.6} fill={hasFire ? 'currentColor' : 'none'} />
          <span>{post.fire_count}</span>
        </button>
        {post.comments_count > 0 && (
          <div className="post-card-comments" aria-label={`${post.comments_count} comentarios`}>
            <MessageCircle size={16} strokeWidth={1.6} />
            <span>{post.comments_count}</span>
          </div>
        )}
      </div>
    </article>
  );
}
