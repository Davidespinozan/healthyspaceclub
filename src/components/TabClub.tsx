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
  const [shareMedia, setShareMedia] = useState<File | null>(null);
  const [sharePreview, setSharePreview] = useState<string | null>(null);
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
    try {
      const { data } = await supabase
        .from('club_posts')
        .select('*')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setPosts(data);
    } catch (e) { console.warn('[TabClub] query failed:', e); }
    setLoading(false);
  }, [today]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Check which posts I've already fired
  useEffect(() => {
    if (posts.length === 0) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('club_fires')
          .select('post_id')
          .eq('user_id', userId)
          .in('post_id', posts.map(p => p.id));
        if (data) setFiredPosts(new Set(data.map(d => d.post_id)));
      } catch (e) { console.warn('[TabClub] query failed:', e); }
    })();
  }, [posts, userId]);

  // Handle media selection
  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setShareMedia(file);
    const url = URL.createObjectURL(file);
    setSharePreview(url);
  }

  function clearMedia() {
    setShareMedia(null);
    if (sharePreview) URL.revokeObjectURL(sharePreview);
    setSharePreview(null);
  }

  // Share post with optional media upload
  async function handleShare() {
    if (sharing) return;
    setSharing(true);

    try {
      let photoUrl = '';
      if (shareMedia) {
        const ext = shareMedia.name.split('.').pop() || 'jpg';
        const path = `${userId}_${Date.now()}.${ext}`;
        await supabase.storage.from('club').upload(path, shareMedia);
        const { data } = supabase.storage.from('club').getPublicUrl(path);
        photoUrl = data.publicUrl;
      }

      await supabase.from('club_posts').insert({
        user_id: userId,
        username: userName || 'Anónimo',
        avatar_url: '',
        streak: streakCount,
        workout_summary: workoutSummary,
        photo_url: photoUrl,
        text: shareText.trim().slice(0, 150),
        fire_count: 0,
      });
    } catch (e) { console.warn('[TabClub] mutation failed:', e); }

    setShareText('');
    clearMedia();
    setShowShare(false);
    setSharing(false);
    fetchPosts();
  }

  // Toggle fire
  async function toggleFire(post: ClubPost) {
    const alreadyFired = firedPosts.has(post.id);
    if (alreadyFired) {
      try {
        await supabase.from('club_fires').delete().eq('post_id', post.id).eq('user_id', userId);
        await supabase.from('club_posts').update({ fire_count: Math.max(0, post.fire_count - 1) }).eq('id', post.id);
      } catch (e) { console.warn('[TabClub] mutation failed:', e); }
      setFiredPosts(prev => { const n = new Set(prev); n.delete(post.id); return n; });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, fire_count: Math.max(0, p.fire_count - 1) } : p));
    } else {
      try {
        await supabase.from('club_fires').insert({ post_id: post.id, user_id: userId });
        await supabase.from('club_posts').update({ fire_count: post.fire_count + 1 }).eq('id', post.id);
      } catch (e) { console.warn('[TabClub] mutation failed:', e); }
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
        <button className="cl-share-cta" onClick={() => setShowShare(true)}>
          + Compartir al Club
        </button>

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
                    {post.photo_url.match(/\.(mp4|mov|webm)$/i)
                      ? <video src={post.photo_url} controls />
                      : <img src={post.photo_url} alt="" />
                    }
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

      {/* Share Modal — Instagram story style */}
      {showShare && (
        <div className="cl-modal-backdrop" onClick={() => { clearMedia(); setShowShare(false); }}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-handle" />

            {/* Media preview or picker */}
            {sharePreview ? (
              <div className="cl-media-preview">
                {shareMedia?.type.startsWith('video/')
                  ? <video src={sharePreview} className="cl-media-content" controls />
                  : <img src={sharePreview} alt="" className="cl-media-content" />
                }
                <button className="cl-media-remove" onClick={clearMedia}>✕</button>
              </div>
            ) : (
              <label className="cl-media-picker">
                <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} hidden />
                <div className="cl-media-picker-icon">📷</div>
                <div className="cl-media-picker-text">Foto o video</div>
              </label>
            )}

            {/* Text + meta */}
            <textarea
              className="cl-modal-input"
              placeholder="¿Cómo te fue hoy?"
              maxLength={150}
              value={shareText}
              onChange={e => setShareText(e.target.value)}
            />
            <div className="cl-modal-meta">
              <div className="cl-modal-count">{shareText.length}/150</div>
              {workoutSummary && <div className="cl-modal-workout">{workoutSummary}</div>}
              <div className="cl-modal-streak">🔥 {streakCount}</div>
            </div>

            <button
              className="cl-modal-submit"
              onClick={handleShare}
              disabled={sharing || (!shareText.trim() && !shareMedia)}
            >
              {sharing ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
