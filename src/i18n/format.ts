// Format helpers locale-aware. No dependen del store directamente — el caller
// pasa el locale (lo obtiene de useT()). Esto los hace puros y testeables.

import type { AppLanguage } from '../store';

const LOCALE_MAP: Record<AppLanguage, string> = {
  es: 'es-ES',
  en: 'en-US',
};

export function formatDate(
  date: string | Date,
  locale: AppLanguage,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE_MAP[locale], options);
}

// Plural helper minimal: solo 2 formas (one/other). No ICU plural rules.
// Si en el futuro necesitás "few/many" para otros idiomas, ahí migrás a ICU.
export function plural(
  count: number,
  opts: { one: string; other: string },
): string {
  return count === 1 ? opts.one : opts.other;
}
