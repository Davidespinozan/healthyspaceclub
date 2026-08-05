import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAppStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/es';
import { PAISES } from '../../data/ubicaciones';
import './sheet-base.css';

interface Props {
  onClose: () => void;
}

// Stored values stay in Spanish (data layer). Display labels use t() for i18n.
const SEX_OPTIONS = ['Hombre', 'Mujer'];
const ACTIVITY_OPTIONS = ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta'];
const GOAL_OPTIONS = ['Bajar grasa', 'Subir masa muscular', 'Recomposición', 'Bienestar integral'];

const SEX_KEYS: Record<string, TranslationKey> = {
  'Hombre': 'editData.sexHombre',
  'Mujer': 'editData.sexMujer',
};
const ACTIVITY_KEYS: Record<string, TranslationKey> = {
  'Sedentaria': 'editData.actSedentaria',
  'Ligera': 'editData.actLigera',
  'Moderada': 'editData.actModerada',
  'Alta': 'editData.actAlta',
  'Atleta': 'editData.actAtleta',
};
const GOAL_KEYS: Record<string, TranslationKey> = {
  'Bajar grasa': 'editData.goalBajarGrasa',
  'Subir masa muscular': 'editData.goalSubirMasaMuscular',
  'Recomposición': 'editData.goalRecomposicion',
  'Bienestar integral': 'editData.goalBienestarIntegral',
};

// Salud/preferencias (opcionales) — mismos slugs y claves i18n que el onboarding,
// para que editar aquí y capturar allá escriban exactamente el mismo dato.
const MOBILITY_OPTS = ['ninguna', 'articular', 'equilibrio', 'apoyo'] as const;
const CONDITION_OPTS = ['diabetes', 'hipertension', 'renal', 'colesterol'] as const;
const RESTRICTION_OPTS = ['gluten', 'lacteos', 'huevo', 'frutos-secos', 'cacahuate', 'mariscos', 'vegetariano', 'vegano'] as const;

const splitCsv = (v: unknown): string[] => String(v || '').split(',').map(s => s.trim()).filter(Boolean);

