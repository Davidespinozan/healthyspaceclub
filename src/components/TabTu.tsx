import { useAppStore } from '../store';
import { useLifeSystemStore } from '../store/lifeSystemStore';
import type { DashPage } from '../types';

export default function TabTu({ onNav }: { onNav: (page: DashPage) => void }) {
  const {
    userName, obData, tdee, planGoal, streakCount, startDate,
    foodLog, workoutLog, logout,
  } = useAppStore();
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
