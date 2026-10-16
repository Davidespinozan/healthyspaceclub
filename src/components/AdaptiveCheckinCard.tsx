// ADAPTIVE NUTRITION · entrada del socio real dentro de Nutrición.
//
// Solo PRESENTA y RECOGE lo que la persona declara. Todo lo demás lo deciden autoridades existentes:
//   · qué mostrar (iniciar / check-in / esperar / falta fuerza) → `adaptiveEntryState` (puro), que usa
//     el calendario y la regla de fuerza del planificador del SERVIDOR y el Snapshot V2 del store;
//   · el envío → `callNutritionCheckin` (Edge `nutrition-checkin`), que decide y persiste;
//   · el resultado → la decisión del servidor, solo traducida (`adaptiveResultFrom`).
// El cliente nunca calcula ni envía base, paso, kcal ni decisión, y nunca muestra términos técnicos.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/es';
import { dayKey } from '../utils/localDate';
import { callNutritionCheckin } from '../utils/nutritionCheckinClient';
import { adaptiveEntryState, adaptiveResultFrom, type AdaptiveResult } from '../utils/adaptiveEntry';
import {
  ADHERENCE_ANSWERS, ADHERENCE_ANSWER_COPY_RANGE_PCT, NUTRITION_HUNGER_VALUES, NUTRITION_ENERGY_VALUES,
  NUTRITION_PERFORMANCE_VALUES, STRENGTH_EXPERIENCE_VALUES,
} from '../utils/nutritionCheckin';
import './sheets/sheet-base.css';
import './adaptive-checkin.css';

interface Props { onEditData: () => void }
type Sheet = null | 'start' | 'checkin';

