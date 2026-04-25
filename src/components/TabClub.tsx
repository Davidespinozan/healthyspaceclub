import Stories from './Stories';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';
import './tab-club.css';

interface ClubFeedPost {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  streak: number;
  workout_summary: string | null;
  photo_url: string | null;
  text: string | null;
  fire_count: number;
  created_at: string;
}

export default function TabClub() {
  const { obData } = useAppStore();
  const userId = obData?.name ? String(obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon';

  const [posts, setPosts] = useState<ClubFeedPost[]>([]);
  const [activeToday, setActiveToday] = useState(0);
  const [firedIds, setFiredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFeed();
    fetchActiveCount();
    fetchUserFires();
  }, []);

  async function fetchFeed() {
    try {
      const { data } = await supabase
        .from('club_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setPosts(data as ClubFeedPost[]);
    } catch (e) {
      console.warn('[TabClub] fetchFeed failed:', e);
    }
  }

  async function fetchActiveCount() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('club_posts')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', today + 'T00:00:00');
      if (count != null) setActiveToday(count);
    } catch (e) {
      console.warn('[TabClub] fetchActiveCount failed:', e);
    }
  }

  async function fetchUserFires() {
    try {
      const { data } = await supabase
        .from('club_fires')
        .select('post_id')
        .eq('user_id', userId);
      if (data) setFiredIds(new Set(data.map((d: { post_id: string }) => d.post_id)));
    } catch (e) {
      console.warn('[TabClub] fetchUserFires failed:', e);
    }
  }

  async function toggleFire(postId: string) {
    const isFired = firedIds.has(postId);
    try {
      if (isFired) {
        await supabase.from('club_fires').delete().eq('post_id', postId).eq('user_id', userId);
        const newSet = new Set(firedIds); newSet.delete(postId); setFiredIds(newSet);
        setPosts(p => p.map(post => post.id === postId ? { ...post, fire_count: Math.max(0, post.fire_count - 1) } : post));
      } else {
        await supabase.from('club_fires').insert({ post_id: postId, user_id: userId });
        const newSet = new Set(firedIds); newSet.add(postId); setFiredIds(newSet);
        setPosts(p => p.map(post => post.id === postId ? { ...post, fire_count: post.fire_count + 1 } : post));
      }
    } catch (e) {
      console.warn('[TabClub] toggleFire failed:', e);
    }
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

  return (
    <div className="clb-wrap">
      <div className="clb-header">
        <h1 className="clb-title">El Club</h1>
        <span className="clb-meta">{activeToday} {activeToday === 1 ? 'activo' : 'activos'} hoy</span>
      </div>

      <div className="clb-stories-wrap">
        <Stories />
      </div>

      <section className="clb-feed">
        {posts.length === 0 && (
          <div className="clb-empty">
            <p className="clb-empty-text">Aún no hay publicaciones del club.</p>
            <p className="clb-empty-sub">Sube tu primera story para empezar.</p>
          </div>
        )}
        {posts.map(post => (
          <article key={post.id} className="clb-post">
            <div className="clb-post-head">
              <div className="clb-post-author">
                <div className="clb-post-avatar">
                  {post.avatar_url
                    ? <img src={post.avatar_url} alt="" />
                    : <span>{(post.username || '?')[0].toUpperCase()}</span>
                  }
                </div>
                <div className="clb-post-meta">
                  <div className="clb-post-name">
                    <span className="clb-post-username">{post.username || 'Anónimo'}</span>
                    {post.streak > 0 && <span className="clb-post-streak"> · {post.streak} días</span>}
                  </div>
                  <div className="clb-post-time">{timeAgo(post.created_at)}</div>
                </div>
              </div>
              {post.workout_summary && (
                <span className="clb-post-tag">{post.workout_summary}</span>
              )}
            </div>

            {post.photo_url && (
              <div className="clb-post-media">
                <img src={post.photo_url} alt="" loading="lazy" />
              </div>
            )}

            {post.text && (
              <p className="clb-post-text">{post.text}</p>
            )}

            <div className="clb-post-actions">
              <button
                className={`clb-post-fire${firedIds.has(post.id) ? ' active' : ''}`}
                onClick={() => toggleFire(post.id)}
              >
                <span className="clb-post-fire-icon">🔥</span>
                <span className="clb-post-fire-count">{post.fire_count}</span>
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
