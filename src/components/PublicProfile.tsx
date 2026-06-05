import { useEffect, useState, useMemo } from 'react';
import { X, Flame, Share2, Link2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PostCard, { type ClubPost } from './club/PostCard';
import { deleteClubPost } from '../utils/clubPosts';
import { MILESTONE_STEPS } from '../constants/milestones';
import { useT } from '../i18n';
import './public-profile.css';

interface ProfileData {
  display_name: string;
  username?: string | null;
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
  const { t } = useT();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFires, setUserFires] = useState<Set<string>>(new Set());
  const [firingPost, setFiringPost] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareMsg = `${t('profile.shareText')} ${shareUrl}`;
  const nativeShareAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank');
    setShareOpen(false);
  }
  function copyShareLink() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }).catch(() => {});
    }
  }
  function shareNative() {
    if (nativeShareAvailable) {
      navigator.share({ title: t('profile.shareTitle'), text: t('profile.shareText'), url: shareUrl }).catch(() => {});
    }
    setShareOpen(false);
  }

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, postsRes, milestonesRes] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('display_name, username, bio, avatar_url, created_at, start_date, streak_count')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('club_posts')
            .select('*')
            // Posts propios + colaboraciones donde es coautor (estilo Instagram).
            .or(`user_id.eq.${userId},coauthor_id.eq.${userId}`)
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
                  <div className="pp5-header-actions">
                    {isOwnProfile && (
                      <button
                        className="pp5-close"
                        onClick={() => setShareOpen(true)}
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
                {profile?.username && <p className="pp5-handle">@{profile.username}</p>}
                {profile?.bio && <p className="pp5-bio">{profile.bio}</p>}
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
                      <span className="pp5-highlight-days">{days}d</span>
                    </div>
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

      {shareOpen && (
        <div
          className="pp5-share-backdrop"
          onClick={(e) => { e.stopPropagation(); setShareOpen(false); }}
        >
          <div className="pp5-share-sheet" onClick={e => e.stopPropagation()}>
            <div className="pp5-share-grabber" />
            <div className="pp5-share-title">{t('profile.shareSheetTitle')}</div>
            <button className="pp5-share-opt pp5-share-opt--wa" onClick={shareWhatsApp} type="button">
              <span className="pp5-share-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/>
                </svg>
              </span>
              {t('profile.shareWhatsApp')}
            </button>
            <button className="pp5-share-opt" onClick={copyShareLink} type="button">
              <span className="pp5-share-icon" aria-hidden="true">
                {copied ? <Check size={18} strokeWidth={2.5} /> : <Link2 size={18} />}
              </span>
              {copied ? t('profile.shareCopied') : t('profile.shareCopy')}
            </button>
            {nativeShareAvailable && (
              <button className="pp5-share-opt" onClick={shareNative} type="button">
                <span className="pp5-share-icon" aria-hidden="true"><Share2 size={18} /></span>
                {t('profile.shareMore')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
