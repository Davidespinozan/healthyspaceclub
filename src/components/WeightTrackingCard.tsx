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

  // ¿Registrado esta semana? (desde el domingo pasado)
  const registeredThisWeek = useMemo(() => {
    const sundayThisWeek = (() => {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay());
      return d.toISOString().split('T')[0];
    })();
    return sorted.some(e => e.date >= sundayThisWeek);
  }, [sorted]);

  // Body overflow lock cuando modal abre
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

  const deltaClass = delta === null ? '' : delta < 0 ? ' is-down' : delta > 0 ? ' is-up' : ' is-stable';
  const deltaArrow = delta === null ? '' : delta < 0 ? '↓' : delta > 0 ? '↑' : '—';

  return (
    <>
      <div className="wt-card">
        <div className="wt-card-head">
          <span className="wt-card-label">Tu peso</span>
          {delta !== null && (
            <span className={`wt-card-delta${deltaClass}`}>
              {deltaArrow} {Math.abs(delta)} kg
            </span>
          )}
        </div>

        <div className="wt-card-value">
          {currentWeight !== null && currentWeight !== undefined
            ? <>{currentWeight}<span className="wt-card-unit"> kg</span></>
            : 'Sin registrar'}
        </div>

        <p className="wt-card-meta">
          {registeredThisWeek
            ? 'Registrado esta semana'
            : 'Pesate 1 vez por semana, mismo día y hora, en ayunas.'}
        </p>

        <button type="button" className="wt-card-btn" onClick={openModal}>
          {registeredThisWeek ? 'Actualizar' : 'Registrar peso'}
        </button>
      </div>

      {showModal && (
        <div className="wt-modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="wt-modal" onClick={e => e.stopPropagation()}>
            <h3 className="wt-modal-title">Registrar peso</h3>
            <p className="wt-modal-intro">
              Idealmente, pesate en la mañana después del baño, en ayunas y sin ropa.
            </p>

            <div className="wt-modal-input-row">
              <input
                type="number"
                step="0.1"
                min={30}
                max={300}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="70.5"
                className="wt-modal-input"
                autoFocus
              />
              <span className="wt-modal-unit">kg</span>
            </div>

            {error && <p className="wt-modal-error">{error}</p>}

            <div className="wt-modal-actions">
              <button
                type="button"
                className="wt-modal-btn-ghost"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="wt-modal-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
