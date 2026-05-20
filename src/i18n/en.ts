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
  milestones: {
    d3:   { title: 'Three days', sub: 'The habit is taking root' },
    d7:   { title: 'One week',   sub: 'Consistency takes shape' },
    d14:  { title: 'Two weeks',  sub: 'Your body begins to feel the shift' },
    d30:  { title: 'One month',  sub: "Now it's part of you" },
    d60:  { title: 'Two months', sub: 'True discipline' },
    d90:  { title: 'A season',   sub: 'Few come this far' },
    d180: { title: 'Six months', sub: 'A deep transformation' },
    d365: { title: 'One year',   sub: 'Mastery' },
    labelD365: '1y',
  },
} as const;
