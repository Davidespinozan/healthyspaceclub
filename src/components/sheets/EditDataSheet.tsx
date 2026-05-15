import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store';
import './sheet-base.css';

interface Props {
  onClose: () => void;
}

const SEX_OPTIONS = ['Hombre', 'Mujer'];
const ACTIVITY_OPTIONS = ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta'];
const GOAL_OPTIONS = ['Bajar grasa', 'Subir masa muscular', 'Recomposición', 'Bienestar integral'];

export default function EditDataSheet({ onClose }: Props) {
  const { obData, setObData, recalcFromObData, tdee, planGoal } = useAppStore();

  const [form, setForm] = useState({
    sex: String(obData.sex || ''),
    edad: String(obData.edad || ''),
    peso: String(obData.peso || ''),
    estatura: String(obData.estatura || obData.altura || ''),
    activity: String(obData.activity || obData.actividad || ''),
    goal: String(obData.goal || ''),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setError('');
    const edadN = Number(form.edad);
    const pesoN = Number(form.peso);
    const estaturaN = Number(form.estatura);

    if (!form.sex || !SEX_OPTIONS.includes(form.sex)) { setError('Seleccioná tu sexo.'); return; }
    if (!edadN || edadN < 13 || edadN > 100) { setError('Edad inválida (13-100).'); return; }
    if (!pesoN || pesoN < 30 || pesoN > 300) { setError('Peso inválido (30-300 kg).'); return; }
    if (!estaturaN || estaturaN < 100 || estaturaN > 230) { setError('Estatura inválida (100-230 cm).'); return; }
    if (!form.activity || !ACTIVITY_OPTIONS.includes(form.activity)) { setError('Seleccioná tu nivel de actividad.'); return; }
    if (!form.goal) { setError('Seleccioná tu objetivo.'); return; }

    setSaving(true);
    setObData('sex', form.sex);
    setObData('edad', edadN);
    setObData('peso', pesoN);
    setObData('estatura', estaturaN);
    setObData('activity', form.activity);
    setObData('goal', form.goal);

    try {
      await recalcFromObData();
      setSaved(true);
    } catch (e) {
      console.error('[EditDataSheet] save failed:', e);
      setError('No pudimos guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet" onClick={e => e.stopPropagation()}>
        <div className="sh-handle" />
        <button
          className="sh-close"
          onClick={onClose}
          aria-label="Cerrar"
          type="button"
        >
          ✕
        </button>

        <h1 className="sh-title">Editar mis datos</h1>
        <p className="sh-intro">
          Actualizá tus datos para que el plan se recalcule según tu situación actual.
        </p>

        <div className="sh-form">
          <label className="sh-field">
            <span className="sh-field-label">Sexo</span>
            <select
              className="sh-input"
              value={form.sex}
              onChange={e => update('sex', e.target.value)}
            >
              <option value="">—</option>
              {SEX_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>

          <label className="sh-field">
            <span className="sh-field-label">Edad</span>
            <input
              className="sh-input"
              type="number"
              inputMode="numeric"
              min={13}
              max={100}
              value={form.edad}
              onChange={e => update('edad', e.target.value)}
              placeholder="años"
            />
          </label>

          <label className="sh-field">
            <span className="sh-field-label">Peso (kg)</span>
            <input
              className="sh-input"
              type="number"
              inputMode="decimal"
              min={30}
              max={300}
              step="0.1"
              value={form.peso}
              onChange={e => update('peso', e.target.value)}
            />
          </label>

          <label className="sh-field">
            <span className="sh-field-label">Estatura (cm)</span>
            <input
              className="sh-input"
              type="number"
              inputMode="numeric"
              min={100}
              max={230}
              value={form.estatura}
              onChange={e => update('estatura', e.target.value)}
            />
          </label>

          <label className="sh-field">
            <span className="sh-field-label">Actividad</span>
            <select
              className="sh-input"
              value={form.activity}
              onChange={e => update('activity', e.target.value)}
            >
              <option value="">—</option>
              {ACTIVITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>

          <label className="sh-field">
            <span className="sh-field-label">Objetivo</span>
            <select
              className="sh-input"
              value={form.goal}
              onChange={e => update('goal', e.target.value)}
            >
              <option value="">—</option>
              {GOAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>

        {error && <p className="sh-error">{error}</p>}

        {saved && (
          <div className="sh-saved">
            <p>✓ Datos guardados. Tu plan se actualizó:</p>
            <p className="sh-saved-stats">
              TDEE: <strong>{tdee.toLocaleString()} kcal</strong> · Meta: <strong>{planGoal.toLocaleString()} kcal/día</strong>
            </p>
          </div>
        )}

        <button
          type="button"
          className="sh-cta"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>,
    document.body
  );
}