export default function EditDataSheet({ onClose }: Props) {
  const { obData, setObData, recalcFromObData, addWeight, tdee, planGoal } = useAppStore(useShallow((s) => ({ obData: s.obData, setObData: s.setObData, recalcFromObData: s.recalcFromObData, addWeight: s.addWeight, tdee: s.tdee, planGoal: s.planGoal })));
  const { t } = useT();

  const [form, setForm] = useState({
    sex: String(obData.sex || ''),
    edad: String(obData.edad || ''),
    peso: String(obData.peso || ''),
    estatura: String(obData.estatura || obData.altura || ''),
    activity: String(obData.activity || obData.actividad || ''),
    goal: String(obData.goal || ''),
    country: String(obData.country || ''),
    movilidad: String(obData.movilidad || ''),
  });
  // Multi-selección: se guardan como CSV en obData ('conditions', 'avoid').
  const [conditions, setConditions] = useState<string[]>(() => splitCsv(obData.conditions));
  const [avoid, setAvoid] = useState<string[]>(() => splitCsv(obData.avoid));
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

  function toggleIn(list: string[], set: (v: string[]) => void, slug: string) {
    set(list.includes(slug) ? list.filter(s => s !== slug) : [...list, slug]);
    setSaved(false);
  }

  // movilidad es single-select: volver a tocar el chip activo lo deselecciona.
  function pickMobility(slug: string) {
    update('movilidad', form.movilidad === slug ? '' : slug);
  }

  async function handleSave() {
    setError('');
    const edadN = Number(form.edad);
    const pesoN = Number(form.peso);
    const estaturaN = Number(form.estatura);

    if (!form.sex || !SEX_OPTIONS.includes(form.sex)) { setError(t('editData.errSex')); return; }
    if (!edadN || edadN < 13 || edadN > 100) { setError(t('editData.errAge')); return; }
    if (!pesoN || pesoN < 30 || pesoN > 300) { setError(t('editData.errWeight')); return; }
    if (!estaturaN || estaturaN < 100 || estaturaN > 230) { setError(t('editData.errHeight')); return; }
    if (!form.activity || !ACTIVITY_OPTIONS.includes(form.activity)) { setError(t('editData.errActivity')); return; }
    if (!form.goal) { setError(t('editData.errGoal')); return; }

    setSaving(true);
    const pesoChanged = pesoN !== Number(obData.peso);

    setObData('sex', form.sex);
    setObData('edad', edadN);
    setObData('estatura', estaturaN);
    setObData('activity', form.activity);
    setObData('goal', form.goal);
    // Ubicación + salud/preferencias (opcionales). Se persisten ANTES del recalc
    // porque 'renal' baja el tope de proteína en computeNutritionTargets.
    setObData('country', form.country);
    setObData('movilidad', form.movilidad);
    setObData('conditions', conditions.join(','));
    setObData('avoid', avoid.join(','));

    try {
      if (pesoChanged) {
        // addWeight crea entry en weight_log + setObData('peso') + recalcFromObData
        // (camino unificado para mantener histórico consistente)
        await addWeight(pesoN);
      } else {
        // Peso no cambió: solo recalc por los otros campos
        setObData('peso', pesoN);
        await recalcFromObData();
      }
      setSaved(true);
    } catch (e) {
      console.error('[EditDataSheet] save failed:', e);
      // Fallback: aplicar setObData + recalc igual para no perder los demás campos
      setObData('peso', pesoN);
      try { await recalcFromObData(); } catch { /* ignore */ }
      setError(t('editData.errSaveFallback'));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet" onClick={e => e.stopPropagation()}>
        <div className="sh-handle" />
        <div className="sh-header-row">
          <h1 className="sh-title">{t('editData.title')}</h1>
          <button
            className="sh-close"
            onClick={onClose}
            aria-label={t('common.close')}
            type="button"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <p className="sh-intro">{t('editData.intro')}</p>

        <div className="sh-form">
          <label className="sh-field">
            <span className="sh-field-label">{t('editData.sex')}</span>
            <select
              className="sh-input"
              value={form.sex}
              onChange={e => update('sex', e.target.value)}
            >
              <option value="">—</option>
              {SEX_OPTIONS.map(o => <option key={o} value={o}>{t(SEX_KEYS[o])}</option>)}
            </select>
          </label>

          <label className="sh-field">
            <span className="sh-field-label">{t('editData.age')}</span>
            <input
              className="sh-input"
              type="number"
              inputMode="numeric"
              min={13}
              max={100}
              value={form.edad}
              onChange={e => update('edad', e.target.value)}
              placeholder={t('editData.placeholderYears')}
            />
          </label>

          <label className="sh-field">
            <span className="sh-field-label">{t('editData.weight')}</span>
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
            <span className="sh-field-label">{t('editData.height')}</span>
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
            <span className="sh-field-label">{t('editData.activity')}</span>
            <select
              className="sh-input"
              value={form.activity}
              onChange={e => update('activity', e.target.value)}
            >
              <option value="">—</option>
              {ACTIVITY_OPTIONS.map(o => <option key={o} value={o}>{t(ACTIVITY_KEYS[o])}</option>)}
            </select>
          </label>

          <label className="sh-field">
            <span className="sh-field-label">{t('editData.goal')}</span>
            <select
              className="sh-input"
              value={form.goal}
              onChange={e => update('goal', e.target.value)}
            >
              <option value="">—</option>
              {GOAL_OPTIONS.map(o => <option key={o} value={o}>{t(GOAL_KEYS[o])}</option>)}
            </select>
          </label>

          <label className="sh-field">
            <span className="sh-field-label">{t('editData.location')}</span>
            <select
              className="sh-input"
              value={form.country}
              onChange={e => update('country', e.target.value)}
            >
              <option value="">—</option>
              {PAISES.map(p => <option key={p.slug} value={p.slug}>{p.label}</option>)}
            </select>
            <p className="sh-field-hint">{t('editData.locationHint')}</p>
          </label>
        </div>

        <div className="sh-section">
          <p className="sh-heading">{t('editData.healthSection')}</p>
          <p className="sh-field-hint" style={{ marginTop: -6, marginBottom: 12 }}>{t('editData.healthHint')}</p>

          <div className="sh-field">
            <span className="sh-field-label">{t('onboarding.mobilityTitle')}</span>
            <div className="sh-chips">
              {MOBILITY_OPTS.map(v => (
                <button
                  key={v}
                  type="button"
                  className="sh-chip"
                  aria-pressed={form.movilidad === v}
                  onClick={() => pickMobility(v)}
                >
                  {t(`onboarding.mobility_${v}` as TranslationKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="sh-field" style={{ marginTop: 14 }}>
            <span className="sh-field-label">{t('onboarding.conditionsTitle')}</span>
            <div className="sh-chips">
              {CONDITION_OPTS.map(v => (
                <button
                  key={v}
                  type="button"
                  className="sh-chip"
                  aria-pressed={conditions.includes(v)}
                  onClick={() => toggleIn(conditions, setConditions, v)}
                >
                  {t(`onboarding.condition_${v}` as TranslationKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="sh-field" style={{ marginTop: 14 }}>
            <span className="sh-field-label">{t('onboarding.restrictionsTitle')}</span>
            <div className="sh-chips">
              {RESTRICTION_OPTS.map(v => (
                <button
                  key={v}
                  type="button"
                  className="sh-chip"
                  aria-pressed={avoid.includes(v)}
                  onClick={() => toggleIn(avoid, setAvoid, v)}
                >
                  {t(`onboarding.restr_${v}` as TranslationKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="sh-error">{error}</p>}

        {saved && (
          <div className="sh-saved">
            <p>{t('editData.saved')}</p>
            <p className="sh-saved-stats">
              TDEE: <strong>{tdee.toLocaleString()} kcal</strong> · {t('editData.goalShort')}: <strong>{planGoal.toLocaleString()} {t('settings.kcalPerDay')}</strong>
            </p>
          </div>
        )}

        <button
          type="button"
          className="sh-cta"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('common.saving') : t('editData.save')}
        </button>
      </div>
    </div>,
    document.body
  );
}
