import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PostCard, { type ClubPost } from './club/PostCard';
import './public-profile.css';

interface ProfileData {
  display_name: string;
  bio: string;
  avatar_url: string;
  created_at?: string;
}

interface Props {
  userId: string;
  currentUserId?: string; // para saber si este usuario puede dar fire
  onClose: () => void;
}

export default function PublicProfile({ userId, currentUserId, onClose }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<ClubPost[]>([]);
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
        if (postsRes.data) setPosts(postsRes.data as ClubPost[]);

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

            {/* Feed — usa PostCard compartido, sin author (ya está en el header del perfil) */}
            {posts.length > 0 ? (
              <div className="pp-feed">
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId ?? null}
                    hasFire={userFires.has(post.id)}
                    onFireToggle={() => toggleFire(post.id)}
                    onAuthorTap={() => { /* ya estamos en su perfil */ }}
                    showAuthor={false}
                  />
                ))}
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
