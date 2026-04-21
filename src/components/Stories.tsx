import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import PublicProfile from './PublicProfile';
import { validateMediaFile } from '../utils/mediaValidation';

interface StoryPost {
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

export default function Stories() {
  const { userName, streakCount, dailyWorkout, obData } = useAppStore();
  const userId = obData.name ? String(obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon';

  const [posts, setPosts] = useState<StoryPost[]>([]);
  const [viewingIdx, setViewingIdx] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [shareText, setShareText] = useState('');
  const [shareMedia, setShareMedia] = useState<File | null>(null);
  const [sharePreview, setSharePreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const workoutToday = dailyWorkout?.date === today ? dailyWorkout.plan as Record<string, unknown> : null;
  const workoutSummary = workoutToday
    ? `${(workoutToday as any).type || 'Entrenamiento'} · ${(workoutToday as any).duration || ''}`
    : '';

  // Fetch today's stories
  const fetchPosts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('club_posts')
        .select('*')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) setPosts(data);
    } catch (e) { console.warn('[Stories] query failed:', e); }
  }, [today]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Fetch user's avatar
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('user_profiles').select('avatar_url').eq('user_id', userId).single();
        if (data?.avatar_url) setUserAvatarUrl(data.avatar_url);
      } catch (e) { console.warn('[Stories] query failed:', e); }
    })();
  }, [userId]);

  // Group by user (show 1 bubble per user, latest post)
  const userStories = posts.reduce<Record<string, StoryPost[]>>((acc, p) => {
    if (!acc[p.user_id]) acc[p.user_id] = [];
    acc[p.user_id].push(p);
    return acc;
  }, {});
  const bubbles = Object.values(userStories).map(arr => arr[0]);

  // Media handlers
  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateMediaFile(file, true);
    if (!check.valid) { alert(check.error); return; }
    setShareMedia(file);
    setSharePreview(URL.createObjectURL(file));
  }

  function clearMedia() {
    setShareMedia(null);
    if (sharePreview) URL.revokeObjectURL(sharePreview);
    setSharePreview(null);
  }

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
        avatar_url: userAvatarUrl,
        streak: streakCount,
        workout_summary: workoutSummary,
        photo_url: photoUrl,
        text: shareText.trim().slice(0, 150),
        fire_count: 0,
      });
    } catch (e) { console.warn('[Stories] mutation failed:', e); }
    setShareText('');
    clearMedia();
    setShowShare(false);
    setSharing(false);
    fetchPosts();
  }

  // Fire
  async function fireCurrent() {
    if (viewingIdx === null) return;
    const post = posts[viewingIdx];
    if (!post) return;
    try {
      await supabase.from('club_fires').upsert({ post_id: post.id, user_id: userId });
      await supabase.from('club_posts').update({ fire_count: post.fire_count + 1 }).eq('id', post.id);
    } catch (e) { console.warn('[Stories] mutation failed:', e); }
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, fire_count: p.fire_count + 1 } : p));
  }

  const viewing = viewingIdx !== null ? posts[viewingIdx] : null;

  return (
    <>
      {/* ── Bubbles row ── */}
      <div className="st-row">
        {/* Add story button */}
        <div className="st-bubble st-add" onClick={() => setShowShare(true)}>
          <div className="st-bubble-ring">
            {userAvatarUrl
              ? <img src={userAvatarUrl} alt="" className="st-bubble-img" />
              : <div className="st-bubble-letter">{(userName || '?')[0].toUpperCase()}</div>
            }
            <div className="st-add-badge">+</div>
          </div>
          <span className="st-bubble-name">Tu story</span>
        </div>

        {/* User bubbles */}
        {bubbles.map((post) => (
          <div key={post.id} className="st-bubble" onClick={() => setViewingIdx(posts.indexOf(post))}>
            <div className="st-bubble-ring">
              {post.avatar_url
                ? <img src={post.avatar_url} alt="" className="st-bubble-img" />
                : <div className="st-bubble-letter">{(post.username || '?')[0].toUpperCase()}</div>
              }
            </div>
            <span className="st-bubble-name">{post.username.split(' ')[0]}</span>
            {post.streak > 0 && <span className="st-bubble-streak">🔥 {post.streak}</span>}
          </div>
        ))}
      </div>

      {/* ── Story viewer (full screen) ── */}
      {viewing && (
        <div className="st-viewer" onClick={() => setViewingIdx(null)}>
          <div className="st-viewer-inner" onClick={e => e.stopPropagation()}>
            {/* Progress bar */}
            <div className="st-viewer-progress">
              {posts.filter(p => p.user_id === viewing.user_id).map((_, idx) => (
                <div key={idx} className={`st-prog-seg${idx === 0 ? ' active' : ''}`} />
              ))}
            </div>

            {/* Header */}
            <div className="st-viewer-header">
              <div className="st-viewer-avatar">
                {viewing.avatar_url
                  ? <img src={viewing.avatar_url} alt="" />
                  : <span>{(viewing.username || '?')[0].toUpperCase()}</span>
                }
              </div>
              <div className="st-viewer-name" onClick={(e) => { e.stopPropagation(); setViewingIdx(null); setProfileUserId(viewing.user_id); }} style={{ cursor: 'pointer' }}>{viewing.username}</div>
              {viewing.streak > 0 && <div className="st-viewer-streak">🔥 {viewing.streak}</div>}
              <button className="st-viewer-close" onClick={() => setViewingIdx(null)}>✕</button>
            </div>

            {/* Content */}
            {viewing.photo_url ? (
              viewing.photo_url.match(/\.(mp4|mov|webm)$/i)
                ? <video src={viewing.photo_url} className="st-viewer-media" controls autoPlay />
                : <img src={viewing.photo_url} alt="" className="st-viewer-media" />
            ) : (
              <div className="st-viewer-text-only">{viewing.text}</div>
            )}

            {/* Text overlay */}
            {viewing.photo_url && viewing.text && (
              <div className="st-viewer-text">{viewing.text}</div>
            )}

            {/* Workout badge */}
            {viewing.workout_summary && (
              <div className="st-viewer-workout">{viewing.workout_summary}</div>
            )}

            {/* Fire button */}
            <button className="st-viewer-fire" onClick={fireCurrent}>
              🔥 {viewing.fire_count > 0 ? viewing.fire_count : ''}
            </button>

            {/* Delete (only own stories) */}
            {viewing.user_id === userId && (
              <button className="st-viewer-delete" onClick={async (e) => {
                e.stopPropagation();
                try {
                  await supabase.from('club_posts').delete().eq('id', viewing.id);
                } catch (e) { console.warn('[Stories] mutation failed:', e); }
                setPosts(prev => prev.filter(p => p.id !== viewing.id));
                setViewingIdx(null);
              }}>
                🗑️ Borrar
              </button>
            )}

            {/* Nav arrows */}
            {viewingIdx !== null && viewingIdx > 0 && (
              <div className="st-nav st-nav-prev" onClick={(e) => { e.stopPropagation(); setViewingIdx(viewingIdx! - 1); }} />
            )}
            {viewingIdx !== null && viewingIdx < posts.length - 1 && (
              <div className="st-nav st-nav-next" onClick={(e) => { e.stopPropagation(); setViewingIdx(viewingIdx! + 1); }} />
            )}
          </div>
        </div>
      )}

      {/* ── Share modal ── */}
      {showShare && (
        <div className="st-share-backdrop" onClick={() => { clearMedia(); setShowShare(false); }}>
          <div className="st-share" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-handle" />

            {sharePreview ? (
              <div className="st-share-preview">
                {shareMedia?.type.startsWith('video/')
                  ? <video src={sharePreview} className="st-share-media" controls />
                  : <img src={sharePreview} alt="" className="st-share-media" />
                }
                <button className="st-share-remove" onClick={clearMedia}>✕</button>
              </div>
            ) : (
              <label className="st-share-picker">
                <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} hidden />
                <div className="st-share-picker-icon">📷</div>
                <div className="st-share-picker-text">Foto o video</div>
              </label>
            )}

            <textarea
              className="cl-modal-input"
              placeholder="¿Cómo te fue hoy?"
              maxLength={150}
              value={shareText}
              onChange={e => setShareText(e.target.value)}
            />

            <div className="st-share-meta">
              <span className="st-share-count">{shareText.length}/150</span>
              {workoutSummary && <span className="st-share-workout">{workoutSummary}</span>}
              <span className="st-share-streak">🔥 {streakCount}</span>
            </div>

            <button
              className="cl-modal-submit"
              onClick={handleShare}
              disabled={sharing || (!shareText.trim() && !shareMedia)}
            >
              {sharing ? 'Publicando...' : 'Publicar story'}
            </button>
          </div>
        </div>
      )}

      {profileUserId && (
        <PublicProfile
          userId={profileUserId}
          currentUserId={userId}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </>
  );
}
