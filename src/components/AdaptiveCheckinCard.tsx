// ADAPTIVE NUTRITION · entrada del socio real dentro de Nutrición.
//
// Solo PRESENTA y RECOGE lo que la persona declara. Todo lo demás lo deciden autoridades existentes:
//   · qué mostrar (activando / check-in / esperar / qué falta) → `adaptiveEntryState` (puro), que usa
//     CAPA 1, el planificador y el calendario del SERVIDOR y el Snapshot V2 del store;
//   · el inicio → AUTOMÁTICO con el peso del perfil (`adaptiveAutoStart`, montado en App); aquí solo
//     se muestra su estado. Excepción: recomposición necesita la cintura de partida;
//   · el check-in → `callNutritionCheckin` (Edge `nutrition-checkin`), que decide y persiste;
//   · el resultado → la decisión del servidor, solo traducida (`adaptiveResultFrom`).
// El cliente nunca calcula ni envía base, paso, kcal ni decisión, y nunca muestra términos técnicos.
// El peso SOLO se pide dentro del check-in.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/es';
import { dayKey } from '../utils/localDate';
import { callNutritionCheckin } from '../utils/nutritionCheckinClient';
import {
  adaptiveEntryState, adaptiveResultFrom, isPlausibleWeightKg, isPlausibleWaistCm, WEIGHT_KG_RANGE, WAIST_CM_RANGE,
  type AdaptiveBlockReason, type AdaptiveResult,
} from '../utils/adaptiveEntry';
import { retryAdaptiveAutoStart, useAdaptiveAutoStartStatus } from '../utils/adaptiveAutoStart';
import {
  ADHERENCE_ANSWERS, ADHERENCE_ANSWER_COPY_RANGE_PCT, NUTRITION_HUNGER_VALUES, NUTRITION_ENERGY_VALUES,
  NUTRITION_PERFORMANCE_VALUES, STRENGTH_EXPERIENCE_VALUES,
} from '../utils/nutritionCheckin';
import './sheets/sheet-base.css';
import './adaptive-checkin.css';

interface Props { onEditData: () => void }

const BLOCK_COPY: Record<AdaptiveBlockReason, { title: TranslationKey; body: TranslationKey }> = {
  STRENGTH_REQUIRED: { title: 'adaptive.strengthTitle', body: 'adaptive.strengthBody' },
  UNDERWEIGHT: { title: 'adaptive.underweightTitle', body: 'adaptive.underweightBody' },
  FAT_LOSS_FLOOR: { title: 'adaptive.floorTitle', body: 'adaptive.floorBody' },
  PROFILE_INCOMPLETE: { title: 'adaptive.profileTitle', body: 'adaptive.profileBody' },
  NOT_ELIGIBLE: { title: 'adaptive.notEligibleTitle', body: 'adaptive.notEligibleBody' },
};
const parseNum = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

