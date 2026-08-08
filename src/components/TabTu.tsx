import { useMemo, useEffect, useState } from 'react';
import { Menu, Flame, Trash2, Dumbbell, FileText } from 'lucide-react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { supabase } from '../lib/supabase';
import type { DashPage } from '../types';
import { uploadAvatar } from '../utils/uploadAvatar';
import { deleteClubPost } from '../utils/clubPosts';
import { dayKey } from '../utils/localDate';
import SettingsSheet from './SettingsSheet';
import PublicProfile from './PublicProfile';
import WeightTrackingCard from './WeightTrackingCard';
import ReferralCard from './ReferralCard';
import ProgressCard from './ProgressCard';
import RetratoHSM from './RetratoHSM';
import AmbientGlow from './AmbientGlow';
import { useT } from '../i18n';
import { formatDate } from '../i18n/format';
import './tab-tu-v5.css';

export default function TabTu({ onNav: _onNav }: { onNav: (page: DashPage) => void }) {
  void _onNav;
  const { t, locale } = useT();
  const {
    userName, setUserName, streakCount,
    dailyHSMResponses, username,
    completedSessions,
  } = useAppStore(useShallow((s) => ({ userName: s.userName, setUserName: s.setUserName, streakCount: s.streakCount, perfectDaysTotal: s.perfectDaysTotal, dailyHSMResponses: s.dailyHSMResponses, username: s.username, completedSessions: s.completedSessions })));

  // Entrenamientos de esta semana (últimos 7 días) — para el stat "de 3 esta semana".
  const workoutsThisWeek = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const sinceKey = dayKey(since);
    const days = new Set(completedSessions.filter(s => s.date >= sinceKey).map(s => s.date));
    return days.size;
  }, [completedSessions]);
  const reflections = useMemo(() => [...dailyHSMResponses].reverse(), [dailyHSMResponses]);

  const userId = useCurrentUserId();
  const firstName = userName?.split(' ')[0] || '';

  const [profile, setProfile] = useState({ display_name: '', bio: '', avatar_url: '' });
  const [postCount, setPostCount] = useState(0);
  const [userPosts, setUserPosts] = useState<{ id: string; photo_url: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reflexiones'>('posts');

  async function refreshUserPosts() {
    try {
      const { count } = await supabase.from('club_posts').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      if (count != null) setPostCount(count);
    } catch (e) { console.warn('[TabTu] postCount failed:', e); }
    try {
      const { data } = await supabase
        .from('club_posts')
        .select('id, photo_url')
        .eq('user_id', userId)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(9);
      if (data) setUserPosts(data as { id: string; photo_url: string }[]);
    } catch (e) { console.warn('[TabTu] fetchUserPosts failed:', e); }
  }

  // Borrar un post propio desde tu perfil (aquí es donde vives tus posts; en el
  // Club se pierden en el feed). Optimista: lo quita de la grid y baja el conteo.
  async function handleDeletePost(postId: string, photoUrl: string | null) {
    if (!window.confirm(t('club.deletePostConfirm'))) return;
    try {
      await deleteClubPost(postId, photoUrl ?? null);
      setUserPosts(prev => prev.filter(p => p.id !== postId));
      setPostCount(c => Math.max(0, c - 1));
    } catch (e) {
      console.warn('[TabTu] deletePost failed:', e);
      alert(t('club.deletePostFailed'));
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('user_profiles').select('*').eq('user_id', userId).single();
        if (data) setProfile({ display_name: data.display_name, bio: data.bio, avatar_url: data.avatar_url });
      } catch (e) { console.warn('[TabTu] query failed:', e); }
    })();
    refreshUserPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleSave() {
    setSaving(true);
    const savedName = editName.trim() || userName || t('common.anonymous');
    const savedBio = editBio.trim().slice(0, 100);
    try {
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          display_name: savedName,
          bio: savedBio,
          avatar_url: profile.avatar_url,
        }, { onConflict: 'user_id' });
    } catch (e) { console.warn('[TabTu] mutation failed:', e); }
    setProfile(prev => ({ ...prev, display_name: savedName, bio: savedBio }));
    setUserName(savedName);
    setEditing(false);
    setSaving(false);
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadAvatar(file, userId);
    if (result.errorKey) {
      alert(t(result.errorKey, result.errorParams));
      return;
    }
    try {
      await supabase
        .from('user_profiles')
        .update({ avatar_url: result.url })
        .eq('user_id', userId);
      setProfile(prev => ({ ...prev, avatar_url: result.url }));
    } catch (e) {
      console.warn('[TabTu] mutation failed:', e);
    }
  }

  const displayName = profile.display_name || userName || t('common.anonymous');
  const initial = (firstName || displayName || '?')[0].toUpperCase();

  return (
    <div className="tt5-screen">
      <AmbientGlow variant="warm" />
      <div className="tt5-content">

      {/* HEADER lateral — avatar + meta (☰ inline a la derecha del nombre) */}
      <div className="tt5-header">
        {editing ? (
          <label className="tt5-avatar-wrap tt5-avatar-wrap--editable" aria-label={t('profile.ariaChangeAvatar')}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" />
              : <div className="tt5-avatar-fallback">{initial}</div>
            }
            <input type="file" accept="image/*" onChange={handleAvatar} />
          </label>
        ) : (
          <div className="tt5-avatar-wrap">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" />
              : <div className="tt5-avatar-fallback">{initial}</div>
            }
          </div>
        )}

        {!editing ? (
          <div className="tt5-header-meta">
            <div className="tt5-name-row">
              <h1 className="tt5-name">{displayName}</h1>
              <button
                className="tt5-menu-btn"
                onClick={() => setSettingsOpen(true)}
                aria-label={t('profile.ariaSettings')}
                type="button"
              >
                <Menu size={16} strokeWidth={1.6} />
              </button>
            </div>
            {username && <p className="tt5-handle">@{username}</p>}
            {profile.bio && <p className="tt5-bio">{profile.bio}</p>}
          </div>
        ) : (
          <div className="tt5-edit-block">
            <input
              className="tt5-edit-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder={t('profile.editNamePlaceholder')}
              autoFocus
            />
            <input
              className="tt5-edit-input"
              value={editBio}
              onChange={e => setEditBio(e.target.value.slice(0, 100))}
              placeholder={t('profile.editBioPlaceholder')}
            />
            <div className="tt5-edit-actions">
              <button className="tt5-edit-save" onClick={handleSave} disabled={saving} type="button">
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button className="tt5-edit-cancel" onClick={() => setEditing(false)} type="button">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ACTIONS */}
      {!editing && (
        <div className="tt5-actions">
          <button
            className="tt5-btn tt5-btn--primary"
            type="button"
            onClick={() => {
              setEditName(profile.display_name || userName || '');
              setEditBio(profile.bio || '');
              setEditing(true);
            }}
          >
            {t('profile.editProfile')}
          </button>
          <button
            className="tt5-btn tt5-btn--secondary"
            type="button"
            onClick={() => setProfileOpen(true)}
          >
            {t('profile.viewPublic')}
          </button>
        </div>
      )}

      {/* STATS */}
      {!editing && (
        <div className="tt5-stats">
          <div className="tt5-stat">
            <div className="tt5-stat-label">{t('profile.statPosts')}</div>
            <div className="tt5-stat-row">
              <span className="tt5-stat-icon"><FileText size={15} strokeWidth={2} /></span>
              <span className="tt5-stat-num">{postCount}</span>
            </div>
          </div>
          <div className="tt5-stat">
            <div className="tt5-stat-label">{t('profile.statStreak')}</div>
            <div className="tt5-stat-row">
              <span className="tt5-stat-icon"><Flame size={16} strokeWidth={2} /></span>
              <span className="tt5-stat-num">{streakCount}</span>
            </div>
            <div className="tt5-stat-sub">{t('profile.statDaysUnit')}</div>
          </div>
          <div className="tt5-stat">
            <div className="tt5-stat-label">{t('profile.statWorkouts')}</div>
            <div className="tt5-stat-row">
              <span className="tt5-stat-icon"><Dumbbell size={15} strokeWidth={2} /></span>
              <span className="tt5-stat-num">{workoutsThisWeek}</span>
            </div>
            <div className="tt5-stat-sub">{t('profile.ofThreeWeek', { n: 3 })}</div>
          </div>
        </div>
      )}

      {/* Compartir tu día/progreso vive ahora en Hoy ("Compartir mi día") — es algo del día. */}

      {/* PROGRESO — card única: constancia 7 días + días completos + próximo logro.
          Reemplaza 3 cards sueltas + la fila de círculos (evita el abrumamiento). */}
      {!editing && <ProgressCard />}

      {/* WEIGHT */}
      {!editing && <WeightTrackingCard />}

      {/* REFERIDOS — invita y ganen 1 mes gratis */}
      {!editing && <ReferralCard username={username} userId={userId} />}

      {/* TABS */}
      {!editing && (
        <div className="tt5-tabs">
          <button
            type="button"
            className={activeTab === 'posts' ? 'is-active' : ''}
            onClick={() => setActiveTab('posts')}
          >
            {t('profile.tabPosts')}
          </button>
          <button
            type="button"
            className={activeTab === 'reflexiones' ? 'is-active' : ''}
            onClick={() => setActiveTab('reflexiones')}
          >
            {t('profile.tabReflexiones')}
          </button>
        </div>
      )}

      {!editing && activeTab === 'posts' && (() => {
        const minCells = 6;
        const placeholders = Math.max(0, minCells - userPosts.length);
        return (
          <div className="tt5-grid">
            {userPosts.map(post => (
              <div key={post.id} className="tt5-grid-item">
                <button
                  type="button"
                  className="tt5-grid-view"
                  onClick={() => setProfileOpen(true)}
                  aria-label={t('profile.ariaViewPosts')}
                >
                  <img src={post.photo_url} alt="" loading="lazy" />
                </button>
                <button
                  type="button"
                  className="tt5-grid-del"
                  onClick={() => handleDeletePost(post.id, post.photo_url)}
                  aria-label={t('club.deletePost')}
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
            {Array.from({ length: placeholders }, (_, i) => (
              <div key={`ph-${i}`} className="tt5-grid-item tt5-grid-item--empty" aria-hidden="true" />
            ))}
          </div>
        );
      })()}

      {!editing && activeTab === 'reflexiones' && (
        reflections.length === 0 ? (
          <div className="tt5-reflections-empty">
            <p className="tt5-reflections-empty-text">
              {t('profile.reflexionesEmpty')}
            </p>
          </div>
        ) : (
          <div className="tt5-reflections">
            {/* El retrato — el output como héroe — encabeza tus reflexiones pasadas. */}
            <RetratoHSM />
            {reflections.map((r, i) => (
              <div key={`${r.date}-${r.dimension}-${i}`} className="tt5-reflection">
                <div className="tt5-reflection-head">
                  <span className="tt5-reflection-dim">{r.dimension}</span>
                  <span className="tt5-reflection-date">
                    {formatDate(r.date, locale, { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p className="tt5-reflection-q">{r.question}</p>
                <p className="tt5-reflection-a">{r.response}</p>
              </div>
            ))}
          </div>
        )
      )}

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {profileOpen && (
        <PublicProfile
          userId={userId}
          currentUserId={userId}
          onClose={() => {
            setProfileOpen(false);
            refreshUserPosts();
          }}
        />
      )}

      </div>
    </div>
  );
}
