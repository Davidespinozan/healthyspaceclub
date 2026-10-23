import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import appSrc from '../../App.tsx?raw';
import v1Src from '../../screens/LandingScreen.tsx?raw';
import v2Src from '../../screens/LandingScreenV2.tsx?raw';
import v2Css from '../../screens/landing-v2.css?raw';
import { LANDING_VERSION } from '../../constants/landing';
import LandingScreen from '../../screens/LandingScreen';
import LandingScreenV2 from '../../screens/LandingScreenV2';

// ═══════════════════════════════════════════════════════════════════════════
// D.1 · Landing pública: V2 por defecto con una sola palanca (constants/landing.ts),
// V1 intacta y recuperable, sin query, sin flag de entorno y sin herramientas internas.
// ═══════════════════════════════════════════════════════════════════════════

describe('selección de landing', () => {
  it('V2 es la landing por defecto', () => {
    expect(LANDING_VERSION).toBe('v2');
  });

  it('App elige la landing solo con LANDING_VERSION (sin ?landing= ni import.meta.env.DEV)', () => {
    expect(appSrc).toMatch(/import \{ LANDING_VERSION \} from '\.\/constants\/landing'/);
    expect(appSrc).toMatch(/const isLandingV2 = LANDING_VERSION === 'v2';/);
    expect(appSrc).toMatch(/const Landing = isLandingV2 \? LandingScreenV2 : LandingScreen;/);
    expect(appSrc).not.toMatch(/get\('landing'\)/);
    expect(appSrc).not.toMatch(/import\.meta\.env\.DEV[\s\S]{0,80}LandingScreenV2/);
  });

  it('el scope de V2 solo se aplica cuando V2 está activa', () => {
    expect(appSrc).toMatch(/\$\{isLandingV2 \? ' hsc-lv2-scope' : ''\}/);
  });
});

describe('V2 sin herramientas internas', () => {
  it('no monta ni importa el explorador de medios', () => {
    expect(v2Src).not.toMatch(/mediaReview|MediaReview|landingV2MediaReview/);
    expect(v2Src).not.toMatch(/import\.meta\.env\.DEV/);
    expect(v2Css).not.toMatch(/lv2-mr/);
  });

  it('todas las reglas de landing-v2.css van bajo .hsc-lv2-scope (V1 y la app no se ven afectadas)', () => {
    const css = v2Css.replace(/\/\*[\s\S]*?\*\//g, '');
    const unscoped = [...css.matchAll(/([^{};]+)\{/g)]
      .map((m) => m[1].trim())
      .filter((sel) => sel && !sel.startsWith('@') && !/^(from|to|\d+%)(\s*,\s*(from|to|\d+%))*$/.test(sel))
      .filter((sel) => sel.split(',').some((part) => !part.includes('.hsc-lv2-scope')));
    expect(unscoped).toEqual([]);
  });
});

describe('V1 se conserva', () => {
  // jsdom no trae IntersectionObserver (lo usan las animaciones de aparición).
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  });
  afterAll(() => { vi.unstubAllGlobals(); });

  it('mantiene sus propios logos (no usa la marca V2)', () => {
    expect(v1Src).toMatch(/logohscisotipo\.webp/);
    expect(v1Src).toMatch(/logohscprincipalsinfondo\.webp/);
    expect(v1Src).not.toMatch(/constants\/brand/);
  });

  it('V1 y V2 montan de forma independiente', () => {
    const one = render(<LandingScreen />);
    expect(one.container.querySelector('.hero')).not.toBeNull();
    cleanup();
    const two = render(<div className="hsc-lv2-scope"><LandingScreenV2 /></div>);
    expect(two.container.querySelector('.hero')).not.toBeNull();
    expect(two.container.querySelector('.pcard.feat')).not.toBeNull();
    cleanup();
  });
});
