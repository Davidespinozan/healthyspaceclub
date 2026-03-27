import { useState } from 'react';
import { ChevronLeft, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store';

/* ── Step definitions ─────────────────────────────────────────── */
const HSM_STEPS = [
  { emoji: '🧠', title: 'Identidad',            sub: 'Soy · Sé · Tengo · Puedo', desc: 'Tu identidad es la base de todo. Sin conocer quién eres, cualquier meta se construye sobre arena.' },
  { emoji: '✨', title: 'Vocación',              sub: 'Lo que amas · Sabes · El mundo necesita', desc: 'Descubrir para qué sirves cambia cómo vives cada día.' },
  { emoji: '🎯', title: 'Propósito',             sub: 'Tu por qué', desc: 'El propósito es el por qué detrás de todo lo que haces.' },
  { emoji: '📍', title: 'Metas',                 sub: '90 días · 1 año · 5 años', desc: 'Las metas claras son un mapa. Sin mapa es fácil perderse aunque te esfuerces mucho.' },
  { emoji: '⚡', title: 'Disciplina',            sub: 'Hábitos · Patrones', desc: 'La motivación es pasajera. La disciplina es lo que realmente te lleva ahí.' },
  { emoji: '💪', title: 'Cuerpo',                sub: 'Nutrición · Movimiento · Descanso', desc: 'Tu cuerpo es el vehículo de todo lo que quieres lograr.' },
  { emoji: '🌱', title: 'Entorno y Relaciones',  sub: 'Círculo · Espacio · Límites', desc: 'Las personas con las que te rodeas determinan quién te conviertes.' },
  { emoji: '🧘', title: 'Control Emocional',     sub: 'Patrones · Detonadores · Herramientas', desc: 'Dominar tus emociones no es reprimirlas — es elegir cómo respondes.' },
  { emoji: '🔥', title: 'Resiliencia',           sub: 'Caídas · Aprendizajes · Apoyo', desc: 'No se trata de no caer — se trata de cómo te levantas.' },
  { emoji: '🚀', title: 'Evolución Constante',   sub: 'Aprendizaje · Versión futura · Legado', desc: 'La persona que eras ayer es el piso, no el techo.' },
];

/* ── Types ─────────────────────────────────────────────────────── */
type FieldDef = { key: string; placeholder: string; type?: 'input' | 'textarea' | 'date' | 'select'; options?: string[] };
type SectionDef = { title: string; fields: FieldDef[]; layout?: 'col' | 'row' | 'grid2' | 'grid3' };
type ModuleDef = { sections: SectionDef[]; declaration: { label: string; placeholder: string; special?: 'carta' }; canCompleteMin?: number };

/* ══════════════════════════════════════════════════════════════ */
/*  MODULE DEFINITIONS                                           */
/* ══════════════════════════════════════════════════════════════ */

const MODULES: Record<number, ModuleDef> = {
  0: { // IDENTIDAD
    sections: [
      { title: 'SÉ', layout: 'col', fields: [
        { key: 'se_0', placeholder: '¿Qué sabes hacer mejor que la mayoría?' },
        { key: 'se_1', placeholder: '¿Qué habilidad desarrollaste con esfuerzo?' },
        { key: 'se_2', placeholder: '¿Qué experiencia te marcó?' },
        { key: 'se_3', placeholder: '¿En qué tema eres referencia?' },
        { key: 'se_4', placeholder: '¿Qué talento natural tienes?' },
      ]},
      { title: 'SOY', layout: 'col', fields: [
        { key: 'soy_0', placeholder: '¿Qué te apasiona genuinamente?' },
        { key: 'soy_1', placeholder: '¿Cuál es tu sueño más grande?' },
        { key: 'soy_2', placeholder: '¿Qué aspiras a ser?' },
        { key: 'soy_3', placeholder: '¿Cuál es tu principio más importante?' },
        { key: 'soy_4', placeholder: '¿Qué valoras más en la vida?' },
        { key: 'soy_5', placeholder: '¿Qué creencia te limita?' },
        { key: 'soy_6', placeholder: '¿Cuál es tu mayor miedo?' },
      ]},
      { title: 'TENGO', layout: 'col', fields: [
        { key: 'tengo_0', placeholder: '¿Qué logro o título tienes?' },
        { key: 'tengo_1', placeholder: '¿Cuál es tu activo más valioso?' },
        { key: 'tengo_2', placeholder: '¿Qué herramienta usas diario?' },
        { key: 'tengo_3', placeholder: '¿A quién conoces que te puede ayudar?' },
        { key: 'tengo_4', placeholder: '¿Qué recurso tienes disponible ahora?' },
      ]},
      { title: 'FODA PERSONAL', layout: 'col', fields: [
        { key: 'foda_f', placeholder: 'Ej: Soy disciplinado, tengo habilidades de comunicación...', type: 'textarea' },
        { key: 'foda_d', placeholder: 'Ej: Me cuesta delegar, procrastino bajo presión...', type: 'textarea' },
        { key: 'foda_o', placeholder: 'Ej: Crecimiento del mercado digital, contactos en mi industria...', type: 'textarea' },
        { key: 'foda_a', placeholder: 'Ej: Inestabilidad económica, competencia creciente...', type: 'textarea' },
      ]},
    ],
    declaration: { label: 'PUEDO', placeholder: 'Yo puedo...' },
    canCompleteMin: 5,
  },

  1: { // VOCACIÓN
    sections: [
      { title: 'LO QUE AMO', layout: 'col', fields: [
        { key: 'amo_0', placeholder: '¿Qué actividades te llenan de energía?' },
        { key: 'amo_1', placeholder: '¿Qué harías aunque no te pagaran?' },
        { key: 'amo_2', placeholder: '¿Qué te hace perder la noción del tiempo?' },
        { key: 'amo_3', placeholder: '¿Qué temas estudiarías gratis?' },
        { key: 'amo_4', placeholder: '¿Cuándo te has sentido más vivo?' },
      ]},
      { title: 'LO QUE SÉ HACER', layout: 'col', fields: [
        { key: 'saber_0', placeholder: '¿Cuáles son tus habilidades naturales?' },
        { key: 'saber_1', placeholder: '¿En qué te piden ayuda constantemente?' },
        { key: 'saber_2', placeholder: '¿Qué haces mejor que la mayoría?' },
        { key: 'saber_3', placeholder: '¿De qué logro te sientes más orgulloso?' },
        { key: 'saber_4', placeholder: '¿Qué habilidad has desarrollado con esfuerzo?' },
      ]},
      { title: 'LO QUE EL MUNDO NECESITA', layout: 'col', fields: [
        { key: 'mundo_0', placeholder: '¿Qué problema del mundo te indigna?' },
        { key: 'mundo_1', placeholder: '¿A quién quieres ayudar?' },
        { key: 'mundo_2', placeholder: '¿Qué cambio quieres ver en tu entorno?' },
        { key: 'mundo_3', placeholder: '¿Cómo puedes contribuir con lo que tienes?' },
        { key: 'mundo_4', placeholder: '¿Qué falta en tu comunidad o industria?' },
      ]},
    ],
    declaration: { label: 'MI VOCACIÓN', placeholder: 'Mi vocación es...' },
    canCompleteMin: 3,
  },

  2: { // PROPÓSITO
    sections: [
      { title: 'REFLEXIÓN PROFUNDA', layout: 'col', fields: [
        { key: 'prop_0', placeholder: '¿Cuándo te has sentido más pleno y realizado en tu vida?', type: 'textarea' },
        { key: 'prop_1', placeholder: '¿Qué impacto quieres tener en la vida de otras personas?', type: 'textarea' },
        { key: 'prop_2', placeholder: '¿Cómo quieres que te recuerden?' },
        { key: 'prop_3', placeholder: '¿Qué harías si supieras que no puedes fallar?', type: 'textarea' },
      ]},
      { title: 'MIS VALORES', layout: 'col', fields: [
        { key: 'val_0', placeholder: 'Valor más importante' },
        { key: 'val_1', placeholder: 'Segundo valor' },
        { key: 'val_2', placeholder: 'Tercer valor' },
      ]},
    ],
    declaration: { label: 'MI PROPÓSITO', placeholder: 'Mi propósito es...' },
    canCompleteMin: 3,
  },

  3: { // METAS
    sections: [
      { title: 'META 90 DÍAS', layout: 'col', fields: [
        { key: 'm90_que', placeholder: '¿Qué quieres lograr exactamente?' },
        { key: 'm90_como', placeholder: '¿Cómo sabrás que lo lograste?' },
        { key: 'm90_cuando', placeholder: '¿Para cuándo?', type: 'date' },
        { key: 'm90_porque', placeholder: '¿Por qué es importante para ti?' },
      ]},
      { title: 'META 1 AÑO', layout: 'col', fields: [
        { key: 'm1a_que', placeholder: '¿Qué quieres lograr exactamente?' },
        { key: 'm1a_como', placeholder: '¿Cómo sabrás que lo lograste?' },
        { key: 'm1a_cuando', placeholder: '¿Para cuándo?', type: 'date' },
        { key: 'm1a_porque', placeholder: '¿Por qué es importante para ti?' },
      ]},
      { title: 'META 5 AÑOS', layout: 'col', fields: [
        { key: 'm5a_que', placeholder: '¿Qué quieres lograr exactamente?' },
        { key: 'm5a_como', placeholder: '¿Cómo sabrás que lo lograste?' },
        { key: 'm5a_cuando', placeholder: '¿Para cuándo?', type: 'date' },
        { key: 'm5a_porque', placeholder: '¿Por qué es importante para ti?' },
      ]},
    ],
    declaration: { label: 'MI COMPROMISO', placeholder: 'Me comprometo a...' },
    canCompleteMin: 3,
  },

  4: { // DISCIPLINA
    sections: [
      { title: 'MIS HÁBITOS DE ÉXITO', layout: 'col', fields: [
        { key: 'hab_0', placeholder: '¿Cuál es el hábito?' },
        { key: 'hab_0f', placeholder: 'Diario / Semanal', type: 'select', options: ['Diario', 'Semanal'] },
        { key: 'hab_0h', placeholder: '¿A qué hora?' },
        { key: 'hab_1', placeholder: '¿Cuál es el hábito?' },
        { key: 'hab_1f', placeholder: 'Diario / Semanal', type: 'select', options: ['Diario', 'Semanal'] },
        { key: 'hab_1h', placeholder: '¿A qué hora?' },
        { key: 'hab_2', placeholder: '¿Cuál es el hábito?' },
        { key: 'hab_2f', placeholder: 'Diario / Semanal', type: 'select', options: ['Diario', 'Semanal'] },
        { key: 'hab_2h', placeholder: '¿A qué hora?' },
      ]},
      { title: 'MIS PATRONES A ROMPER', layout: 'col', fields: [
        { key: 'pat_0', placeholder: '¿Cuál es el mal hábito?' },
        { key: 'pat_0t', placeholder: '¿Qué lo dispara?' },
        { key: 'pat_0r', placeholder: '¿Con qué lo reemplazas?' },
        { key: 'pat_1', placeholder: '¿Cuál es el mal hábito?' },
        { key: 'pat_1t', placeholder: '¿Qué lo dispara?' },
        { key: 'pat_1r', placeholder: '¿Con qué lo reemplazas?' },
      ]},
    ],
    declaration: { label: 'MI COMPROMISO DE DISCIPLINA', placeholder: 'Mi compromiso de disciplina es...' },
    canCompleteMin: 3,
  },

  5: { // CUERPO
    sections: [
      { title: 'MI RELACIÓN CON EL CUERPO', layout: 'col', fields: [
        { key: 'cuerpo_0', placeholder: '¿Cómo describirías tu relación actual con tu cuerpo?', type: 'textarea' },
        { key: 'cuerpo_1', placeholder: '¿Qué es lo que más valoras de tu cuerpo?' },
        { key: 'cuerpo_2', placeholder: '¿Qué quieres cambiar o mejorar?' },
        { key: 'cuerpo_3', placeholder: '¿Cómo te sientes cuando te cuidas bien?' },
      ]},
      { title: 'MI ESTILO DE VIDA IDEAL', layout: 'col', fields: [
        { key: 'ideal_0', placeholder: '¿Qué come la versión de ti que quieres ser?' },
        { key: 'ideal_1', placeholder: '¿Cómo se mueve y ejercita?' },
        { key: 'ideal_2', placeholder: '¿Cómo duerme y descansa?' },
        { key: 'ideal_3', placeholder: '¿Cómo maneja el estrés físico?' },
      ]},
      { title: 'MIS COMPROMISOS FÍSICOS', layout: 'col', fields: [
        { key: 'comp_0', placeholder: 'Compromiso físico 1' },
        { key: 'comp_1', placeholder: 'Compromiso físico 2' },
        { key: 'comp_2', placeholder: 'Compromiso físico 3' },
      ]},
    ],
    declaration: { label: 'MI CUERPO MERECE', placeholder: 'Mi cuerpo merece...' },
    canCompleteMin: 3,
  },

  6: { // ENTORNO Y RELACIONES
    sections: [
      { title: 'MI CÍRCULO', layout: 'col', fields: [
        { key: 'energia_0', placeholder: 'Persona que me da energía 1' },
        { key: 'energia_1', placeholder: 'Persona que me da energía 2' },
        { key: 'energia_2', placeholder: 'Persona que me da energía 3' },
        { key: 'quita_0', placeholder: 'Persona que me la quita 1' },
        { key: 'quita_1', placeholder: 'Persona que me la quita 2' },
        { key: 'quita_2', placeholder: 'Persona que me la quita 3' },
        { key: 'fort_0', placeholder: 'Relación que necesito fortalecer 1' },
        { key: 'fort_1', placeholder: 'Relación que necesito fortalecer 2' },
      ]},
      { title: 'MI ENTORNO FÍSICO', layout: 'col', fields: [
        { key: 'espacio_0', placeholder: '¿Cómo es tu espacio de trabajo actual?' },
        { key: 'espacio_1', placeholder: '¿Cómo sería tu espacio ideal?' },
        { key: 'espacio_2', placeholder: '¿Qué cambio puedes hacer esta semana?' },
      ]},
      { title: 'MIS LÍMITES', layout: 'col', fields: [
        { key: 'lim_0', placeholder: 'Límite que necesito establecer 1' },
        { key: 'lim_1', placeholder: 'Límite que necesito establecer 2' },
        { key: 'lim_2', placeholder: 'Límite que necesito establecer 3' },
      ]},
    ],
    declaration: { label: 'ME RODEO DE', placeholder: 'Me rodeo de...' },
    canCompleteMin: 3,
  },

  7: { // CONTROL EMOCIONAL
    sections: [
      { title: 'MIS PATRONES EMOCIONALES', layout: 'col', fields: [
        { key: 'emo_0', placeholder: '¿Qué emoción aparece más seguido en ti?' },
        { key: 'emo_1', placeholder: '¿Qué la dispara normalmente?' },
        { key: 'emo_2', placeholder: '¿Cómo reaccionas cuando aparece?' },
        { key: 'emo_3', placeholder: '¿Cómo quieres responder en su lugar?' },
      ]},
      { title: 'MIS DETONADORES', layout: 'col', fields: [
        { key: 'det_0', placeholder: 'Situación que me saca de control' },
        { key: 'det_0r', placeholder: '¿Qué pasa después?' },
        { key: 'det_1', placeholder: 'Otra situación' },
        { key: 'det_1r', placeholder: '¿Qué pasa después?' },
      ]},
      { title: 'MIS HERRAMIENTAS', layout: 'col', fields: [
        { key: 'herr_0', placeholder: '¿Qué te ayuda a calmarte?' },
        { key: 'herr_1', placeholder: '¿Cómo practicas la conciencia del momento?' },
        { key: 'herr_2', placeholder: '¿Cómo procesas las emociones difíciles?' },
      ]},
    ],
    declaration: { label: 'CUANDO SIENTO ALGO DIFÍCIL', placeholder: 'Cuando siento algo difícil, elijo...' },
    canCompleteMin: 3,
  },

  8: { // RESILIENCIA
    sections: [
      { title: 'MIS CAÍDAS Y APRENDIZAJES', layout: 'col', fields: [
        { key: 'caida_0', placeholder: '¿Cuál ha sido el obstáculo más grande que has superado?', type: 'textarea' },
        { key: 'caida_1', placeholder: '¿Qué aprendiste de esa experiencia?', type: 'textarea' },
        { key: 'caida_2', placeholder: '¿Cómo te cambió como persona?', type: 'textarea' },
      ]},
      { title: 'MI MENTALIDAD ANTE LOS RETOS', layout: 'col', fields: [
        { key: 'ment_0', placeholder: '¿Cómo reaccionas normalmente cuando algo sale mal?' },
        { key: 'ment_1', placeholder: '¿Cómo quieres reaccionar?' },
        { key: 'ment_2', placeholder: '¿Qué te dice tu voz interna en esos momentos?' },
      ]},
      { title: 'MI RED DE APOYO', layout: 'col', fields: [
        { key: 'red_0', placeholder: '¿Quién es?' },
        { key: 'red_0t', placeholder: '¿Qué tipo de apoyo te da?' },
        { key: 'red_1', placeholder: '¿Quién es?' },
        { key: 'red_1t', placeholder: '¿Qué tipo de apoyo te da?' },
      ]},
    ],
    declaration: { label: 'CUANDO ENFRENTO ADVERSIDAD', placeholder: 'Cuando enfrento adversidad...' },
    canCompleteMin: 3,
  },

  9: { // EVOLUCIÓN CONSTANTE
    sections: [
      { title: 'MI APRENDIZAJE CONTINUO', layout: 'col', fields: [
        { key: 'apr_0', placeholder: '¿Qué estás aprendiendo ahora mismo?' },
        { key: 'apr_1', placeholder: '¿Qué quieres aprender este año?' },
        { key: 'apr_2', placeholder: '¿Cómo aprendes mejor?' },
      ]},
      { title: 'MI VERSIÓN FUTURA', layout: 'col', fields: [
        { key: 'fut_0', placeholder: '¿Cómo es la mejor versión de ti físicamente en 3 años?', type: 'textarea' },
        { key: 'fut_1', placeholder: '¿Cómo es mentalmente y emocionalmente?', type: 'textarea' },
        { key: 'fut_2', placeholder: '¿Cómo es profesionalmente?', type: 'textarea' },
        { key: 'fut_3', placeholder: '¿Cómo son sus relaciones?', type: 'textarea' },
      ]},
      { title: 'MI LEGADO', layout: 'col', fields: [
        { key: 'leg_0', placeholder: '¿Qué quieres haber construido al final de tu vida?' },
        { key: 'leg_1', placeholder: '¿Qué quieres que digan de ti?' },
        { key: 'leg_2', placeholder: '¿Qué le dejarías a las personas que amas?' },
      ]},
    ],
    declaration: { label: 'CARTA A MI YO FUTURO', placeholder: 'Querido yo del futuro...', special: 'carta' },
    canCompleteMin: 3,
  },
};

/* ══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                               */
/* ══════════════════════════════════════════════════════════════ */

export default function GrowthPlan({ visible }: { visible: boolean }) {
  const [activeModule, setActiveModule] = useState<number | null>(null);
  const growthCompleted = useAppStore(s => s.growthCompleted);

  if (!visible) return null;

  if (activeModule !== null) {
    return <ModuleView index={activeModule} onBack={() => setActiveModule(null)} />;
  }

  return <HSMOverview growthCompleted={growthCompleted} onSelect={setActiveModule} />;
}

/* ── Overview ─────────────────────────────────────────────────── */
function HSMOverview({ growthCompleted, onSelect }: { growthCompleted: boolean[]; onSelect: (i: number) => void }) {
  const completedCount = growthCompleted.filter(Boolean).length;
  return (
    <div className="hsm-wrap">
      <div className="hsm-hero">
        <div className="hsm-hero-badge">Plan de Crecimiento</div>
        <h2 className="hsm-hero-title">Tu proceso de transformación</h2>
        <p className="hsm-hero-sub">Diez pasos que tienes que recorrer en orden. No hay atajos — cada paso construye el siguiente.</p>
        <div className="hsm-progress-bar-wrap"><div className="hsm-progress-bar" style={{ width: `${(completedCount / 10) * 100}%` }} /></div>
        <div className="hsm-progress-label">{completedCount} / 10 completados</div>
      </div>
      <div className="hsm-steps">
        {HSM_STEPS.map((step, i) => {
          const done = growthCompleted[i];
          return (
            <div key={i} className={`hsm-step${done ? ' hsm-step-done' : ''}`} onClick={() => onSelect(i)}>
              <div className="hsm-step-num">{done ? <CheckCircle2 size={18} strokeWidth={2} /> : i + 1}</div>
              <div className="hsm-step-emoji">{step.emoji}</div>
              <div className="hsm-step-body">
                <div className="hsm-step-title">{step.title}</div>
                <div className="hsm-step-sub">{step.sub}</div>
              </div>
              <div className="hsm-step-action">
                {done ? <span className="hsm-done-chip">Completo</span> : <ArrowRight size={16} strokeWidth={1.8} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Generic Module View ──────────────────────────────────────── */
function ModuleView({ index, onBack }: { index: number; onBack: () => void }) {
  const step = HSM_STEPS[index];
  const moduleDef = MODULES[index];
  const growthData = useAppStore(s => s.growthData);
  const saveGrowthData = useAppStore(s => s.saveGrowthData);
  const completeGrowthStep = useAppStore(s => s.completeGrowthStep);
  const growthCompleted = useAppStore(s => s.growthCompleted);
  const isCompleted = growthCompleted[index];
  const [started, setStarted] = useState(isCompleted);

  const saved: Record<string, string> = (growthData[index] as Record<string, string>) ?? {};

  function handleField(key: string, val: string) {
    saveGrowthData(index, { [key]: val });
  }

  // Count filled fields
  const allKeys = moduleDef.sections.flatMap(s => s.fields.map(f => f.key));
  const filledCount = allKeys.filter(k => (saved[k] ?? '').trim().length > 0).length;
  const declarationKey = `decl_${index}`;
  const declarationVal = saved[declarationKey] ?? '';
  const canComplete = filledCount >= (moduleDef.canCompleteMin ?? 3) && declarationVal.trim().length > 0;

  function handleComplete() {
    completeGrowthStep(index);
    onBack();
  }

  // Completed summary
  if (isCompleted && !started) {
    return (
      <div className="hsm-module">
        <button className="hsm-back" onClick={onBack}><ChevronLeft size={16} /> Volver al método</button>
        <div className="gm-summary">
          <div className="gm-summary-icon">{step.emoji}</div>
          <h3 className="gm-summary-title">Módulo {step.title} completado</h3>
          {declarationVal && (
            <div className="gm-summary-decl">
              <div className="gm-summary-decl-label">{moduleDef.declaration.label}</div>
              <p>{declarationVal}</p>
            </div>
          )}
          <button className="gm-btn-review" onClick={() => setStarted(true)}>Revisar mis respuestas</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hsm-module">
      <button className="hsm-back" onClick={onBack}><ChevronLeft size={16} /> Volver al método</button>

      {/* Intro card (if not started yet and not completed) */}
      {!started && !isCompleted ? (
        <div className="gm-intro">
          <div className="gm-intro-sub">{step.sub}</div>
          <div className="gm-intro-title">{step.emoji} {step.title}</div>
          <p className="gm-intro-desc">{step.desc}</p>
          <button className="gm-intro-btn" onClick={() => setStarted(true)}>Comenzar</button>
        </div>
      ) : (
        <>
          {/* Module header */}
          <div className="hsm-module-header">
            <span className="hsm-module-emoji">{step.emoji}</span>
            <div>
              <div className="hsm-module-num">Módulo {index + 1}</div>
              <h2 className="hsm-module-title">{step.title}</h2>
            </div>
          </div>

          {/* Sections */}
          {moduleDef.sections.map((section, si) => (
            <div key={si} className="gm-section">
              <div className="gm-section-title">{section.title}</div>
              <div className="gm-section-card">
                {section.fields.map(field => (
                  <div key={field.key} className="gm-field">
                    {field.type === 'textarea' ? (
                      <textarea
                        className="gm-textarea"
                        placeholder={field.placeholder}
                        value={saved[field.key] ?? ''}
                        onChange={e => handleField(field.key, e.target.value)}
                      />
                    ) : field.type === 'date' ? (
                      <input
                        className="gm-input"
                        type="date"
                        placeholder={field.placeholder}
                        value={saved[field.key] ?? ''}
                        onChange={e => handleField(field.key, e.target.value)}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="gm-input"
                        value={saved[field.key] ?? ''}
                        onChange={e => handleField(field.key, e.target.value)}
                      >
                        <option value="">{field.placeholder}</option>
                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        className="gm-input"
                        type="text"
                        placeholder={field.placeholder}
                        value={saved[field.key] ?? ''}
                        onChange={e => handleField(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Declaration */}
          {moduleDef.declaration.special === 'carta' ? (
            <div className="gm-carta">
              <div className="gm-carta-label">{moduleDef.declaration.label}</div>
              <p className="gm-carta-desc">Esta es la declaración más importante del método. Escríbele a quien quieres ser.</p>
              <textarea
                className="gm-carta-input"
                placeholder={moduleDef.declaration.placeholder}
                value={declarationVal}
                onChange={e => handleField(declarationKey, e.target.value)}
              />
            </div>
          ) : (
            <div className="gm-declaration">
              <div className="gm-declaration-label">{moduleDef.declaration.label}</div>
              {index === 0 && <p className="gm-declaration-desc">Combinando todo lo anterior, esta es la versión de ti que puede emerger:</p>}
              <textarea
                className="gm-declaration-input"
                placeholder={moduleDef.declaration.placeholder}
                value={declarationVal}
                onChange={e => handleField(declarationKey, e.target.value)}
              />
            </div>
          )}

          {/* Complete button */}
          <button
            className={`gm-btn-complete${canComplete ? '' : ' disabled'}`}
            onClick={canComplete ? handleComplete : undefined}
          >
            Completar módulo {step.title}
          </button>
        </>
      )}
    </div>
  );
}
