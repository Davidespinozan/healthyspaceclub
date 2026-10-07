import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAppStore } from '../../store';
import { PERMANENT_AVOID_CATALOG } from '../../utils/avoidAuthority';
import {
  TRAINING_MODALITIES, TRAINING_MODALITIES_KEY, declaredTrainingModalitiesForForm,
  serializeTrainingModalities, type TrainingModality,
} from '../../utils/trainingModality';
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
// CAPA 1E · Fase A — NIVEL DE ENTRENAMIENTO. Los tres valores que consume
// `levelFromObData`. Dominio TRAINING: convive a propósito con ACTIVITY_OPTIONS
// (dominio Nutrition legacy), que no se toca hasta la Fase E.
const LEVEL_OPTIONS = ['principiante', 'intermedio', 'avanzado'];
// CAPA 1E · Fase B — ACTIVITY PROFILE de Nutrition. Tercer dominio, distinto de
// ACTIVITY_OPTIONS (legacy) y de LEVEL_OPTIONS (Training). Vive en su propia
// sección para que no se lea como una variante de ninguno de los dos.
const DAILY_LIFE_OPTIONS = ['DL1', 'DL2', 'DL3', 'DL4'];
const TRAINING_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const TRAINING_MINUTE_CHIPS = [30, 45, 60, 75, 90, 120];
const TRAINING_MINUTES_MIN = 1;
const TRAINING_MINUTES_MAX = 300;
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
const LEVEL_KEYS: Record<string, TranslationKey> = {
  'principiante': 'editData.levelPrincipiante',
  'intermedio': 'editData.levelIntermedio',
  'avanzado': 'editData.levelAvanzado',
};
// Las etiquetas del movimiento diario se REUSAN del onboarding: mismo dato, mismo
// copy. Igual que la sección de salud reusa `onboarding.mobility_*`.
const DAILY_LIFE_KEYS: Record<string, TranslationKey> = {
  'DL1': 'onboarding.dlNone',
  'DL2': 'onboarding.dlLittle',
  'DL3': 'onboarding.dlQuite',
  'DL4': 'onboarding.dlLot',
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
// P0-02 · catálogo ÚNICO de restricciones permanentes (mismo que onboarding).
const RESTRICTION_OPTS = PERMANENT_AVOID_CATALOG;

const splitCsv = (v: unknown): string[] => String(v || '').split(',').map(s => s.trim()).filter(Boolean);

/**
 * ¿La clave está declarada en el perfil persistido?
 *
 * CAPA 1E · Fase B — por PRESENCIA, nunca por truthiness. `trainsHabitually: 0`
 * significa «declaró que no entrena» y es falsy: con un `||` se leería como «sin
 * declarar» y la hoja le volvería a preguntar algo que ya respondió.
 */
const isDeclared = (ob: Record<string, string | number>, key: string): boolean => {
  if (!(key in ob)) return false;
  const v = ob[key];
  if (v === undefined || v === null) return false;
  return typeof v === 'string' ? v.trim() !== '' : true;
};

export default function EditDataSheet({ onClose }: Props) {
  const { obData, setObData, recalcFromObData, addWeight, tdee, planGoal, planClearedByAvoid, acknowledgePlanClearedByAvoid } = useAppStore(useShallow((s) => ({ obData: s.obData, setObData: s.setObData, recalcFromObData: s.recalcFromObData, addWeight: s.addWeight, tdee: s.tdee, planGoal: s.planGoal, planClearedByAvoid: s.planClearedByAvoid, acknowledgePlanClearedByAvoid: s.acknowledgePlanClearedByAvoid })));
  const { t } = useT();

  const [form, setForm] = useState({
    sex: String(obData.sex || ''),
    edad: String(obData.edad || ''),
    peso: String(obData.peso || ''),
    estatura: String(obData.estatura || obData.altura || ''),
    activity: String(obData.activity || obData.actividad || ''),
    // Perfil legacy sin nivel → '' = SIN DECLARAR, y así se muestra. NO se
    // prerrellena con 'intermedio' ni se infiere desde `activity`: el motor tiene
    // su propio fallback, pero la UI no debe fingir que ese fallback fue una
    // declaración del socio.
    nivel: String(obData.nivel || ''),
    // CAPA 1E · Fase B — ActivityProfile. Igual que el nivel: '' = SIN DECLARAR, y
    // así se muestra. Nada se prerrellena ni se infiere desde `activity` ni desde
    // `nivel`. `trainsHabitually` se lee por PRESENCIA porque 0 es una respuesta.
    dailyLife: String(obData.dailyLife || ''),
    trainsHabitually: isDeclared(obData, 'trainsHabitually')
      ? (Number(obData.trainsHabitually) === 1 ? 'si' : 'no')
      : '',
    trainingDays: isDeclared(obData, 'trainingDaysPerWeek')
      ? String(obData.trainingDaysPerWeek)
      : '',
    trainingMinutes: isDeclared(obData, 'trainingSessionMinutes')
      ? String(obData.trainingSessionMinutes)
      : '',
    goal: String(obData.goal || ''),
    country: String(obData.country || ''),
    movilidad: String(obData.movilidad || ''),
  });
  // Multi-selección: se guardan como CSV en obData ('conditions', 'avoid').
  const [conditions, setConditions] = useState<string[]>(() => splitCsv(obData.conditions));
  const [avoid, setAvoid] = useState<string[]>(() => splitCsv(obData.avoid));
  // CAPA 2 · A2 · modalidad DECLARADA. Se pre-rellena solo con valores válidos; un
  // perfil sin declaración abre vacío (no se infiere de minutos, actividad ni historial).
  const [modalities, setModalities] = useState<TrainingModality[]>(
    () => declaredTrainingModalitiesForForm(obData[TRAINING_MODALITIES_KEY]),
  );
  // Si la duración declarada no coincide con ningún atajo (p. ej. 50), la hoja abre
  // directamente en «Otro» con el valor real — nunca lo redondea a un chip.
  const [minutesCustom, setMinutesCustom] = useState(
    () => isDeclared(obData, 'trainingSessionMinutes') &&
      Number(obData.trainsHabitually) === 1 &&
      !TRAINING_MINUTE_CHIPS.includes(Number(obData.trainingSessionMinutes)),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // P0-02 · el aviso es de ESTE guardado: se limpia cualquier marca anterior al abrir.
  useEffect(() => { acknowledgePlanClearedByAvoid(); }, [acknowledgePlanClearedByAvoid]);

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

  // CAPA 1E · Fase B — validez del entrenamiento habitual. Los días tienen que ser
  // uno de 1–7 (no basta «no vacío»: un perfil que respondió «No» trae 0 guardado,
  // y 0 es incoherente con «Sí» para el clasificador). Los minutos, cualquier
  // entero declarado en [1, 300].
  const trainingDaysNum = Number(form.trainingDays);
  const trainingDaysValid = TRAINING_DAY_OPTIONS.includes(trainingDaysNum);
  const trainingMinutesNum = Number(form.trainingMinutes);
  const trainingMinutesValid =
    form.trainingMinutes !== '' &&
    Number.isInteger(trainingMinutesNum) &&
    trainingMinutesNum >= TRAINING_MINUTES_MIN &&
    trainingMinutesNum <= TRAINING_MINUTES_MAX;

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
    // `nivel` es nuevo: un perfil legacy que nunca lo declaró debe poder guardar el
    // resto de sus datos sin que le inventemos uno. Pero en cuanto forma parte del
    // perfil —ya estaba declarado, o se declara ahora— tiene que ser válido: así no
    // se puede vaciar un nivel real ni colar un valor que el motor ignoraría.
    const hadLevel = LEVEL_OPTIONS.includes(String(obData.nivel || ''));
    if ((hadLevel || form.nivel) && !LEVEL_OPTIONS.includes(form.nivel)) { setError(t('editData.errLevel')); return; }
    // CAPA 1E · Fase B — mismo criterio que el nivel: un perfil legacy que nunca
    // declaró su ActivityProfile puede guardar el resto sin completarlo, pero lo ya
    // declarado no se puede vaciar ni dejar inválido.
    const hadDailyLife = DAILY_LIFE_OPTIONS.includes(String(obData.dailyLife || ''));
    if ((hadDailyLife || form.dailyLife) && !DAILY_LIFE_OPTIONS.includes(form.dailyLife)) {
      setError(t('editData.errDailyLife')); return;
    }
    const hadTrains = isDeclared(obData, 'trainsHabitually');
    if ((hadTrains || form.trainsHabitually) && form.trainsHabitually !== 'si' && form.trainsHabitually !== 'no') {
      setError(t('editData.errTrainsHabitually')); return;
    }
    // Con «Sí», días Y duración son obligatorios. Con «No» no se pide nada más.
    if (form.trainsHabitually === 'si' && !(trainingDaysValid && trainingMinutesValid)) {
      setError(t('editData.errTraining')); return;
    }
    // A2 · con «Sí», al menos una modalidad: es lo que decide la proteína.
    if (form.trainsHabitually === 'si' && modalities.length === 0) {
      setError(t('editData.errModality')); return;
    }
    if (!form.goal) { setError(t('editData.errGoal')); return; }

    setSaving(true);
    const pesoChanged = pesoN !== Number(obData.peso);

    setObData('sex', form.sex);
    setObData('edad', edadN);
    setObData('estatura', estaturaN);
    setObData('activity', form.activity);
    // Solo se escribe una DECLARACIÓN real. Un perfil legacy que sigue sin nivel se
    // queda sin nivel: ni '' ni 'intermedio'. Escribirlo aquí convertiría el fallback
    // del motor en un dato del socio, que es justo lo que no queremos.
    if (LEVEL_OPTIONS.includes(form.nivel)) setObData('nivel', form.nivel);
    // CAPA 1E · Fase B — solo declaraciones reales. Sin declarar → no se escribe
    // nada y el perfil sigue incompleto para el mapper, que es lo correcto.
    if (DAILY_LIFE_OPTIONS.includes(form.dailyLife)) setObData('dailyLife', form.dailyLife);
    if (form.trainsHabitually === 'no') {
      // «No» se persiste EXPLÍCITO con 0/0: es el único par verdadero y neutraliza
      // unos días/minutos que hubieran quedado de un «Sí» anterior.
      setObData('trainsHabitually', 0);
      setObData('trainingDaysPerWeek', 0);
      setObData('trainingSessionMinutes', 0);
      // A2 · «No entreno» vacía la modalidad: ya no aplica y no debe quedar rancia.
      setObData(TRAINING_MODALITIES_KEY, '');
    } else if (form.trainsHabitually === 'si') {
      setObData('trainsHabitually', 1);
      setObData('trainingDaysPerWeek', trainingDaysNum);
      setObData('trainingSessionMinutes', trainingMinutesNum);
      setObData(TRAINING_MODALITIES_KEY, serializeTrainingModalities(modalities));
    }
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

          {/* CAPA 1E · Fase A — junto a «Actividad» a propósito: son los dos campos
              que más fácil se confunden, y verlos con etiquetas distintas es lo que
              aclara que miden cosas distintas. */}
          <label className="sh-field">
            <span className="sh-field-label">{t('editData.level')}</span>
            <select
              className="sh-input"
              value={form.nivel}
              onChange={e => update('nivel', e.target.value)}
            >
              <option value="">{t('editData.levelPending')}</option>
              {LEVEL_OPTIONS.map(o => <option key={o} value={o}>{t(LEVEL_KEYS[o])}</option>)}
            </select>
            <p className="sh-field-hint">{t('editData.levelHint')}</p>
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

        {/* CAPA 1E · Fase B — sección propia para el ActivityProfile de Nutrition.
            Separarla de DATOS es lo que impide que se lea como una variante de
            «Actividad» (legacy) o de «Nivel de entrenamiento» (Training). */}
        <div className="sh-section">
          <p className="sh-heading">{t('editData.movementSection')}</p>
          <p className="sh-field-hint" style={{ marginTop: -6, marginBottom: 12 }}>{t('editData.movementHint')}</p>

          <label className="sh-field">
            <span className="sh-field-label">{t('editData.dailyLife')}</span>
            <select
              className="sh-input"
              value={form.dailyLife}
              onChange={e => update('dailyLife', e.target.value)}
            >
              <option value="">{t('editData.notDeclared')}</option>
              {DAILY_LIFE_OPTIONS.map(o => <option key={o} value={o}>{t(DAILY_LIFE_KEYS[o])}</option>)}
            </select>
          </label>

          <label className="sh-field" style={{ marginTop: 14 }}>
            <span className="sh-field-label">{t('editData.trainsHabitually')}</span>
            <select
              className="sh-input"
              value={form.trainsHabitually}
              onChange={e => update('trainsHabitually', e.target.value)}
            >
              <option value="">{t('editData.notDeclared')}</option>
              <option value="no">{t('editData.optNo')}</option>
              <option value="si">{t('editData.optYes')}</option>
            </select>
          </label>

          {form.trainsHabitually === 'si' && (
            <>
              <div className="sh-field" style={{ marginTop: 14 }}>
                <span className="sh-field-label">{t('editData.trainingDays')}</span>
                <div className="sh-chips">
                  {TRAINING_DAY_OPTIONS.map(d => (
                    <button
                      key={d}
                      type="button"
                      className="sh-chip"
                      aria-pressed={trainingDaysNum === d}
                      onClick={() => update('trainingDays', String(d))}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sh-field" style={{ marginTop: 14 }}>
                <span className="sh-field-label">{t('editData.trainingMinutes')}</span>
                <div className="sh-chips">
                  {TRAINING_MINUTE_CHIPS.map(m => (
                    <button
                      key={m}
                      type="button"
                      className="sh-chip"
                      aria-pressed={!minutesCustom && trainingMinutesNum === m}
                      onClick={() => { setMinutesCustom(false); update('trainingMinutes', String(m)); }}
                    >
                      {m}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="sh-chip"
                    aria-pressed={minutesCustom}
                    onClick={() => setMinutesCustom(true)}
                  >
                    {t('onboarding.trainingMinutesOther')}
                  </button>
                </div>
                {minutesCustom && (
                  <input
                    className="sh-input"
                    style={{ marginTop: 10 }}
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    aria-label={t('onboarding.trainingMinutesCustomLabel')}
                    value={form.trainingMinutes}
                    onChange={e => update('trainingMinutes', e.target.value.replace(/[^0-9]/g, ''))}
                  />
                )}
                <p className="sh-field-hint">{t('onboarding.trainingMinutesHint')}</p>
              </div>

              {/* CAPA 2 · A2 · modalidad DECLARADA (multi-selección). */}
              <div className="sh-field" style={{ marginTop: 14 }}>
                <span className="sh-field-label">{t('onboarding.modalityQuestion')}</span>
                <p className="sh-field-hint" style={{ marginTop: 0 }}>{t('onboarding.modalityHint')}</p>
                <div className="sh-chips">
                  {TRAINING_MODALITIES.map(m => (
                    <button
                      key={m}
                      type="button"
                      className="sh-chip"
                      aria-pressed={modalities.includes(m)}
                      title={t(`onboarding.modality_${m}Desc` as TranslationKey)}
                      onClick={() => toggleIn(modalities, (v) => setModalities(v as TrainingModality[]), m)}
                    >
                      {t(`onboarding.modality_${m}` as TranslationKey)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
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
              {/* C3 · sin cifra, «—». Nunca «0 kcal». */}
              TDEE: <strong>{tdee != null ? `${tdee.toLocaleString()} kcal` : '—'}</strong> · {t('editData.goalShort')}: <strong>{planGoal != null ? `${planGoal.toLocaleString()} ${t('settings.kcalPerDay')}` : '—'}</strong>
            </p>
            {/* P0-02 · el plan se descartó porque servía algo que el usuario acaba de
                excluir. Sin esto la desaparición era silenciosa. */}
            {planClearedByAvoid && (
              <p className="sh-saved-warn">{t('editData.planClearedByAvoid')}</p>
            )}
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
