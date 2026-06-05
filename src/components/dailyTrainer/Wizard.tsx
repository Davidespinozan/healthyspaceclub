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

import { Lock } from 'lucide-react';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/es';
import type { Modality, Equipment, MuscleGroup } from '../../types';
import {
  MODALITY_OPTIONS,
  TIME_OPTIONS,
  EQUIPMENT_OPTIONS,
  DISCOMFORT_OPTIONS,
  PAIN_AREAS,
  FOCUS_OPTIONS,
  MUSCLE_OPTIONS,
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
  discomfort: string;
  setDiscomfort: (v: string) => void;
  painArea: string;
  setPainArea: (v: string) => void;
  selectedTime: number;
  setSelectedTime: (t: number) => void;
  selectedEquipment: Equipment;
  setSelectedEquipment: (e: Equipment) => void;

  // Foco de fuerza + historia
  focus: FocusValue;
  setFocus: (f: FocusValue) => void;
  selectedMuscles: MuscleGroup[];
  setSelectedMuscles: (m: MuscleGroup[]) => void;
  lastTrained: string;
  setLastTrained: (v: string) => void;
  hasSystemHistory: boolean;

  // Acción final
  onGenerate: () => void;
}

export default function Wizard({
  phase, setPhase,
  firstName, todayDayName, todayDateShort,
  suggestion, modalityCounts, skipPhysical,
  selectedModality, setSelectedModality,
  discomfort, setDiscomfort,
  painArea, setPainArea,
  selectedTime, setSelectedTime,
  selectedEquipment, setSelectedEquipment,
  focus, setFocus,
  selectedMuscles, setSelectedMuscles,
  lastTrained, setLastTrained,
  hasSystemHistory,
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
                {isSelected && !locked && <div className="wz-option-check">✓</div>}
              </button>
            );
          })}
        </div>

        <button className="wz-cta" onClick={handleModalityNext}>
          {t('wizard.next')}
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
          {t('wizard.next')}
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
            <p className="wz-q-label">{t('wizard.equipmentQ')}</p>
            <div className="wz-chips wz-chips-col">
              {EQUIPMENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`wz-chip wz-chip-block${selectedEquipment === opt.value ? ' on' : ''}`}
                  onClick={() => setSelectedEquipment(opt.value)}
                >
                  <span className="wz-chip-icon"><opt.icon size={16} strokeWidth={1.5} /></span>
                  <span>{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="wz-cta" onClick={onGenerate}>
          {t('wizard.generatePre')} <em>{t('wizard.routine')}</em> →
        </button>

        <div className="wz-back">
          <button className="wz-back-link" onClick={() => setPhase(skipPhysical ? 'modality' : 'physical')}>{t('wizard.back')}</button>
        </div>
      </div>
    );
  }

  return null;
}
