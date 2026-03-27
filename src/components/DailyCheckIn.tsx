import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useAppStore } from '../store';

const QUESTIONS = [
  {
    id: 'feeling',
    question: '¿Cómo amaneciste hoy?',
    emoji: '🌅',
    options: [
      { label: 'Con todo',  value: 'excelente', icon: '🔥' },
      { label: 'Bien',      value: 'bien',       icon: '💪' },
      { label: 'Regular',   value: 'regular',    icon: '😐' },
      { label: 'Cansado',   value: 'cansado',    icon: '😴' },
    ],
  },
  {
    id: 'sleep',
    question: '¿Cómo dormiste anoche?',
    emoji: '🌙',
    options: [
      { label: 'Muy bien (+7h)',      value: 'muy bien', icon: '😴' },
      { label: 'Normal (5–7h)',       value: 'normal',   icon: '🙂' },
      { label: 'Mal (menos de 5h)',   value: 'mal',      icon: '😵' },
    ],
  },
];

export default function DailyCheckIn({ onDone }: { onDone: () => void }) {
  const { saveDailyCheckIn, streakCount, userName } = useAppStore();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const firstName = userName?.split(' ')[0] || '';

  function handleOption(value: string) {
    const q = QUESTIONS[step];
    const next = { ...answers, [q.id]: value };
    setAnswers(next);

    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1);
    } else {
      saveDailyCheckIn({ feeling: next.feeling, sleep: next.sleep });
      setDone(true);
      setTimeout(onDone, 1800);
    }
  }

  if (done) {
    const newStreak = streakCount;
    return (
      <div className="ci-done">
        <div className="ci-done-fire">🔥</div>
        <div className="ci-done-streak">{newStreak} {newStreak === 1 ? 'día' : 'días'} seguidos</div>
        <div className="ci-done-sub">¡Sigue así, no rompas la racha!</div>
      </div>
    );
  }

  const q = QUESTIONS[step];

  return (
    <div className="ci-wrap">
      {/* Progress */}
      <div className="dtr-progress">
        {QUESTIONS.map((_, i) => (
          <div key={i} className={`dtr-dot${i < step ? ' done' : i === step ? ' active' : ''}`} />
        ))}
      </div>

      <div className="dtr-question-card">
        <div className="dtr-q-emoji">{q.emoji}</div>
        <div className="dtr-q-text">
          {step === 0 && firstName ? `${firstName}, ${q.question.toLowerCase()}` : q.question}
        </div>
        <div className="dtr-options">
          {q.options.map(opt => (
            <button key={opt.value} className="dtr-option" onClick={() => handleOption(opt.value)}>
              <span className="dtr-opt-icon">{opt.icon}</span>
              <span className="dtr-opt-label">{opt.label}</span>
              <ChevronRight size={14} className="dtr-opt-arrow" />
            </button>
          ))}
        </div>
      </div>

      {step > 0 && (
        <button className="dtr-back" onClick={() => setStep(s => s - 1)}>← Anterior</button>
      )}
    </div>
  );
}
