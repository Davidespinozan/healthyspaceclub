// Diccionario español — fuente de verdad del shape de keys.
// en.ts se tipa con `typeof es` para que el compilador detecte faltantes.
// Lote 0: solo skeleton de prueba. Las keys reales se agregan en Lotes 1-7.

export const es = {
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    close: 'Cerrar',
  },
  settings: {
    language: 'Idioma',
    languageEs: 'Español',
    languageEn: 'Inglés',
  },
} as const;

// Helper type para extraer todas las keys anidadas como dot-notation:
// 'common.save' | 'common.cancel' | 'settings.language' | ...
type DotNested<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? DotNested<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type TranslationKey = DotNested<typeof es>;

// Helper: preserva el shape (keys exactas) pero permite cualquier string como
// value. Usado en en.ts para que pueda traducir sin que TS exija el literal de es.
export type Translations<T> = {
  [K in keyof T]: T[K] extends string ? string : Translations<T[K]>;
};