export default function AdaptiveCheckinCard({ onEditData }: Props) {
  const { t, locale } = useT();
  const { energyStatus, obData, adaptive, snapshot, applyServerNutritionWeight, loadAdaptiveCalibration } = useAppStore(useShallow((s) => ({
    energyStatus: s.energyState?.status ?? null, obData: s.obData, adaptive: s.adaptiveCalibration, snapshot: s.nutritionSnapshot,
    applyServerNutritionWeight: s.applyServerNutritionWeight, loadAdaptiveCalibration: s.loadAdaptiveCalibration,
  })));
  const today = dayKey(new Date());
  const state = useMemo(() => adaptiveEntryState({ energyPrescribed: energyStatus === 'PRESCRIBED', obData, adaptive, snapshot, today }),
    [energyStatus, obData, adaptive, snapshot, today]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [result, setResult] = useState<AdaptiveResult | null>(null);

  const fmt = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const resultText = (r: AdaptiveResult): string | null => {
    switch (r.kind) {
      case 'STARTED': return t('adaptive.resultStarted');
      case 'KEEP': return t('adaptive.resultKeep');
      case 'ADJUST': return r.effectiveFrom && r.effectiveFrom !== today ? t('adaptive.resultAdjust', { date: fmt(r.effectiveFrom) }) : t('adaptive.resultAdjustToday');
      case 'REVIEW': return t('adaptive.resultReview');
      case 'NOT_DUE': return t('adaptive.resultNotDue');
      case 'NOT_ELIGIBLE': return t('adaptive.resultNotEligible');
      case 'INVALID_INPUT': return t('adaptive.resultInvalid');
      case 'ERROR': return t('adaptive.resultError');
      case 'STRENGTH_REQUIRED': return null;   // se muestra como su propia tarjeta
    }
  };
  const strengthCard = (
    <div className="ad-card" role="status" data-adaptive="strength-required">
      <p className="ad-title">{t('adaptive.strengthTitle')}</p>
      <p className="ad-body">{t('adaptive.strengthBody')}</p>
      <button type="button" className="ad-cta" onClick={onEditData}>{t('adaptive.strengthCta')}</button>
    </div>
  );

  if (state.kind === 'HIDDEN' && !result) return null;
  const banner = result && resultText(result);

  return (
    <div className="ad-wrap" data-adaptive-state={state.kind}>
      {banner && <p className="ad-result" role="status" data-adaptive-result={result!.kind}>{banner}</p>}
      {(state.kind === 'STRENGTH_REQUIRED' || result?.kind === 'STRENGTH_REQUIRED') && strengthCard}
      {state.kind === 'CAN_START' && result?.kind !== 'STRENGTH_REQUIRED' && (
        <div className="ad-card" data-adaptive="start">
          <p className="ad-title">{t('adaptive.startTitle')}</p>
          <p className="ad-body">{t('adaptive.startBody')}</p>
          <button type="button" className="ad-cta" onClick={() => { setResult(null); setSheet('start'); }}>{t('adaptive.startCta')}</button>
        </div>
      )}
      {state.kind === 'CHECKIN_DUE' && (
        <div className="ad-card" data-adaptive="due">
          <p className="ad-title">{t('adaptive.dueTitle')}</p>
          <p className="ad-body">{t('adaptive.dueBody')}</p>
          {state.pendingFrom && <p className="ad-note">{t('adaptive.pendingAdjust', { date: fmt(state.pendingFrom) })}</p>}
          <button type="button" className="ad-cta" onClick={() => { setResult(null); setSheet('checkin'); }}>{t('adaptive.dueCta')}</button>
        </div>
      )}
      {state.kind === 'WAITING' && (
        <div className="ad-card ad-card--quiet" data-adaptive="waiting">
          <p className="ad-title">{t('adaptive.waitingTitle')}</p>
          {state.pendingFrom && result?.kind !== 'ADJUST' && <p className="ad-note">{t('adaptive.pendingAdjust', { date: fmt(state.pendingFrom) })}</p>}
          <p className="ad-body">{state.nextCheckinFrom ? t('adaptive.waitingNext', { date: fmt(state.nextCheckinFrom) }) : t('adaptive.waitingNextUnknown')}</p>
        </div>
      )}
      {sheet && (
        <AdaptiveSheet
          mode={sheet}
          needsWaist={state.kind === 'CAN_START' || state.kind === 'CHECKIN_DUE' ? state.needsWaist : false}
          needsExperience={state.kind === 'CHECKIN_DUE' ? state.needsExperience : false}
          onClose={() => setSheet(null)}
          onDone={(r) => { setResult(r); setSheet(null); }}
          submit={(action, declared) => callNutritionCheckin(action, declared, applyServerNutritionWeight, loadAdaptiveCalibration)}
        />
      )}
    </div>
  );
}

// ── Hoja de inicio / check-in ───────────────────────────────────────────────
interface SheetProps {
  mode: 'start' | 'checkin';
  needsWaist: boolean;
  needsExperience: boolean;
  onClose: () => void;
  onDone: (r: AdaptiveResult) => void;
  submit: (action: 'start' | 'checkin', declared: Record<string, unknown>) => ReturnType<typeof callNutritionCheckin>;
}

function AdaptiveSheet({ mode, needsWaist, needsExperience, onClose, onDone, submit }: SheetProps) {
  const { t } = useT();
  // Un requestId por hoja: reintentar dentro de la misma hoja es idempotente en el servidor.
  const [requestId] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [adherence, setAdherence] = useState<string | null>(null);
  const [hunger, setHunger] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [performance, setPerformance] = useState<string | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const range = (a: (typeof ADHERENCE_ANSWERS)[number]) => {
    const r = ADHERENCE_ANSWER_COPY_RANGE_PCT[a];
    return r.max == null ? t('adaptive.rangeAtLeast', { min: r.min }) : r.min === 0 ? t('adaptive.rangeUnder', { n: r.max + 1 }) : t('adaptive.rangeBetween', { min: r.min, max: r.max });
  };
  const chips = (values: readonly string[], prefix: string, value: string | null, set: (v: string) => void, label?: (v: string) => string) => (
    <div className="sh-chips">
      {values.map((v) => (
        <button key={v} type="button" className="sh-chip" aria-pressed={value === v} data-value={v} onClick={() => set(v)}>
          {t(`adaptive.${prefix}_${v}` as TranslationKey)}{label ? <>{' '}<span className="ad-chip-sub">· {label(v)}</span></> : null}
        </button>
      ))}
    </div>
  );

  async function send() {
    setError('');
    const w = Number(weight.replace(',', '.'));
    const wc = Number(waist.replace(',', '.'));
    const complete = w > 0 && (!needsWaist || wc > 0)
      && (mode === 'start' || (adherence && hunger && energy && performance && (!needsExperience || experience)));
    if (!complete) { setError(t('adaptive.incomplete')); return; }
    const localDate = dayKey(new Date());
    // SOLO lo que la persona declara (lista blanca de la Edge). Nada de base, paso, kcal ni decisión.
    const declared: Record<string, unknown> = { requestId, localDate, weightKg: w };
    if (needsWaist) declared.waistCm = wc;
    if (mode === 'checkin') {
      Object.assign(declared, { adherenceAnswer: adherence, hunger, energy, performance });
      if (needsExperience) declared.strengthExperience = experience;
    }
    setBusy(true);
    try {
      const res = await submit(mode, declared);
      onDone(adaptiveResultFrom(res.body, localDate));
    } catch {
      onDone({ kind: 'ERROR' });
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet" onClick={(e) => e.stopPropagation()} data-adaptive-sheet={mode}>
        <div className="sh-handle" />
        <div className="sh-header-row">
          <h1 className="sh-title">{t(mode === 'start' ? 'adaptive.startSheetTitle' : 'adaptive.checkinSheetTitle')}</h1>
          <button className="sh-close" onClick={onClose} aria-label={t('common.close')} type="button"><X size={18} strokeWidth={2} /></button>
        </div>
        <p className="sh-intro">{t(mode === 'start' ? 'adaptive.startSheetIntro' : 'adaptive.checkinIntro')}</p>
        <div className="sh-form">
          <label className="sh-field">
            <span className="sh-field-label">{t('adaptive.weightLabel')}</span>
            <input className="sh-input" inputMode="decimal" name="weightKg" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          {needsWaist && (
            <label className="sh-field">
              <span className="sh-field-label">{t('adaptive.waistLabel')}</span>
              <input className="sh-input" inputMode="decimal" name="waistCm" value={waist} onChange={(e) => setWaist(e.target.value)} />
            </label>
          )}
          {mode === 'checkin' && (
            <>
              <div className="sh-field"><span className="sh-field-label">{t('adaptive.adherenceQ')}</span>
                {chips(ADHERENCE_ANSWERS, 'adherence', adherence, setAdherence, (v) => range(v as (typeof ADHERENCE_ANSWERS)[number]))}</div>
              <div className="sh-field"><span className="sh-field-label">{t('adaptive.hungerQ')}</span>{chips(NUTRITION_HUNGER_VALUES, 'hunger', hunger, setHunger)}</div>
              <div className="sh-field"><span className="sh-field-label">{t('adaptive.energyQ')}</span>{chips(NUTRITION_ENERGY_VALUES, 'energy', energy, setEnergy)}</div>
              <div className="sh-field"><span className="sh-field-label">{t('adaptive.performanceQ')}</span>{chips(NUTRITION_PERFORMANCE_VALUES, 'performance', performance, setPerformance)}</div>
              {needsExperience && (
                <div className="sh-field"><span className="sh-field-label">{t('adaptive.experienceQ')}</span>{chips(STRENGTH_EXPERIENCE_VALUES, 'experience', experience, setExperience)}</div>
              )}
            </>
          )}
        </div>
        {error && <p className="sh-error">{error}</p>}
        <button type="button" className="sh-cta" disabled={busy} onClick={() => void send()}>
          {busy ? t('adaptive.sending') : t(mode === 'start' ? 'adaptive.startSubmit' : 'adaptive.checkinSubmit')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
