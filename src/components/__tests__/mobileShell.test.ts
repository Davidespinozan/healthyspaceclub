import { describe, it, expect } from 'vitest';
import cssSrc from '../../index.css?raw';
import clubCss from '../tab-club.css?raw';
import dashSrc from '../../screens/DashboardScreen.tsx?raw';

// ═══════════════════════════════════════════════════════════════════════════
// PROD-REGRESSION-1 · MOBILE-SHELL-P0 · invariantes estructurales/estilo del shell.
// jsdom no puede probar el scroll real de Safari; probamos las declaraciones que
// FALLARÍAN contra el modelo viejo (documento como scroller + nav frágil + Club
// con 100dvh y padding duplicado).
// ═══════════════════════════════════════════════════════════════════════════

function block(css: string, selector: string): string {
  // Extrae el PRIMER bloque `selector { ... }` (sin anidar) para acotar las aserciones.
  const i = css.indexOf(selector + ' {');
  if (i < 0) return '';
  const start = css.indexOf('{', i);
  const end = css.indexOf('}', start);
  return css.slice(start, end + 1);
}

// ── TEST 1 · shell acotado al viewport dinámico ──────────────────────────────
describe('1 · shell acotado (viewport dinámico, no solo min-height)', () => {
  it('.app-shell usa height:100dvh (con fallback 100vh)', () => {
    const b = block(cssSrc, '.app-shell');
    expect(b).toMatch(/height:\s*100dvh/);
    expect(b).toMatch(/height:\s*100vh/);            // fallback
    // Ya NO depende solo de min-height (el modelo viejo).
    expect(b).not.toMatch(/min-height:\s*100dvh/);
    expect(b).not.toMatch(/-webkit-fill-available/);
  });
});

// ── TEST 2 · app-main es el scroller primario y puede encoger ────────────────
describe('2 · app-main = scroller primario', () => {
  it('.app-main tiene flex, min-height:0 y overflow-y:auto', () => {
    const b = block(cssSrc, '.app-main');
    expect(b).toMatch(/flex:\s*1/);
    expect(b).toMatch(/min-height:\s*0/);            // clave: permite encoger → overflow activa
    expect(b).toMatch(/overflow-y:\s*auto/);
  });
});

// ── TEST 3 · nav fijo, sin dependencia de scroll de documento ────────────────
describe('3 · bottom nav fijo', () => {
  it('.bnav es position:fixed; bottom:0', () => {
    const b = block(cssSrc, '.bnav');
    expect(b).toMatch(/position:\s*fixed/);
    expect(b).toMatch(/bottom:\s*0/);
  });
});

// ── TEST 4 · limpieza de nav: UNA sola autoridad = .app-main ─────────────────
describe('4 · limpieza del nav en app-main (autoridad única)', () => {
  it('.app-main reserva 64px + safe-area-inset-bottom', () => {
    const b = block(cssSrc, '.app-main');
    expect(b).toMatch(/padding[^;]*64px[^;]*env\(safe-area-inset-bottom/);
  });
});

// ── TEST 5 · Club sin 100dvh ni padding de safe-area duplicado ───────────────
describe('5 · Club ya no duplica viewport-height ni nav-padding', () => {
  it('.clb-wrap sin min-height:100dvh y sin safe-area-inset-bottom en su padding', () => {
    const b = block(clubCss, '.clb-wrap');
    expect(b).not.toMatch(/min-height:\s*100dvh/);
    expect(b).not.toMatch(/env\(safe-area-inset-bottom/);   // el nav-clearance lo posee .app-main
    expect(b).toMatch(/background:\s*var\(--sala-bg\)/);     // fondo intacto (== --cream, sin costura)
  });
});

// ── TEST 6 · estructura de navegación intacta ────────────────────────────────
describe('6 · estructura de rutas de navegación sin cambios', () => {
  it('DashboardScreen sigue renderizando <nav className="bnav"> con las tabs y navTo', () => {
    expect(dashSrc).toMatch(/<nav className="bnav">/);
    expect(dashSrc).toMatch(/className=\{`bnav-item/);
    expect(dashSrc).toMatch(/function navTo\(page: DashPage\)/);
    // navTo resetea el nuevo scroller (.app-main), no solo el documento.
    expect(dashSrc).toMatch(/querySelector\('\.app-main'\)\?\.scrollTo\(0, 0\)/);
  });
});
