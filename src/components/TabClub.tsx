import CreatePostModal from './CreatePostModal';
import PublicProfile from './PublicProfile';
import PostCard, { type ClubPost } from './club/PostCard';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { deleteClubPost } from '../utils/clubPosts';
import { useT } from '../i18n';
import { plural } from '../i18n/format';
import './tab-club.css';

export default function TabClub() {
  const userId = useCurrentUserId();
  const { t } = useT();

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
    if (!window.confirm(t('club.deletePostConfirm'))) return;
    const post = posts.find(p => p.id === postId);
    try {
      await deleteClubPost(postId, post?.photo_url ?? null);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e) {
      console.warn('[TabClub] deletePost failed:', e);
      alert(t('club.deletePostFailed'));
    }
  }

  return (
    <div className="clb-wrap">
      <div className="clb-header">
        <h1 className="clb-title">{t('club.title')}</h1>
        <span className="clb-meta">
          {plural(activeToday, {
            one: t('club.activeOne', { count: activeToday }),
            other: t('club.activeOther', { count: activeToday }),
          })}
        </span>
      </div>

      <section className="clb-feed">
        {posts.length === 0 && (
          <div className="clb-empty">
            <p className="clb-empty-text">{t('club.emptyTitle')}</p>
            <p className="clb-empty-sub">{t('club.emptySub')}</p>
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
        aria-label={t('club.ariaCreate')}
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
          onClose={() => {
            setProfileUserId(null);
            // Re-fetch para sincronizar borrados hechos desde el perfil propio
            fetchFeed();
          }}
        />
      )}
    </div>
  );
}
