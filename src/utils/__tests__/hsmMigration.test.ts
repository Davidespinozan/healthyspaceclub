import { describe, it, expect, vi } from 'vitest';
import { legacyToReflection, dedupeLegacy, runHSMMigration, type LegacyReflection } from '../hsmMigration';
import type { HSMReflection } from '../hsmRepository';

describe('MINDSET-1 · legacyToReflection', () => {
  it('fila ES con pregunta CONOCIDA del banco → dimensionId + questionIndex estables', () => {
    const r = legacyToReflection({ date: '2026-08-01', dimension: 'Identidad', question: '¿Quién eres cuando nadie te ve?', response: 'Soy honesto.' });
    expect(r.dimensionId).toBe('identity');
    expect(r.questionIndex).toBe(0);
    expect(r.questionKey).toBe('identity#0');
    expect(r.response).toBe('Soy honesto.');
    expect(r.safetyLevel).toBe('NORMAL');
    expect(r.question).toBe('¿Quién eres cuando nadie te ve?'); // snapshot preservado
  });
  it('fila EN → mismo dimensionId estable', () => {
    const r = legacyToReflection({ date: '2026-08-01', dimension: 'Identity', question: 'Who are you when no one is watching?', response: 'x' });
    expect(r.dimensionId).toBe('identity');
  });
  it('pregunta DESCONOCIDA se PRESERVA (unknown, index -1, texto snapshot)', () => {
    const r = legacyToReflection({ date: '2026-08-01', dimension: 'Identidad', question: 'Pregunta vieja borrada del banco', response: 'algo' });
    expect(r.dimensionId).toBe('identity');       // dimensión sí se reconoce
    expect(r.questionIndex).toBe(-1);             // pregunta no
    expect(r.questionKey).toMatch(/^identity#u/); // clave por hash → no colisiona
    expect(r.question).toBe('Pregunta vieja borrada del banco');
  });
  it('dimensión desconocida → unknown, nunca se descarta', () => {
    const r = legacyToReflection({ date: '2026-08-01', dimension: 'Dimensión Inventada', question: 'q', response: 'r' });
    expect(r.dimensionId).toBe('unknown');
    expect(r.questionKey).toMatch(/^unknown#u/);
    expect(r.response).toBe('r');
  });
  it('clasifica URGENT al migrar', () => {
    expect(legacyToReflection({ date: 'd', dimension: 'Cuerpo', question: 'q', response: 'quiero matarme' }).safetyLevel).toBe('URGENT');
  });
});

describe('MINDSET-1 · dedupe + migración idempotente', () => {
  const mk = (over: Partial<HSMReflection> = {}): HSMReflection => ({ date: '2026-08-01', dimensionId: 'body', questionIndex: 1, questionKey: 'body#1', question: 'q', response: 'r', safetyLevel: 'NORMAL', ...over });

  it('dedupeLegacy quita duplicados por (date, questionKey), la primera gana', () => {
    const out = dedupeLegacy([mk({ response: 'A' }), mk({ response: 'B' }), mk({ questionKey: 'body#2', response: 'C' })]);
    expect(out).toHaveLength(2);
    expect(out[0].response).toBe('A');
  });

  it('runHSMMigration migra todo, sin pérdida, y re-ejecutar no duplica (mock insertFn)', async () => {
    const inserted: HSMReflection[] = [];
    const insertFn = vi.fn(async (r: HSMReflection) => { inserted.push(r); return true; });
    const legacy: LegacyReflection[] = [
      { date: '2026-08-01', dimension: 'Identidad', question: '¿Quién eres cuando nadie te ve?', response: 'a' },
      { date: '2026-08-01', dimension: 'Cuerpo', question: 'q body', response: 'b' },
      { date: '2026-08-01', dimension: 'Identidad', question: '¿Quién eres cuando nadie te ve?', response: 'dup' }, // mismo key → dedupe
    ];
    const res = await runHSMMigration(legacy, insertFn);
    expect(res.ok).toBe(true);
    expect(res.total).toBe(2);       // dedupe eliminó la 3ª
    expect(res.migrated).toBe(2);
    // Re-ejecutar: mismos keys → el insertFn real usa ON CONFLICT DO NOTHING; aquí
    // el mock igual no crea duplicados de identidad (mismos questionKey).
    inserted.length = 0; insertFn.mockClear();
    const res2 = await runHSMMigration(legacy, insertFn);
    expect(res2.total).toBe(2);
    expect(new Set(inserted.map(r => `${r.date}|${r.questionKey}`)).size).toBe(2);
  });

  it('fallo parcial → ok=false (el caller NO marca completado → reintenta)', async () => {
    let n = 0;
    const insertFn = vi.fn(async () => { n++; return n !== 1; }); // el 1º falla
    const legacy: LegacyReflection[] = [
      { date: 'd', dimension: 'Cuerpo', question: 'q1', response: 'r1' },
      { date: 'd', dimension: 'Metas', question: 'q2', response: 'r2' },
    ];
    const res = await runHSMMigration(legacy, insertFn);
    expect(res.ok).toBe(false);
    expect(res.migrated).toBe(1);
  });

  it('ignora respuestas vacías', async () => {
    const insertFn = vi.fn(async () => true);
    const res = await runHSMMigration([{ date: 'd', dimension: 'Cuerpo', question: 'q', response: '   ' }], insertFn);
    expect(res.total).toBe(0);
    expect(insertFn).not.toHaveBeenCalled();
  });
});
