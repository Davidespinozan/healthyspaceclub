import { useMemo } from 'react';
import { useAppStore } from '../store';
import { useLifeSystemStore } from '../store/lifeSystemStore';
import type { DashPage } from '../types';

const RADAR_DIMS = ['Identidad','Vocación','Propósito','Metas','Disciplina','Cuerpo','Entorno y Relaciones','Control Emocional','Resiliencia','Evolución'];
const RADAR_SHORT = ['Identidad','Vocación','Propósito','Metas','Disciplina','Cuerpo','Entorno','Emocional','Resiliencia','Evolución'];

export default function TabTu({ onNav }: { onNav: (page: DashPage) => void }) {
  const {
    userName, obData, tdee, planGoal, streakCount, startDate,
    foodLog, workoutLog, hsmUnlockDays, dailyHSMResponses, logout,
  } = useAppStore();

  // Radar chart data: count responses per dimension in last 30 days
  const radarData = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const recent = dailyHSMResponses.filter(r => r.date >= cutoff);
    return RADAR_DIMS.map((dim, i) => {
      const count = recent.filter(r => r.dimension === dim).length;
      const maxExpected = 12; // ~3 times per dimension in 30 days
      return { label: RADAR_SHORT[i], value: Math.min(count / maxExpected, 1) };
    });
  }, [dailyHSMResponses]);
  const { setActivePanel } = useLifeSystemStore();

  function navLS(panel: 'time' | 'journal' | 'dash') {
    setActivePanel(panel);
    onNav('lifesystem');
  }

  const today = new Date().toISOString().split('T')[0];
  const todayKcal = Math.round(foodLog.filter(e => e.date === today).reduce((s, e) => s + e.kcal, 0));

  const weeksActive = (() => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return 0;
    return Math.max(1, Math.floor((Date.now() - start.getTime()) / (7 * 86400000)) + 1);
  })();

  return (
    <div className="tt-wrap">
      {/* Metrics grid */}
      <div className="tt-metrics">
        <div className="tt-metric">
          <div className="tt-metric-val">{streakCount}</div>
          <div className="tt-metric-lbl">Días racha</div>
        </div>
        <div className="tt-metric">
          <div className="tt-metric-val">{todayKcal.toLocaleString()}</div>
          <div className="tt-metric-lbl">Cal hoy</div>
        </div>
        <div className="tt-metric">
          <div className="tt-metric-val">{weeksActive}</div>
          <div className="tt-metric-lbl">Semanas</div>
        </div>
      </div>

      <div className="tab-content">
      {/* Adherence calendar */}
      {startDate && (
        <div className="tt-section">
          <div className="tt-section-title">Tu actividad</div>
          <div className="tt-calendar">
            {(() => {
              const cells = [];
              const now = new Date();
              // Show last 28 days (4 weeks)
              for (let i = 27; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dayStr = d.toISOString().split('T')[0];
                const startD = new Date(startDate);
                const dayIndex = Math.floor((d.getTime() - startD.getTime()) / 86400000);
                const isActive = hsmUnlockDays.includes(dayIndex);
                const isToday = i === 0;
                cells.push(
                  <div
                    key={i}
                    className={`tt-cal-cell${isActive ? ' active' : ''}${isToday ? ' today' : ''}`}
                    title={dayStr}
                  />
                );
              }
              return cells;
            })()}
          </div>
          <div className="tt-cal-legend">
            <span>{hsmUnlockDays.length} días activos</span>
            <div className="tt-cal-legend-dots"><div className="tt-cal-cell small" /><span>Inactivo</span><div className="tt-cal-cell small active" /><span>Activo</span></div>
          </div>
        </div>
      )}

      {/* Radar chart */}
      {dailyHSMResponses.length > 0 && (
        <div className="tt-section">
          <div className="tt-section-title">Tus dimensiones</div>
          <div className="tt-radar-wrap">
            <svg viewBox="0 0 300 300" className="tt-radar-svg">
              {/* Grid rings */}
              {[0.25, 0.5, 0.75, 1].map(r => (
                <polygon key={r} className="tt-radar-ring" points={
                  Array.from({ length: 10 }, (_, i) => {
                    const angle = (Math.PI * 2 * i / 10) - Math.PI / 2;
                    const x = 150 + Math.cos(angle) * 120 * r;
                    const y = 150 + Math.sin(angle) * 120 * r;
                    return `${x},${y}`;
                  }).join(' ')
                } />
              ))}
              {/* Data polygon */}
              <polygon className="tt-radar-data" points={
                radarData.map((d, i) => {
                  const angle = (Math.PI * 2 * i / 10) - Math.PI / 2;
                  const v = Math.max(d.value, 0.05);
                  const x = 150 + Math.cos(angle) * 120 * v;
                  const y = 150 + Math.sin(angle) * 120 * v;
                  return `${x},${y}`;
                }).join(' ')
              } />
              {/* Labels */}
              {radarData.map((d, i) => {
                const angle = (Math.PI * 2 * i / 10) - Math.PI / 2;
                const x = 150 + Math.cos(angle) * 145;
                const y = 150 + Math.sin(angle) * 145;
                return (
                  <text key={i} x={x} y={y} className="tt-radar-label" textAnchor="middle" dominantBaseline="middle">
                    {d.label}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Nutrición */}
      <div className="tt-section">
        <div className="tt-section-title">Nutrición</div>
        <div className="tt-cards">
          <div className="tt-card" onClick={() => onNav('alimentacion')}>
            <div className="tt-card-icon-wrap"><span>🥗</span></div>
            <div>
              <div className="tt-card-title">Plan semanal</div>
              <div className="tt-card-sub">Genera o revisa tu plan de comidas</div>
            </div>
          </div>
          <div className="tt-card" onClick={() => onNav('alimentacion')}>
            <div className="tt-card-icon-wrap"><span>🛒</span></div>
            <div>
              <div className="tt-card-title">Lista del súper</div>
              <div className="tt-card-sub">Ingredientes de la semana</div>
            </div>
          </div>
        </div>
      </div>

      {/* Entrenamiento */}
      <div className="tt-section">
        <div className="tt-section-title">Entrenamiento</div>
        <div className="tt-cards">
          <div className="tt-card" onClick={() => onNav('entrenamiento')}>
            <div className="tt-card-icon-wrap"><span>💪</span></div>
            <div>
              <div className="tt-card-title">Generar rutina de hoy</div>
              <div className="tt-card-sub">Personalizada según tu energía</div>
            </div>
          </div>
        </div>
        {/* Historial */}
        {workoutLog.length > 0 && (
          <>
            <div className="tt-section-title" style={{ marginTop: 12 }}>Historial de entreno</div>
            <div className="tt-history">
              {[...workoutLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((entry, i) => (
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
          </>
        )}
      </div>

      {/* Control de vida */}
      <div className="tt-section">
        <div className="tt-section-title">Control de vida</div>
        <div className="tt-cards">
          <div className="tt-card" onClick={() => navLS('time')}>
            <div className="tt-card-icon-wrap"><span>📅</span></div>
            <div>
              <div className="tt-card-title">Time blocking</div>
              <div className="tt-card-sub">Organiza tu día por bloques</div>
            </div>
          </div>
          <div className="tt-card" onClick={() => navLS('journal')}>
            <div className="tt-card-icon-wrap"><span>✦</span></div>
            <div>
              <div className="tt-card-title">Journal</div>
              <div className="tt-card-sub">Reflexiones y notas diarias</div>
            </div>
          </div>
        </div>
      </div>

      {/* Perfil */}
      <div className="tt-section-title">Perfil</div>
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
      </div>{/* end tab-content */}
    </div>
  );
}
