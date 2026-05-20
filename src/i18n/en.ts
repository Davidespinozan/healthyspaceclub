import type { es, Translations } from './es';

// `en` se tipa con Translations<typeof es> — preserva las keys exactas (si
// olvidás una key, el compilador grita) pero acepta cualquier string en los
// values (no exige el literal de es como 'Guardar').
export const en: Translations<typeof es> = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
  },
  settings: {
    language: 'Language',
    languageEs: 'Spanish',
    languageEn: 'English',
  },
} as const;
