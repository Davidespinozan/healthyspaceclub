import { describe, it, expect } from 'vitest';
import { classifySafety, suppressesNormalReview, excludedFromAIContext } from '../hsmSafety';

// MINDSET-1 · el contrato de seguridad es el más delicado: el malestar ORDINARIO
// nunca es URGENT; URGENT exige intención/medio explícito e inmediato.
describe('MINDSET-1 · classifySafety — NORMAL (malestar ordinario)', () => {
  const normals = [
    'Hoy estoy triste.',
    'Estoy harto del trabajo.',
    'No tengo motivación.',
    'Quiero rendirme con la dieta.',
    'Tuve un día horrible.',
    'Estoy cansado y estresado.',
    'Me frustré en el gym hoy.',
    'I had a terrible day and I feel down.',
    'I want to quit my diet, no motivation at all.',
    '', '   ',
  ];
  for (const t of normals) {
    it(`NORMAL: ${JSON.stringify(t.slice(0, 32))}`, () => expect(classifySafety(t)).toBe('NORMAL'));
  }
});

describe('MINDSET-1 · classifySafety — CONCERNING (desesperanza sin medio inmediato)', () => {
  const concerning = [
    'Ya no le veo sentido a nada, me siento sin esperanza.',
    'Quiero desaparecer, todo está perdido.',
    'Siento que estarían mejor sin mí.',
    'I feel hopeless and there is no way out.',
    'Honestly I want to die sometimes, nothing matters anymore.',
    'No hay salida, la vida no tiene sentido.',
  ];
  for (const t of concerning) {
    it(`CONCERNING: ${JSON.stringify(t.slice(0, 32))}`, () => expect(classifySafety(t)).toBe('CONCERNING'));
  }
});

describe('MINDSET-1 · classifySafety — URGENT (intención/medio explícito inmediato)', () => {
  const urgent = [
    'Quiero matarme.',
    'Me voy a quitar la vida esta noche.',
    'Voy a suicidarme.',
    'Estoy pensando en cortarme.',
    'Tengo un plan para matarme.',
    'I want to kill myself tonight.',
    'I am going to end my life.',
    'I keep thinking about hurting myself and I have a plan to end it.',
  ];
  for (const t of urgent) {
    it(`URGENT: ${JSON.stringify(t.slice(0, 32))}`, () => expect(classifySafety(t)).toBe('URGENT'));
  }
});

describe('MINDSET-1 · classifySafety — robustez', () => {
  it('nunca lanza (entradas raras) → default NORMAL', () => {
    // @ts-expect-error probar entradas no-string
    expect(classifySafety(null)).toBe('NORMAL');
    // @ts-expect-error
    expect(classifySafety(undefined)).toBe('NORMAL');
    // @ts-expect-error
    expect(classifySafety(12345)).toBe('NORMAL');
  });
  it('URGENT domina si aparece junto a texto ordinario', () => {
    expect(classifySafety('Tuve un día normal pero quiero matarme.')).toBe('URGENT');
  });
  it('flags de gating', () => {
    expect(suppressesNormalReview('URGENT')).toBe(true);
    expect(suppressesNormalReview('CONCERNING')).toBe(false);
    expect(excludedFromAIContext('URGENT')).toBe(true);
    expect(excludedFromAIContext('NORMAL')).toBe(false);
  });
});
