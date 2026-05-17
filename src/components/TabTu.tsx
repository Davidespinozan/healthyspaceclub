import { useMemo, useEffect, useState } from 'react';
import { Menu, Flame, Lock, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { supabase } from '../lib/supabase';
import type { DashPage } from '../types';
import { uploadAvatar } from '../utils/uploadAvatar';
import CoachProfileSheet from './CoachProfileSheet';
import SettingsSheet from './SettingsSheet';
import PublicProfile from './PublicProfile';
import WeightTrackingCard from './WeightTrackingCard';
import './tab-tu-v3.css';

const MILESTONE_STEPS = [3, 7, 14, 30, 60, 90, 180, 365] as const;
const MILESTONE_LABELS: Record<number, string> = {
  3: '3d', 7: '7d', 14: '14d', 30: '30d', 60: '60d', 90: '90d', 180: '180d', 365: '1a',
};
const MILESTONE_FULL_LABELS: Record<number, string> = {
  3: '3 días', 7: '7 días', 14: '14 días', 30: '30 días',
  60: '60 días', 90: '90 días', 180: '180 días', 365: '1 año',
};

export default function TabTu({ onNav }: { onNav: (page: DashPage) => void }) {
  const {
    userName, setUserName, streakCount, startDate,
    hsmProfile,
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
  const [coachOpen, setCoachOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reflexiones'>('posts');

  const { yearNumber, dayOfYear } = useMemo(() => {
    const start = startDate ? new Date(startDate).getTime() : Date.now();
    const days = Math.max(0, Math.floor((Date.now() - start) / 86400000));
    return { yearNumber: Math.floor(days / 365) + 1, dayOfYear: (days % 365) + 1 };
  }, [startDate]);

  const achievementsCount = useMemo(
    () => MILESTONE_STEPS.filter(m => streakCount >= m).length,
    [streakCount]
  );

  const nextMilestone = useMemo(
    () => MILESTONE_STEPS.find(m => streakCount < m),
    [streakCount]
  );

  function openLogrosSheet() {
    console.log('TODO: LogrosSheet');
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

  // hsmProfile puede ser string u objeto — normalizamos sin romper
  const profileText = useMemo(() => {
    if (!hsmProfile) return null;
    if (typeof hsmProfile === 'string') return hsmProfile;
    if (typeof hsmProfile === 'object' && hsmProfile !== null) {
      const obj = hsmProfile as Record<string, unknown>;
      if (typeof obj.text === 'string') return obj.text as string;
    }
    return null;
  }, [hsmProfile]);

  const displayName = profile.display_name || userName || 'Anónimo';

  return (
    <div className="tt3-wrap">

      {/* A. Topbar — solo hamburguesa en círculo, alineada a la derecha */}
      <div className="tt3-topbar">
        <button
          className="tt3-topbar-menu"
          onClick={() => setSettingsOpen(true)}
          aria-label="Ajustes"
          type="button"
        >
          <Menu size={18} strokeWidth={1.6} />
        </button>
      </div>

      {/* B. Header centrado — avatar + nombre + bio */}
      <div className="tt3-header">
        <label className="tt3-avatar" aria-label="Cambiar avatar">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" />
            : <span>{(firstName || displayName || '?')[0].toUpperCase()}</span>
          }
          <input type="file" accept="image/*" onChange={handleAvatar} hidden />
        </label>

        {!editing ? (
          <>
            <h1 className="tt3-name">{displayName}</h1>
            {profile.bio && <p className="tt3-bio">{profile.bio}</p>}
            <p className="tt3-year-label">Año {yearNumber} · día {dayOfYear}</p>
          </>
        ) : (
          <div className="tt3-edit-block">
            <input
              className="tt3-edit-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
            />
            <input
              className="tt3-edit-input tt3-edit-input--bio"
              value={editBio}
              onChange={e => setEditBio(e.target.value.slice(0, 100))}
              placeholder="Bio corta (máx 100)"
            />
            <div className="tt3-edit-actions">
              <button className="tt3-edit-save" onClick={handleSave} disabled={saving} type="button">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="tt3-edit-cancel" onClick={() => setEditing(false)} type="button">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* C. Stats hero — inline con separadores verticales */}
      {!editing && (
        <div className="tt3-stats-row">
          <div className="tt3-stat-cell">
            <div className="tt3-stat-num">{postCount}</div>
            <div className="tt3-stat-label">Posts</div>
          </div>
          <div className="tt3-stat-cell tt3-stat-cell--middle">
            <div className="tt3-stat-num tt3-stat-num--accent">{streakCount}</div>
            <div className="tt3-stat-label">Racha</div>
          </div>
          <div className="tt3-stat-cell">
            <div className="tt3-stat-num">{achievementsCount}</div>
            <div className="tt3-stat-label">Logros</div>
          </div>
        </div>
      )}

      {/* D. Botones de perfil (sólo cuando NO está editando) */}
      {!editing && (
        <div className="tt3-actions">
          <button
            className="tt3-btn-primary"
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
            className="tt3-btn-outline"
            type="button"
            onClick={handleShare}
          >
            Compartir
          </button>
        </div>
      )}

      {/* E0. Card de peso semanal */}
      {!editing && <WeightTrackingCard />}

      {/* E. Card del coach — horizontal: dot + body + arrow */}
      <div
        className="tt3-coach-card"
        role="button"
        tabIndex={0}
        onClick={() => setCoachOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCoachOpen(true); }}
      >
        <span className="tt3-coach-dot" aria-hidden="true" />
        <div className="tt3-coach-body">
          <div className="tt3-coach-eyebrow">Tu coach</div>
          <p className="tt3-coach-text">
            {profileText || 'Aún estoy aprendiendo de ti. Reflexiona en Tu Espacio para que pueda conocerte.'}
          </p>
        </div>
        <ArrowRight size={16} strokeWidth={1.6} className="tt3-coach-arrow" aria-hidden="true" />
      </div>

      {/* F. Logros — fila horizontal compacta + heading "Ver todos" + contexto */}
      <section className="tt3-milestones-section">
        <div className="tt3-milestones-header">
          <span className="tt3-milestones-eyebrow">Logros</span>
          <button
            type="button"
            className="tt3-milestones-link"
            onClick={openLogrosSheet}
          >
            Ver todos →
          </button>
        </div>

        <div className="tt3-milestones">
          {MILESTONE_STEPS.map(m => {
            const reached = streakCount >= m;
            const isYear = m === 365;
            return (
              <div
                key={m}
                className={`tt3-milestone${reached ? ' reached' : ''}${isYear ? ' tt3-milestone--year' : ''}`}
              >
                <div className="tt3-milestone-circle">
                  {reached
                    ? <Flame size={20} strokeWidth={1.6} aria-hidden="true" />
                    : <Lock size={16} strokeWidth={1.6} aria-hidden="true" />
                  }
                </div>
                <div className="tt3-milestone-label">{MILESTONE_LABELS[m]}</div>
              </div>
            );
          })}
        </div>

        <p className="tt3-milestones-context">
          {nextMilestone
            ? <>Llevás {streakCount} {streakCount === 1 ? 'día' : 'días'} — el siguiente logro a {MILESTONE_FULL_LABELS[nextMilestone]}</>
            : <>Año completo. Próximo logro: año {yearNumber + 1}.</>
          }
        </p>
      </section>

      {/* G. Tabs — Posts / Reflexiones */}
      <div className="tt3-tabs">
        <button
          type="button"
          className={`tt3-tab${activeTab === 'posts' ? ' active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Posts
        </button>
        <button
          type="button"
          className={`tt3-tab${activeTab === 'reflexiones' ? ' active' : ''}`}
          onClick={() => setActiveTab('reflexiones')}
        >
          Reflexiones
        </button>
      </div>

      {/* H. Contenido por tab */}
      {activeTab === 'posts' && (() => {
        const minCells = 6;
        const placeholders = Math.max(0, minCells - userPosts.length);
        return (
          <div className="tt3-grid">
            {userPosts.map(post => (
              <button
                key={post.id}
                type="button"
                className="tt3-grid-item"
                onClick={() => setProfileOpen(true)}
                aria-label="Ver mis posts"
              >
                <img src={post.photo_url} alt="" loading="lazy" />
              </button>
            ))}
            {Array.from({ length: placeholders }, (_, i) => (
              <div key={`ph-${i}`} className="tt3-grid-item tt3-grid-item--empty" aria-hidden="true" />
            ))}
          </div>
        );
      })()}

      {activeTab === 'reflexiones' && (
        <div className="tt3-reflections-empty">
          <p className="tt3-reflections-empty-text">
            Tus reflexiones de Tu Espacio aparecerán aquí.
          </p>
        </div>
      )}

      <CoachProfileSheet
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        onReflect={() => {
          setCoachOpen(false);
          onNav('hoy');
          setTimeout(() => alert('Desliza al final de Hoy y toca Tu Espacio para reflexionar.'), 250);
        }}
      />

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
  );
}
