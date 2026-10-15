// Selector del tipo de batido (paso 'protein' del Planificador).
//
// RESTRICCIONES · la compatibilidad de cada tipo NO se decide aquí: viene de
// `shakeTypeOptions`, una proyección de `shakeCompatibleWith`, la misma autoridad que
// aplican el generador y la validación final. Un tipo incompatible se muestra
// deshabilitado y con su motivo; nunca queda seleccionado y no se elige otro por el
// usuario (sin sustituciones automáticas).
//
// WEEKLY PREFERENCES SPLIT · D-WP5 · recibe la POLÍTICA (strict/soft): lácteos permanente o semanal
// bloquea el whey igual, pero el motivo dice de dónde viene (restricción vs preferencia de la semana).
import type React from 'react';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/es';
import { shakeTypeOptions, type ProteinShake, type AvoidPolicy } from '../utils/planEngine';

const LABEL: Record<ProteinShake['type'], TranslationKey> = {
  regular: 'nutritionPlanner.proteinRegular',
  vegana: 'nutritionPlanner.proteinVegan',
  massgainer: 'nutritionPlanner.proteinGainer',
};

interface Props {
  /** Política de la semana (permanentes en `strict`, preferencias en `soft`), la misma que recibirá el
   *  generador. Una lista suelta se interpreta como todo estricto. */
  avoid: AvoidPolicy | readonly string[];
  /** Tipo elegido y compatible, o null si no hay ninguno elegido. */
  value: ProteinShake['type'] | null;
  onChange: (type: ProteinShake['type']) => void;
  pill: (on: boolean) => React.CSSProperties;
}

export default function ShakeTypeSelector({ avoid, value, onChange, pill }: Props) {
  const { t } = useT();
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {shakeTypeOptions(avoid).map(({ type, compatible, origin }) => {
        const on = compatible && value === type;
        return (
          <button
            key={type}
            type="button"
            data-shake-type={type}
            disabled={!compatible}
            aria-disabled={!compatible}
            aria-pressed={on}
            style={{ ...pill(on), ...(compatible ? null : { opacity: 0.5, cursor: 'not-allowed', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }) }}
            onClick={() => { if (compatible) onChange(type); }}
          >
            {t(LABEL[type])}
            {!compatible && (
              <span style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>{t(origin === 'soft' ? 'nutritionPlanner.shakeIncompatibleDairyWeekly' : 'nutritionPlanner.shakeIncompatibleDairy')}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
