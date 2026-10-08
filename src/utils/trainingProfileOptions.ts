// ─────────────────────────────────────────────────────────────────────────────
// Opciones y validadores COMPARTIDOS del perfil de actividad de Nutrition
// (movimiento diario + entrenamiento habitual). Los usan el onboarding, la hoja
// «Editar mis datos» y el flujo de completar perfil (A10): un solo sitio para
// los valores permitidos, sin copias que puedan divergir.
//
// No es una autoridad energética: solo define qué valores ofrece la captura. El
// rango estructural del clasificador (0–7 días, 0–1440 min) no se toca.
// ─────────────────────────────────────────────────────────────────────────────
import type { TranslationKey } from '../i18n/es';

/** Movimiento diario · los cuatro niveles que consume el ActivityClassifier. */
export const DAILY_LIFE_LEVELS = ['DL1', 'DL2', 'DL3', 'DL4'] as const;

/** Etiqueta y descripción de cada nivel: el mismo copy del onboarding. */
export const DAILY_LIFE_COPY: Record<(typeof DAILY_LIFE_LEVELS)[number], { titleKey: TranslationKey; descKey: TranslationKey }> = {
  DL1: { titleKey: 'onboarding.dlNone', descKey: 'onboarding.dlNoneDesc' },
  DL2: { titleKey: 'onboarding.dlLittle', descKey: 'onboarding.dlLittleDesc' },
  DL3: { titleKey: 'onboarding.dlQuite', descKey: 'onboarding.dlQuiteDesc' },
  DL4: { titleKey: 'onboarding.dlLot', descKey: 'onboarding.dlLotDesc' },
};

/**
 * Días por semana. 1–7, nunca 0: el ActivityClassifier acepta `[0,7]` pero LANZA
 * con `trainsHabitually=true` y 0 días por incoherente, así que ofrecerlo sería
 * ofrecer un input que el motor rechaza.
 */
export const TRAINING_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Atajos de duración. NO son el dominio: son accesos rápidos a los valores más
 * comunes. «Otro» permite declarar cualquier entero de 1 a 300, porque lo que se
 * captura es la duración DECLARADA.
 */
export const TRAINING_MINUTE_CHIPS = [30, 45, 60, 75, 90, 120] as const;
export const TRAINING_MINUTES_MIN = 1;
export const TRAINING_MINUTES_MAX = 300;

export const isValidTrainingDays = (n: number): boolean =>
  (TRAINING_DAY_OPTIONS as readonly number[]).includes(n);

export const isValidTrainingMinutes = (n: number): boolean =>
  Number.isInteger(n) && n >= TRAINING_MINUTES_MIN && n <= TRAINING_MINUTES_MAX;
