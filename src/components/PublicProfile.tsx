import { useEffect, useState, useMemo } from 'react';
import { X, Flame, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PostCard, { type ClubPost } from './club/PostCard';
import { deleteClubPost } from '../utils/clubPosts';
import { MILESTONE_STEPS, MILESTONE_EMOJI, getMilestoneLabel } from '../constants/milestones';
import { useT } from '../i18n';
import './public-profile.css';

interface ProfileData {
  display_name: string;
  bio: string;
  avatar_url: string;
  created_at?: string;
  start_date?: string | null;
  streak_count?: number | null;
}

interface MilestoneRow {
  milestone_days: number;
  unlocked_at: string;
}

interface Props {
  userId: string;
  currentUserId?: string;
  onClose: () => void;
}

export default function PublicProfile({ userId, currentUserId, onClose }: Props) {
  const { t, locale } = useT();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFires, setUserFires] = useState<Set<string>>(new Set());
  const [firingPost, setFiringPost] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, postsRes, milestonesRes] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('display_name, bio, avatar_url, created_at, start_date, streak_count')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('club_posts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('user_milestones')
            .select('milestone_days, unlocked_at')
            .eq('user_id', userId)
            .order('milestone_days', { ascending: true }),
        ]);

        if (profileRes.error) throw new Error(profileRes.error.message);
        if (postsRes.error) throw new Error(postsRes.error.message);
        if (milestonesRes.error) throw new Error(milestonesRes.error.message);

        if (profileRes.data) setProfile(profileRes.data);
        if (postsRes.data) setPosts(postsRes.data as ClubPost[]);
        if (milestonesRes.data) setMilestones(milestonesRes.data);

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

  async function handleDelete(postId: string) {
    if (!window.confirm(t('club.deletePostConfirm'))) return;
    const post = posts.find(p => p.id === postId);
    try {
      await deleteClubPost(postId, post?.photo_url ?? null);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e) {
      console.warn('[public-profile] delete failed:', e);
      alert(t('club.deletePostFailed'));
    }
  }

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

  const { yearN, dayN } = useMemo(() => {
    const start = profile?.start_date
      ? new Date(profile.start_date).getTime()
      : profile?.created_at
        ? new Date(profile.created_at).getTime()
        : Date.now();
    const days = Math.max(0, Math.floor((Date.now() - start) / 86400000));
    return { yearN: Math.floor(days / 365) + 1, dayN: (days % 365) + 1 };
  }, [profile?.start_date, profile?.created_at]);

  const unlockedSet = useMemo(
    () => new Set(milestones.map(m => m.milestone_days)),
    [milestones],
  );
  const sortedHighlights = useMemo(
    () => MILESTONE_STEPS.filter(d => unlockedSet.has(d)),
    [unlockedSet],
  );

  const displayName = profile?.display_name || posts[0]?.username || userId;
  const isOwnProfile = !!currentUserId && currentUserId === userId;
  const initial = (displayName || '?')[0].toUpperCase();
  const avatarUrl = profile?.avatar_url || posts[0]?.avatar_url || '';
  const visitedStreak = profile?.streak_count ?? 0;
  const hasContent = posts.length > 0 || sortedHighlights.length > 0;

  return (
    <div className="pp5-backdrop" onClick={onClose}>
      <div className="pp5-modal" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="pp5-loading">
            <button className="pp5-close pp5-close--floating" onClick={onClose} aria-label={t('common.close')} type="button">
              <X size={18} />
            </button>
            <div className="pp5-spinner" />
            <p className="pp5-loading-text">{t('profile.loadingProfile')}</p>
          </div>
        ) : error ? (
          <div className="pp5-error">
            <button className="pp5-close pp5-close--floating" onClick={onClose} aria-label={t('common.close')} type="button">
              <X size={18} />
            </button>
            <p className="pp5-error-text">{error}</p>
            <button className="pp5-error-btn" onClick={onClose} type="button">{t('common.close')}</button>
          </div>
        ) : (
          <>
            {/* HEADER lateral (✕ inline en name-row) */}
            <div className="pp5-header">
              <div className="pp5-avatar-wrap">
                {avatarUrl
                  ? <img src={avatarUrl} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <div className="pp5-avatar-fallback">{initial}</div>
                }
              </div>
              <div className="pp5-header-meta">
                <div className="pp5-name-row">
                  <h1 className="pp5-name">{displayName}</h1>
                </div>
                {profile?.bio && <p className="pp5-bio">{profile.bio}</p>}
                <span className="pp5-year-chip">{t('profile.yearDayChip', { year: yearN, day: dayN })}</span>
              </div>
              <div className="pp5-header-actions">
                {isOwnProfile && (
                  <button
                    className="pp5-close"
                    onClick={() => {
                      const data = { title: t('profile.shareTitle'), url: window.location.href };
                      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                        navigator.share(data).catch(() => {});
                      }
                    }}
                    aria-label={t('profile.share')}
                    type="button"
                  >
                    <Share2 size={15} />
                  </button>
                )}
                <button className="pp5-close" onClick={onClose} aria-label={t('common.close')} type="button">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* STATS */}
            <div className="pp5-stats">
              <div className="pp5-stat pp5-stat--posts">
                <div className="pp5-stat-label">{t('profile.statPosts')}</div>
                <div className="pp5-stat-num">{posts.length}</div>
              </div>
              <div className="pp5-stat pp5-stat--racha">
                <div className="pp5-stat-label">{t('profile.statStreak')}</div>
                <div className="pp5-stat-num">{visitedStreak} <Flame size={20} strokeWidth={1.6} /></div>
              </div>
              <div className="pp5-stat pp5-stat--logros">
                <div className="pp5-stat-label">{t('profile.statLogros')}</div>
                <div className="pp5-stat-num">
                  {sortedHighlights.length}<span className="pp5-stat-num-total">/{MILESTONE_STEPS.length}</span>
                </div>
              </div>
            </div>

            {/* HIGHLIGHTS — solo logros desbloqueados */}
            {sortedHighlights.length > 0 && (
              <div className="pp5-highlights">
                {sortedHighlights.map(days => (
                  <div key={days} className="pp5-highlight">
                    <div className="pp5-highlight-ring">
                      <div className="pp5-highlight-emoji" aria-hidden="true">
                        {MILESTONE_EMOJI[days]}
                      </div>
                    </div>
                    <div className="pp5-highlight-label">{getMilestoneLabel(days, locale)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* FEED */}
            {posts.length > 0 ? (
              <div className="pp5-feed">
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId ?? null}
                    hasFire={userFires.has(post.id)}
                    onFireToggle={() => toggleFire(post.id)}
                    onAuthorTap={() => { /* ya estamos en su perfil */ }}
                    onDelete={isOwnProfile ? handleDelete : undefined}
                    showAuthor={false}
                  />
                ))}
              </div>
            ) : !hasContent ? (
              <div className="pp5-empty">
                <div className="pp5-empty-emoji">🌱</div>
                <p className="pp5-empty-text">{t('profile.publicEmpty')}</p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
