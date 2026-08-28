import { describe, it, expect } from 'vitest';
import { buildShareMoments, type ShareInput, type TFn } from '../shareMoments';
import momentsSrc from '../shareMoments.ts?raw';
import overlaySrc from '../photoOverlay.ts?raw';
import studioSrc from '../../components/ShareStudio.tsx?raw';

// ═══════════════════════════════════════════════════════════════════════════
// SHARE-2 · VISUAL POLISH P0 · pruebas del lenguaje factual + compositor acotado.
// jsdom NO tiene backend de canvas → el layout se prueba por source-scan (mismo
// patrón que §29-C/D), y la copy por el motor puro buildShareMoments.
// ═══════════════════════════════════════════════════════════════════════════

const t: TFn = (k) => k;                       // mock determinista: devuelve la key
const build = (i: ShareInput) => buildShareMoments(i, t);

const BANNED = /primer brote|brote|germinar|florec|raí[cz]|imparable|leyenda|guerrero|m[aá]quina|despegando|first sprout|sprout|unstoppable|legend/i;

// ── A/B · sin nombres de logro inventados en el PATH ACTIVO de Share ──────────
describe('A/B · lenguaje de logro factual (sin metáfora)', () => {
  it('el momento de racha NO usa metáfora: título factual, sin subtítulo largo', () => {
    const m = build({ streakCount: 3 }).find(x => x.kind === 'streak_milestone')!;
    expect(m).toBeTruthy();
    expect(m.title).toBe('sstudio.streak');                 // kicker factual (mock key)
    expect(m.subtitle).toBeUndefined();                     // ex "El hábito empezó a germinar" → eliminado
    expect(JSON.stringify(m)).not.toMatch(BANNED);
  });
  it('shareMoments.ts ya NO importa getMilestoneCopy (la metáfora vivía ahí)', () => {
    const imports = momentsSrc.split('\n').filter(l => /^\s*import\b/.test(l)).join('\n');
    expect(imports).not.toMatch(/getMilestoneCopy/);
    expect(imports).toMatch(/MILESTONE_STEPS/);             // autoridad de hitos: intacta
  });
  it('ningún archivo ACTIVO de Share contiene lenguaje de logro inventado', () => {
    expect(momentsSrc).not.toMatch(BANNED);
    expect(overlaySrc).not.toMatch(BANNED);
    expect(studioSrc).not.toMatch(BANNED);
  });
});

// ── C · lienzo 1080×1920 sin cambios ─────────────────────────────────────────
describe('C · dimensiones del story', () => {
  it('composeShareImage sigue en 1080×1920', () => {
    expect(overlaySrc).toMatch(/const W = 1080, H = 1920/);
  });
});

