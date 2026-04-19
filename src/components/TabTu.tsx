import { useMemo, useEffect, useState } from 'react';
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

  return (
    <div className="tp-wrap">
      {/* ── Avatar + name ── */}
      <div className="tp-header">
        <label className="tp-avatar">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" />
            : <div className="tp-avatar-letter">{(firstName || '?')[0].toUpperCase()}</div>
          }
          <input type="file" accept="image/*" onChange={handleAvatar} hidden />
        </label>
        <div className="tp-name">{profile.display_name || userName || 'Anónimo'}</div>
        {profile.bio && <div className="tp-bio">{profile.bio}</div>}
        <button className="tp-edit" onClick={() => onNav('huella')}>Editar perfil</button>
      </div>

      {/* ── Stats ── */}
      <div className="tp-stats">
        <div className="tp-stat">
          <div className="tp-stat-val">{streakCount}</div>
          <div className="tp-stat-lbl">Racha</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-val">{hsmUnlockDays.length}</div>
          <div className="tp-stat-lbl">Días activos</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-val">{postCount}</div>
          <div className="tp-stat-lbl">Posts</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-val">{weeksActive}</div>
          <div className="tp-stat-lbl">Semanas</div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="tp-actions">
        <div className="tp-action" onClick={() => onNav('alimentacion')}>
          <span className="tp-action-icon">🥗</span>
          <span className="tp-action-lbl">Plan</span>
        </div>
        <div className="tp-action" onClick={() => onNav('entrenamiento')}>
          <span className="tp-action-icon">💪</span>
          <span className="tp-action-lbl">Rutina</span>
        </div>
        <div className="tp-action" onClick={() => onNav('alimentacion')}>
          <span className="tp-action-icon">🛒</span>
          <span className="tp-action-lbl">Súper</span>
        </div>
      </div>

      {/* ── Calories today ── */}
      <div className="tp-kcal">
        <div className="tp-kcal-row">
          <span>Calorías hoy</span>
          <span className="tp-kcal-val">{todayKcal.toLocaleString()} / {planGoal > 0 ? planGoal.toLocaleString() : '—'}</span>
        </div>
        <div className="tp-kcal-bar-wrap">
          <div className="tp-kcal-bar" style={{ width: `${planGoal > 0 ? Math.min((todayKcal / planGoal) * 100, 100) : 0}%` }} />
        </div>
      </div>

      {/* ── Activity calendar ── */}
      {startDate && (
        <div className="tp-section">
          <div className="tp-section-title">Actividad</div>
          <div className="tp-calendar">
            {Array.from({ length: 28 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (27 - i));
              const startD = new Date(startDate);
              const dayIndex = Math.floor((d.getTime() - startD.getTime()) / 86400000);
              const isActive = hsmUnlockDays.includes(dayIndex);
              return <div key={i} className={`tp-cal${isActive ? ' on' : ''}${i === 27 ? ' today' : ''}`} />;
            })}
          </div>
        </div>
      )}

      {/* ── Workout history ── */}
      {workoutLog.length > 0 && (
        <div className="tp-section">
          <div className="tp-section-title">Últimos entrenamientos</div>
          <div className="tp-history">
            {[...workoutLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((entry, i) => (
              <div key={i} className="tp-history-item">
                <div className="tp-history-date">{entry.date}</div>
                <div className="tp-history-exercise">{entry.exercise}</div>
                <div className="tp-history-sets">
                  {entry.sets.map((s, si) => (
                    <span key={si} className="tp-history-set">{s.reps}×{s.kg}kg</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Radar chart ── */}
      {dailyHSMResponses.length > 0 && (
        <div className="tp-section">
          <div className="tp-section-title">Tus dimensiones</div>
          <div className="tp-radar-wrap">
            <svg viewBox="0 0 300 300" className="tp-radar">
              {[0.25, 0.5, 0.75, 1].map(r => (
                <polygon key={r} className="tp-radar-ring" points={
                  Array.from({ length: 10 }, (_, i) => {
                    const a = (Math.PI * 2 * i / 10) - Math.PI / 2;
                    return `${150 + Math.cos(a) * 120 * r},${150 + Math.sin(a) * 120 * r}`;
                  }).join(' ')
                } />
              ))}
              <polygon className="tp-radar-fill" points={
                radarData.map((d, i) => {
                  const a = (Math.PI * 2 * i / 10) - Math.PI / 2;
                  const v = Math.max(d.value, 0.05);
                  return `${150 + Math.cos(a) * 120 * v},${150 + Math.sin(a) * 120 * v}`;
                }).join(' ')
              } />
              {radarData.map((d, i) => {
                const a = (Math.PI * 2 * i / 10) - Math.PI / 2;
                return (
                  <text key={i} x={150 + Math.cos(a) * 145} y={150 + Math.sin(a) * 145}
                    className="tp-radar-lbl" textAnchor="middle" dominantBaseline="middle">{d.label}</text>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* ── Milestones ── */}
      <div className="tp-section">
        <div className="tp-section-title">Logros</div>
        <div className="tp-milestones">
          {[3,7,14,21,30,60,90].map(m => (
            <div key={m} className={`tp-milestone${streakCount >= m ? ' on' : ''}`}>
              <span className="tp-milestone-num">{m}</span>
              <span className="tp-milestone-lbl">días</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Profile data ── */}
      <div className="tp-section">
        <div className="tp-section-title">Perfil</div>
        <div className="tp-profile-data">
          <div className="tp-row"><span>Sexo</span><span>{String(obData.sex || '—')}</span></div>
          <div className="tp-row"><span>Edad</span><span>{obData.edad ? `${obData.edad} años` : '—'}</span></div>
          <div className="tp-row"><span>Peso</span><span>{obData.peso ? `${obData.peso} kg` : '—'}</span></div>
          <div className="tp-row"><span>Estatura</span><span>{obData.estatura ? `${obData.estatura} cm` : '—'}</span></div>
          <div className="tp-row"><span>Actividad</span><span>{String(obData.activity || '—')}</span></div>
          <div className="tp-row"><span>Objetivo</span><span>{String(obData.goal || '—')}</span></div>
          {planGoal > 0 && <div className="tp-row"><span>Meta calórica</span><span className="tp-kcal-highlight">{planGoal.toLocaleString()} kcal/día</span></div>}
          {tdee > 0 && <div className="tp-row"><span>TDEE</span><span>{tdee.toLocaleString()} kcal</span></div>}
        </div>
      </div>

      {/* ── Logout ── */}
      <button className="tp-logout" onClick={logout}>Cerrar sesión</button>
    </div>
  );
}
