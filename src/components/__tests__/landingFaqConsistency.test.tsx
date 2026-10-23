import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// El store persiste en localStorage y captura el storage al crearse; en este entorno de
// test no hay uno utilizable, así que se define uno en memoria ANTES de importar el store.
vi.hoisted(() => {
  const m = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => { m.set(k, String(v)); },
      removeItem: (k: string) => { m.delete(k); },
      clear: () => m.clear(),
      key: (i: number) => [...m.keys()][i] ?? null,
      get length() { return m.size; },
    },
  });
});
import { useAppStore } from '../../store';
import LandingScreen from '../../screens/LandingScreen';
import LandingScreenV2 from '../../screens/LandingScreenV2';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';

// ═══════════════════════════════════════════════════════════════════════════
// D.3C + D.3D · FAQ «¿cuándo es el primer cobro?» de V1 y V2. No puede prometer:
//  - que «Mi Plan» muestra la fecha o el importe del primer cobro (muestra el fin de la
//    prueba, D.3B, y no consulta a Stripe el próximo cobro);
//  - una fecha exacta del primer cobro en el checkout: con un código promocional el modal
//    ya no la muestra (D.3 C1) y los importes y fechas dependen de la promoción.
// Se conserva lo verificado: 3 días de prueba y cancelación sin cobro durante la prueba.
// ═══════════════════════════════════════════════════════════════════════════

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
});
afterAll(() => { vi.unstubAllGlobals(); });
afterEach(() => cleanup());

const FINAL = {
  es: 'Antes de activar tu prueba, puedes consultar las condiciones de tu plan y los cobros previstos. '
    + 'Si introduces un código promocional, los importes y las fechas de cobro dependerán de sus condiciones. '
    + 'Si cancelas durante los 3 días de prueba gratuita, no se te cobrará nada. '
    + 'En «Mi Plan», dentro de tu perfil, puedes ver cuándo termina tu prueba gratuita y administrar tu suscripción; '
    + 'los cobros posteriores dependen de las condiciones de tu plan.',
  en: 'Before starting your trial, you can review your plan terms and expected charges. '
    + 'If you enter a promotional code, charge amounts and dates will depend on its terms. '
    + "If you cancel during the 3-day free trial, you won't be charged. "
    + 'In “My Plan”, inside your profile, you can check when your free trial ends and manage your subscription; '
    + 'future charges depend on your plan terms.',
} as const;

const Q = { es: '¿Cómo sé cuándo será el primer cobro?', en: 'How will I know when the first charge happens?' } as const;

// Promesas que ya no pueden aparecer (incondicionales o falsas con promoción).
const FORBIDDEN = [
  /fecha exacta/i, /exact date/i, /fecha prevista de tu primer cobro/i, /scheduled date of your first charge/i,
  /(la encuentras|revisarla) en «Mi Plan»/, /(find it|check it) (in|under) “My Plan”/,
  /[$€]\s?\d/,
];

function faq(container: HTMLElement, q: string): string {
  const item = [...container.querySelectorAll('.fi')].find((el) => el.querySelector('.fi-q')?.textContent?.includes(q));
  return item?.querySelector('.fi-a')?.textContent ?? '';
}

describe.each([
  ['V1', () => <LandingScreen />],
  ['V2', () => <div className="hsc-lv2-scope"><LandingScreenV2 /></div>],
])('FAQ del primer cobro · %s', (_v, ui) => {
  it.each(['es', 'en'] as const)('%s: texto definitivo, sin promesa de fecha exacta ni de Mi Plan', (lang) => {
    useAppStore.setState({ language: lang });
    const { container } = render(ui());
    const a = faq(container, Q[lang]);
    expect(a).toBe(FINAL[lang]);
    for (const re of FORBIDDEN) expect(a).not.toMatch(re);
    // La FAQ sigue teniendo las mismas 4 preguntas.
    expect(container.querySelectorAll('.faq .fi').length).toBe(4);
  });
});

describe('coherencia con PaymentModal con código promocional (D.3 C1)', () => {
  it.each(['es', 'en'] as const)('%s: FAQ y modal dicen lo mismo — con código, importes y fechas dependen de la promoción', (lang) => {
    const dict = lang === 'es' ? es : en;
    // El modal, con código escrito, no anuncia fecha ni importe definitivo…
    expect(dict.pay.promoNote).toMatch(lang === 'es' ? /importe y la fecha de futuros cobros dependerán/ : /amount and date of future charges will depend/);
    expect(dict.pay.promoTrialNote).toMatch(lang === 'es' ? /3 días/ : /3 days/);
    // …y la FAQ explica exactamente eso, sin prometer una fecha concreta.
    expect(FINAL[lang]).toMatch(lang === 'es' ? /importes y las fechas de cobro dependerán de sus condiciones/ : /charge amounts and dates will depend on its terms/);
    expect(FINAL[lang]).toMatch(lang === 'es' ? /durante los 3 días de prueba gratuita/ : /during the 3-day free trial/);
  });
});
