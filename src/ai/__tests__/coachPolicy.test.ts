import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: { auth: {}, from: () => ({}) } }));

import { buildCoachPolicyBlock } from '../coachPolicy';
import { buildCoachSystemPrompt } from '../prompts/coach';
import { useAppStore } from '../../store';

const P = buildCoachPolicyBlock();
const ST = () => useAppStore.getState();
const prompt = (level: 'NORMAL' | 'CONCERNING' = 'NORMAL') => buildCoachSystemPrompt(ST(), 'es', level);

// ─────────────────────────────────────────────────────────────────────────────
// COACH-QUALITY-1 · §16 — PROMPT-INVARIANT ASSERTIONS
// El bloque es política de razonamiento, no un motor. Verificamos que las reglas
// P0 estén presentes (o ausentes, para las que se removieron) en el system prompt.
// ─────────────────────────────────────────────────────────────────────────────

describe('§16 · modos de respuesta', () => {
  const MODES = ['ANSWER', 'EXPLAIN', 'PLAN', 'REFLECT', 'VENT', 'DECIDE', 'CHALLENGE', 'CLARIFY', 'CELEBRATE'];
  it('A · los 9 modos están nombrados en el bloque', () => {
    for (const m of MODES) expect(P).toContain(m);
  });
  it('A2 · los 9 modos llegan al system prompt compuesto', () => {
    const p = prompt();
    for (const m of MODES) expect(p).toContain(m);
  });
  it('A3 · triage silencioso — instrucción de NO imprimir el modo', () => {
    expect(P).toMatch(/EN SILENCIO/i);
    expect(P).toMatch(/no lo imprimas/i);
  });
});

describe('§16 · profundidad adaptativa (reemplaza el tope global)', () => {
  it('B · el tope global "Máximo 3 oraciones" YA NO está en el prompt', () => {
    expect(prompt()).not.toMatch(/Máximo 3 oraciones/i);
  });
  it('B2 · longitud gobernada por el modo, no por un tope fijo', () => {
    expect(P).toMatch(/LONGITUD por el modo/i);
    expect(P).toMatch(/no por un tope fijo/i);
  });
});

describe('§16 · política de listas', () => {
  it('C · la prohibición absoluta "Nunca des listas de 5 puntos" YA NO está', () => {
    expect(prompt()).not.toMatch(/Nunca des listas de 5 puntos/i);
  });
  it('C2 · PLAN permite viñetas breves; prosa por defecto', () => {
    expect(P).toMatch(/viñetas breves/i);
    expect(P).toMatch(/prosa por defecto/i);
  });
});

describe('§16 · política de preguntas con valor de información', () => {
  it('D · la pregunta forzada "confronta... con una pregunta" YA NO está', () => {
    expect(prompt()).not.toMatch(/confronta con amabilidad.*con una pregunta/i);
  });
  it('D2 · una pregunta debe APORTAR información', () => {
    expect(P).toMatch(/una pregunta debe APORTAR información/i);
  });
  it('D3 · permiso explícito de CERRAR SIN pregunta', () => {
    expect(P).toMatch(/CERRAR SIN pregunta/i);
  });
  it('D4 · CLARIFY es el único modo donde la pregunta suele ser obligatoria', () => {
    expect(P).toMatch(/CLARIFY.*obligatoria/is);
  });
});

describe('§16 · anti-cliché / especificidad', () => {
  it('E · regla anti-cliché ("taza motivacional")', () => {
    expect(P).toMatch(/taza motivacional/i);
  });
  it('E2 · preferencia observación → interpretación → acción', () => {
    expect(P).toMatch(/OBSERVACIÓN ESPECÍFICA/i);
    expect(P).toMatch(/INTERPRETACIÓN/);
    expect(P).toMatch(/ACCIÓN o PREGUNTA DE VALOR/i);
  });
});

describe('§16 · emoción ≠ interpretación ≠ conducta', () => {
  it('F · las tres se distinguen explícitamente', () => {
    expect(P).toMatch(/EMOCIÓN ≠ INTERPRETACIÓN ≠ CONDUCTA/);
  });
  it('F2 · nunca confrontar a alguien por SENTIR', () => {
    expect(P).toMatch(/NUNCA confrontes a alguien por SENTIR/i);
  });
});

describe('§16 · jerarquía HECHO vs HIPÓTESIS', () => {
  it('G · HSC FACT / USER FACT / HIPÓTESIS / PATRÓN LONGITUDINAL', () => {
    expect(P).toMatch(/HSC FACT/);
    expect(P).toMatch(/USER FACT/);
    expect(P).toMatch(/HIPÓTESIS/);
    expect(P).toMatch(/PATRÓN LONGITUDINAL/i);
  });
  it('G2 · los mensajes anteriores del chat NO son fuente de verdad', () => {
    expect(P).toMatch(/mensajes ANTERIORES del chat NO son fuente de verdad/i);
  });
});

describe('§16 · meta-regla de activación HSM', () => {
  it('H · no activar una dimensión en CADA respuesta', () => {
    expect(P).toMatch(/no actives una dimensión en CADA respuesta/i);
  });
});

describe('§16 · alcance ampliado (redirect suavizado)', () => {
  it('I · el redirect reflejo "redirige a lo que importa hoy" YA NO está', () => {
    expect(prompt()).not.toMatch(/redirige a lo que importa hoy/i);
  });
  it('I2 · propósito/carrera/relaciones/identidad son desarrollo humano de HSC', () => {
    expect(P).toMatch(/propósito/i);
    expect(P).toMatch(/relaciones/i);
    expect(P).toMatch(/desarrollo humano de HSC/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §16 · REGRESIÓN — COACH-CONTEXT y COACH-SAFETY intactos
// ─────────────────────────────────────────────────────────────────────────────

describe('§16 · COACH-CONTEXT preservado', () => {
  it('J · HECHOS vs SUGERENCIA sigue en el prompt', () => {
    expect(prompt()).toMatch(/HECHOS vs SUGERENCIA/);
  });
  it('J2 · regla no-invent + RESTA HOY exacta siguen', () => {
    const p = prompt();
    expect(p).toMatch(/NUNCA inventes/);
    expect(p).toMatch(/RESTA HOY/);
    expect(p).toMatch(/Ausencia de dato ≠ inferencia/);
  });
});

describe('§16 · COACH-SAFETY preservado (SAFETY manda sobre el modo)', () => {
  it('K · frontera clínica / no-diagnóstico intacta', () => {
    const p = prompt();
    expect(p).toMatch(/no eres psic/i);
    expect(p).toMatch(/NUNCA diagnostiques/);
    expect(p).toMatch(/restricci/i); // alimentación segura
  });
  it('K2 · la política dice que la SEGURIDAD manda sobre el modo', () => {
    expect(P).toMatch(/SEGURIDAD manda sobre el modo/i);
  });
  it('K3 · reflejo CONCERNING sigue condicionado al nivel', () => {
    expect(prompt('NORMAL')).not.toMatch(/sugiere posible malestar/i);
    expect(prompt('CONCERNING')).toMatch(/sugiere posible malestar/i);
  });
});
