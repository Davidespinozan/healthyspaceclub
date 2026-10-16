// ADAPTIVE NUTRITION · entrada del socio real dentro de Nutrición.
//
// Solo PRESENTA y RECOGE lo que la persona declara. Todo lo demás lo deciden autoridades existentes:
//   · qué mostrar (activando / check-in / esperar / qué falta) → `adaptiveEntryState` (puro), que usa
//     CAPA 1, el planificador y el calendario del SERVIDOR y el Snapshot V2 del store;
//   · el inicio → usuario NUEVO: AUTOMÁTICO con el perfil (`adaptiveAutoStart`, montado en App), aquí
//     solo se muestra su estado; usuario EXISTENTE (D3): su check-in INICIAL registra el peso de hoy como
//     punto de partida (START), sin ajustar nada. Recomposición sin cintura en el perfil → Mis datos (D2);
//   · el check-in → `callNutritionCheckin` (Edge `nutrition-checkin`), que decide y persiste;
//   · el resultado → la decisión del servidor, solo traducida (`adaptiveResultFrom`).
// El cliente nunca calcula ni envía base, paso, kcal ni decisión, y nunca muestra términos técnicos.
// El peso SOLO se pide dentro de un check-in (el inicial o el completo).
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
  adaptiveEntryState, adaptiveResultFrom, precheckInitialCheckin, isPlausibleWeightKg, isPlausibleWaistCm, WEIGHT_KG_RANGE, WAIST_CM_RANGE,
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

const BLOCK_COPY: Record<AdaptiveBlockReason, { title: TranslationKey; body: TranslationKey; cta: TranslationKey }> = {
  STRENGTH_REQUIRED: { title: 'adaptive.strengthTitle', body: 'adaptive.strengthBody', cta: 'adaptive.editDataCta' },
  UNDERWEIGHT: { title: 'adaptive.underweightTitle', body: 'adaptive.underweightBody', cta: 'adaptive.editDataCta' },
  FAT_LOSS_FLOOR: { title: 'adaptive.floorTitle', body: 'adaptive.floorBody', cta: 'adaptive.editDataCta' },
  PROFILE_INCOMPLETE: { title: 'adaptive.profileTitle', body: 'adaptive.profileBody', cta: 'adaptive.editDataCta' },
  WAIST_MISSING: { title: 'adaptive.waistMissingTitle', body: 'adaptive.waistMissingBody', cta: 'adaptive.goToEditDataCta' },
  NOT_ELIGIBLE: { title: 'adaptive.notEligibleTitle', body: 'adaptive.notEligibleBody', cta: 'adaptive.editDataCta' },
};
type SheetMode = 'initial' | 'checkin';
const parseNum = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

