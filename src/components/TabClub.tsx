import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import type { DashPage } from '../types';

interface ClubPost {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  streak: number;
  workout_summary: string;
  photo_url: string;
  text: string;
  fire_count: number;
  created_at: string;
}

export default function TabClub({ onNav }: { onNav: (page: DashPage) => void }) {
  const { userName, streakCount, dailyWorkout } = useAppStore();
  const userId = useAppStore(s => s.obData.name ? String(s.obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon');

  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [shareText, setShareText] = useState('');
  const [sharing, setSharing] = useState(false);
  const [firedPosts, setFiredPosts] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split('T')[0];
  const workoutToday = dailyWorkout?.date === today ? dailyWorkout.plan as Record<string, unknown> : null;
  const workoutSummary = workoutToday
    ? `${(workoutToday as any).type || 'Entrenamiento'} · ${(workoutToday as any).duration || ''}`
    : '';

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('club_posts')
      .select('*')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setPosts(data);
    setLoading(false);
  }, [today]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Check which posts I've already fired
  useEffect(() => {
    if (posts.length === 0) return;
    supabase
      .from('club_fires')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', posts.map(p => p.id))
      .then(({ data }) => {
        if (data) setFiredPosts(new Set(data.map(d => d.post_id)));
      });
  }, [posts, userId]);

  // Share post
  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    await supabase.from('club_posts').insert({
      user_id: userId,
      username: userName || 'Anónimo',
      avatar_url: '',
      streak: streakCount,
      workout_summary: workoutSummary,
      photo_url: '',
      text: shareText.trim().slice(0, 150),
      fire_count: 0,
    });
    setShareText('');
    setShowShare(false);
    setSharing(false);
    fetchPosts();
  }

  // Toggle fire
  async function toggleFire(post: ClubPost) {
    const alreadyFired = firedPosts.has(post.id);
    if (alreadyFired) {
      await supabase.from('club_fires').delete().eq('post_id', post.id).eq('user_id', userId);
      await supabase.from('club_posts').update({ fire_count: Math.max(0, post.fire_count - 1) }).eq('id', post.id);
      setFiredPosts(prev => { const n = new Set(prev); n.delete(post.id); return n; });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, fire_count: Math.max(0, p.fire_count - 1) } : p));
    } else {
      await supabase.from('club_fires').insert({ post_id: post.id, user_id: userId });
      await supabase.from('club_posts').update({ fire_count: post.fire_count + 1 }).eq('id', post.id);
      setFiredPosts(prev => new Set(prev).add(post.id));
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, fire_count: p.fire_count + 1 } : p));
    }
  }

  function timeAgo(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  return (
    <div className="cl-wrap">
      {/* Header */}
      <div className="cl-header">
        <div className="cl-header-title">El Club</div>
        <div className="cl-header-sub">La comunidad que se transforma junta</div>
      </div>

      <div className="tab-content">
        {/* Share CTA */}
        {workoutToday && (
          <button className="cl-share-cta" onClick={() => setShowShare(true)}>
            Compartir al Club
          </button>
        )}

        {/* Feed */}
        {loading ? (
          <div className="cl-loading">Cargando el Club...</div>
        ) : posts.length === 0 ? (
          <div className="cl-empty">
            <div className="cl-empty-icon">🔥</div>
            <div className="cl-empty-title">El Club empieza contigo</div>
            <div className="cl-empty-sub">Completa tu entrenamiento y comparte tu progreso</div>
          </div>
        ) : (
          <div className="cl-feed">
            {posts.map(post => (
              <div key={post.id} className="cl-post">
                <div className="cl-post-header">
                  <div
                    className="cl-avatar"
                    onClick={() => onNav('huella')}
                  >
                    {post.avatar_url
                      ? <img src={post.avatar_url} alt="" />
                      : <span>{(post.username || '?')[0].toUpperCase()}</span>
                    }
                  </div>
                  <div className="cl-post-meta">
                    <span className="cl-post-name" onClick={() => onNav('huella')}>{post.username}</span>
                    <span className="cl-post-time">{timeAgo(post.created_at)}</span>
                  </div>
                  {post.streak > 0 && <div className="cl-post-streak">🔥 {post.streak}</div>}
                </div>

                {post.workout_summary && (
                  <div className="cl-post-workout">{post.workout_summary}</div>
                )}

                {post.text && <p className="cl-post-text">{post.text}</p>}

                {post.photo_url && (
                  <div className="cl-post-photo">
                    <img src={post.photo_url} alt="" />
                  </div>
                )}

                <button
                  className={`cl-fire-btn${firedPosts.has(post.id) ? ' fired' : ''}`}
                  onClick={() => toggleFire(post)}
                >
                  🔥 {post.fire_count > 0 ? post.fire_count : ''}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShare && (
        <div className="cl-modal-backdrop" onClick={() => setShowShare(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-handle" />
            <div className="cl-modal-title">Compartir al Club</div>

            {workoutSummary && (
              <div className="cl-modal-workout">{workoutSummary}</div>
            )}

            <div className="cl-modal-streak">🔥 Racha: {streakCount} días</div>

            <textarea
              className="cl-modal-input"
              placeholder="¿Cómo te fue hoy? (máx 150 caracteres)"
              maxLength={150}
              value={shareText}
              onChange={e => setShareText(e.target.value)}
            />
            <div className="cl-modal-count">{shareText.length}/150</div>

            <button
              className="cl-modal-submit"
              onClick={handleShare}
              disabled={sharing}
            >
              {sharing ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
