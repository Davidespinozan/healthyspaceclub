import { useEffect, useState } from 'react';
import { X, Flame } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './public-profile.css';

interface ProfileData {
  display_name: string;
  bio: string;
  avatar_url: string;
  created_at?: string;
}

interface PostData {
  id: string;
  username: string;
  avatar_url: string;
  streak: number;
  workout_summary: string;
  photo_url: string;
  text: string;
  fire_count: number;
  created_at: string;
}

interface Props {
  userId: string;
  currentUserId?: string; // para saber si este usuario puede dar fire
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return 'justo ahora';
  if (mins < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days}d`;

  const day = d.getDate();
  const month = d.toLocaleDateString('es-ES', { month: 'short' });
  return `${day} ${month}`;
}

export default function PublicProfile({ userId, currentUserId, onClose }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFires, setUserFires] = useState<Set<string>>(new Set());
  const [firingPost, setFiringPost] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, postsRes] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('display_name, bio, avatar_url, created_at')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('club_posts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),
        ]);

        if (profileRes.error) throw new Error(profileRes.error.message);
        if (postsRes.error) throw new Error(postsRes.error.message);

        if (profileRes.data) setProfile(profileRes.data);
        if (postsRes.data) setPosts(postsRes.data);

        // Cargar fires del currentUser sobre estos posts
        if (currentUserId && postsRes.data && postsRes.data.length > 0) {
          const postIds = postsRes.data.map(p => p.id);
          const firesRes = await supabase
            .from('club_fires')
            .select('post_id')
            .eq('user_id', currentUserId)
            .in('post_id', postIds);

          if (firesRes.data) {
            setUserFires(new Set(firesRes.data.map(f => f.post_id)));
          }
        }
      } catch (e: any) {
        console.warn('[public-profile] load failed:', e);
        setError(e.message || 'No se pudo cargar el perfil');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, currentUserId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function toggleFire(postId: string) {
    if (!currentUserId || firingPost === postId) return;
    setFiringPost(postId);

    const hasFire = userFires.has(postId);

    try {
      if (hasFire) {
        await supabase
          .from('club_fires')
          .delete()
          .eq('user_id', currentUserId)
          .eq('post_id', postId);

        const newFires = new Set(userFires);
        newFires.delete(postId);
        setUserFires(newFires);

        setPosts(posts.map(p =>
          p.id === postId ? { ...p, fire_count: Math.max(0, p.fire_count - 1) } : p
        ));
      } else {
        await supabase
          .from('club_fires')
          .insert({ user_id: currentUserId, post_id: postId });

        const newFires = new Set(userFires);
        newFires.add(postId);
        setUserFires(newFires);

        setPosts(posts.map(p =>
          p.id === postId ? { ...p, fire_count: p.fire_count + 1 } : p
        ));
      }
    } catch (e) {
      console.warn('[public-profile] fire toggle failed:', e);
    } finally {
      setFiringPost(null);
    }
  }

  const displayName = profile?.display_name || posts[0]?.username || userId;
  const initial = (displayName || '?')[0].toUpperCase();
  const avatarUrl = profile?.avatar_url || posts[0]?.avatar_url || '';
  const totalFires = posts.reduce((sum, p) => sum + (p.fire_count || 0), 0);
  const currentStreak = posts[0]?.streak ?? 0;
  const memberSince = profile?.created_at || posts[posts.length - 1]?.created_at;

  return (
    <div className="pp-backdrop" onClick={onClose}>
      <div className="pp-modal" onClick={e => e.stopPropagation()}>
        <button className="pp-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        {loading ? (
          <div className="pp-loading">
            <div className="pp-spinner" />
            <p className="pp-loading-text">Cargando perfil...</p>
          </div>
        ) : error ? (
          <div className="pp-error">
            <p className="pp-error-text">{error}</p>
            <button className="pp-error-btn" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="pp-header">
              <div className="pp-avatar">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="pp-avatar-img"
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="pp-avatar-letter">{initial}</span>
                )}
              </div>
              <h2 className="pp-name">{displayName}</h2>
              {profile?.bio && <p className="pp-bio">{profile.bio}</p>}

              <div className="pp-stats">
                <div className="pp-stat">
                  <span className="pp-stat-num">{posts.length}</span>
                  <span className="pp-stat-lbl">posts</span>
                </div>
                {currentStreak > 0 && (
                  <div className="pp-stat">
                    <span className="pp-stat-num">🔥 {currentStreak}</span>
                    <span className="pp-stat-lbl">racha</span>
                  </div>
                )}
                {totalFires > 0 && (
                  <div className="pp-stat">
                    <span className="pp-stat-num">{totalFires}</span>
                    <span className="pp-stat-lbl">fires recibidos</span>
                  </div>
                )}
              </div>

              {memberSince && (
                <p className="pp-member-since">
                  Miembro desde {new Date(memberSince).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* Feed */}
            {posts.length > 0 ? (
              <div className="pp-feed">
                {posts.map(post => {
                  const hasFire = userFires.has(post.id);
                  const isOwnPost = currentUserId === userId;

                  return (
                    <div key={post.id} className="pp-post">
                      {post.workout_summary && (
                        <div className="pp-post-workout-chip">
                          💪 {post.workout_summary}
                        </div>
                      )}

                      {post.photo_url && (
                        post.photo_url.match(/\.(mp4|mov|webm)$/i) ? (
                          <video
                            src={post.photo_url}
                            className="pp-post-media"
                            autoPlay
                            muted
                            loop
                            playsInline
                            onError={e => {
                              (e.target as HTMLVideoElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <img
                            src={post.photo_url}
                            alt=""
                            className="pp-post-media"
                            onError={e => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )
                      )}

                      {post.text && (
                        <p className="pp-post-text">{post.text}</p>
                      )}

                      <div className="pp-post-footer">
                        <span className="pp-post-date">{timeAgo(post.created_at)}</span>

                        {currentUserId && !isOwnPost ? (
                          <button
                            className={`pp-post-fire${hasFire ? ' on' : ''}`}
                            onClick={() => toggleFire(post.id)}
                            disabled={firingPost === post.id}
                            aria-label={hasFire ? 'Quitar fire' : 'Dar fire'}
                          >
                            <Flame size={14} fill={hasFire ? 'currentColor' : 'none'} />
                            <span>{post.fire_count}</span>
                          </button>
                        ) : post.fire_count > 0 && (
                          <span className="pp-post-fires">
                            🔥 {post.fire_count}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pp-empty">
                <div className="pp-empty-emoji">🌱</div>
                <p className="pp-empty-text">
                  {displayName} aún no ha publicado nada.
                </p>
                <p className="pp-empty-sub">
                  Apenas comienza su espacio.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
