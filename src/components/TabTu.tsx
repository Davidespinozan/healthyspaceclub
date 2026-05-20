import { useMemo, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { useAppStore } from '../store';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { supabase } from '../lib/supabase';
import type { DashPage } from '../types';
import { uploadAvatar } from '../utils/uploadAvatar';
import SettingsSheet from './SettingsSheet';
import PublicProfile from './PublicProfile';
import WeightTrackingCard from './WeightTrackingCard';
import LogrosSheet from './sheets/LogrosSheet';
import AmbientGlow from './AmbientGlow';
import {
  MILESTONE_STEPS,
  MILESTONE_EMOJI,
  getMilestoneLabel,
  getAchievementsCount,
  getNextMilestone,
} from '../constants/milestones';
import { useT } from '../i18n';
import './tab-tu-v5.css';

export default function TabTu({ onNav: _onNav }: { onNav: (page: DashPage) => void }) {
  void _onNav;
  const { locale } = useT();
  const {
    userName, setUserName, streakCount, startDate, userMilestones,
  } = useAppStore();

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
  const [logrosSheetOpen, setLogrosSheetOpen] = useState(false);
  const [focusedMilestone, setFocusedMilestone] = useState<number | undefined>(undefined);

  const { yearNumber, dayOfYear } = useMemo(() => {
    const start = startDate ? new Date(startDate).getTime() : Date.now();
    const days = Math.max(0, Math.floor((Date.now() - start) / 86400000));
    return { yearNumber: Math.floor(days / 365) + 1, dayOfYear: (days % 365) + 1 };
  }, [startDate]);

  const achievementsCount = useMemo(
    () => getAchievementsCount(streakCount),
    [streakCount]
  );

  const nextMilestone = useMemo(
    () => getNextMilestone(streakCount),
    [streakCount]
  );

  const unlockedDays = useMemo(
    () => new Set(userMilestones.map(m => m.milestone_days)),
    [userMilestones]
  );

  function openLogrosSheet(focused?: number) {
    setFocusedMilestone(focused);
    setLogrosSheetOpen(true);
  }

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
    const savedName = editName.trim() || userName || 'Anónimo';
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
    if ('error' in result) {
      alert(result.error);
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

  function handleShare() {
    const data = { title: 'Mi perfil HSC', url: window.location.href };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      navigator.share(data).catch(() => {});
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('URL copiada al portapapeles'))
        .catch(() => {});
    }
  }

  const displayName = profile.display_name || userName || 'Anónimo';
  const initial = (firstName || displayName || '?')[0].toUpperCase();

  return (
    <div className="tt5-screen">
      <AmbientGlow variant="warm" />
      <div className="tt5-content">

      {/* HEADER lateral — avatar + meta (☰ inline a la derecha del nombre) */}
      <div className="tt5-header">
        <label className="tt5-avatar-wrap" aria-label="Cambiar avatar">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" />
            : <div className="tt5-avatar-fallback">{initial}</div>
          }
          <input type="file" accept="image/*" onChange={handleAvatar} />
        </label>

        {!editing ? (
          <div className="tt5-header-meta">
            <div className="tt5-name-row">
              <h1 className="tt5-name">{displayName}</h1>
              <button
                className="tt5-menu-btn"
                onClick={() => setSettingsOpen(true)}
                aria-label="Ajustes"
                type="button"
              >
                <Menu size={16} strokeWidth={1.6} />
              </button>
            </div>
            {profile.bio && <p className="tt5-bio">{profile.bio}</p>}
            <span className="tt5-year-chip">Año {yearNumber} · día {dayOfYear}</span>
          </div>
        ) : (
          <div className="tt5-edit-block">
            <input
              className="tt5-edit-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
            />
            <input
              className="tt5-edit-input"
              value={editBio}
              onChange={e => setEditBio(e.target.value.slice(0, 100))}
              placeholder="Bio corta (máx 100)"
            />
            <div className="tt5-edit-actions">
              <button className="tt5-edit-save" onClick={handleSave} disabled={saving} type="button">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="tt5-edit-cancel" onClick={() => setEditing(false)} type="button">
                Cancelar
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
            Editar perfil
          </button>
          <button
            className="tt5-btn tt5-btn--secondary"
            type="button"
            onClick={handleShare}
          >
            Compartir
          </button>
        </div>
      )}

      {/* STATS */}
      {!editing && (
        <div className="tt5-stats">
          <div className="tt5-stat tt5-stat--posts">
            <div className="tt5-stat-label">Posts</div>
            <div className="tt5-stat-num">{postCount}</div>
          </div>
          <div className="tt5-stat tt5-stat--racha">
            <div className="tt5-stat-label">Racha</div>
            <div className="tt5-stat-num">{streakCount} 🔥</div>
          </div>
          <button
            type="button"
            className="tt5-stat tt5-stat--logros"
            onClick={() => openLogrosSheet()}
          >
            <div className="tt5-stat-label">Logros</div>
            <div className="tt5-stat-num">
              {achievementsCount}<span className="tt5-stat-num-total">/{MILESTONE_STEPS.length}</span>
            </div>
          </button>
        </div>
      )}

      {/* WEIGHT */}
      {!editing && <WeightTrackingCard />}

      {/* HIGHLIGHTS — scroll horizontal */}
      {!editing && (
        <div className="tt5-highlights">
          {MILESTONE_STEPS.map((days, idx) => {
            const isUnlocked = unlockedDays.has(days);
            const isNext = !isUnlocked && days === nextMilestone;
            const futureOpacity = !isUnlocked && !isNext ? 1 - idx * 0.08 : undefined;
            const remaining = Math.max(0, days - streakCount);
            return (
              <button
                type="button"
                key={days}
                className={`tt5-highlight${isUnlocked ? ' is-unlocked' : ''}${isNext ? ' is-next' : ''}`}
                style={futureOpacity !== undefined ? { opacity: futureOpacity } : undefined}
                onClick={() => openLogrosSheet(days)}
              >
                <div className="tt5-highlight-ring">
                  <div className="tt5-highlight-emoji" aria-hidden="true">
                    {isUnlocked ? MILESTONE_EMOJI[days] : '🔒'}
                  </div>
                </div>
                <div className="tt5-highlight-label">
                  {isNext ? 'Próximo' : getMilestoneLabel(days, locale)}
                </div>
                {isNext && (
                  <div className="tt5-highlight-sub">a {remaining}d</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* TABS */}
      {!editing && (
        <div className="tt5-tabs">
          <button
            type="button"
            className={activeTab === 'posts' ? 'is-active' : ''}
            onClick={() => setActiveTab('posts')}
          >
            Posts
          </button>
          <button
            type="button"
            className={activeTab === 'reflexiones' ? 'is-active' : ''}
            onClick={() => setActiveTab('reflexiones')}
          >
            Reflexiones
          </button>
        </div>
      )}

      {!editing && activeTab === 'posts' && (() => {
        const minCells = 6;
        const placeholders = Math.max(0, minCells - userPosts.length);
        return (
          <div className="tt5-grid">
            {userPosts.map(post => (
              <button
                key={post.id}
                type="button"
                className="tt5-grid-item"
                onClick={() => setProfileOpen(true)}
                aria-label="Ver mis posts"
              >
                <img src={post.photo_url} alt="" loading="lazy" />
              </button>
            ))}
            {Array.from({ length: placeholders }, (_, i) => (
              <div key={`ph-${i}`} className="tt5-grid-item tt5-grid-item--empty" aria-hidden="true" />
            ))}
          </div>
        );
      })()}

      {!editing && activeTab === 'reflexiones' && (
        <div className="tt5-reflections-empty">
          <p className="tt5-reflections-empty-text">
            Tus reflexiones de Tu Espacio aparecerán aquí.
          </p>
        </div>
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

      <LogrosSheet
        isOpen={logrosSheetOpen}
        onClose={() => setLogrosSheetOpen(false)}
        initialMilestoneDay={focusedMilestone}
      />

      </div>
    </div>
  );
}
