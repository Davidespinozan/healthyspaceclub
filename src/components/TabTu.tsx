import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import type { DashPage } from '../types';

const RADAR_DIMS = ['Identidad','Vocación','Propósito','Metas','Disciplina','Cuerpo','Entorno y Relaciones','Control Emocional','Resiliencia','Evolución'];
const RADAR_SHORT = ['Identidad','Vocación','Propósito','Metas','Disciplina','Cuerpo','Entorno','Emocional','Resiliencia','Evolución'];

export default function TabTu({ onNav }: { onNav: (page: DashPage) => void }) {
  const {
    userName, obData, tdee, planGoal, streakCount, startDate,
    foodLog, workoutLog, hsmUnlockDays, dailyHSMResponses, logout,
  } = useAppStore();

  const userId = obData.name ? String(obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon';
  const firstName = userName?.split(' ')[0] || '';

  // Profile from Supabase
  const [profile, setProfile] = useState({ display_name: '', bio: '', avatar_url: '' });
  const [postCount, setPostCount] = useState(0);

  useEffect(() => {
    supabase.from('user_profiles').select('*').eq('user_id', userId).single()
      .then(({ data }) => {
        if (data) setProfile({ display_name: data.display_name, bio: data.bio, avatar_url: data.avatar_url });
      });
    supabase.from('club_posts').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .then(({ count }) => { if (count != null) setPostCount(count); });
  }, [userId]);

  // Avatar upload
  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `${userId}.${ext}`;
    await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl + '?t=' + Date.now();
    await supabase.from('user_profiles').update({ avatar_url: url }).eq('user_id', userId);
    setProfile(prev => ({ ...prev, avatar_url: url }));
  }

  // Radar
  const radarData = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const recent = dailyHSMResponses.filter(r => r.date >= cutoff);
    return RADAR_DIMS.map((dim, i) => {
      const count = recent.filter(r => r.dimension === dim).length;
      return { label: RADAR_SHORT[i], value: Math.min(count / 12, 1) };
    });
  }, [dailyHSMResponses]);

  const today = new Date().toISOString().split('T')[0];
  const todayKcal = Math.round(foodLog.filter(e => e.date === today).reduce((s, e) => s + e.kcal, 0));
  const weeksActive = startDate ? Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / (7 * 86400000)) + 1) : 0;

  // Tab state
  const [tab, setTab] = useState<'resumen' | 'progreso' | 'ajustes'>('resumen');

  return (
    <div className="tt-wrap">
      {/* ── Profile header (Instagram-style) ── */}
      <div className="tt-profile-hero">
        <label className="tt-avatar-wrap">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" className="tt-avatar-img" />
            : <div className="tt-avatar-placeholder">{(firstName || '?')[0].toUpperCase()}</div>
          }
          <input type="file" accept="image/*" onChange={handleAvatar} hidden />
        </label>

        <div className="tt-profile-info">
          <div className="tt-profile-name">{profile.display_name || userName || 'Anónimo'}</div>
          {profile.bio && <div className="tt-profile-bio">{profile.bio}</div>}
          <button className="tt-edit-profile" onClick={() => onNav('huella')}>Editar perfil</button>
        </div>
      </div>

      {/* Stats row */}
      <div className="tt-stats-row">
        <div className="tt-stat">
          <div className="tt-stat-val">{streakCount}</div>
          <div className="tt-stat-lbl">Racha</div>
        </div>
        <div className="tt-stat-div" />
        <div className="tt-stat">
          <div className="tt-stat-val">{hsmUnlockDays.length}</div>
          <div className="tt-stat-lbl">Días activos</div>
        </div>
        <div className="tt-stat-div" />
        <div className="tt-stat">
          <div className="tt-stat-val">{postCount}</div>
          <div className="tt-stat-lbl">Posts</div>
        </div>
        <div className="tt-stat-div" />
        <div className="tt-stat">
          <div className="tt-stat-val">{weeksActive}</div>
          <div className="tt-stat-lbl">Semanas</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tt-tab-bar">
        {(['resumen', 'progreso', 'ajustes'] as const).map(t => (
          <button key={t} className={`tt-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'resumen' ? 'Resumen' : t === 'progreso' ? 'Progreso' : 'Ajustes'}
          </button>
        ))}
      </div>

      <div className="tab-content">

      {/* ── Tab: Resumen ── */}
      {tab === 'resumen' && (<>
        {/* Quick actions */}
        <div className="tt-actions">
          <div className="tt-action" onClick={() => onNav('alimentacion')}>
            <span className="tt-action-icon">🥗</span>
            <span className="tt-action-lbl">Plan semanal</span>
          </div>
          <div className="tt-action" onClick={() => onNav('entrenamiento')}>
            <span className="tt-action-icon">💪</span>
            <span className="tt-action-lbl">Rutina</span>
          </div>
          <div className="tt-action" onClick={() => onNav('alimentacion')}>
            <span className="tt-action-icon">🛒</span>
            <span className="tt-action-lbl">Súper</span>
          </div>
          <div className="tt-action" onClick={() => onNav('hsm')}>
            <span className="tt-action-icon">🧠</span>
            <span className="tt-action-lbl">Método</span>
          </div>
        </div>

        {/* Today's metrics */}
        <div className="tt-today-card">
          <div className="tt-today-row">
            <span className="tt-today-lbl">Calorías hoy</span>
            <span className="tt-today-val">{todayKcal.toLocaleString()} / {planGoal > 0 ? planGoal.toLocaleString() : '—'}</span>
          </div>
          <div className="tt-today-bar-wrap">
            <div className="tt-today-bar" style={{ width: `${planGoal > 0 ? Math.min((todayKcal / planGoal) * 100, 100) : 0}%` }} />
          </div>
        </div>

        {/* Activity calendar */}
        {startDate && (
          <div className="tt-section">
            <div className="tt-section-title">Actividad</div>
            <div className="tt-calendar">
              {Array.from({ length: 28 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - (27 - i));
                const startD = new Date(startDate);
                const dayIndex = Math.floor((d.getTime() - startD.getTime()) / 86400000);
                const isActive = hsmUnlockDays.includes(dayIndex);
                return <div key={i} className={`tt-cal-cell${isActive ? ' active' : ''}${i === 27 ? ' today' : ''}`} />;
              })}
            </div>
          </div>
        )}

        {/* Workout history */}
        {workoutLog.length > 0 && (
          <div className="tt-section">
            <div className="tt-section-title">Últimos entrenamientos</div>
            <div className="tt-history">
              {[...workoutLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((entry, i) => (
                <div key={i} className="tt-history-item">
                  <div className="tt-history-date">{entry.date}</div>
                  <div className="tt-history-exercise">{entry.exercise}</div>
                  <div className="tt-history-sets">
                    {entry.sets.map((s, si) => (
                      <span key={si} className="tt-history-set">{s.reps}×{s.kg}kg</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>)}

      {/* ── Tab: Progreso ── */}
      {tab === 'progreso' && (<>
        {/* Radar chart */}
        {dailyHSMResponses.length > 0 && (
          <div className="tt-section">
            <div className="tt-section-title">Tus dimensiones</div>
            <div className="tt-radar-wrap">
              <svg viewBox="0 0 300 300" className="tt-radar-svg">
                {[0.25, 0.5, 0.75, 1].map(r => (
                  <polygon key={r} className="tt-radar-ring" points={
                    Array.from({ length: 10 }, (_, i) => {
                      const angle = (Math.PI * 2 * i / 10) - Math.PI / 2;
                      return `${150 + Math.cos(angle) * 120 * r},${150 + Math.sin(angle) * 120 * r}`;
                    }).join(' ')
                  } />
                ))}
                <polygon className="tt-radar-data" points={
                  radarData.map((d, i) => {
                    const angle = (Math.PI * 2 * i / 10) - Math.PI / 2;
                    const v = Math.max(d.value, 0.05);
                    return `${150 + Math.cos(angle) * 120 * v},${150 + Math.sin(angle) * 120 * v}`;
                  }).join(' ')
                } />
                {radarData.map((d, i) => {
                  const angle = (Math.PI * 2 * i / 10) - Math.PI / 2;
                  return (
                    <text key={i} x={150 + Math.cos(angle) * 145} y={150 + Math.sin(angle) * 145}
                      className="tt-radar-label" textAnchor="middle" dominantBaseline="middle">{d.label}</text>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Streak milestones */}
        <div className="tt-section">
          <div className="tt-section-title">Logros</div>
          <div className="tt-milestones">
            {[3,7,14,21,30,60,90].map(m => (
              <div key={m} className={`tt-milestone${streakCount >= m ? ' achieved' : ''}`}>
                <span className="tt-milestone-num">{m}</span>
                <span className="tt-milestone-lbl">días</span>
              </div>
            ))}
          </div>
        </div>
      </>)}

      {/* ── Tab: Ajustes ── */}
      {tab === 'ajustes' && (<>
        <div className="tt-profile">
          <div className="tt-profile-row"><span className="tt-profile-lbl">Nombre</span><span className="tt-profile-val">{String(obData.name || userName || '—')}</span></div>
          <div className="tt-profile-row"><span className="tt-profile-lbl">Sexo</span><span className="tt-profile-val">{String(obData.sex || '—')}</span></div>
          <div className="tt-profile-row"><span className="tt-profile-lbl">Edad</span><span className="tt-profile-val">{obData.edad ? `${obData.edad} años` : '—'}</span></div>
          <div className="tt-profile-row"><span className="tt-profile-lbl">Peso</span><span className="tt-profile-val">{obData.peso ? `${obData.peso} kg` : '—'}</span></div>
          <div className="tt-profile-row"><span className="tt-profile-lbl">Estatura</span><span className="tt-profile-val">{obData.estatura ? `${obData.estatura} cm` : '—'}</span></div>
          <div className="tt-profile-row"><span className="tt-profile-lbl">Actividad</span><span className="tt-profile-val">{String(obData.activity || '—')}</span></div>
          <div className="tt-profile-row"><span className="tt-profile-lbl">Objetivo</span><span className="tt-profile-val">{String(obData.goal || '—')}</span></div>
          {planGoal > 0 && <div className="tt-profile-row"><span className="tt-profile-lbl">Meta calórica</span><span className="tt-profile-val tt-profile-kcal">{planGoal.toLocaleString()} kcal/día</span></div>}
          {tdee > 0 && <div className="tt-profile-row"><span className="tt-profile-lbl">TDEE</span><span className="tt-profile-val">{tdee.toLocaleString()} kcal</span></div>}
        </div>
        <button className="tt-logout" onClick={logout}>Cerrar sesión</button>
      </>)}

      </div>{/* end tab-content */}
    </div>
  );
}