export default function AdaptiveCheckinCard({ onEditData }: Props) {
  const { t, locale } = useT();
  const { energyStatus, obData, adaptive, snapshot, applyServerNutritionWeight, loadAdaptiveCalibration } = useAppStore(useShallow((s) => ({
    energyStatus: s.energyState?.status ?? null, obData: s.obData, adaptive: s.adaptiveCalibration, snapshot: s.nutritionSnapshot,
    applyServerNutritionWeight: s.applyServerNutritionWeight, loadAdaptiveCalibration: s.loadAdaptiveCalibration,
  })));
  const autoStart = useAdaptiveAutoStartStatus();
  const today = dayKey(new Date());
  const state = useMemo(() => adaptiveEntryState({ energyStatus, obData, adaptive, snapshot, today }),
    [energyStatus, obData, adaptive, snapshot, today]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [result, setResult] = useState<AdaptiveResult | null>(null);
  const submit = (action: 'start' | 'checkin', declared: Record<string, unknown>) =>
    callNutritionCheckin(action, declared, applyServerNutritionWeight, loadAdaptiveCalibration);

  const fmt = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const resultText = (r: AdaptiveResult): string | null => {
    switch (r.kind) {
      case 'STARTED': return t('adaptive.resultStarted');
      case 'KEEP': return t('adaptive.resultKeep');
      case 'ADJUST': return r.effectiveFrom && r.effectiveFrom !== today ? t('adaptive.resultAdjust', { date: fmt(r.effectiveFrom) }) : t('adaptive.resultAdjustToday');
      case 'REVIEW': return t('adaptive.resultReview');
      case 'UNDERWEIGHT': return t('adaptive.resultUnderweight');
      case 'NOT_DUE': return t('adaptive.resultNotDue');
      case 'NOT_ELIGIBLE': return t('adaptive.resultNotEligible');
      case 'INVALID_INPUT': return t('adaptive.resultInvalid');
      case 'ERROR': return t('adaptive.resultError');
      case 'STRENGTH_REQUIRED': return null;   // se muestra como su propia tarjeta
    }
  };
  const blockedCard = (reason: AdaptiveBlockReason) => (
    <div className="ad-card" role="status" data-adaptive={`blocked-${reason}`}>
      <p className="ad-title">{t(BLOCK_COPY[reason].title)}</p>
      <p className="ad-body">{t(BLOCK_COPY[reason].body)}</p>
      <button type="button" className="ad-cta" onClick={onEditData}>{t('adaptive.editDataCta')}</button>
    </div>
  );

  if (state.kind === 'HIDDEN' && !result) return null;
  const banner = result && resultText(result);
  // Tras un check-in con peso bajo, el resultado ya explica la causa: no se repite la tarjeta de pausa.
  const hideBlocked = state.kind === 'BLOCKED' && state.reason === 'UNDERWEIGHT' && result?.kind === 'UNDERWEIGHT';

  return (
    <div className="ad-wrap" data-adaptive-state={state.kind}>
      {banner && <p className="ad-result" role="status" data-adaptive-result={result!.kind}>{banner}</p>}
      {result?.kind === 'STRENGTH_REQUIRED' && state.kind !== 'BLOCKED' && blockedCard('STRENGTH_REQUIRED')}
      {state.kind === 'BLOCKED' && !hideBlocked && blockedCard(state.reason)}
      {state.kind === 'STARTING' && (
        autoStart === 'FAILED' ? (
          <div className="ad-card" role="status" data-adaptive="start-failed">
            <p className="ad-body">{t('adaptive.startFailed')}</p>
            <button type="button" className="ad-cta" onClick={() => void retryAdaptiveAutoStart()}>{t('adaptive.retryCta')}</button>
          </div>
        ) : (
          <div className="ad-card ad-card--quiet" role="status" data-adaptive="starting">
            <p className="ad-title">{t('adaptive.startingTitle')}</p>
            <p className="ad-body">{t('adaptive.startingBody')}</p>
          </div>
        )
      )}
      {state.kind === 'NEEDS_WAIST' && (
        <WaistStartCard weightKg={(obData as Record<string, unknown>).peso as number} today={today} submit={submit} onDone={setResult} />
      )}
      {state.kind === 'CHECKIN_DUE' && (
        <div className="ad-card" data-adaptive="due">
          <p className="ad-title">{t('adaptive.dueTitle')}</p>
          <p className="ad-body">{t('adaptive.dueBody')}</p>
          {state.pendingFrom && <p className="ad-note">{t('adaptive.pendingAdjust', { date: fmt(state.pendingFrom) })}</p>}
          <button type="button" className="ad-cta" onClick={() => { setResult(null); setSheetOpen(true); }}>{t('adaptive.dueCta')}</button>
        </div>
      )}
      {state.kind === 'WAITING' && (
        <div className="ad-card ad-card--quiet" data-adaptive="waiting">
          <p className="ad-title">{t('adaptive.waitingTitle')}</p>
          {state.pendingFrom && result?.kind !== 'ADJUST' && <p className="ad-note">{t('adaptive.pendingAdjust', { date: fmt(state.pendingFrom) })}</p>}
          <p className="ad-body">{state.nextCheckinFrom ? t('adaptive.waitingNext', { date: fmt(state.nextCheckinFrom) }) : t('adaptive.waitingNextUnknown')}</p>
        </div>
      )}
      {sheetOpen && state.kind === 'CHECKIN_DUE' && (
        <CheckinSheet
          needsWaist={state.needsWaist}
          needsExperience={state.needsExperience}
          onClose={() => setSheetOpen(false)}
          onDone={(r) => { setResult(r); setSheetOpen(false); }}
          submit={submit}
        />
      )}
    </div>
  );
}

type Submit = (action: 'start' | 'checkin', declared: Record<string, unknown>) => ReturnType<typeof callNutritionCheckin>;
const newRequestId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

// ── Recomposición: la línea base exige cintura (contrato MB2); el peso sale del perfil ──
function WaistStartCard({ weightKg, today, submit, onDone }: { weightKg: number; today: string; submit: Submit; onDone: (r: AdaptiveResult) => void }) {
  const { t } = useT();
  const [requestId] = useState(newRequestId);
  const [waist, setWaist] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    const wc = parseNum(waist);
    if (!isPlausibleWaistCm(wc)) { setError(t('adaptive.invalidWaist', WAIST_CM_RANGE)); return; }
    setError('');
    setBusy(true);
    try {
      const res = await submit('start', { requestId, localDate: today, weightKg, waistCm: wc });
      onDone(adaptiveResultFrom(res.body, today));
    } catch {
      onDone({ kind: 'ERROR' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ad-card" data-adaptive="needs-waist">
      <p className="ad-title">{t('adaptive.waistTitle')}</p>
      <p className="ad-body">{t('adaptive.waistBody')}</p>
      <label className="ad-field">
        <span className="ad-field-label">{t('adaptive.waistLabel')}</span>
        <input className="sh-input" inputMode="decimal" name="waistCm" value={waist} onChange={(e) => setWaist(e.target.value)} />
      </label>
      {error && <p className="sh-error">{error}</p>}
      <button type="button" className="ad-cta" disabled={busy} onClick={() => void send()}>{busy ? t('adaptive.sending') : t('adaptive.waistSubmit')}</button>
    </div>
  );
}

// ── Hoja de check-in (única interacción que pide peso) ─────────────────────
interface SheetProps {
  needsWaist: boolean;
  needsExperience: boolean;
  onClose: () => void;
  onDone: (r: AdaptiveResult) => void;
  submit: Submit;
}

function CheckinSheet({ needsWaist, needsExperience, onClose, onDone, submit }: SheetProps) {
  const { t } = useT();
  // Un requestId por hoja: reintentar dentro de la misma hoja es idempotente en el servidor.
  const [requestId] = useState(newRequestId);
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
    const w = parseNum(weight);
    const wc = parseNum(waist);
    if (weight.trim() === '' || (needsWaist && waist.trim() === '') || !adherence || !hunger || !energy || !performance || (needsExperience && !experience)) {
      setError(t('adaptive.incomplete')); return;
    }
    if (!isPlausibleWeightKg(w)) { setError(t('adaptive.invalidWeight', WEIGHT_KG_RANGE)); return; }
    if (needsWaist && !isPlausibleWaistCm(wc)) { setError(t('adaptive.invalidWaist', WAIST_CM_RANGE)); return; }
    setError('');
    const localDate = dayKey(new Date());
    // SOLO lo que la persona declara (lista blanca de la Edge). Nada de base, paso, kcal ni decisión.
    const declared: Record<string, unknown> = { requestId, localDate, weightKg: w, adherenceAnswer: adherence, hunger, energy, performance };
    if (needsWaist) declared.waistCm = wc;
    if (needsExperience) declared.strengthExperience = experience;
    setBusy(true);
    try {
      const res = await submit('checkin', declared);
      // El store ya aplicó el peso del servidor y recalculó CAPA 1: su estado explica la consecuencia.
      onDone(adaptiveResultFrom(res.body, localDate, useAppStore.getState().energyState?.status ?? null));
    } catch {
      onDone({ kind: 'ERROR' });
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet" onClick={(e) => e.stopPropagation()} data-adaptive-sheet="checkin">
        <div className="sh-handle" />
        <div className="sh-header-row">
          <h1 className="sh-title">{t('adaptive.checkinSheetTitle')}</h1>
          <button className="sh-close" onClick={onClose} aria-label={t('common.close')} type="button"><X size={18} strokeWidth={2} /></button>
        </div>
        <p className="sh-intro">{t('adaptive.checkinIntro')}</p>
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
          <div className="sh-field"><span className="sh-field-label">{t('adaptive.adherenceQ')}</span>
            {chips(ADHERENCE_ANSWERS, 'adherence', adherence, setAdherence, (v) => range(v as (typeof ADHERENCE_ANSWERS)[number]))}</div>
          <div className="sh-field"><span className="sh-field-label">{t('adaptive.hungerQ')}</span>{chips(NUTRITION_HUNGER_VALUES, 'hunger', hunger, setHunger)}</div>
          <div className="sh-field"><span className="sh-field-label">{t('adaptive.energyQ')}</span>{chips(NUTRITION_ENERGY_VALUES, 'energy', energy, setEnergy)}</div>
          <div className="sh-field"><span className="sh-field-label">{t('adaptive.performanceQ')}</span>{chips(NUTRITION_PERFORMANCE_VALUES, 'performance', performance, setPerformance)}</div>
          {needsExperience && (
            <div className="sh-field"><span className="sh-field-label">{t('adaptive.experienceQ')}</span>{chips(STRENGTH_EXPERIENCE_VALUES, 'experience', experience, setExperience)}</div>
          )}
        </div>
        {error && <p className="sh-error">{error}</p>}
        <button type="button" className="sh-cta" disabled={busy} onClick={() => void send()}>
          {busy ? t('adaptive.sending') : t('adaptive.checkinSubmit')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
