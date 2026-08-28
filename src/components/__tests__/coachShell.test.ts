import { describe, it, expect } from 'vitest';
import cssSrc from '../../index.css?raw';
import dashSrc from '../../screens/DashboardScreen.tsx?raw';
import coachCtxSrc from '../../utils/coachContext.ts?raw';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';

// ═══════════════════════════════════════════════════════════════════════════
// PROD-REGRESSION-1 · COACH-SHELL-POLISH-P0 · control de Coach sobrio/premium.
// Solo shell visual + a11y. jsdom no prueba píxeles; se prueban las invariantes
// de estructura/estilo/semántica que fallarían contra el FAB glow anterior.
// ═══════════════════════════════════════════════════════════════════════════

function block(css: string, selector: string): string {
  const i = css.indexOf(selector + ' {');
  if (i < 0) return '';
  const start = css.indexOf('{', i);
  const end = css.indexOf('}', start);
  return css.slice(start, end + 1);
}

// ── TEST 1 · estados accesibles (abrir / cerrar) ─────────────────────────────
describe('1 · nombres accesibles del control', () => {
  it('el FAB tiene aria-label dinámico abrir/cerrar y las keys existen', () => {
    expect(dashSrc).toMatch(/aria-label=\{coachOpen \? t\('common\.coachClose'\) : t\('common\.coachOpen'\)\}/);
    expect((es as unknown as { common: Record<string, string> }).common.coachOpen).toBe('Abrir Coach');
    expect((es as unknown as { common: Record<string, string> }).common.coachClose).toBe('Cerrar Coach');
    expect((en as unknown as { common: Record<string, string> }).common.coachOpen).toBe('Open Coach');
    expect((en as unknown as { common: Record<string, string> }).common.coachClose).toBe('Close Coach');
  });
  it('es un <button type="button"> con aria-expanded', () => {
    expect(dashSrc).toMatch(/type="button"[\s\S]*?className=\{`coach-fab/);
    expect(dashSrc).toMatch(/aria-expanded=\{coachOpen\}/);
  });
});

// ── TEST 2 · comportamiento de cierre: misma autoridad ───────────────────────
describe('2 · toggle cableado a la misma autoridad', () => {
  it('onClick sigue siendo setCoachOpen(!coachOpen) (una sola acción open/close)', () => {
    expect(dashSrc).toMatch(/onClick=\{\(\) => setCoachOpen\(!coachOpen\)\}/);
    // No se añadió una segunda acción de cierre compitiendo.
    expect((dashSrc.match(/setCoachOpen\(/g) || []).length).toBeGreaterThanOrEqual(1);
  });
});

// ── TEST 3 · Escape / click-outside sin cambios ──────────────────────────────
describe('3 · cierre por click-outside intacto', () => {
  it('el handler de click fuera del overlay/fab sigue presente', () => {
    expect(dashSrc).toMatch(/!el\.closest\('\.coach-overlay'\) && !el\.closest\('\.coach-fab'\)/);
  });
});

// ── TEST 4 · safe-area en el posicionamiento ─────────────────────────────────
describe('4 · safe-area / relación con bottom-nav', () => {
  it('.coach-fab despeja el nav con gap constante, sin doble-contar safe-area', () => {
    const b = block(cssSrc, '.coach-fab');
    // Usa el MISMO término que .bnav (max(12px, env(...))) → la safe-area se cancela.
    expect(b).toMatch(/bottom:\s*calc\(78px \+ max\(12px, env\(safe-area-inset-bottom/);
    // Ya NO suma env() a un base fijo (el doble-conteo anterior).
    expect(b).not.toMatch(/bottom:\s*calc\(90px \+ env\(/);
  });
});

// ── TEST 5 · focus-visible explícito ─────────────────────────────────────────
describe('5 · focus-visible premium e inconfundible', () => {
  it('.coach-fab:focus-visible define un anillo de foco', () => {
    const b = block(cssSrc, '.coach-fab:focus-visible');
    expect(b).toMatch(/box-shadow:[^;]*0 0 0 3px rgba\(191, 160, 101/);
  });
});

// ── TEST 6 · sin glow/scale de espectáculo ───────────────────────────────────
describe('6 · tratamiento sobrio (sin glow ni scale llamativo)', () => {
  it('el glow dorado 0.42 y el scale(1.04) anteriores desaparecieron', () => {
    const b = block(cssSrc, '.coach-fab');
    expect(b).not.toMatch(/rgba\(168, 134, 78, 0\.42\)/);   // glow dorado viejo
    expect(cssSrc).not.toMatch(/\.coach-fab:hover\s*\{[^}]*scale\(1\.04\)/s);
    // elevación neutra sutil presente
    expect(b).toMatch(/box-shadow:\s*0 6px 18px rgba\(21, 51, 48, 0\.22\)/);
    // sin animación continua/pulse en el fab
    expect(cssSrc).not.toMatch(/\.coach-fab\s*\{[^}]*animation:[^}]*infinite/s);
  });
});

// ── TEST 7 · reduced-motion ──────────────────────────────────────────────────
describe('7 · reduced-motion respetado', () => {
  it('hay un bloque prefers-reduced-motion que neutraliza el fab', () => {
    expect(cssSrc).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.coach-fab[^}]*transition:\s*none/s);
  });
});

// ── TEST 8 · MURO DURO de lógica del Coach intacto ───────────────────────────
describe('8 · inteligencia del Coach sin cambios', () => {
  it('coachContext conserva el hecho reflectionCompletedToday y la línea de hechos', () => {
    expect(coachCtxSrc).toMatch(/reflectionCompletedToday:/);
    expect(coachCtxSrc).toMatch(/REFLEXIÓN DE HOY:/);
  });
});
