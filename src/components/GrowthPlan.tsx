import { useState } from 'react';
import { ChevronLeft, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store';

/* ── Step definitions ─────────────────────────────────────────── */
const HSM_STEPS = [
  { emoji: '🧠', title: 'Identidad',            sub: 'Soy, Sé, Tengo, Puedo' },
  { emoji: '✨', title: 'Vocación',              sub: 'Qué te llama y para qué sirves' },
  { emoji: '🎯', title: 'Propósito',             sub: 'Para qué estás aquí' },
  { emoji: '📍', title: 'Metas',                 sub: 'Hacia dónde vas' },
  { emoji: '⚡', title: 'Disciplina',            sub: 'Cómo llegas ahí' },
  { emoji: '💪', title: 'Cuerpo',                sub: 'Nutrición y entrenamiento' },
  { emoji: '🌱', title: 'Entorno y Relaciones',  sub: 'Con quién y dónde estás' },
  { emoji: '🧘', title: 'Control Emocional',     sub: 'Ansiedad, impulsos, estrés' },
  { emoji: '🔥', title: 'Resiliencia',           sub: 'Cómo te levantas' },
  { emoji: '🚀', title: 'Evolución Constante',   sub: 'Nunca terminas' },
];

/* ── Main router ─────────────────────────────────────────────── */
export default function GrowthPlan({ visible }: { visible: boolean }) {
  const [activeModule, setActiveModule] = useState<number | null>(null);
  const growthCompleted = useAppStore(s => s.growthCompleted);

  if (!visible) return null;

  if (activeModule !== null) {
    return (
      <ModuleDetail
        index={activeModule}
        onBack={() => setActiveModule(null)}
      />
    );
  }

  return <HSMOverview growthCompleted={growthCompleted} onSelect={setActiveModule} />;
}

/* ── Overview: 10 locked steps ───────────────────────────────── */
function HSMOverview({
  growthCompleted,
  onSelect,
}: {
  growthCompleted: boolean[];
  onSelect: (i: number) => void;
}) {
  const completedCount = growthCompleted.filter(Boolean).length;

  return (
    <div className="hsm-wrap">
      <div className="hsm-hero">
        <div className="hsm-hero-badge">Plan de Crecimiento</div>
        <h2 className="hsm-hero-title">Tu proceso de transformación</h2>
        <p className="hsm-hero-sub">
          Diez pasos que tienes que recorrer en orden. No hay atajos — cada paso construye el siguiente.
        </p>
        <div className="hsm-progress-bar-wrap">
          <div className="hsm-progress-bar" style={{ width: `${(completedCount / 10) * 100}%` }} />
        </div>
        <div className="hsm-progress-label">{completedCount} / 10 completados</div>
      </div>

      <div className="hsm-steps">
        {HSM_STEPS.map((step, i) => {
          const done = growthCompleted[i];
          const unlocked = true;
          return (
            <div
              key={i}
              className={`hsm-step${done ? ' hsm-step-done' : ''}${!unlocked ? ' hsm-step-locked' : ''}`}
              onClick={() => unlocked && onSelect(i)}
            >
              <div className="hsm-step-num">{done ? <CheckCircle2 size={18} strokeWidth={2} /> : i + 1}</div>
              <div className="hsm-step-emoji">{step.emoji}</div>
              <div className="hsm-step-body">
                <div className="hsm-step-title">{step.title}</div>
                <div className="hsm-step-sub">{step.sub}</div>
              </div>
              <div className="hsm-step-action">
                {!unlocked ? <Lock size={16} strokeWidth={1.8} /> : done ? <span className="hsm-done-chip">Completo</span> : <ArrowRight size={16} strokeWidth={1.8} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Module detail router ─────────────────────────────────────── */
function ModuleDetail({ index, onBack }: { index: number; onBack: () => void }) {
  const step = HSM_STEPS[index];
  return (
    <div className="hsm-module">
      <button className="hsm-back" onClick={onBack}>
        <ChevronLeft size={16} /> Volver al método
      </button>
      <div className="hsm-module-header">
        <span className="hsm-module-emoji">{step.emoji}</span>
        <div>
          <div className="hsm-module-num">Módulo {index + 1}</div>
          <h2 className="hsm-module-title">{step.title}</h2>
          <p className="hsm-module-sub">{step.sub}</p>
        </div>
      </div>
      {index === 0 && <IdentidadModule onComplete={onBack} />}
      {index !== 0 && <ComingSoon />}
    </div>
  );
}

/* ── Coming soon placeholder ─────────────────────────────────── */
function ComingSoon() {
  return (
    <div className="hsm-coming">
      <div className="hsm-coming-icon">🔨</div>
      <div className="hsm-coming-title">Próximamente</div>
      <p className="hsm-coming-sub">Este módulo está siendo desarrollado. Completa Identidad primero para continuar tu proceso.</p>
    </div>
  );
}

/* ── Módulo 1: Identidad ─────────────────────────────────────── */
function IdentidadModule({ onComplete }: { onComplete: () => void }) {
  const [plantilla, setPlantilla] = useState<1 | 2>(1);
  const growthData = useAppStore(s => s.growthData);
  const saveGrowthData = useAppStore(s => s.saveGrowthData);
  const completeGrowthStep = useAppStore(s => s.completeGrowthStep);
  const growthCompleted = useAppStore(s => s.growthCompleted);
  const isCompleted = growthCompleted[0];

  const saved = growthData[0] ?? {};

  // Plantilla 1 fields
  const seFields = ['Conocimiento 1', 'Conocimiento 2', 'Habilidad 1', 'Habilidad 2', 'Experiencia clave'];
  const soyFields = ['Pasión principal', 'Sueño más grande', 'Aspiración', 'Principio central', 'Valor más importante', 'Creencia limitante', 'Mayor miedo'];
  const tengoFields = ['Título / logro', 'Activo más valioso', 'Herramienta clave', 'Contacto importante', 'Recurso disponible'];

  // Plantilla 2 fields
  const fodaFields = {
    fortalezas: 'Fortalezas',
    debilidades: 'Debilidades',
    oportunidades: 'Oportunidades',
    amenazas: 'Amenazas',
  };

  function handleField(key: string, val: string) {
    saveGrowthData(0, { [key]: val });
  }

  const canComplete = (() => {
    const filled = seFields.concat(soyFields).concat(tengoFields)
      .filter(f => (saved[`se_${f}`] || saved[`soy_${f}`] || saved[`tengo_${f}`] || '').trim().length > 0);
    const fodaFilled = Object.keys(fodaFields).filter(k => (saved[`foda_${k}`] || '').trim().length > 0);
    return filled.length >= 3 && fodaFilled.length >= 2;
  })();

  function handleComplete() {
    completeGrowthStep(0);
    onComplete();
  }

  if (isCompleted) {
    return <IdentidadSummary data={saved} onReview={() => setPlantilla(1)} />;
  }

  return (
    <div className="idn-wrap">
      {/* Plantilla tabs */}
      <div className="idn-tabs">
        <button className={`idn-tab${plantilla === 1 ? ' on' : ''}`} onClick={() => setPlantilla(1)}>
          Plantilla 1 — Análisis de Identidad
        </button>
        <button className={`idn-tab${plantilla === 2 ? ' on' : ''}`} onClick={() => setPlantilla(2)}>
          Plantilla 2 — FODA Personal
        </button>
      </div>

      {plantilla === 1 && (
        <>
          <div className="idn-intro">
            <strong>Objetivo:</strong> Descubrir tu potencial para emprender con propósito.
            <br />Llena cada bloque con ideas reales sobre ti. Mientras más profundo vayas, más claridad tendrás.
          </div>

          <div className="idn-grid3">
            {/* SÉ */}
            <div className="idn-block">
              <div className="idn-block-title">SÉ</div>
              <div className="idn-block-sub">Conocimientos · Habilidades · Experiencias · Talentos · Intereses</div>
              {seFields.map(f => (
                <input
                  key={f}
                  className="idn-input"
                  placeholder={f}
                  value={saved[`se_${f}`] ?? ''}
                  onChange={e => handleField(`se_${f}`, e.target.value)}
                />
              ))}
            </div>

            {/* SOY */}
            <div className="idn-block idn-block-center">
              <div className="idn-block-title">SOY</div>
              <div className="idn-block-sub">Pasiones · Sueños · Aspiraciones · Principios · Valores · Creencias · Miedos</div>
              {soyFields.map(f => (
                <input
                  key={f}
                  className="idn-input"
                  placeholder={f}
                  value={saved[`soy_${f}`] ?? ''}
                  onChange={e => handleField(`soy_${f}`, e.target.value)}
                />
              ))}
            </div>

            {/* TENGO */}
            <div className="idn-block">
              <div className="idn-block-title">TENGO</div>
              <div className="idn-block-sub">Títulos · Activos · Propiedades · Herramientas · Equipos · Contactos · Recursos</div>
              {tengoFields.map(f => (
                <input
                  key={f}
                  className="idn-input"
                  placeholder={f}
                  value={saved[`tengo_${f}`] ?? ''}
                  onChange={e => handleField(`tengo_${f}`, e.target.value)}
                />
              ))}
            </div>
          </div>

          {/* PUEDO */}
          <div className="idn-puedo">
            <div className="idn-puedo-title">= PUEDO</div>
            <p className="idn-puedo-desc">
              Al integrar lo que Soy, Sé y Tengo, puedo transformarme en una versión más elevada de mí. Esto implica salir de mi zona de confort, romper las barreras de una identidad fija y actuar con significado y propósito.
            </p>
            <textarea
              className="idn-puedo-input"
              placeholder="Escribe tu declaración PUEDO personal aquí..."
              value={saved['puedo'] ?? ''}
              onChange={e => handleField('puedo', e.target.value)}
            />
          </div>

          <div className="idn-nav">
            <button className="idn-btn-next" onClick={() => setPlantilla(2)}>
              Continuar a Plantilla 2 →
            </button>
          </div>
        </>
      )}

      {plantilla === 2 && (
        <>
          <div className="idn-intro">
            <strong>Objetivo:</strong> Detectar tus ventajas y riesgos para emprender con claridad.
            <br />Llena cada cuadrante con elementos reales de tu vida.
          </div>

          <div className="idn-foda-grid">
            <div className="idn-foda-block idn-foda-f">
              <div className="idn-foda-title">FORTALEZAS</div>
              <div className="idn-foda-sub">Factores internos que te dan ventaja — habilidades, actitudes, conocimientos, experiencia.</div>
              <textarea
                className="idn-foda-textarea"
                placeholder="Una por línea..."
                value={saved['foda_fortalezas'] ?? ''}
                onChange={e => handleField('foda_fortalezas', e.target.value)}
              />
            </div>
            <div className="idn-foda-block idn-foda-d">
              <div className="idn-foda-title">DEBILIDADES</div>
              <div className="idn-foda-sub">Limitaciones internas que pueden frenarte — hábitos, carencias, miedos, falta de habilidades clave.</div>
              <textarea
                className="idn-foda-textarea"
                placeholder="Una por línea..."
                value={saved['foda_debilidades'] ?? ''}
                onChange={e => handleField('foda_debilidades', e.target.value)}
              />
            </div>
            <div className="idn-foda-block idn-foda-o">
              <div className="idn-foda-title">OPORTUNIDADES</div>
              <div className="idn-foda-sub">Factores externos que puedes aprovechar — tendencias, contactos, recursos disponibles.</div>
              <textarea
                className="idn-foda-textarea"
                placeholder="Una por línea..."
                value={saved['foda_oportunidades'] ?? ''}
                onChange={e => handleField('foda_oportunidades', e.target.value)}
              />
            </div>
            <div className="idn-foda-block idn-foda-a">
              <div className="idn-foda-title">AMENAZAS</div>
              <div className="idn-foda-sub">Riesgos externos que pudieran afectar tu avance — entorno, economía, responsabilidades, inseguridad.</div>
              <textarea
                className="idn-foda-textarea"
                placeholder="Una por línea..."
                value={saved['foda_amenazas'] ?? ''}
                onChange={e => handleField('foda_amenazas', e.target.value)}
              />
            </div>
          </div>

          <div className="idn-nav">
            <button className="idn-btn-back" onClick={() => setPlantilla(1)}>← Volver a Plantilla 1</button>
            <button
              className={`idn-btn-complete${canComplete ? '' : ' disabled'}`}
              onClick={canComplete ? handleComplete : undefined}
              title={!canComplete ? 'Completa más campos para continuar' : ''}
            >
              ✓ Completar módulo Identidad
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Identidad summary (after completion) ────────────────────── */
function IdentidadSummary({ data, onReview }: { data: Record<string, string>; onReview: () => void }) {
  return (
    <div className="idn-summary">
      <div className="idn-summary-icon">✅</div>
      <h3 className="idn-summary-title">Módulo Identidad completado</h3>
      {data['puedo'] && (
        <div className="idn-summary-puedo">
          <div className="idn-summary-puedo-label">Tu declaración PUEDO</div>
          <p>{data['puedo']}</p>
        </div>
      )}
      <button className="idn-btn-back" onClick={onReview}>Revisar mis respuestas</button>
    </div>
  );
}
