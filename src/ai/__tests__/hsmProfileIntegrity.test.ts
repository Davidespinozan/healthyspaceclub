import { describe, it, expect } from 'vitest';
import { buildHSMProfilePrompt } from '../prompts/hsmProfile';

// REFLECTION-P1-A · el prompt del perfil ya no se auto-valida: el perfil anterior
// entra como HIPÓTESIS PREVIA (no evidencia) y la evidencia actual manda.

const RECENT = '[2026-08-20] Disciplina: "quiero constancia"\n[2026-08-22] Metas: "avancé en el proyecto"';
const SIGNALS = '- Actividad: 5 reflexión(es) en 30d · 12 en 90d · 12 en total.\n- Dimensiones en 30d: Disciplina 3 · Metas 2.';

describe('§17 · self-seeding break', () => {
  const prior = 'El usuario evita sistemáticamente el conflicto.';
  const p = buildHSMProfilePrompt(prior, RECENT, SIGNALS);

  it('el perfil anterior aparece SOLO bajo la sección de hipótesis previa etiquetada', () => {
    expect(p).toMatch(/HIPÓTESIS PREVIA — NO ES EVIDENCIA/);
    // el texto previo existe, pero después del marcador de hipótesis (no en EVIDENCIA ACTUAL)
    const idxMarker = p.indexOf('HIPÓTESIS PREVIA — NO ES EVIDENCIA');
    const idxPrior = p.indexOf(prior);
    expect(idxPrior).toBeGreaterThan(idxMarker);
    // no aparece dentro del bloque de evidencia actual (antes del marcador)
    expect(p.slice(0, idxMarker)).not.toContain(prior);
  });
  it('reglas de integridad presentes', () => {
    expect(p).toMatch(/NO es evidencia/i);
    expect(p).toMatch(/RE-GANARSE con la evidencia actual/i);
    expect(p).toMatch(/ELIMÍNALA/);                       // afirmaciones sin apoyo se eliminan
    expect(p).toMatch(/Repetir una inferencia anterior NO aumenta su certeza/i);
    expect(p).toMatch(/ausencia de evidencia en evidencia/i);
    expect(p).toMatch(/No diagnostiques/i);
    expect(p).toMatch(/causalidad sin evidencia/i);
  });
  it('la sección de EVIDENCIA ACTUAL no contiene la afirmación previa fabricada', () => {
    const evidence = p.slice(p.indexOf('EVIDENCIA ACTUAL'), p.indexOf('HIPÓTESIS PREVIA'));
    expect(evidence).not.toContain('evita sistemáticamente el conflicto');
    expect(evidence).toContain('quiero constancia');    // sí la evidencia real
  });
});

describe('§18 · current evidence wins', () => {
  it('el prompt da autoridad a la evidencia actual sobre la hipótesis previa', () => {
    const p = buildHSMProfilePrompt('El usuario es muy indisciplinado.', RECENT, SIGNALS);
    expect(p).toMatch(/la evidencia actual manda sobre la hipótesis previa/i);
    expect(p).toMatch(/Si la evidencia actual la contradice, ACTUALÍZALA/i);
    expect(p).not.toMatch(/preserva la continuidad|mantén el perfil anterior/i); // NO preservar a ciegas
  });
});

describe('§11 · prior-profile handling (Option A)', () => {
  it('sin perfil previo → sin sección de hipótesis previa', () => {
    const p = buildHSMProfilePrompt('Sin perfil previo.', RECENT, SIGNALS);
    expect(p).not.toMatch(/HIPÓTESIS PREVIA/);
  });
  it('sin señales → prompt válido sin bloque de señales (no inventa)', () => {
    const p = buildHSMProfilePrompt('Sin perfil previo.', RECENT);
    expect(p).not.toMatch(/SEÑALES LONGITUDINALES OBSERVABLES/);
    expect(p).toMatch(/EVIDENCIA ACTUAL/);
  });
  it('con señales → bloque de señales presente', () => {
    const p = buildHSMProfilePrompt('Sin perfil previo.', RECENT, SIGNALS);
    expect(p).toMatch(/SEÑALES LONGITUDINALES OBSERVABLES/);
    expect(p).toContain('Disciplina 3');
  });
});
