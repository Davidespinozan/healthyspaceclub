import { useState } from 'react';
import { useAppStore } from '../store';

export default function OnboardingScreen() {
  const { obStep, setObStep, setObData, finishOnboarding, startTrial } = useAppStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sex, setSex] = useState('');
  const [goal, setGoal] = useState('');
  const [peso, setPeso] = useState(70);
  const [estatura, setEstatura] = useState(170);
  const [edad, setEdad] = useState(28);
  const [activity, setActivity] = useState('');

  const progress = ((obStep - 1) / 9) * 100;

  function goBack() {
    if (obStep > 1) setObStep(obStep - 1);
  }

  function goNext(step: number) {
    setObStep(obStep + 1);
    if (step === 1) setObData('name', name);
    if (step === 2) setObData('email', email);
    if (step === 3) setObData('sex', sex);
    if (step === 4) setObData('goal', goal);
    if (step === 5) setObData('peso', peso);
    if (step === 6) setObData('estatura', estatura);
    if (step === 7) setObData('edad', edad);
  }

  function finish() {
    setObData('activity', activity);
    setObStep(9);
  }

  function choosePlan(plan: 'basico' | 'pro' | 'elite') {
    startTrial(plan);
    finishOnboarding();
  }

  return (
    <div className="ob">
      <div className="ob-logo">
        <img src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1771971266/logo_ohaica.png" alt="Healthy Space Club" style={{ height: '72px', width: 'auto' }} />
      </div>
      <div className="ob-bar">
        <div className="ob-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Step 1 */}
      <div className={`ob-step${obStep === 1 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 1 de 9</div>
        <div className="ob-q">👋 ¿Cuál es tu nombre completo?</div>
        <div className="ob-hint">Con este nombre te saludaremos dentro del Club cada día.</div>
        <input
          className="ob-inp" type="text" placeholder="Tu nombre completo..."
          autoComplete="name" value={name}
          onChange={e => setName(e.target.value)}
        />
        <button className="btn-ob" onClick={() => goNext(1)} disabled={name.trim().length < 2}>Continuar →</button>
      </div>

      {/* Step 2 */}
      <div className={`ob-step${obStep === 2 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 2 de 9</div>
        <div className="ob-q">📧 ¿Cuál es tu correo electrónico?</div>
        <div className="ob-hint">Para enviarte tu plan personalizado y acceso al Club.</div>
        <input
          className="ob-inp" type="email" placeholder="tu@correo.com"
          autoComplete="email" value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button className="btn-ob" onClick={() => goNext(2)} disabled={!email.includes('@')}>Continuar →</button>
        <button className="btn-ob-back" onClick={goBack}>← Anterior</button>
      </div>
      <div className={`ob-step${obStep === 3 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 3 de 9</div>
        <div className="ob-q">🧬 ¿Cuál es tu sexo biológico?</div>
        <div className="ob-hint">Esto nos ayuda a calcular tus macros y requerimientos calóricos.</div>
        <div className="ob-opts">
          <div className={`ob-opt${sex === 'Hombre' ? ' sel' : ''}`} onClick={() => setSex('Hombre')}>
            <span className="ob-em">🙋‍♂️</span><div><h5>Hombre</h5></div>
          </div>
          <div className={`ob-opt${sex === 'Mujer' ? ' sel' : ''}`} onClick={() => setSex('Mujer')}>
            <span className="ob-em">🙋‍♀️</span><div><h5>Mujer</h5></div>
          </div>
        </div>
        <button className="btn-ob" onClick={() => goNext(3)} disabled={!sex}>Continuar →</button>
        <button className="btn-ob-back" onClick={goBack}>← Anterior</button>
      </div>
      <div className={`ob-step${obStep === 4 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 4 de 9</div>
        <div className="ob-q">🎯 ¿Cuál es tu objetivo principal?</div>
        <div className="ob-hint">El Club personalizará tu plan de nutrición y entrenamiento en torno a esto.</div>
        <div className="ob-opts">
          {[
            { id: 'Bajar grasa corporal', em: '🔥', title: 'Bajar grasa corporal', desc: 'Definir y reducir porcentaje graso' },
            { id: 'Recomponer', em: '⚡', title: 'Recomponer', desc: 'Perder grasa y ganar músculo' },
            { id: 'Subir masa muscular', em: '💪', title: 'Subir masa muscular', desc: 'Ganar volumen y fuerza' },
          ].map(o => (
            <div key={o.id} className={`ob-opt${goal === o.id ? ' sel' : ''}`} onClick={() => setGoal(o.id)}>
              <span className="ob-em">{o.em}</span><div><h5>{o.title}</h5><p>{o.desc}</p></div>
            </div>
          ))}
        </div>
        <button className="btn-ob" onClick={() => goNext(4)} disabled={!goal}>Continuar →</button>
        <button className="btn-ob-back" onClick={goBack}>← Anterior</button>
      </div>
      <div className={`ob-step${obStep === 5 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 5 de 9</div>
        <div className="ob-q">⚖️ ¿Cuál es tu peso actual?</div>
        <div className="ob-hint">En kilogramos — esto calibra tu plan nutricional desde el día uno.</div>
        <div className="ob-number-display">{peso} <span>kg</span></div>
        <input type="range" min="40" max="150" value={peso} step="1" onChange={e => setPeso(Number(e.target.value))} />
        <button className="btn-ob" onClick={() => goNext(5)}>Continuar →</button>
        <button className="btn-ob-back" onClick={goBack}>← Anterior</button>
      </div>
      <div className={`ob-step${obStep === 6 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 6 de 9</div>
        <div className="ob-q">📏 ¿Cuál es tu estatura?</div>
        <div className="ob-hint">En centímetros — para calcular tu composición ideal.</div>
        <div className="ob-number-display">{estatura} <span>cm</span></div>
        <input type="range" min="140" max="210" value={estatura} step="1" onChange={e => setEstatura(Number(e.target.value))} />
        <button className="btn-ob" onClick={() => goNext(6)}>Continuar →</button>
        <button className="btn-ob-back" onClick={goBack}>← Anterior</button>
      </div>
      <div className={`ob-step${obStep === 7 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 7 de 9</div>
        <div className="ob-q">🎂 ¿Cuántos años tienes?</div>
        <div className="ob-hint">Tu edad influye en tu metabolismo y plan de entrenamiento.</div>
        <div className="ob-number-display">{edad} <span>años</span></div>
        <input type="range" min="14" max="70" value={edad} step="1" onChange={e => setEdad(Number(e.target.value))} />
        <button className="btn-ob" onClick={() => goNext(7)}>Continuar →</button>
        <button className="btn-ob-back" onClick={goBack}>← Anterior</button>
      </div>
      <div className={`ob-step${obStep === 8 ? ' on' : ''}`}>
        <div className="ob-snum">Paso 8 de 9</div>
        <div className="ob-q">🏃 ¿Cuál es tu nivel de actividad física?</div>
        <div className="ob-hint">Sin juicios — esto ajusta tus calorías y rutinas perfectamente.</div>
        <div className="ob-opts ob-opts-single">
          {[
            { id: 'Sedentaria', em: '🛋️', title: 'Sedentaria', desc: 'Poco o nada de ejercicio' },
            { id: 'Ligera', em: '🚶', title: 'Ligera', desc: 'Caminar o ejercicio 1-2 días' },
            { id: 'Moderada', em: '🏋️', title: 'Moderada', desc: 'Ejercicio 3-5 días a la semana' },
            { id: 'Alta', em: '⚡', title: 'Alta', desc: 'Ejercicio intenso 6-7 días' },
            { id: 'Atleta', em: '🏆', title: 'Atleta', desc: 'Entreno dos veces al día o más' },
          ].map(o => (
            <div key={o.id} className={`ob-opt${activity === o.id ? ' sel' : ''}`} onClick={() => setActivity(o.id)}>
              <span className="ob-em">{o.em}</span><div><h5>{o.title}</h5><p>{o.desc}</p></div>
            </div>
          ))}
        </div>
        <button className="btn-ob" onClick={finish} disabled={!activity}>Entrar al Club ✦</button>
        <button className="btn-ob-back" onClick={goBack}>← Anterior</button>
      </div>

      {/* Step 9 — Plan selection */}
      <div className={`ob-step ob-plan-step${obStep === 9 ? ' on' : ''}`}>
        <div className="ob-snum">Elige tu plan</div>
        <div className="ob-q">🎉 Tu plan está listo, {name || 'bienvenid@'}</div>
        <div className="ob-hint">Elige cómo empezar hoy — 3 días gratis en cualquier plan</div>
        <div className="ob-plan-cards">
          <div className="ob-plan-card">
            <div className="ob-plan-trial-badge">✦ 3 días gratis</div>
            <div className="ob-plan-name">Básico</div>
            <div className="ob-plan-price">$149<span>/mes</span></div>
            <ul className="ob-plan-feats">
              <li>Plan de alimentación personalizado</li>
              <li>28 días de menú con porciones</li>
              <li>Recetas semanales en video</li>
              <li>Plan de entrenamiento 7 días</li>
            </ul>
            <button className="ob-plan-btn" onClick={() => choosePlan('basico')}>Empezar 3 días gratis →</button>
          </div>
          <div className="ob-plan-card featured">
            <div className="ob-plan-popular">⭐ Más popular</div>
            <div className="ob-plan-trial-badge">✦ 3 días gratis</div>
            <div className="ob-plan-name">Pro</div>
            <div className="ob-plan-price">$199<span>/mes</span></div>
            <ul className="ob-plan-feats">
              <li>Todo lo del plan Básico</li>
              <li>Macros personalizados (P/C/G)</li>
              <li>Intercambio inteligente de ingredientes</li>
              <li>Registro de entrenamiento con progresión</li>
            </ul>
            <button className="ob-plan-btn" onClick={() => choosePlan('pro')}>Empezar 3 días gratis →</button>
          </div>
          <div className="ob-plan-card">
            <div className="ob-plan-trial-badge">✦ 3 días gratis</div>
            <div className="ob-plan-name">Elite</div>
            <div className="ob-plan-price">$299<span>/mes</span></div>
            <ul className="ob-plan-feats">
              <li>Todo lo del plan Pro</li>
              <li>AI Coach personalizado</li>
              <li>Control de Vida (Notion)</li>
              <li>Comunidad privada del Club</li>
            </ul>
            <button className="ob-plan-btn" onClick={() => choosePlan('elite')}>Empezar 3 días gratis →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
