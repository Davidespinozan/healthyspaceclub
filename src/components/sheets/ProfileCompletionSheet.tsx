// ─────────────────────────────────────────────────────────────────────────────
// A10 · ProfileCompletionSheet — completar el perfil de Nutrition sin rehacer el
// onboarding.
//
// Las preguntas NO están listadas aquí: las decide `nutritionCompletionSteps`
// sobre el borrador (perfil guardado + respuestas), es decir, la cadena real de
// Nutrition. Se muestra la primera pendiente; al responderla, la lista se
// recalcula. Cuando no queda ninguna, un solo guardado y la acción central
// (`recalcFromObData`) hace el resto. Aquí no se calcula ninguna kcal ni macro.
//
// El copy de cada pregunta es el del onboarding (mismas claves de i18n) y los
// valores permitidos vienen de `trainingProfileOptions`/`trainingModality`.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/es';
import {
  answerTrainsHabitually, nutritionCompletionSteps, withAnswers,
  type CompletionAnswers, type CompletionStep,
} from '../../utils/profileCompletion';
import {
  DAILY_LIFE_COPY, DAILY_LIFE_LEVELS, TRAINING_DAY_OPTIONS, TRAINING_MINUTE_CHIPS,
  isValidTrainingMinutes,
} from '../../utils/trainingProfileOptions';
import {
  TRAINING_MODALITIES, TRAINING_MODALITIES_KEY, serializeTrainingModalities, type TrainingModality,
} from '../../utils/trainingModality';
import SheetOption from './SheetOption';
import './sheet-base.css';

interface Props {
  onClose: () => void;
  /** Datos base ausentes (sexo, edad…): se completan en la hoja «Editar mis datos». */
  onOpenEditData?: () => void;
}

const QUESTION_KEY: Record<Exclude<CompletionStep, 'core'>, TranslationKey> = {
  pregnantOrLactating: 'onboarding.embarazoQuestion',
  requiresTherapeuticDiet: 'onboarding.therapeuticDietQuestion',
  dailyLife: 'onboarding.dailyLifeQuestion',
  trainsHabitually: 'onboarding.trainsQuestion',
  trainingDaysPerWeek: 'onboarding.trainingDaysQuestion',
  trainingSessionMinutes: 'onboarding.trainingMinutesQuestion',
  trainingModalities: 'onboarding.modalityQuestion',
};
const HINT_KEY: Partial<Record<CompletionStep, TranslationKey>> = {
  requiresTherapeuticDiet: 'onboarding.therapeuticDietHint',
  dailyLife: 'onboarding.dailyLifeHint',
  trainsHabitually: 'onboarding.trainsHint',
  trainingSessionMinutes: 'onboarding.trainingMinutesHint',
  trainingModalities: 'onboarding.modalityHint',
};

