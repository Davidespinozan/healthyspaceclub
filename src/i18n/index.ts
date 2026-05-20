// i18n custom liviano para HSC — sin librerías externas.
// Resolver de idioma (en orden de prioridad):
//   1. store.language (si languageSetByUser === true, el user lo eligió)
//   2. navigator.language (si empieza con 'en' → 'en', 'es' → 'es')
//   3. fallback: 'es'
//
// API:
//   const { t, locale } = useT();
//   t('settings.language')                       → 'Idioma' | 'Language'
//   t('milestones.next', { days: 7 })            → interpola {days} en el string
//
// Si la key no existe en el locale actual, fallback al otro locale.
// Si tampoco existe, retorna la key misma (útil para detectar faltantes en dev).

import { useAppStore, type AppLanguage } from '../store';
import { es, type TranslationKey, type Translations } from './es';
import { en } from './en';

type Dict = Translations<typeof es>;
const DICTS: Record<AppLanguage, Dict> = { es, en };

// Detecta el idioma del navegador. Acepta 'en-US', 'en-GB', 'es-ES', 'es-MX', etc.
// En Capacitor iOS, navigator.language puede devolver el locale del sistema
// (ej. 'es' o 'en') — el startsWith() lo cubre. Si devuelve algo más exótico
// (ej. 'pt'), cae al fallback 'es'.
export function detectBrowserLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'es';
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('es')) return 'es';
  return 'es';
}

// Resolver de idioma inicial. Se llama en bootstrap (App.tsx) para sobrescribir
// el default 'es' del store SI el user no eligió manualmente todavía.
export function resolveInitialLanguage(): AppLanguage {
  const state = useAppStore.getState();
  if (state.languageSetByUser) return state.language;
  return detectBrowserLanguage();
}

// Navega un dict por dot-notation. 'settings.language' → dict.settings.language.
function lookup(dict: Dict, key: string): string | undefined {
  const parts = key.split('.');
  let cursor: unknown = dict;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && part in cursor) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

// Interpola {key} en el string con los valores del objeto params.
function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

export function useT(): {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  locale: AppLanguage;
} {
  const locale = useAppStore(s => s.language);
  const dict = DICTS[locale];
  const fallbackDict = DICTS[locale === 'es' ? 'en' : 'es'];

  function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const raw = lookup(dict, key) ?? lookup(fallbackDict, key) ?? key;
    return params ? interpolate(raw, params) : raw;
  }

  return { t, locale };
}
