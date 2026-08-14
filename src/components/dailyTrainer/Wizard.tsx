// DailyTrainer Wizard — los 3 pasos de setup (modality | physical | logistics).
//
// Extraído de DailyTrainer.tsx en el Lote DT-B. Sub-componente controlled:
// el padre mantiene phase + selecciones como state, el wizard solo renderiza
// y dispara cambios. CERO cambio de comportamiento — markup idéntico.
//
// Preservado:
// - onPhaseChange del padre (Lote 2) sigue intacto porque phase vive en el padre
// - Las selecciones (modality/time/equipment/etc.) viven en el padre para que
//   estén disponibles después de generar (regen + WorkoutPlayer)

import { Lock, Users, Check, ArrowRight } from 'lucide-react';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/es';
import type { Modality, MuscleGroup, CardioStyle, TrainingGoal } from '../../types';
import type { Gear } from '../../utils/equipmentImplement';
import {
  MODALITY_OPTIONS,
  TIME_OPTIONS,
  GEAR_ENV_OPTIONS,
  GEAR_OPTIONS,
  TRAINING_GOAL_OPTIONS,
  DISCOMFORT_OPTIONS,
  PAIN_AREAS,
  FOCUS_OPTIONS,
  MUSCLE_OPTIONS,
  CARDIO_STYLE_OPTIONS,
  LAST_TRAINED_OPTIONS,
  type WizardPhase,
  type FocusValue,
} from './constants';

interface WizardProps {
  // Step state (padre mantiene phase para preservar onPhaseChange)
  phase: WizardPhase;
  setPhase: (p: WizardPhase) => void;

  // Context derivado en el padre
  firstName: string;
  todayDayName: string;
  todayDateShort: string;
  suggestion: { modality: Modality; reasonKey: TranslationKey; reasonParams?: Record<string, string | number> };
  modalityCounts: Record<string, number>;
  skipPhysical: boolean;

  // Selecciones controladas (padre dueño del state — sobreviven al wizard)
  selectedModality: Modality;
  setSelectedModality: (m: Modality) => void;
  // Estilo de cardio (Fase 4). 'auto' = seguir el objetivo (híbrido).
  selectedCardioStyle: CardioStyle | 'auto';
  setSelectedCardioStyle: (s: CardioStyle | 'auto') => void;
  cardioCapabilities: { correr: boolean; funcional: boolean; lowImpact: boolean; explosividad: boolean };
  inferredCardioStyle: CardioStyle; // el que el objetivo recomienda (para resaltar en 'auto')
  discomfort: string;
  setDiscomfort: (v: string) => void;
  painArea: string;
  setPainArea: (v: string) => void;
  selectedTime: number;
  setSelectedTime: (t: number) => void;
  // GEAR granular (2 pasos): el usuario declara acceso + implementos. Peso corporal
  // implícito. El padre deriva TODO (allowedImplements, buckets, hasFullGym/hasWeights).
  gear: Gear[];
  setGear: (g: Gear[]) => void;
  // TRAINING GOAL (Fase 2): qué adaptación de resistencia. Solo se pregunta en resistencia.
  trainingGoal: TrainingGoal;
  setTrainingGoal: (g: TrainingGoal) => void;

  // Foco de fuerza + historia
  focus: FocusValue;
  setFocus: (f: FocusValue) => void;
  selectedMuscles: MuscleGroup[];
  setSelectedMuscles: (m: MuscleGroup[]) => void;
  selectedPriority: MuscleGroup[];
  setSelectedPriority: (m: MuscleGroup[]) => void;
  // P6 · check-in de readiness (rápido, opcional). '' = sin responder.
  energy: string;
  setEnergy: (v: string) => void;
  sleep: string;
  setSleep: (v: string) => void;
  soreness: string;
  setSoreness: (v: string) => void;
  lastTrained: string;
  setLastTrained: (v: string) => void;
  hasSystemHistory: boolean;

  // Modo pareja: compañero conectado y matcheado (solo confirmación).
  partnerMode: boolean;
  partnerName: string;

  // Acción final
  onGenerate: () => void;
}

