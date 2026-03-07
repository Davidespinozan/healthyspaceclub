import { useState } from 'react';
import { trainingDays, type TrainingDay, type TrainingExercise } from '../data/trainingDays';
import { useAppStore } from '../store';

const typeLabel: Record<string, string> = {
  lower: 'Lower Body',
  upper: 'Upper Body',
  yoga: 'Yoga / Movilidad',
  rest: 'Descanso',
};

const WEEKS = [1, 2, 3, 4] as const;

export default function Rutinas() {
  const [week, setWeek] = useState(1);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const openVideo = useAppStore(s => s.openVideo);

  const weekDays = trainingDays.filter(d => d.week === week);

  const toggle = (day: number, locked?: boolean) => {
    if (locked) return;
    setOpenDay(openDay === day ? null : day);
  };

  const playExercise = (ex: TrainingExercise) => {
    openVideo(
      'exercise',
      ex.name,
      ex.note || ex.sets,
      '🎬',
      [
        { title: 'Preparación', desc: `Prepárate para ${ex.name}. ${ex.note || ''}` },
        { title: 'Ejecución', desc: `Realiza ${ex.sets}. Mantén control y buena técnica en cada repetición.` },
        { title: 'Contracción', desc: 'Aprieta el músculo objetivo en el punto máximo del movimiento.' },
        { title: 'Respiración', desc: 'Exhala en el esfuerzo, inhala en la fase excéntrica. Mantén ritmo constante.' },
        { title: 'Descanso', desc: 'Descansa 60–90 seg entre series. Hidrátate y prepárate para la siguiente.' },
      ]
    );
  };

  return (
    <div className="rt-wrap">
      {/* Week tabs */}
      <div className="rt-week-tabs">
        {WEEKS.map(w => (
          <button
            key={w}
            className={`rt-week-tab${week === w ? ' active' : ''}`}
            onClick={() => { setWeek(w); setOpenDay(null); }}
          >
            Semana {w}
            {w > 1 && <span className="rt-week-soon">Próximamente</span>}
          </button>
        ))}
      </div>

      {/* Day chip strip */}
      <div className="rt-week">
        {weekDays.map(d => (
          <button
            key={d.day}
            className={`rt-day-chip${openDay === d.day ? ' active' : ''}${d.type === 'rest' ? ' rest' : ''}${d.locked ? ' locked' : ''}`}
            onClick={() => toggle(d.day, d.locked)}
          >
            <span className="rt-chip-num">Día {d.day}</span>
            <span className="rt-chip-icon">{d.locked ? '🔒' : d.icon}</span>
          </button>
        ))}
      </div>

      {/* Day cards */}
      <div className="rt-days">
        {weekDays.map(d => (
          <DayCard key={d.day} day={d} open={openDay === d.day} onToggle={() => toggle(d.day, d.locked)} onPlay={playExercise} />
        ))}
      </div>
    </div>
  );
}

function DayCard({ day, open, onToggle, onPlay }: { day: TrainingDay; open: boolean; onToggle: () => void; onPlay: (ex: TrainingExercise) => void }) {
  if (day.locked) {
    return (
      <div className="rt-card rt-locked">
        <button className="rt-card-head" disabled>
          <div className="rt-card-left">
            <span className="rt-card-badge" style={{ background: '#999' }}>🔒</span>
            <div className="rt-card-info">
              <span className="rt-card-title">{day.title}</span>
              <span className="rt-card-focus">Se desbloqueará pronto</span>
            </div>
          </div>
          <div className="rt-card-right">
            <span className="rt-card-type">{typeLabel[day.type]}</span>
            <span className="rt-card-dur">{day.duration}</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={`rt-card${open ? ' open' : ''}${day.type === 'rest' ? ' rt-rest' : ''}`}>
      <button className="rt-card-head" onClick={onToggle}>
        <div className="rt-card-left">
          <span className="rt-card-badge" style={{ background: day.color }}>{day.day}</span>
          <div className="rt-card-info">
            <span className="rt-card-title">{day.title}</span>
            <span className="rt-card-focus">{day.focus}</span>
          </div>
        </div>
        <div className="rt-card-right">
          <span className="rt-card-type">{typeLabel[day.type]}</span>
          <span className="rt-card-dur">{day.duration}</span>
          <span className={`rt-card-arrow${open ? ' open' : ''}`}>›</span>
        </div>
      </button>

      {open && (
        <div className="rt-card-body">
          {day.sections.map((sec, si) => (
            <div key={si} className="rt-section">
              <div className="rt-sec-head">
                <span className="rt-sec-title">{sec.title}</span>
                {sec.subtitle && <span className="rt-sec-sub">{sec.subtitle}</span>}
              </div>
              <div className="rt-exercises">
                {sec.exercises.map((ex, ei) => (
                  <div key={ei} className="rt-exercise" onClick={() => onPlay(ex)}>
                    <span className="rt-ex-num">{ei + 1}</span>
                    <div className="rt-ex-info">
                      <span className="rt-ex-name">{ex.name}</span>
                      {ex.note && <span className="rt-ex-note">{ex.note}</span>}
                    </div>
                    <span className="rt-ex-sets">{ex.sets}</span>
                    <span className="rt-ex-play">▶</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