export default function ProfileCompletionSheet({ onClose, onOpenEditData }: Props) {
  const { t } = useT();
  const { obData, setObData, recalcFromObData } = useAppStore(useShallow((s) => ({
    obData: s.obData, setObData: s.setObData, recalcFromObData: s.recalcFromObData,
  })));

  // Historial de respuestas: cada paso añade una entrada, «Atrás» la quita.
  const [history, setHistory] = useState<CompletionAnswers[]>([]);
  const answers: CompletionAnswers = Object.assign({}, ...history);
  const steps = nutritionCompletionSteps(withAnswers(obData, answers));
  const step = steps[0] ?? null;

  // Entrada local del paso actual (minutos y modalidades necesitan confirmar).
  const [minutes, setMinutes] = useState('');
  const [modalities, setModalities] = useState<TrainingModality[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setMinutes(''); setModalities([]); }, [step]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const answer = (a: CompletionAnswers) => { setError(''); setHistory((h) => [...h, a]); };
  const back = () => setHistory((h) => h.slice(0, -1));

  async function save() {
    setSaving(true);
    setError('');
    try {
      for (const [k, v] of Object.entries(answers)) if (v !== undefined) setObData(k, v);
      await recalcFromObData('profile-completion');
      onClose();
    } catch (e) {
      console.error('[ProfileCompletionSheet] save failed:', e);
      setError(t('profileCompletion.error'));
      setSaving(false);
    }
  }

  const yesNo = (onYes: () => void, onNo: () => void) => (
    <div className="sh-chips">
      <button type="button" className="sh-chip" onClick={onNo}>{t('editData.optNo')}</button>
      <button type="button" className="sh-chip" onClick={onYes}>{t('editData.optYes')}</button>
    </div>
  );

  function renderStep(s: CompletionStep) {
    switch (s) {
      case 'core':
        return (
          <>
            <p className="sh-field-hint">{t('profileCompletion.coreMissing')}</p>
            {onOpenEditData && (
              <button type="button" className="sh-cta sh-cta--secondary" onClick={onOpenEditData}>
                {t('profileCompletion.coreCta')}
              </button>
            )}
          </>
        );
      case 'pregnantOrLactating':
        return yesNo(() => answer({ embarazo: 1 }), () => answer({ embarazo: 0 }));
      case 'requiresTherapeuticDiet':
        return yesNo(() => answer({ requiresTherapeuticDiet: 1 }), () => answer({ requiresTherapeuticDiet: 0 }));
      case 'trainsHabitually':
        return yesNo(() => answer(answerTrainsHabitually(true)), () => answer(answerTrainsHabitually(false)));
      case 'dailyLife':
        return (
          // Preview QA · título + descripción VISIBLES (sin hover), a ancho completo.
          <div className="sh-options">
            {DAILY_LIFE_LEVELS.map((id) => (
              <SheetOption key={id}
                title={t(DAILY_LIFE_COPY[id].titleKey)}
                description={t(DAILY_LIFE_COPY[id].descKey)}
                onClick={() => answer({ dailyLife: id })} />
            ))}
          </div>
        );
      case 'trainingDaysPerWeek':
        return (
          <div className="sh-chips">
            {TRAINING_DAY_OPTIONS.map((d) => (
              <button key={d} type="button" className="sh-chip" onClick={() => answer({ trainingDaysPerWeek: d })}>{d}</button>
            ))}
          </div>
        );
      case 'trainingSessionMinutes': {
        const n = Number(minutes);
        return (
          <>
            <div className="sh-chips">
              {TRAINING_MINUTE_CHIPS.map((m) => (
                <button key={m} type="button" className="sh-chip" onClick={() => answer({ trainingSessionMinutes: m })}>{m}</button>
              ))}
            </div>
            <label className="sh-field" style={{ marginTop: 12 }}>
              <span className="sh-field-label">{t('onboarding.trainingMinutesCustomLabel')}</span>
              <input className="sh-input" type="text" inputMode="numeric" maxLength={3} value={minutes}
                onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ''))} />
            </label>
            <button type="button" className="sh-cta" disabled={!isValidTrainingMinutes(n)}
              onClick={() => answer({ trainingSessionMinutes: n })}>
              {t('profileCompletion.next')}
            </button>
          </>
        );
      }
      case 'trainingModalities':
        return (
          <>
            <div className="sh-options">
              {TRAINING_MODALITIES.map((m) => (
                <SheetOption key={m}
                  title={t(`onboarding.modality_${m}` as TranslationKey)}
                  description={t(`onboarding.modality_${m}Desc` as TranslationKey)}
                  pressed={modalities.includes(m)}
                  onClick={() => setModalities((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))} />
              ))}
            </div>
            <button type="button" className="sh-cta" disabled={modalities.length === 0}
              onClick={() => answer({ [TRAINING_MODALITIES_KEY]: serializeTrainingModalities(modalities) })}>
              {t('profileCompletion.next')}
            </button>
          </>
        );
    }
  }

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet" role="dialog" aria-label={t('profileCompletion.title')} onClick={(e) => e.stopPropagation()}>
        <div className="sh-handle" />
        <div className="sh-header-row">
          <h1 className="sh-title">{t('profileCompletion.title')}</h1>
          <button className="sh-close" onClick={onClose} aria-label={t('common.close')} type="button">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <p className="sh-intro">{t('profileCompletion.body')}</p>

        <div className="sh-form">
          {step ? (
            <div className="sh-field" data-step={step}>
              <span className="sh-eyebrow">{t('profileCompletion.stepOf', { n: history.length + 1 })}</span>
              {step !== 'core' && <span className="sh-field-label">{t(QUESTION_KEY[step])}</span>}
              {HINT_KEY[step] && <p className="sh-field-hint">{t(HINT_KEY[step]!)}</p>}
              {renderStep(step)}
            </div>
          ) : (
            <>
              <p className="sh-p">{t('profileCompletion.done')}</p>
              <button type="button" className="sh-cta" onClick={save} disabled={saving}>
                {saving ? t('profileCompletion.saving') : t('profileCompletion.save')}
              </button>
            </>
          )}
          {history.length > 0 && !saving && (
            <button type="button" className="sh-cta sh-cta--secondary" onClick={back}>{t('common.back')}</button>
          )}
          {error && <p className="sh-error">{error}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
