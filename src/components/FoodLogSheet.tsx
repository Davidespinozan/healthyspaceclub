// FoodLogSheet — Lote Food-2.
//
// Sheet hermano de MealDetailPopout (familia visual .th-popout-*).
// Captura texto libre del usuario → IA estima macros → guarda en foodLog
// (local + Supabase) vía el motor de Food-1.
//
// El sheet es read/write — el MealDetailPopout sigue read-only de la
// info del meal y solo delega acá vía un callback.

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { callAI } from '../utils/aiProxy';
import { buildFoodEstimatePrompt } from '../ai/prompts/foodEstimate';
import { parseFoodEstimate, sanitizeFoodEntry, type FoodEstimate } from '../utils/foodEstimate';
import type { TranslationKey } from './../i18n/es';

// Mismo map que MealDetailPopout — el time del meal del plan se traduce
// para mostrar "en vez de Desayuno" / "Instead of Breakfast".
const MEAL_TIME_KEYS: Record<string, TranslationKey> = {
  'Desayuno': 'mealTime.desayuno',
  'Snack AM': 'mealTime.snackAm',
  'Comida':   'mealTime.comida',
  'Snack PM': 'mealTime.snackPm',
  'Cena':     'mealTime.cena',
};

type Phase = 'input' | 'estimating' | 'done' | 'error';

interface Props {
  /** Time del meal del plan que se está reemplazando (e.g. "Desayuno"). Opcional. */
  mealTime?: string;
  /** Índice del meal del plan en la lista del día — si se provee, el meal
   *  se marca como "resuelto por log" tras un registro exitoso (Food-4). */
  mealIndex?: number;
  onClose: () => void;
  /** Disparado tras un registro exitoso (después del tap "Listo"). */
  onLogged?: () => void;
}

export default function FoodLogSheet({ mealTime, mealIndex, onClose, onLogged }: Props) {
  const { t, locale } = useT();
  const addFoodLog = useAppStore(s => s.addFoodLog);
  const setMealResolvedByLog = useAppStore(s => s.setMealResolvedByLog);

  const [phase, setPhase] = useState<Phase>('input');
  const [text, setText] = useState('');
  const [estimate, setEstimate] = useState<FoodEstimate | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey>('foodLog.errorEstimate');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (phase === 'input') textareaRef.current?.focus();
  }, [phase]);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) {
      setErrorKey('foodLog.errorEmptyInput');
      setPhase('error');
      return;
    }

    setPhase('estimating');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const prompt = buildFoodEstimatePrompt(trimmed, locale);
      const data = await callAI(
        { max_tokens: 200, messages: [{ role: 'user', content: prompt }] },
        controller.signal,
      );
      const raw = data.content?.[0]?.text ?? '';
      const parsed = parseFoodEstimate(raw);
      if (!parsed) {
        setErrorKey('foodLog.errorEstimate');
        setPhase('error');
        return;
      }

      const entry = sanitizeFoodEntry(parsed, trimmed, 'ai');
      await addFoodLog(entry);

      // Food-4: marcar el meal del plan como resuelto por log (señal visual
      // distinta al check ✓ "seguí el plan"). Solo si vino con mealIndex.
      if (mealIndex !== undefined) {
        const today = new Date().toISOString().split('T')[0];
        setMealResolvedByLog(`meal-${today}-${mealIndex}`);
      }

      setEstimate({ kcal: entry.kcal, prot: entry.prot, carbs: entry.carbs, fat: entry.fat });
      setPhase('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setErrorKey('foodLog.errorTimeout');
      } else {
        // addFoodLog throw (Supabase fail) o AIProxyError
        setErrorKey('foodLog.errorSave');
      }
      setPhase('error');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function handleDone() {
    onLogged?.();
    onClose();
  }

  function handleRetry() {
    setPhase('input');
  }

  const timeLabel = mealTime && MEAL_TIME_KEYS[mealTime] ? t(MEAL_TIME_KEYS[mealTime]) : mealTime;

  return createPortal(
    <div className="th-popout-backdrop" onClick={onClose}>
      <div className="th-popout th-popout-sm" onClick={e => e.stopPropagation()}>
        <div className="th-popout-handle" />

        {/* Scrolleable: eyebrow + contenido según fase. Los botones de
            acción viven SIEMPRE en el footer sticky, nunca acá. */}
        <div className="th-popout-content">
          <div className="th-popout-time">
            {phase === 'done' ? t('foodLog.doneEyebrow') : t('foodLog.eyebrow')}
            {timeLabel && phase !== 'done' && ` · ${t('foodLog.eyebrowInstead', { time: timeLabel })}`}
          </div>

          {/* INPUT — textarea + disclaimer (CTA va al footer) */}
          {phase === 'input' && (
            <>
              <div className="th-popout-name">{t('foodLog.title')}</div>
              <textarea
                ref={textareaRef}
                className="wz-textarea"
                placeholder={t('foodLog.placeholder')}
                value={text}
                onChange={e => setText(e.target.value)}
                rows={3}
              />
              <p style={{
                fontFamily: 'Georgia, serif', fontStyle: 'italic',
                fontSize: '.78rem', color: 'var(--txt2)',
                margin: '4px 0 0', lineHeight: 1.4,
              }}>
                {t('foodLog.disclaimer')}
              </p>
            </>
          )}

          {/* ESTIMATING — spinner (sin footer; ver abajo) */}
          {phase === 'estimating' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 16, padding: '40px 20px',
            }}>
              <div className="wz-spinner" />
              <p style={{ color: 'var(--txt2)', fontStyle: 'italic', fontSize: 13 }}>
                {t('foodLog.estimating')}
              </p>
            </div>
          )}

          {/* DONE — info de lo registrado (CTA Listo va al footer) */}
          {phase === 'done' && estimate && (
            <>
              <div className="th-popout-header">
                <div className="th-popout-time">{timeLabel}</div>
                <div className="th-popout-kcal">~{estimate.kcal} kcal</div>
              </div>
              <div className="th-popout-name">{text.trim()}</div>
              <div className="th-popout-desc">
                {t('foodLog.doneMacros', {
                  prot: estimate.prot,
                  carbs: estimate.carbs,
                  fat: estimate.fat,
                })}
              </div>
              <p style={{
                fontFamily: 'Georgia, serif', fontStyle: 'italic',
                fontSize: '.78rem', color: 'var(--txt2)',
                margin: '8px 0 0', lineHeight: 1.4,
              }}>
                {t('foodLog.doneNote')}
              </p>
            </>
          )}

          {/* ERROR — mensaje (CTAs al footer) */}
          {phase === 'error' && (
            <div className="th-popout-name">{t(errorKey)}</div>
          )}
        </div>

        {/* Footer sticky variable según fase. En 'estimating' NO se renderiza
            (el spinner es el único contenido y no hay acción posible). */}
        {phase === 'input' && (
          <div className="th-popout-footer">
            <button
              type="button"
              className="wz-cta"
              onClick={handleSubmit}
              disabled={!text.trim()}
            >
              {t('foodLog.ctaSubmit')}
            </button>
            <button type="button" className="th-popout-close" onClick={onClose}>
              {t('foodLog.ctaCancel')}
            </button>
          </div>
        )}

        {phase === 'done' && estimate && (
          <div className="th-popout-footer">
            <button type="button" className="wz-cta" onClick={handleDone}>
              {t('foodLog.ctaDone')}
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="th-popout-footer">
            <button type="button" className="wz-cta" onClick={handleRetry}>
              {t('foodLog.ctaRetry')}
            </button>
            <button type="button" className="th-popout-close" onClick={onClose}>
              {t('foodLog.ctaCancel')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
