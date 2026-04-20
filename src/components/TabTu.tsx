import { useMemo, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import type { DashPage } from '../types';
import './tab-tu-v2.css';

const RADAR_DIMS = ['Identidad','Vocación','Propósito','Metas','Disciplina','Cuerpo','Entorno y Relaciones','Control Emocional','Resiliencia','Evolución'];
const DIM_EMOJI: Record<string, string> = {
  'Identidad': '🧠',
  'Vocación': '✨',
  'Propósito': '🎯',
  'Metas': '📍',
  'Disciplina': '⚡',
  'Cuerpo': '💪',
  'Entorno y Relaciones': '🌱',
  'Control Emocional': '🧘',
  'Resiliencia': '🔥',
  'Evolución': '🚀',
};
const DIM_SHORT: Record<string, string> = {
  'Entorno y Relaciones': 'Entorno',
  'Control Emocional': 'Emocional',
};

export default function TabTu({ onNav }: { onNav: (page: DashPage) => void }) {
  const {
    userName, setUserName, obData, tdee, planGoal, streakCount, startDate,
    foodLog, workoutLog, dailyHSMResponses, logout,
    hsmProfile,
  } = useAppStore();

  const userId = obData.name ? String(obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon';
  const firstName = userName?.split(' ')[0] || '';

  const [profile, setProfile] = useState({ display_name: '', bio: '', avatar_url: '' });
  const [postCount, setPostCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('user_profiles').select('*').eq('user_id', userId).single()
      .then(({ data }) => {
        if (data) setProfile({ display_name: data.display_name, bio: data.bio, avatar_url: data.avatar_url });
      });
    supabase.from('club_posts').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .then(({ count }) => { if (count != null) setPostCount(count); });
  }, [userId]);

  async function handleSave() {
    setSaving(true);
    const savedName = editName.trim() || userName || 'Anónimo';
    const savedBio = editBio.trim().slice(0, 100);
    await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        display_name: savedName,
        bio: savedBio,
        avatar_url: profile.avatar_url,
      }, { onConflict: 'user_id' });
    setProfile(prev => ({ ...prev, display_name: savedName, bio: savedBio }));
    setUserName(savedName);
    setEditing(false);
    setSaving(false);
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `${userId}.${ext}`;
    await supabase.storage.from('avatar').upload(path, file, { upsert: true });
    const { data } = supabase.storage.from('avatar').getPublicUrl(path);
    const url = data.publicUrl + '?t=' + Date.now();
    await supabase.from('user_profiles').update({ avatar_url: url }).eq('user_id', userId);
    setProfile(prev => ({ ...prev, avatar_url: url }));
  }

  // Radar / dimensiones (lógica preservada)
  const radarData = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const recent = dailyHSMResponses.filter(r => r.date >= cutoff);
    return RADAR_DIMS.map(dim => {
      const count = recent.filter(r => r.dimension === dim).length;
      return { label: dim, short: DIM_SHORT[dim] || dim, emoji: DIM_EMOJI[dim] || '•', count, value: Math.min(count / 12, 1) };
    }).sort((a, b) => b.count - a.count);
  }, [dailyHSMResponses]);

  const today = new Date().toISOString().split('T')[0];
  const todayKcal = Math.round(foodLog.filter(e => e.date === today).reduce((s, e) => s + e.kcal, 0));

  // Historial de reviews — últimos 3 días con respuestas HSM
  const recentReviews = useMemo(() => {
    const byDate: Record<string, { dimension: string; response: string }[]> = {};
    dailyHSMResponses.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push({ dimension: r.dimension, response: r.response });
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3)
      .map(([date, responses]) => ({ date, responses }));
  }, [dailyHSMResponses]);

  function formatReviewDate(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'short' });
    const dow = d.toLocaleDateString('es-ES', { weekday: 'short' });
    const isToday = dateStr === today;
    return isToday ? `${day} ${month} · hoy` : `${day} ${month} · ${dow}`;
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

  const profileUpdatedAt = useMemo(() => {
    if (!hsmProfile || typeof hsmProfile !== 'object') return null;
    const obj = hsmProfile as Record<string, unknown>;
    return typeof obj.updatedAt === 'string' ? obj.updatedAt as string : null;
  }, [hsmProfile]);

  function formatProfileDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'short' });
    const dow = d.toLocaleDateString('es-ES', { weekday: 'long' });
    return `actualizado ${dow} ${day} ${month}`;
  }

  const totalReflections = dailyHSMResponses.length;
  const daysSinceStart = startDate
    ? Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000) + 1
    : 0;

  return (
    <div className="tu2-wrap">
      {/* ── Hero ── */}
      <div className="tu2-hero">
        <label className="tu2-avatar" style={{ cursor: 'pointer', overflow: 'hidden' }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : <span>{(firstName || '?')[0].toUpperCase()}</span>
          }
          <input type="file" accept="image/*" onChange={handleAvatar} hidden />
        </label>
        <div className="tu2-hero-body">
          <p className="tu2-hero-micro">
            {startDate ? `día ${daysSinceStart} · miembro desde ${new Date(startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : 'tu perfil'}
          </p>
          {!editing ? (
            <>
              <h1 className="tu2-hero-name">
                {profile.display_name || userName || 'Anónimo'}
                {streakCount > 0 && <>, <em>{streakCount >= 30 ? 'eres élite.' : streakCount >= 15 ? 'imparable.' : streakCount >= 8 ? 'en racha.' : streakCount >= 4 ? 'vas bien.' : 'empezando.'}</em></>}
              </h1>
              {profile.bio && <p className="tu2-hero-bio">{profile.bio}</p>}
              <p className="tu2-hero-sub">
                {totalReflections > 0
                  ? `${streakCount} días construyendo. ${totalReflections} reflexiones escritas.`
                  : 'Empieza a escribir en Tu Espacio para que tu coach te conozca.'}
              </p>
              <button className="tu2-hero-edit" onClick={() => {
                setEditName(profile.display_name || userName || '');
                setEditBio(profile.bio || '');
                setEditing(true);
              }}>Editar perfil</button>
            </>
          ) : (
            <>
              <input
                className="tu2-edit-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Tu nombre"
                autoFocus
              />
              <input
                className="tu2-edit-input tu2-edit-bio"
                value={editBio}
                onChange={e => setEditBio(e.target.value.slice(0, 100))}
                placeholder="Bio corta (máx 100)"
              />
              <div className="tu2-edit-actions">
                <button className="tu2-edit-save" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button className="tu2-edit-cancel" onClick={() => setEditing(false)}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Perfil psicológico (pieza central) ── */}
      <div className="tu2-profile">
        <div className="tu2-profile-top">
          <div className="tu2-profile-badge">
            <span className="tu2-profile-badge-dot" />
            <span className="tu2-profile-badge-text">Perfil del coach</span>
          </div>
          {profileUpdatedAt && (
            <span className="tu2-profile-updated">{formatProfileDate(profileUpdatedAt)}</span>
          )}
        </div>
        <h2 className="tu2-profile-title">
          {profileText ? <>Esto es lo que <em>ya sé de ti</em>.</> : <>Aún no <em>te conozco</em>.</>}
        </h2>
        {profileText ? (
          <p className="tu2-profile-text">{profileText}</p>
        ) : (
          <div className="tu2-profile-empty">
            <p className="tu2-profile-empty-text">
              Tu coach genera este perfil cada domingo basándose en tus reflexiones. Necesita al menos 10 respuestas para empezar. Llevas {totalReflections} de 10.
            </p>
          </div>
        )}
      </div>

      {/* ── 10 dimensiones HSM ── */}
      {dailyHSMResponses.length > 0 && (
        <div>
          <h3 className="tu2-section-title">
            Tus 10 dimensiones
            <span className="tu2-section-meta">últimos 30 días</span>
          </h3>
          <div className="tu2-dims">
            {radarData.map(d => (
              <div key={d.label} className="tu2-dim">
                <div className="tu2-dim-emoji">{d.emoji}</div>
                <div className="tu2-dim-body">
                  <div className="tu2-dim-name">{d.short}</div>
                  <div className="tu2-dim-bar-track">
                    <div className="tu2-dim-bar-fill" style={{ width: `${Math.max(d.value * 100, 4)}%` }} />
                  </div>
                </div>
                <span className={`tu2-dim-count${d.count === 0 ? ' zero' : ''}`}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Accesos rápidos ── */}
      <div>
        <h3 className="tu2-section-title">Accesos rápidos</h3>
        <div className="tu2-quick">
          <div className="tu2-quick-card" onClick={() => onNav('alimentacion')}>
            <div className="tu2-quick-icon">🥗</div>
            <div className="tu2-quick-body">
              <div className="tu2-quick-name">Plan</div>
              <div className="tu2-quick-sub">Tu semana</div>
            </div>
          </div>
          <div className="tu2-quick-card" onClick={() => onNav('entrenamiento')}>
            <div className="tu2-quick-icon">💪</div>
            <div className="tu2-quick-body">
              <div className="tu2-quick-name">Rutina</div>
              <div className="tu2-quick-sub">Genera la de hoy</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Historial de observaciones ── */}
      {recentReviews.length > 0 && (
        <div>
          <h3 className="tu2-section-title">
            Tus observaciones
            <span className="tu2-section-meta">últimas {recentReviews.length}</span>
          </h3>
          <div className="tu2-reviews">
            {recentReviews.map(({ date, responses }) => (
              <div key={date} className="tu2-review">
                <div className="tu2-review-top">
                  <span className="tu2-review-date">{formatReviewDate(date)}</span>
                  <span className="tu2-review-type">{responses.length} reflexión{responses.length !== 1 ? 'es' : ''}</span>
                </div>
                <p className="tu2-review-text">
                  {responses.slice(0, 2).map((r, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      <em>"{r.response.substring(0, 80)}{r.response.length > 80 ? '...' : ''}"</em>
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Últimos entrenamientos ── */}
      {workoutLog.length > 0 && (
        <div>
          <h3 className="tu2-section-title">
            Últimos entrenamientos
            <span className="tu2-section-meta">{workoutLog.length} totales</span>
          </h3>
          <div className="tu2-reviews">
            {[...workoutLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((entry, i) => (
              <div key={i} className="tu2-review">
                <div className="tu2-review-top">
                  <span className="tu2-review-date">{formatReviewDate(entry.date)}</span>
                  <span className="tu2-review-type">{entry.sets.length} series</span>
                </div>
                <p className="tu2-review-text" style={{ fontStyle: 'normal' }}>
                  {entry.exercise} · {entry.sets.map(s => `${s.reps}×${s.kg}kg`).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Logros ── */}
      <div>
        <h3 className="tu2-section-title">
          Logros
          <span className="tu2-section-meta">racha</span>
        </h3>
        <div className="tu2-milestones">
          {[3,7,14,21,30,60,90].map(m => (
            <div key={m} className={`tu2-milestone${streakCount >= m ? ' reached' : ''}`}>
              <span className="tu2-milestone-num">{m}</span>
              <span className="tu2-milestone-label">días</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Calorías hoy (compact) ── */}
      {planGoal > 0 && (
        <div>
          <h3 className="tu2-section-title">
            Calorías hoy
            <span className="tu2-section-meta">{todayKcal.toLocaleString()} / {planGoal.toLocaleString()}</span>
          </h3>
          <div style={{
            background: 'white',
            border: '0.5px solid var(--sand)',
            borderRadius: '14px',
            padding: '14px 18px',
          }}>
            <div style={{
              height: '5px',
              background: 'var(--sand)',
              borderRadius: '10px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min((todayKcal / planGoal) * 100, 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--amber) 0%, #d4b374 100%)',
                borderRadius: '10px',
                transition: 'width 0.4s',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Tus datos ── */}
      <div>
        <h3 className="tu2-section-title">Tus datos</h3>
        <div className="tu2-data">
          <div className="tu2-data-row">
            <span className="tu2-data-key">Sexo</span>
            <span className="tu2-data-val">{String(obData.sex || '—')}</span>
          </div>
          <div className="tu2-data-row">
            <span className="tu2-data-key">Edad</span>
            <span className="tu2-data-val">{obData.edad ? `${obData.edad} años` : '—'}</span>
          </div>
          <div className="tu2-data-row">
            <span className="tu2-data-key">Peso</span>
            <span className="tu2-data-val">{obData.peso ? `${obData.peso} kg` : '—'}</span>
          </div>
          <div className="tu2-data-row">
            <span className="tu2-data-key">Estatura</span>
            <span className="tu2-data-val">{obData.estatura ? `${obData.estatura} cm` : '—'}</span>
          </div>
          <div className="tu2-data-row">
            <span className="tu2-data-key">Actividad</span>
            <span className="tu2-data-val">{String(obData.activity || '—')}</span>
          </div>
          <div className="tu2-data-row">
            <span className="tu2-data-key">Objetivo</span>
            <span className="tu2-data-val">{String(obData.goal || '—')}</span>
          </div>
          {planGoal > 0 && (
            <div className="tu2-data-row">
              <span className="tu2-data-key">Meta calórica</span>
              <span className="tu2-data-val accent">{planGoal.toLocaleString()} kcal/día</span>
            </div>
          )}
          {tdee > 0 && (
            <div className="tu2-data-row">
              <span className="tu2-data-key">TDEE</span>
              <span className="tu2-data-val">{tdee.toLocaleString()} kcal</span>
            </div>
          )}
          {postCount > 0 && (
            <div className="tu2-data-row">
              <span className="tu2-data-key">Posts en el club</span>
              <span className="tu2-data-val">{postCount}</span>
            </div>
          )}
        </div>
      </div>

      <button className="tu2-logout" onClick={logout}>Cerrar sesión</button>
    </div>
  );
}
