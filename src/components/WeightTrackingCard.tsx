import { dayKey } from '../utils/localDate';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import './weight-tracking-card.css';

export default function WeightTrackingCard() {
  const weightLog = useAppStore(s => s.weightLog);
  const addWeight = useAppStore(s => s.addWeight);
  const obData = useAppStore(s => s.obData);
  const { t } = useT();

  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastValue, setToastValue] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...weightLog].sort((a, b) => a.date.localeCompare(b.date)),
    [weightLog],
  );
  const lastEntry = sorted[sorted.length - 1];
  const obPeso = typeof obData?.peso === 'number'
    ? obData.peso
    : (typeof obData?.peso === 'string' ? Number(obData.peso) : null);
  const currentWeight = lastEntry?.kg ?? (Number.isFinite(obPeso) ? obPeso : null);

  // Delta inteligente: intenta vs entry de hace ≥7 días, fallback al primer entry.
  const deltaInfo = useMemo(() => {
    if (!lastEntry || sorted.length < 2) return null;
    const previousEntries = sorted.slice(0, -1);
    if (previousEntries.length === 0) return null;

    // Intento 1: entry de hace ≥7 días
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = dayKey(weekAgo);
    const weekAgoEntry = previousEntries.filter(e => e.date <= weekAgoStr).pop();
    if (weekAgoEntry) {
      return {
        value: +(lastEntry.kg - weekAgoEntry.kg).toFixed(1),
        label: 'semana' as const,
      };
    }

    // Fallback: usar la entry más vieja disponible
    const oldestEntry = previousEntries[0];
    return {
      value: +(lastEntry.kg - oldestEntry.kg).toFixed(1),
      label: 'inicio' as const,
    };
  }, [sorted, lastEntry]);

  // ¿Registró peso esta semana? (desde el domingo pasado)
  const registeredThisWeek = useMemo(() => {
    const sundayThisWeek = (() => {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay());
      return dayKey(d);
    })();
    return sorted.some(e => e.date >= sundayThisWeek);
  }, [sorted]);

  // Body overflow lock + ESC handler cuando modal abre
  useEffect(() => {
    if (!showModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setShowModal(false); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [showModal]);

  async function handleSave() {
    setError('');
    const kg = parseFloat(inputValue);
    if (!kg || kg < 30 || kg > 300) {
      setError(t('weight.errInvalid'));
      return;
    }
    setSaving(true);
    try {
      await addWeight(kg);
      setInputValue('');
      setShowModal(false);
      // Micro-feedback: toast con confirmación
      setToastValue(kg);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    } catch (e) {
      console.error('[WeightTrackingCard] save failed:', e);
      setError(t('weight.errSave'));
    } finally {
      setSaving(false);
    }
  }

  function openModal() {
    setError('');
    setInputValue(currentWeight ? String(currentWeight) : '');
    setShowModal(true);
  }

  const showChip = deltaInfo !== null && deltaInfo.value !== 0;
  const chipDirection = deltaInfo && deltaInfo.value < 0 ? 'down' : 'up';
  const metaText = (() => {
    if (deltaInfo?.label === 'inicio' && Math.abs(deltaInfo.value) > 0) {
      return t('weight.metaSinceFirst');
    }
    if (registeredThisWeek) return t('weight.metaThisWeek');
    return t('weight.metaWeeklyTip');
  })();

  return (
    <>
      <button type="button" className="weight-row" onClick={openModal}>
        <div className="weight-row-left">
          <span className="weight-row-label">{t('weight.label')}</span>
          <span className="weight-row-value">
            {currentWeight !== null && currentWeight !== undefined
              ? <>{currentWeight} <span className="weight-row-unit">kg</span></>
              : t('weight.unset')}
          </span>
          {showChip && deltaInfo && (
            <span className={`weight-row-delta ${chipDirection}`}>
              {deltaInfo.value < 0
                ? <ArrowDown size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
                : <ArrowUp size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />} {Math.abs(deltaInfo.value)} kg
            </span>
          )}
        </div>
        <span className="weight-row-chevron" aria-hidden="true">›</span>
      </button>
      <div className="weight-row-meta">{metaText}</div>

      {showToast && toastValue !== null && (
        <div className="weight-toast" role="status" aria-live="polite">
          <div className="weight-toast-check" aria-hidden="true"><Check size={16} strokeWidth={2.5} /></div>
          <div className="weight-toast-text">{t('weight.toastSaved')} {toastValue} kg</div>
        </div>
      )}

      {showModal && (
        <div className="weight-modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="weight-modal" onClick={e => e.stopPropagation()}>
            <h3 className="weight-modal-title">{t('weight.modalTitle')}</h3>
            <p className="weight-modal-intro">
              {t('weight.modalIntro')}
            </p>

            <div className="weight-modal-input-row">
              <input
                type="number"
                step="0.1"
                min={30}
                max={300}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={t('weight.placeholder')}
                className="weight-modal-input"
                autoFocus
              />
              <span className="weight-modal-unit">kg</span>
            </div>

            {error && <p className="weight-modal-error">{error}</p>}

            <div className="weight-modal-actions">
              <button
                type="button"
                className="weight-modal-btn-ghost"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="weight-modal-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
