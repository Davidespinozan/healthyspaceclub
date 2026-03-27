import { useState } from 'react';
import { useAppStore } from '../store';

export default function OnboardingScreen() {
  const { obStep, setObStep, setObData, finishOnboarding } = useAppStore();

  const [name, setName] = useState('');
  const [sex, setSex] = useState('');
  const [goal, setGoal] = useState('');
  const [activity, setActivity] = useState('');

  const totalSteps = 4;
  const progress = ((obStep - 1) / totalSteps) * 100;

  function goBack() {
    if (obStep > 1) setObStep(obStep - 1);
  }

  function goNext(step: number) {
    setObStep(obStep + 1);
    if (step === 1) setObData('name', name);
    if (step === 2) setObData('sex', sex);
    if (step === 3) setObData('goal', goal);
  }

  function finish() {
    setObData('activity', activity);
    // Use sensible defaults for peso/estatura/edad — user can refine later in profile
    setObData('peso', 70);
    setObData('estatura', 170);
    setObData('edad', 28);
    finishOnboarding();
  }

  return (
    <div className="ob">
      <div className="ob-logo">
        <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="Healthy Space Club" style={{ height: '72px', width: 'auto' }} />
      </div>
      <div className="ob-bar">
        <div className="ob-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Step 1 — Name */}
      <div className={`ob-step${obStep === 1 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 1 de {totalSteps}</div>
        <div className="ob-q">¿Cuál es tu nombre?</div>
        <div className="ob-hint">Con este nombre te saludaremos cada día.</div>
        <input
          className="ob-inp" type="text" placeholder="Tu nombre..."
          autoComplete="name" value={name}
          onChange={e => setName(e.target.value)}
        />
        <button className="btn-ob" onClick={() => goNext(1)} disabled={name.trim().length < 2}>Continuar</button>
      </div>

      {/* Step 2 — Sex */}
      <div className={`ob-step${obStep === 2 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 2 de {totalSteps}</div>
        <div className="ob-q">¿Cuál es tu sexo biológico?</div>
        <div className="ob-hint">Esto calibra tus macros y requerimientos calóricos.</div>
        <div className="ob-opts">
          <div className={`ob-opt${sex === 'Hombre' ? ' sel' : ''}`} onClick={() => setSex('Hombre')}>
            <span className="ob-em">🙋‍♂️</span><div><h5>Hombre</h5></div>
          </div>
          <div className={`ob-opt${sex === 'Mujer' ? ' sel' : ''}`} onClick={() => setSex('Mujer')}>
            <span className="ob-em">🙋‍♀️</span><div><h5>Mujer</h5></div>
          </div>
        </div>
        <button className="btn-ob" onClick={() => goNext(2)} disabled={!sex}>Continuar</button>
        <button className="btn-ob-back" onClick={goBack}>← Anterior</button>
      </div>

      {/* Step 3 — Goal */}
      <div className={`ob-step${obStep === 3 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 3 de {totalSteps}</div>
        <div className="ob-q">¿Cuál es tu objetivo?</div>
        <div className="ob-hint">Tu plan de nutrición y entrenamiento se personaliza en torno a esto.</div>
        <div className="ob-opts">
          {[
            { id: 'Bajar grasa corporal', em: '🔥', title: 'Bajar grasa', desc: 'Definir y reducir porcentaje graso' },
            { id: 'Recomponer', em: '⚡', title: 'Recomponer', desc: 'Perder grasa y ganar músculo' },
            { id: 'Subir masa muscular', em: '💪', title: 'Subir masa', desc: 'Ganar volumen y fuerza' },
          ].map(o => (
            <div key={o.id} className={`ob-opt${goal === o.id ? ' sel' : ''}`} onClick={() => setGoal(o.id)}>
              <span className="ob-em">{o.em}</span><div><h5>{o.title}</h5><p>{o.desc}</p></div>
            </div>
          ))}
        </div>
        <button className="btn-ob" onClick={() => goNext(3)} disabled={!goal}>Continuar</button>
        <button className="btn-ob-back" onClick={goBack}>← Anterior</button>
      </div>

      {/* Step 4 — Activity */}
      <div className={`ob-step${obStep === 4 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 4 de {totalSteps}</div>
        <div className="ob-q">¿Cuál es tu nivel de actividad?</div>
        <div className="ob-hint">Esto ajusta tus calorías y rutinas.</div>
        <div className="ob-opts ob-opts-single">
          {[
            { id: 'Sedentaria', em: '🛋️', title: 'Sedentaria', desc: 'Poco o nada de ejercicio' },
            { id: 'Ligera', em: '🚶', title: 'Ligera', desc: 'Ejercicio 1-2 días' },
            { id: 'Moderada', em: '🏋️', title: 'Moderada', desc: 'Ejercicio 3-5 días' },
            { id: 'Alta', em: '⚡', title: 'Alta', desc: 'Ejercicio intenso 6-7 días' },
            { id: 'Atleta', em: '🏆', title: 'Atleta', desc: 'Entreno dos veces al día' },
          ].map(o => (
            <div key={o.id} className={`ob-opt${activity === o.id ? ' sel' : ''}`} onClick={() => setActivity(o.id)}>
              <span className="ob-em">{o.em}</span><div><h5>{o.title}</h5><p>{o.desc}</p></div>
            </div>
          ))}
        </div>
        <button className="btn-ob" onClick={finish} disabled={!activity}>Entrar al Club</button>
        <button className="btn-ob-back" onClick={goBack}>← Anterior</button>
      </div>
    </div>
  );
}