// ── D · cada estilo tiene configuración de layout DISTINTA ────────────────────
describe('D · tres personalidades genuinamente distintas', () => {
  it('NÚMERO = centrado/simétrico; EDITORIAL = peso ligero + regla; OSCURO = anclado abajo', () => {
    // NÚMERO: número centrado
    expect(overlaySrc).toMatch(/style === 'stat'[\s\S]*?ctx\.textAlign = 'center'[\s\S]*?fillText\(art\.stat\.big, cx/);
    // EDITORIAL: peso 300 (ligero) + regla de hilo dorada
    expect(overlaySrc).toMatch(/style === 'editorial'[\s\S]*?`300 \$\{numPx\}px/);
    expect(overlaySrc).toMatch(/fillRect\(PAD, topY \+ 44, 120, 3\)/);   // hairline rule
    // OSCURO (else): anclado abajo con número pesado 800, fuera de la zona de UI
    expect(overlaySrc).toMatch(/fillText\(art\.stat\.big, PAD, H - 220\)/);
  });
});

// ── E/F · texto dinámico ACOTADO + márgenes seguros ──────────────────────────
describe('E/F · texto acotado (imposible desbordar)', () => {
  it('existe sistema fit/wrap y ancho seguro maxW = W - 2·PAD', () => {
    expect(overlaySrc).toMatch(/function fitFontPx/);
    expect(overlaySrc).toMatch(/function wrapLines/);
    expect(overlaySrc).toMatch(/function drawHeadline/);
    expect(overlaySrc).toMatch(/const maxW = W - PAD \* 2/);
    // El subtítulo largo YA NO se dibuja con trackedLeft sin límite (bug de overflow).
    expect(overlaySrc).not.toMatch(/trackedLeft\(ctx, art\.subtitle/);
  });
  it('el footer-tagline obligatorio fue eliminado (no es anuncio)', () => {
    expect(overlaySrc).not.toMatch(/trackedLeft\(ctx, art\.tagline/);
  });
});

// ── G/H · valores numéricos representativos ──────────────────────────────────
describe('G/H · números de hito válidos y factuales', () => {
  // La AUTORIDAD (MILESTONE_STEPS = 3,7,14,30,60,90,180,365) es intacta: el momento
  // muestra el HITO alcanzado, no el streak crudo. 3/30/90 son hitos reales.
  for (const n of [3, 30, 90]) {
    it(`streak ${n} → stat.big="${n}", label factual, sin metáfora`, () => {
      const m = build({ streakCount: n }).find(x => x.kind === 'streak_milestone')!;
      expect(m.stat).toEqual({ big: String(n), label: 'sstudio.streakLabel' });
      expect(JSON.stringify(m)).not.toMatch(BANNED);
    });
  }
  it('streak 100 → muestra el hito alcanzado (90), autoridad MILESTONE_STEPS intacta', () => {
    const m = build({ streakCount: 100 }).find(x => x.kind === 'streak_milestone')!;
    expect(m.stat!.big).toBe('90');
  });
  it('workout (min) y duo (días) siguen produciendo stat numérico', () => {
    const w = build({ streakCount: 1, todayWorkout: { modality: 'fuerza', durationMinutes: 52 } }).find(x => x.kind === 'workout')!;
    expect(w.stat).toEqual({ big: '52', label: 'sstudio.min' });
    const d = build({ streakCount: 5, duo: { days: 12 } }).find(x => x.kind === 'duo')!;
    expect(d.stat).toEqual({ big: '12', label: 'sstudio.togetherLabel' });
  });
});

// ── I · foto opcional sigue componiendo ──────────────────────────────────────
describe('I · rama de foto intacta', () => {
  it('composeShareImage conserva rama con-foto y sin-foto', () => {
    expect(overlaySrc).toMatch(/if \(photo\)/);
    expect(overlaySrc).toMatch(/forest|forestDeep|gradiente de marca/i);
    expect(overlaySrc).toMatch(/Dim uniforme|rgba\(6,20,16,0\.30\)/);   // legibilidad en foto para todos los estilos
  });
});

// ── J/K · privacidad + autoridad de ShareMoment sin cambios ──────────────────
describe('J/K · privacidad y autoridad intactas', () => {
  it('kinds de ShareMoment sin cambios (sin nuevos tipos)', () => {
    expect(momentsSrc).toMatch(/'showed_up' \| 'workout' \| 'cardio' \| 'streak_milestone' \| 'streak'/);
    expect(momentsSrc).toMatch(/'week_complete' \| 'comeback' \| 'duo' \| 'program_milestone'/);
  });
  it('proyección de privacidad: sin campos prohibidos en el momento', () => {
    const m = build({ streakCount: 30, todayWorkout: { modality: 'fuerza', durationMinutes: 52, totalVolumeKg: 8000 }, duo: { days: 12 } });
    const blob = JSON.stringify(m).toLowerCase();
    for (const bad of ['email', 'reflection', 'coach', 'kcal', 'macro', 'injury', 'readiness', 'partner', 'weight', '@']) {
      expect(blob).not.toContain(bad);
    }
  });
});

// ── L · flujo de share nativo sin cambios ────────────────────────────────────
describe('L · native share sin cambios', () => {
  it('shareImage sigue usando Web Share + fallback descarga/clipboard', () => {
    expect(overlaySrc).toMatch(/export async function shareImage/);
    expect(overlaySrc).toMatch(/nav\.share/);
    expect(overlaySrc).toMatch(/navigator\.clipboard/);
  });
});
