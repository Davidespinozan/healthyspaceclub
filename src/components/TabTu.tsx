import { useMemo, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import type { DashPage } from '../types';
import { validateMediaFile } from '../utils/mediaValidation';
import CoachProfileSheet from './CoachProfileSheet';
import SettingsSheet from './SettingsSheet';
import './tab-tu-v3.css';

const MILESTONE_STEPS = [3, 7, 14, 30, 90, 365];

export default function TabTu({ onNav }: { onNav: (page: DashPage) => void }) {
  const {
    userName, setUserName, obData, streakCount,
    hsmProfile,
  } = useAppStore();

  const userId = obData.name ? String(obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon';
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

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('user_profiles').select('*').eq('user_id', userId).single();
        if (data) setProfile({ display_name: data.display_name, bio: data.bio, avatar_url: data.avatar_url });
      } catch (e) { console.warn('[TabTu] query failed:', e); }
    })();
    (async () => {
      try {
        const { count } = await supabase.from('club_posts').select('id', { count: 'exact', head: true }).eq('user_id', userId);
        if (count != null) setPostCount(count);
      } catch (e) { console.warn('[TabTu] query failed:', e); }
    })();
    (async () => {
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
    })();
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
    const check = validateMediaFile(file);
    if (!check.valid) { alert(check.error); return; }
    const ext = file.name.split('.').pop();
    const path = `${userId}.${ext}`;
    try {
      await supabase.storage.from('avatar').upload(path, file, { upsert: true });
      const { data } = supabase.storage.from('avatar').getPublicUrl(path);
      const url = data.publicUrl + '?t=' + Date.now();
      await supabase.from('user_profiles').update({ avatar_url: url }).eq('user_id', userId);
      setProfile(prev => ({ ...prev, avatar_url: url }));
    } catch (e) { console.warn('[TabTu] mutation failed:', e); }
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
  const achievedCount = MILESTONE_STEPS.filter(m => streakCount >= m).length;

  return (
    <div className="tt3-wrap">

      {/* A. Topbar */}
      <div className="tt3-topbar">
        <span className="tt3-topbar-name">{displayName}</span>
        <button
          className="tt3-topbar-menu"
          onClick={() => setSettingsOpen(true)}
          aria-label="Ajustes"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="3" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* B. Header social */}
      <div className="tt3-header">
        <label className="tt3-avatar" aria-label="Cambiar avatar">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" />
            : <span>{(firstName || displayName || '?')[0].toUpperCase()}</span>
          }
          <input type="file" accept="image/*" onChange={handleAvatar} hidden />
        </label>
        <div className="tt3-header-body">
          {!editing ? (
            <>
              <h1 className="tt3-name">{displayName}</h1>
              {profile.bio && <p className="tt3-bio">{profile.bio}</p>}
              <div className="tt3-stats">
                <span className="tt3-stat">
                  <span className="tt3-stat-num">{postCount}</span>
                  <span className="tt3-stat-label">{postCount === 1 ? 'post' : 'posts'}</span>
                </span>
                <span className="tt3-stat">
                  <span className="tt3-stat-num">{streakCount}</span>
                  <span className="tt3-stat-label">{streakCount === 1 ? 'día racha' : 'días racha'}</span>
                </span>
                <span className="tt3-stat">
                  <span className="tt3-stat-num">{achievedCount}</span>
                  <span className="tt3-stat-label">{achievedCount === 1 ? 'logro' : 'logros'}</span>
                </span>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* C. Botones de perfil (sólo cuando NO está editando) */}
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

      {/* D. Card chica del coach */}
      <div
        className="tt3-coach-card"
        role="button"
        tabIndex={0}
        onClick={() => setCoachOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCoachOpen(true); }}
      >
        <div className="tt3-coach-eyebrow">
          <span className="tt3-coach-eyebrow-dot" />
          Tu coach
        </div>
        <p className="tt3-coach-text">
          {profileText || 'Aún estoy aprendiendo de ti. Reflexiona en Tu Espacio para que pueda conocerte.'}
        </p>
        <span className="tt3-coach-arrow" aria-hidden="true">→</span>
      </div>

      {/* E. Logros */}
      <section className="tt3-milestones-section">
        <p className="tt3-milestones-eyebrow">Logros</p>
        <div className="tt3-milestones">
          {MILESTONE_STEPS.map(m => (
            <div
              key={m}
              className={`tt3-milestone${streakCount >= m ? ' reached' : ''}${m === 365 ? ' tt3-milestone--year' : ''}`}
            >
              <div className="tt3-milestone-circle">
                <span className="tt3-milestone-num">{m}</span>
              </div>
              <div className="tt3-milestone-label">{m === 365 ? '1 año' : 'días'}</div>
            </div>
          ))}
        </div>
      </section>

      {/* F. Tabs */}
      <div className="tt3-tabs">
        <button type="button" className="tt3-tab active">Posts</button>
        <button type="button" className="tt3-tab disabled" disabled>Rutinas</button>
        <button type="button" className="tt3-tab disabled" disabled>Comidas</button>
      </div>

      {/* G. Grid 3x3 */}
      <div className="tt3-grid">
        {userPosts.length === 0 ? (
          <div className="tt3-grid-empty" style={{ gridColumn: '1 / -1' }}>
            <p className="tt3-grid-empty-text">Aún no has compartido nada.</p>
            <p className="tt3-grid-empty-sub">Comparte tu primer logro en el Club.</p>
          </div>
        ) : (
          userPosts.map(post => (
            <div key={post.id} className="tt3-grid-item">
              <img src={post.photo_url} alt="" loading="lazy" />
            </div>
          ))
        )}
      </div>

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

    </div>
  );
}
