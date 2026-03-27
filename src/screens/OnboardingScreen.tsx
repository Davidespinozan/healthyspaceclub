import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useAppStore } from '../store';

const TOTAL_STEPS = 8;

export default function OnboardingScreen() {
  const { setObData, finishOnboardingCalc, finishOnboarding } = useAppStore();

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [animKey, setAnimKey] = useState(0);

  // Form state
  const [name, setName] = useState('');
  const [sex, setSex] = useState('');
  const [goal, setGoal] = useState('');
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [estatura, setEstatura] = useState('');
  const [activity, setActivity] = useState('');

  // Processing animation
  const [processingLine, setProcessingLine] = useState(0);
  const processingTexts = [
    'Calculando tu metabolismo...',
    'Diseñando tu plan de nutrición...',
    'Preparando tu coach personal...',
    'Activando el Healthy Space Method...',
  ];

  function goNext() {
    setDir('next');
    setAnimKey(k => k + 1);
    setStep(s => s + 1);
  }

  function goBack() {
    setDir('prev');
    setAnimKey(k => k + 1);
    setStep(s => s - 1);
  }

  // Step 7: processing animation + save to store
  useEffect(() => {
    if (step !== 7) return;

    // Save all data to store
    setObData('name', name);
    setObData('sex', sex);
    setObData('goal', goal);
    setObData('edad', Number(edad) || 28);
    setObData('peso', Number(peso) || 70);
    setObData('estatura', Number(estatura) || 170);
    setObData('activity', activity);

    // Animate processing lines
    setProcessingLine(0);
    const timers = processingTexts.map((_, i) =>
      setTimeout(() => setProcessingLine(i + 1), (i + 1) * 800)
    );
    // After all lines shown, calculate TDEE and advance to step 8
    const finalTimer = setTimeout(() => {
      // Trigger TDEE calculation NOW so step 8 can read the result
      finishOnboardingCalc();
      setDir('next');
      setAnimKey(k => k + 1);
      setStep(8);
    }, processingTexts.length * 800 + 700);

    return () => { timers.forEach(clearTimeout); clearTimeout(finalTimer); };
  }, [step]);

  function handleFinish() {
    finishOnboarding();
  }

  // Progress bar (steps 2-7, not shown on 1 and 8)
  const showProgress = step >= 2 && step <= 7;
  const progressPct = showProgress ? ((step - 1) / (TOTAL_STEPS - 2)) * 100 : 0;

  // Can go back?
  const showBack = step >= 2 && step <= 6;

  // Goal label for result screen
  const goalLabels: Record<string, string> = {
    'Ganar músculo': 'Ganancia muscular',
    'Bajar de peso': 'Pérdida de grasa',
    'Más energía': 'Más energía diaria',
    'Bienestar integral': 'Bienestar integral',
  };

  return (
    <div className="onb">
      {/* Progress bar */}
      {showProgress && (
        <div className="onb-progress">
          <div className="onb-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Back button */}
      {showBack && (
        <button className="onb-back" onClick={goBack}>
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
      )}

      {/* ── Step 1: Bienvenida ── */}
      {step === 1 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-dark`}>
          <div className="onb-center">
            <div className="onb-brand">Healthy Space</div>
            <div className="onb-brand-sub">Tu coach de vida, nutrición y crecimiento personal</div>
            <button className="onb-btn-gold" onClick={goNext}>Comenzar mi proceso</button>
          </div>
        </div>
      )}

      {/* ── Step 2: Nombre ── */}
      {step === 2 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">¿Cómo te llamas?</h2>
            <p className="onb-hint">Así te va a llamar tu coach</p>
            <input
              className="onb-input-big"
              type="text"
              placeholder="Tu nombre"
              autoComplete="name"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim().length >= 2 && goNext()}
            />
            <button className="onb-btn-dark" onClick={goNext} disabled={name.trim().length < 2}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Sexo ── */}
      {step === 3 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">¿Cuál es tu sexo biológico?</h2>
            <div className="onb-cards-row">
              {(['Hombre', 'Mujer'] as const).map(s => (
                <div
                  key={s}
                  className={`onb-card-select${sex === s ? ' selected' : ''}`}
                  onClick={() => { setSex(s); setTimeout(goNext, 200); }}
                >
                  <span className="onb-card-emoji">{s === 'Hombre' ? '🙋‍♂️' : '🙋‍♀️'}</span>
                  <span className="onb-card-label">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Objetivo ── */}
      {step === 4 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">¿Qué quieres lograr?</h2>
            <div className="onb-cards-col">
              {[
                { id: 'Ganar músculo', emoji: '💪', desc: 'Construir fuerza y masa muscular' },
                { id: 'Bajar de peso', emoji: '🔥', desc: 'Perder grasa de forma sostenible' },
                { id: 'Más energía', emoji: '⚡', desc: 'Sentirme mejor cada día' },
                { id: 'Bienestar integral', emoji: '🧘', desc: 'Cuerpo, mente y propósito' },
              ].map(o => (
                <div
                  key={o.id}
                  className={`onb-card-option${goal === o.id ? ' selected' : ''}`}
                  onClick={() => { setGoal(o.id); setTimeout(goNext, 200); }}
                >
                  <span className="onb-card-emoji">{o.emoji}</span>
                  <div>
                    <div className="onb-card-title">{o.id}</div>
                    <div className="onb-card-desc">{o.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Datos físicos ── */}
      {step === 5 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">Tus datos para personalizar todo</h2>
            <p className="onb-hint">Calculamos tu metabolismo exacto con estos datos</p>
            <div className="onb-inputs-group">
              <div className="onb-input-field">
                <label>Edad</label>
                <input type="number" inputMode="numeric" placeholder="28" value={edad} onChange={e => setEdad(e.target.value)} />
              </div>
              <div className="onb-input-field">
                <label>Peso (kg)</label>
                <input type="number" inputMode="decimal" placeholder="70" value={peso} onChange={e => setPeso(e.target.value)} />
              </div>
              <div className="onb-input-field">
                <label>Altura (cm)</label>
                <input type="number" inputMode="numeric" placeholder="170" value={estatura} onChange={e => setEstatura(e.target.value)} />
              </div>
            </div>
            <button
              className="onb-btn-dark"
              onClick={goNext}
              disabled={!edad || !peso || !estatura}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── Step 6: Actividad ── */}
      {step === 6 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">¿Qué tan activo eres normalmente?</h2>
            <div className="onb-cards-col">
              {[
                { id: 'Sedentaria', emoji: '🛋', desc: 'Trabajo de escritorio, poco movimiento' },
                { id: 'Ligera', emoji: '🚶', desc: 'Camino algo, actividad ocasional' },
                { id: 'Moderada', emoji: '🏃', desc: 'Ejercicio 3-4 veces por semana' },
                { id: 'Alta', emoji: '🏋', desc: 'Entreno intenso casi todos los días' },
              ].map(o => (
                <div
                  key={o.id}
                  className={`onb-card-option${activity === o.id ? ' selected' : ''}`}
                  onClick={() => { setActivity(o.id); setTimeout(goNext, 200); }}
                >
                  <span className="onb-card-emoji">{o.emoji}</span>
                  <div>
                    <div className="onb-card-title">{o.id}</div>
                    <div className="onb-card-desc">{o.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 7: Processing ── */}
      {step === 7 && (
        <div key={animKey} className="onb-slide onb-dark">
          <div className="onb-center">
            <div className="onb-processing">
              {processingTexts.map((text, i) => (
                <div
                  key={i}
                  className={`onb-proc-line${i < processingLine ? ' visible' : ''}`}
                >
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 8: Profile ready ── */}
      {step === 8 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-dark`}>
          <div className="onb-center">
            <h2 className="onb-result-title">Todo listo, {name.split(' ')[0]}</h2>
            <div className="onb-result-card">
              <div className="onb-result-kcal">
                {useAppStore.getState().planGoal > 0
                  ? useAppStore.getState().planGoal.toLocaleString()
                  : '—'} <span>kcal/día</span>
              </div>
              <div className="onb-result-plan">{goalLabels[goal] || goal}</div>
              <div className="onb-result-coach">Tu coach ya te conoce</div>
            </div>
            <button className="onb-btn-gold" onClick={handleFinish}>
              Entrar a mi espacio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
