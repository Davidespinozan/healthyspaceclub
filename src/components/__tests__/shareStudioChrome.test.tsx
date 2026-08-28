import { describe, it, expect } from 'vitest';
import cssSrc from '../share-studio.css?raw';
import studioSrc from '../ShareStudio.tsx?raw';
import overlaySrc from '../../utils/photoOverlay.ts?raw';
import momentsSrc from '../../utils/shareMoments.ts?raw';

// ═══════════════════════════════════════════════════════════════════════════
// PROD-REGRESSION-1 · SHARE-STUDIO-CHROME-P0 · invariantes del sheet móvil.
// jsdom no puede probar el viewport real de Safari; se prueban las declaraciones
// que FALLARÍAN contra el modelo viejo (94vh + preview rígida 56vh + único scroller
// que dejaba "Añadir foto"/"Compartir" fuera de la vista).
// ═══════════════════════════════════════════════════════════════════════════

function block(css: string, selector: string): string {
  const i = css.indexOf(selector + ' {');
  if (i < 0) return '';
  const start = css.indexOf('{', i);
  const end = css.indexOf('}', start);
  return css.slice(start, end + 1);
}

// ── TEST 1 · sheet acotado al viewport pequeño (svh), no 94vh frágil ─────────
describe('1 · sheet acotado a viewport pequeño', () => {
  it('.ssx usa svh (con fallback vh) y ya no 94vh + overflow-y:auto propio', () => {
    const b = block(cssSrc, '.ssx');
    expect(b).toMatch(/max-height:\s*92svh/);
    expect(b).toMatch(/max-height:\s*92vh/);        // fallback
    expect(b).not.toMatch(/max-height:\s*94vh/);    // modelo viejo eliminado
    expect(b).toMatch(/overflow:\s*hidden/);        // el sheet NO scrollea (lo hace el body)
  });
});

// ── TEST 2 · layout flex: cuerpo encoge/scrollea, acciones no ────────────────
describe('2 · cuerpo scrollable + acciones fijas', () => {
  it('.ssx-body tiene flex + min-height:0 + overflow-y:auto', () => {
    const b = block(cssSrc, '.ssx-body');
    expect(b).toMatch(/flex:\s*1/);
    expect(b).toMatch(/min-height:\s*0/);
    expect(b).toMatch(/overflow-y:\s*auto/);
  });
  it('.ssx-actions no se encoge (flex-shrink:0)', () => {
    expect(block(cssSrc, '.ssx-actions')).toMatch(/flex-shrink:\s*0/);
  });
});

// ── TEST 3 · alcanzabilidad estructural: acciones FUERA del cuerpo scrollable ─
describe('3 · acciones alcanzables (fuera del scroller)', () => {
  it('en el JSX, .ssx-actions es hermano de .ssx-body (no anidado dentro)', () => {
    const bodyIdx = studioSrc.indexOf('className="ssx-body"');
    const bodyClose = studioSrc.indexOf('{/* ACCIONES', bodyIdx);
    const actionsIdx = studioSrc.indexOf('className="ssx-actions"');
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(actionsIdx).toBeGreaterThan(bodyIdx);
    // El comentario de ACCIONES aparece después del cuerpo → acciones fuera del body.
    expect(bodyClose).toBeGreaterThan(-1);
    expect(actionsIdx).toBeGreaterThan(bodyClose);
    // Ambos botones existen dentro de las acciones.
    expect(studioSrc).toMatch(/sstudio\.addPhoto/);
    expect(studioSrc).toMatch(/post\.shareCardCta/);
  });
});

// ── TEST 4 · preview 9:16 acotada/encogible ──────────────────────────────────
describe('4 · preview 9:16 con límites (puede encoger)', () => {
  it('.ssx-preview-wrap mantiene aspect-ratio 9/16 y usa svh + max-height', () => {
    const b = block(cssSrc, '.ssx-preview-wrap');
    expect(b).toMatch(/aspect-ratio:\s*9\s*\/\s*16/);
    expect(b).toMatch(/height:\s*min\(48svh/);
    expect(b).toMatch(/max-height:\s*100%/);
    expect(b).not.toMatch(/height:\s*min\(56vh,\s*520px\)/);  // rígido viejo movido a desktop
  });
});

// ── TEST 5 · safe-area en el sheet (footer respeta home indicator) ───────────
describe('5 · safe-area', () => {
  it('.ssx incluye env(safe-area-inset-bottom) en su padding inferior', () => {
    expect(block(cssSrc, '.ssx')).toMatch(/padding:[^;]*env\(safe-area-inset-bottom\)/);
  });
});

// ── TEST 6 · path de Share protegido sin cambios ─────────────────────────────
describe('6 · ShareMoment/compositor/referral/privacidad intactos', () => {
  it('compositor sigue 1080×1920', () => {
    expect(overlaySrc).toMatch(/const W = 1080, H = 1920/);
  });
  it('kinds de ShareMoment sin cambios', () => {
    expect(momentsSrc).toMatch(/'showed_up' \| 'workout' \| 'cardio' \| 'streak_milestone' \| 'streak'/);
  });
  it('el studio conserva referral (profileLink) + shareImage', () => {
    expect(studioSrc).toMatch(/profileLink\(username\)/);
    expect(studioSrc).toMatch(/shareImage\(/);
  });
  it('a11y preservada: role=dialog, aria-modal, Escape, picker solo por botón', () => {
    expect(studioSrc).toMatch(/role="dialog"/);
    expect(studioSrc).toMatch(/aria-modal="true"/);
    expect(studioSrc).toMatch(/e\.key === 'Escape'/);
    expect(studioSrc).toMatch(/onClick=\{\(\) => inputRef\.current\?\.click\(\)\}/);
  });
});
