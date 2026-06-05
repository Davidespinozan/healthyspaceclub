import type { TranslationKey } from '../i18n/es';

// Los workouts guardan `type` como un label de display (ej. 'Piernas',
// 'Empuje (push)', 'Upper body') que se generó en el idioma del momento y
// quedaba mezclado al cambiar de idioma. Aquí lo traducimos en el RENDER
// mapeando los labels conocidos de DAY_TYPE_CONFIG a sus keys i18n.
// Para títulos compuestos (músculos específicos) cae al label original.
const DAY_LABEL_KEY: Record<string, TranslationKey> = {
  'Upper body': 'workout.dayTypeUpper',
  'Lower body': 'workout.dayTypeLower',
  'Full body': 'workout.dayTypeFullBody',
  'Empuje (push)': 'workout.dayTypePush',
  'Tracción (pull)': 'workout.dayTypePull',
  'Piernas': 'workout.dayTypeLegs',
  'Cardio': 'workout.dayTypeCardio',
  'Movilidad': 'workout.dayTypeMovilidad',
  'Yoga / Recovery': 'workout.dayTypeYoga',
};

export function translateDayLabel(
  label: string,
  t: (k: TranslationKey) => string,
): string {
  const key = DAY_LABEL_KEY[label];
  return key ? t(key) : label;
}