export default function Wizard({
  phase, setPhase,
  firstName, todayDayName, todayDateShort,
  suggestion, modalityCounts, skipPhysical,
  selectedModality, setSelectedModality,
  selectedCardioStyle, setSelectedCardioStyle, inferredCardioStyle, cardioCapabilities,
  discomfort, setDiscomfort,
  painArea, setPainArea,
  selectedTime, setSelectedTime,
  gear, setGear,
  trainingGoal, setTrainingGoal,
  focus, setFocus,
  selectedMuscles, setSelectedMuscles,
  selectedPriority, setSelectedPriority,
  energy, setEnergy, sleep, setSleep, soreness, setSoreness,
  lastTrained, setLastTrained,
  hasSystemHistory,
  partnerMode, partnerName,
  onGenerate,
}: WizardProps) {
  const { t } = useT();
  // Navegación entre pasos — saltar physical cuando skipPhysical es true.
  function handleModalityNext() {
    if (skipPhysical) setPhase('logistics');
    else setPhase('physical');
  }

  function handlePhysicalNext() {
    setPhase('logistics');
  }

  // ──────────────────────────────────────────────────────
  // STEP 1 — MODALITY
  // ──────────────────────────────────────────────────────
  if (phase === 'modality') {
    return (
      <div className="wz-root">
        <div className="wz-hero">
          <div className="wz-stepper">
            <div className="wz-stepper-bar active" />
            <div className="wz-stepper-bar" />
            {!skipPhysical && <div className="wz-stepper-bar" />}
          </div>
          <p className="wz-eyebrow">{t('wizard.step1', { day: todayDayName, date: todayDateShort })}</p>
          <h1 className="wz-title">
            {firstName ? `${firstName}, ` : ''}<em>{t('wizard.modalityQ')}</em>
          </h1>
        </div>

        <div className="wz-options">
          {MODALITY_OPTIONS.map(opt => {
            const count = opt.value === 'auto' ? 999 : (modalityCounts[opt.value] || 0);
            const locked = opt.minExercises > 0 && count < opt.minExercises;
            const isSelected = selectedModality === opt.value;
            const isSuggested = suggestion.modality === opt.value;

            // Dynamic sub-label for auto
            let subLabel = opt.subKey ? t(opt.subKey) : '';
            if (opt.value === 'auto') {
              subLabel = t(suggestion.reasonKey, suggestion.reasonParams);
            }

            return (
              <button
                key={opt.value}
                className={`wz-option${isSelected ? ' selected' : ''}${locked ? ' locked' : ''}`}
                onClick={() => !locked && setSelectedModality(opt.value)}
                disabled={locked}
              >
                <div className="wz-option-thumb">
                  {locked
                    ? <Lock size={22} strokeWidth={1.5} />
                    : <opt.icon size={22} strokeWidth={1.5} />}
                </div>
                <div className="wz-option-body">
                  <div className="wz-option-label">
                    {t(opt.labelKey)}
                    {isSuggested && !locked && <span className="wz-option-badge">{t('wizard.suggested')}</span>}
                  </div>
                  <div className="wz-option-sub">{locked ? t('wizard.comingSoon') : subLabel}</div>
                </div>
                {isSelected && !locked && <div className="wz-option-check"><Check size={14} strokeWidth={2} aria-hidden="true" /></div>}
              </button>
            );
          })}
        </div>

        <button className="wz-cta" onClick={handleModalityNext}>
          {t('wizard.next')} <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
        </button>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────
  // STEP 2 — PHYSICAL CONTEXT
  // ──────────────────────────────────────────────────────
  if (phase === 'physical') {
    return (
      <div className="wz-root">
        <div className="wz-hero">
          <div className="wz-stepper">
            <div className="wz-stepper-bar done" />
            <div className="wz-stepper-bar active" />
            <div className="wz-stepper-bar" />
          </div>
          <p className="wz-eyebrow">{t('wizard.step2')}</p>
          <h1 className="wz-title">
            <em>{t('wizard.physicalQ')}</em>
          </h1>
        </div>

        {/* Historia: solo se pregunta cuando el sistema NO tiene registro propio.
            Cuando ya hay sesiones, las deriva de la data real. */}
        {!hasSystemHistory && (
          <div className="wz-q">
            <p className="wz-q-label">{t('wizard.lastTrainedQ')}</p>
            <div className="wz-chips wz-chips-col">
              {LAST_TRAINED_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`wz-chip wz-chip-block${lastTrained === opt.value ? ' on' : ''}`}
                  onClick={() => setLastTrained(opt.value)}
                >
                  <span className="wz-chip-icon"><opt.icon size={16} strokeWidth={1.5} /></span>
                  <span>{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* P6 · Check-in de readiness — "¿cómo llegas hoy?". Segundos, todo opcional
            (clic de nuevo deselecciona). Modifica SOLO la dosis de hoy, no el plan. */}
        <div className="wz-q">
          <p className="wz-q-label">{t('wizard.checkinQ')}</p>
          {([
            { label: t('wizard.ckEnergyLabel'), val: energy, set: setEnergy, opts: [['baja', t('wizard.ckEnergyLow')], ['normal', t('wizard.ckEnergyMid')], ['alta', t('wizard.ckEnergyHigh')]] },
            { label: t('wizard.ckSleepLabel'), val: sleep, set: setSleep, opts: [['malo', t('wizard.ckSleepBad')], ['normal', t('wizard.ckSleepMid')], ['bueno', t('wizard.ckSleepGood')]] },
            { label: t('wizard.ckSorenessLabel'), val: soreness, set: setSoreness, opts: [['ninguna', t('wizard.ckSorenessNone')], ['leve', t('wizard.ckSorenessMild')], ['alta', t('wizard.ckSorenessHigh')]] },
          ] as const).map(row => (
            <div key={row.label} className="wz-checkin-row">
              <span className="wz-checkin-label">{row.label}</span>
              <div className="wz-chips">
                {row.opts.map(([v, lbl]) => (
                  <button
                    key={v}
                    className={`wz-chip wz-chip-sm${row.val === v ? ' on' : ''}`}
                    onClick={() => row.set(row.val === v ? '' : v)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="wz-q">
          <p className="wz-q-label">{t('wizard.discomfortQ')}</p>
          <div className="wz-chips wz-chips-col">
            {DISCOMFORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`wz-chip wz-chip-block${discomfort === opt.value ? ' on' : ''}`}
                onClick={() => setDiscomfort(opt.value)}
              >
                <span className="wz-chip-icon"><opt.icon size={16} strokeWidth={1.5} /></span>
                <span>{t(opt.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        {discomfort === 'pain' && (
          <div className="wz-q">
            <p className="wz-q-label">{t('wizard.whereQ')}</p>
            <div className="wz-chips">
              {PAIN_AREAS.map(area => (
                <button
                  key={area.value}
                  className={`wz-chip${painArea === area.value ? ' on' : ''}`}
                  onClick={() => setPainArea(area.value)}
                >
                  {t(area.labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="wz-cta" onClick={handlePhysicalNext}>
          {t('wizard.next')} <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
        </button>

        <div className="wz-back">
          <button className="wz-back-link" onClick={() => setPhase('modality')}>{t('wizard.back')}</button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────
  // STEP 3 — LOGISTICS
  // ──────────────────────────────────────────────────────
  if (phase === 'logistics') {
    const stepNum = skipPhysical ? 2 : 3;

    return (
      <div className="wz-root">
        <div className="wz-hero">
          <div className="wz-stepper">
            <div className="wz-stepper-bar done" />
            {!skipPhysical && <div className="wz-stepper-bar done" />}
            <div className="wz-stepper-bar active" />
          </div>
          <p className="wz-eyebrow">{t('wizard.step3', { n: stepNum })}</p>
          <h1 className="wz-title">
            <em>{t('wizard.logisticsTitle')}</em>
          </h1>
        </div>

        {/* Compañero (modo pareja) — conectado y matcheado. Solo confirmación;
            su nivel/equipo reales ya vienen de su perfil. */}
        {partnerMode && (
          <div className="wz-partner-confirm">
            <Users size={16} strokeWidth={2} />
            <span>{t('wizard.partnerTrainingWith', { name: partnerName })}</span>
          </div>
        )}

        {/* Foco — solo fuerza. Auto / split preset / músculos específicos. */}
        {selectedModality === 'fuerza' && (
          <div className="wz-q">
            <p className="wz-q-label">{t('wizard.focusQ')}</p>
            <div className="wz-chips wz-chips-col">
              {FOCUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`wz-chip wz-chip-block${focus === opt.value ? ' on' : ''}`}
                  onClick={() => setFocus(opt.value)}
                >
                  <span className="wz-chip-icon"><opt.icon size={16} strokeWidth={1.5} /></span>
                  <span>{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>
            {focus === 'specific' && (
              <div className="wz-muscle-grid">
                <p className="wz-q-label wz-muscle-label">{t('wizard.focusSpecificQ')}</p>
                <div className="wz-chips">
                  {MUSCLE_OPTIONS.map(m => {
                    const on = selectedMuscles.includes(m.value);
                    return (
                      <button
                        key={m.value}
                        className={`wz-chip${on ? ' on' : ''}`}
                        onClick={() => setSelectedMuscles(on ? selectedMuscles.filter(x => x !== m.value) : [...selectedMuscles, m.value])}
                      >
                        {t(m.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* P5 · MÚSCULO PRIORITARIO (preferencia persistente, no solo hoy): sesga
                volumen, orden y selección hacia 1-2 músculos en CADA sesión. Máx 2 para
                que el sesgo no se diluya; seguridad/recuperación lo bajan solos. */}
            <div className="wz-muscle-grid">
              <p className="wz-q-label wz-muscle-label">{t('wizard.priorityQ')}</p>
              <div className="wz-chips">
                {MUSCLE_OPTIONS.map(m => {
                  const on = selectedPriority.includes(m.value);
                  const full = selectedPriority.length >= 2 && !on;
                  return (
                    <button
                      key={m.value}
                      className={`wz-chip${on ? ' on' : ''}`}
                      disabled={full}
                      onClick={() => setSelectedPriority(on ? selectedPriority.filter(x => x !== m.value) : [...selectedPriority, m.value])}
                    >
                      {t(m.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Estilo de cardio — solo modalidad cardio. Híbrido: el objetivo pre-
            selecciona uno (inferido); el usuario puede cambiarlo. */}
        {selectedModality === 'cardio' && (
          <div className="wz-q">
            <p className="wz-q-label">{t('wizard.cardioStyleQ')}</p>
            <div className="wz-chips wz-chips-col">
              {CARDIO_STYLE_OPTIONS.map(opt => {
                // 1ª defensa: solo se puede elegir una modalidad con CONTENIDO real (video) para el
                // equipo actual. Explosividad (0 videos) → siempre "Próximamente". Bajo impacto sin
                // gym → "Requiere gimnasio". La fuente es getCardioCapabilities (no hardcode local).
                const available = cardioCapabilities[opt.value];
                const active = available && (selectedCardioStyle === 'auto' ? inferredCardioStyle : selectedCardioStyle) === opt.value;
                const note = !available
                  ? (opt.value === 'lowImpact' ? t('wizard.cardioRequiresGym') : t('wizard.cardioSoon'))
                  : null;
                return (
                  <button
                    key={opt.value}
                    className={`wz-chip wz-chip-block${active ? ' on' : ''}${!available ? ' wz-chip-disabled' : ''}`}
                    disabled={!available}
                    aria-disabled={!available}
                    onClick={() => { if (available) setSelectedCardioStyle(opt.value); }}
                  >
                    <span className="wz-chip-icon"><opt.icon size={16} strokeWidth={1.5} /></span>
                    <span>{t(opt.labelKey)}</span>
                    {note && <span className="wz-chip-soon">{note}</span>}
                  </button>
                );
              })}
            </div>
            <p className="wz-q-hint">{t('wizard.cardioStyleHint')}</p>
          </div>
        )}

        <div className="wz-q">
          <p className="wz-q-label">{t('wizard.timeQ')}</p>
          <div className="wz-chips wz-chips-3">
            {TIME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`wz-chip${selectedTime === opt.value ? ' on' : ''}`}
                onClick={() => setSelectedTime(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {selectedModality !== 'yoga' && (
          <div className="wz-q">
            {/* Paso 1 · entorno (acceso). Gimnasio completo = set estándar; propio equipo
                = declara implementos abajo. */}
            <p className="wz-q-label">{t('wizard.gearEnvQ')}</p>
            <div className="wz-chips wz-chips-col">
              {GEAR_ENV_OPTIONS.map(opt => {
                const isGymEnv = gear.includes('gym');
                const on = opt.value === 'gym' ? isGymEnv : !isGymEnv;
                return (
                  <button
                    key={opt.value}
                    className={`wz-chip wz-chip-block${on ? ' on' : ''}`}
                    // gym → set canónico ['gym']; propio equipo → conserva lo ya elegido
                    // sin gym (o vacío = solo peso corporal).
                    onClick={() => setGear(opt.value === 'gym' ? ['gym'] : gear.filter(g => g !== 'gym'))}
                  >
                    <span className="wz-chip-icon"><opt.icon size={16} strokeWidth={1.5} /></span>
                    {/* CARDIO: "propio equipo" no pregunta implementos → el copy real es "sin equipo /
                        en casa" (peso corporal). Fuerza/hipertrofia conservan su wording. */}
                    <span>{opt.value === 'own' && selectedModality === 'cardio' ? t('wizard.gearEnvOwnCardio') : t(opt.labelKey)}</span>
                  </button>
                );
              })}
            </div>

            {/* Paso 2 · implementos (solo con propio equipo). Multi-select; peso corporal
                implícito (nada marcado = solo peso corporal). NO en CARDIO: mancuernas/barra/banco/
                dominadas/bandas no cambian una sesión de cardio (el banco solo distingue gym-vs-no,
                auditado) → eran botones decorativos. La distinción útil de cardio (gym → máquinas/
                kettlebell) ya la da el Paso 1. En fuerza/hipertrofia el selector se mantiene igual. */}
            {!gear.includes('gym') && selectedModality !== 'cardio' && (
              <div className="wz-subq">
                <p className="wz-q-sublabel">{t('wizard.gearOwnQ')}</p>
                <p className="wz-q-hint wz-q-hint-block">{t('wizard.gearOwnHint')}</p>
                <div className="wz-chips">
                  {GEAR_OPTIONS.map(opt => {
                    const on = gear.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        className={`wz-chip${on ? ' on' : ''}`}
                        onClick={() => setGear(on ? gear.filter(g => g !== opt.value) : [...gear, opt.value])}
                      >
                        <span className="wz-chip-icon"><opt.icon size={16} strokeWidth={1.5} /></span>
                        <span>{t(opt.labelKey)}</span>
                        {on && <Check size={13} strokeWidth={2.5} style={{ marginLeft: 'auto', flexShrink: 0 }} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRAINING GOAL (Fase 2) · solo en RESISTENCIA (fuerza o auto). NO en cardio dedicado ni
            yoga. Separado del body goal: "perder grasa" no decide esto. Default hipertrofia. */}
        {(selectedModality === 'fuerza' || selectedModality === 'auto') && (
          <div className="wz-q">
            <p className="wz-q-label">{t('wizard.trainingGoalQ')}</p>
            <div className="wz-chips wz-chips-col">
              {TRAINING_GOAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`wz-chip wz-chip-block${trainingGoal === opt.value ? ' on' : ''}`}
                  onClick={() => setTrainingGoal(opt.value)}
                >
                  <span className="wz-chip-icon"><opt.icon size={16} strokeWidth={1.5} /></span>
                  <span className="wz-chip-stack">
                    <span>{t(opt.labelKey)}</span>
                    <span className="wz-chip-sub">{t(opt.subKey)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="wz-cta" onClick={onGenerate}>
          {t('wizard.generatePre')} <em>{t('wizard.routine')}</em> <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
        </button>

        <div className="wz-back">
          <button className="wz-back-link" onClick={() => setPhase(skipPhysical ? 'modality' : 'physical')}>{t('wizard.back')}</button>
        </div>
      </div>
    );
  }

  return null;
}