export default function AdaptiveCheckinCard({ onEditData }: Props) {
  const { t, locale } = useT();
  const { energyStatus, obData, adaptive, snapshot, startDate, applyServerNutritionWeight, loadAdaptiveCalibration } = useAppStore(useShallow((s) => ({
    energyStatus: s.energyState?.status ?? null, obData: s.obData, adaptive: s.adaptiveCalibration, snapshot: s.nutritionSnapshot, startDate: s.startDate,
    applyServerNutritionWeight: s.applyServerNutritionWeight, loadAdaptiveCalibration: s.loadAdaptiveCalibration,
  })));
  const autoStart = useAdaptiveAutoStartStatus();
  const today = dayKey(new Date());
  const state = useMemo(() => adaptiveEntryState({ energyStatus, obData, adaptive, snapshot, startDate: startDate ?? '', today }),
    [energyStatus, obData, adaptive, snapshot, startDate, today]);
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [result, setResult] = useState<AdaptiveResult | null>(null);
  const submit = (action: 'start' | 'checkin', declared: Record<string, unknown>) =>
    callNutritionCheckin(action, declared, applyServerNutritionWeight, loadAdaptiveCalibration);

  const fmt = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const resultText = (r: AdaptiveResult): string | null => {
    switch (r.kind) {
      case 'STARTED': return t('adaptive.resultStarted');
      case 'BASELINE': return t('adaptive.resultBaseline');
      case 'UNDERWEIGHT_NOT_SAVED': return t('adaptive.resultUnderweightNotSaved');
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
      <button type="button" className="ad-cta" onClick={onEditData}>{t(BLOCK_COPY[reason].cta)}</button>
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
      {state.kind === 'INITIAL_CHECKIN' && (
        <div className="ad-card" data-adaptive="initial">
          <p className="ad-title">{t('adaptive.initialTitle')}</p>
          <p className="ad-body">{t('adaptive.initialBody')}</p>
          <button type="button" className="ad-cta" onClick={() => { setResult(null); setSheet('initial'); }}>{t('adaptive.initialCta')}</button>
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
      {sheet === 'checkin' && state.kind === 'CHECKIN_DUE' && (
        <CheckinSheet
          mode="checkin"
          needsWaist={state.needsWaist}
          needsExperience={state.needsExperience}
          onClose={() => setSheet(null)}
          onDone={(r) => { setResult(r); setSheet(null); }}
          submit={submit}
        />
      )}
      {sheet === 'initial' && state.kind === 'INITIAL_CHECKIN' && (
        <CheckinSheet
          mode="initial"
          profileWaistCm={state.waistCm}
          precheck={(weightKg) => precheckInitialCheckin({ obData, energyStatus, weightKg, waistCm: state.waistCm, today })}
          onClose={() => setSheet(null)}
          onDone={(r) => { setResult(r); setSheet(null); }}
          submit={submit}
        />
      )}
    </div>
  );
}

type Submit = (action: 'start' | 'checkin', declared: Record<string, unknown>) => ReturnType<typeof callNutritionCheckin>;
const newRequestId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

// ── Hoja de check-in (lo único que pide peso) ───────────────────────────────
// 'initial' (D3, usuario existente): solo el peso de hoy → START en el servidor = punto de partida,
// sin ajustar nada (no hay trayectoria que evaluar). La cintura de recomposición sale del perfil (D2).
// 'checkin': el check-in completo del contrato MB2.
type SheetProps = { onClose: () => void; onDone: (r: AdaptiveResult) => void; submit: Submit } & (
  | { mode: 'checkin'; needsWaist: boolean; needsExperience: boolean }
  | { mode: 'initial'; profileWaistCm: number | null; precheck: (weightKg: number) => AdaptiveResult | null }
);

function CheckinSheet(props: SheetProps) {
  const { mode, onClose, onDone, submit } = props;
  const needsWaist = mode === 'checkin' && props.needsWaist;
  const needsExperience = mode === 'checkin' && props.needsExperience;
  const full = mode === 'checkin';
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
    if (weight.trim() === '' || (needsWaist && waist.trim() === '')
      || (full && (!adherence || !hunger || !energy || !performance || (needsExperience && !experience)))) {
      setError(t('adaptive.incomplete')); return;
    }
    if (!isPlausibleWeightKg(w)) { setError(t('adaptive.invalidWeight', WEIGHT_KG_RANGE)); return; }
    if (needsWaist && !isPlausibleWaistCm(wc)) { setError(t('adaptive.invalidWaist', WAIST_CM_RANGE)); return; }
    setError('');
    const localDate = dayKey(new Date());
    if (props.mode === 'initial') {
      // Si el planificador del servidor no aceptaría este peso (p. ej. bajo para bajar grasa), se explica sin enviar.
      const blocked = props.precheck(w);
      if (blocked) { onDone(blocked); return; }
    }
    // SOLO lo que la persona declara (lista blanca de la Edge). Nada de base, paso, kcal ni decisión.
    const declared: Record<string, unknown> = props.mode === 'initial'
      ? { requestId, localDate, weightKg: w, ...(props.profileWaistCm != null ? { waistCm: props.profileWaistCm } : {}) }
      : { requestId, localDate, weightKg: w, adherenceAnswer: adherence, hunger, energy, performance,
          ...(needsWaist ? { waistCm: wc } : {}), ...(needsExperience ? { strengthExperience: experience } : {}) };
    setBusy(true);
    try {
      const res = await submit(full ? 'checkin' : 'start', declared);
      // El store ya aplicó el peso del servidor y recalculó CAPA 1: su estado explica la consecuencia.
      const r = adaptiveResultFrom(res.body, localDate, useAppStore.getState().energyState?.status ?? null);
      onDone(!full && r.kind === 'STARTED' ? { kind: 'BASELINE' } : r);
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
          <h1 className="sh-title">{t(full ? 'adaptive.checkinSheetTitle' : 'adaptive.initialSheetTitle')}</h1>
          <button className="sh-close" onClick={onClose} aria-label={t('common.close')} type="button"><X size={18} strokeWidth={2} /></button>
        </div>
        <p className="sh-intro">{t(full ? 'adaptive.checkinIntro' : 'adaptive.initialIntro')}</p>
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
          {full && (
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
          {busy ? t('adaptive.sending') : t(full ? 'adaptive.checkinSubmit' : 'adaptive.initialSubmit')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
