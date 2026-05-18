import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import './weight-tracking-card.css';

export default function WeightTrackingCard() {
  const weightLog = useAppStore(s => s.weightLog);
  const addWeight = useAppStore(s => s.addWeight);
  const obData = useAppStore(s => s.obData);

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

  // Delta vs entry de hace ≥7 días
  const delta = useMemo(() => {
    if (!lastEntry) return null;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const previous = sorted.filter(e => e.date <= weekAgoStr).pop();
    if (!previous) return null;
    return +(lastEntry.kg - previous.kg).toFixed(1);
  }, [sorted, lastEntry]);

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
      setError('Ingresá un peso entre 30 y 300 kg.');
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
      setTimeout(() => setShowToast(false), 2500);
    } catch (e) {
      console.error('[WeightTrackingCard] save failed:', e);
      setError('No se pudo guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function openModal() {
    setError('');
    setInputValue(currentWeight ? String(currentWeight) : '');
    setShowModal(true);
  }

  const deltaClass = delta === null ? '' : delta < 0 ? ' down' : delta > 0 ? ' up' : ' stable';
  const deltaArrow = delta === null ? '' : delta < 0 ? '↓' : delta > 0 ? '↑' : '—';

  return (
    <>
      <button type="button" className="weight-row" onClick={openModal}>
        <div className="weight-row-left">
          <span className="weight-row-label">Peso</span>
          <span className="weight-row-value">
            {currentWeight !== null && currentWeight !== undefined
              ? <>{currentWeight} <span className="weight-row-unit">kg</span></>
              : 'Sin registrar'}
          </span>
          {delta !== null && (
            <span className={`weight-row-delta${deltaClass}`}>
              {deltaArrow} {Math.abs(delta)} kg
            </span>
          )}
        </div>
        <span className="weight-row-chevron" aria-hidden="true">›</span>
      </button>

      {showModal && (
        <div className="weight-modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="weight-modal" onClick={e => e.stopPropagation()}>
            <h3 className="weight-modal-title">Registrar peso</h3>
            <p className="weight-modal-intro">
              Idealmente, pesate en la mañana después del baño, en ayunas y sin ropa.
            </p>

            <div className="weight-modal-input-row">
              <input
                type="number"
                step="0.1"
                min={30}
                max={300}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="70.5"
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
                Cancelar
              </button>
              <button
                type="button"
                className="weight-modal-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showToast && toastValue !== null && (
        <div className="weight-toast" role="status" aria-live="polite">
          <div className="weight-toast-check" aria-hidden="true">✓</div>
          <div className="weight-toast-text">Peso registrado · {toastValue} kg</div>
        </div>
      )}
    </>
  );
}
