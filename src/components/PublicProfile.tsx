import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './public-profile.css';

interface ProfileData {
  display_name: string;
  bio: string;
  avatar_url: string;
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
  onClose: () => void;
}

export default function PublicProfile({ userId, onClose }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [profileRes, postsRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('display_name, bio, avatar_url')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('club_posts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (postsRes.data) setPosts(postsRes.data);
      setLoading(false);
    }
    load();
  }, [userId]);

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

  const displayName = profile?.display_name || posts[0]?.username || userId;
  const initial = (displayName || '?')[0].toUpperCase();
  const avatarUrl = profile?.avatar_url || posts[0]?.avatar_url || '';

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'short' });
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} · ${hours}:${mins}`;
  }

  return (
    <div className="pp-backdrop" onClick={onClose}>
      <div className="pp-modal" onClick={e => e.stopPropagation()}>
        <button className="pp-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        {loading ? (
          <div className="pp-loading">
            <div className="pp-spinner" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="pp-header">
              <div className="pp-avatar">
                {avatarUrl
                  ? <img src={avatarUrl} alt="" className="pp-avatar-img" />
                  : <span className="pp-avatar-letter">{initial}</span>
                }
              </div>
              <h2 className="pp-name">{displayName}</h2>
              {profile?.bio && <p className="pp-bio">{profile.bio}</p>}
              <div className="pp-stats">
                <div className="pp-stat">
                  <span className="pp-stat-num">{posts.length}</span>
                  <span className="pp-stat-lbl">posts</span>
                </div>
                {posts[0]?.streak > 0 && (
                  <div className="pp-stat">
                    <span className="pp-stat-num">🔥 {posts[0].streak}</span>
                    <span className="pp-stat-lbl">racha</span>
                  </div>
                )}
              </div>
            </div>

            {/* Feed */}
            {posts.length > 0 ? (
              <div className="pp-feed">
                {posts.map(post => (
                  <div key={post.id} className="pp-post">
                    {post.photo_url && (
                      post.photo_url.match(/\.(mp4|mov|webm)$/i)
                        ? <video src={post.photo_url} className="pp-post-media" controls playsInline />
                        : <img src={post.photo_url} alt="" className="pp-post-media" />
                    )}
                    {post.text && (
                      <p className="pp-post-text">{post.text}</p>
                    )}
                    <div className="pp-post-footer">
                      <span className="pp-post-date">{formatDate(post.created_at)}</span>
                      {post.workout_summary && (
                        <span className="pp-post-workout">{post.workout_summary}</span>
                      )}
                      {post.fire_count > 0 && (
                        <span className="pp-post-fires">🔥 {post.fire_count}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pp-empty">
                <p className="pp-empty-text">Aún no ha publicado nada.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
