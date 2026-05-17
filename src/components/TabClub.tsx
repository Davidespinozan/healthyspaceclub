import CreatePostModal from './CreatePostModal';
import PublicProfile from './PublicProfile';
import PostCard, { type ClubPost } from './club/PostCard';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import './tab-club.css';

export default function TabClub() {
  const userId = useCurrentUserId();

  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [activeToday, setActiveToday] = useState(0);
  const [firedIds, setFiredIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

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
      if (data) setPosts(data as ClubPost[]);
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

  async function deletePost(postId: string) {
    try {
      await supabase.from('club_posts').delete().eq('id', postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e) {
      console.warn('[TabClub] deletePost failed:', e);
    }
  }

  return (
    <div className="clb-wrap">
      <div className="clb-header">
        <h1 className="clb-title">El Club</h1>
        <span className="clb-meta">{activeToday} {activeToday === 1 ? 'activo' : 'activos'} hoy</span>
      </div>

      <section className="clb-feed">
        {posts.length === 0 && (
          <div className="clb-empty">
            <p className="clb-empty-text">Aún no hay publicaciones del club.</p>
            <p className="clb-empty-sub">Comparte tu primer logro para empezar.</p>
          </div>
        )}
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={userId}
            hasFire={firedIds.has(post.id)}
            onFireToggle={toggleFire}
            onAuthorTap={setProfileUserId}
            onDelete={deletePost}
          />
        ))}
      </section>

      <button
        type="button"
        className="clb-fab"
        aria-label="Crear publicación"
        onClick={() => setCreateOpen(true)}
      >
        +
      </button>

      <CreatePostModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onPostCreated={() => fetchFeed()}
      />

      {profileUserId && (
        <PublicProfile
          userId={profileUserId}
          currentUserId={userId}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </div>
  );
}
