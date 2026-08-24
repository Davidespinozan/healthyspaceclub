import { describe, it, expect } from 'vitest';
import { reflectionInsertRow, reflectionFromRow, type HSMReflection } from '../hsmRepository';

const r: HSMReflection = {
  date: '2026-08-01', dimensionId: 'identity', questionIndex: 0, questionKey: 'identity#0',
  question: '¿Quién eres?', response: 'Honesto y disciplinado.', safetyLevel: 'CONCERNING',
};

describe('MINDSET-1 · mapeo repositorio (puro)', () => {
  it('insertRow fija user_id y los campos estables', () => {
    const row = reflectionInsertRow('user-1', r);
    expect(row.user_id).toBe('user-1');
    expect(row.reflection_date).toBe('2026-08-01');
    expect(row.dimension_id).toBe('identity');
    expect(row.question_index).toBe(0);
    expect(row.question_key).toBe('identity#0');
    expect(row.response).toBe('Honesto y disciplinado.');
    expect(row.safety_level).toBe('CONCERNING');
  });
  it('round-trip row → reflection preserva la identidad', () => {
    const back = reflectionFromRow({
      reflection_date: '2026-08-01', dimension_id: 'identity', question_index: 0,
      question_key: 'identity#0', question_text: '¿Quién eres?', response: 'Honesto y disciplinado.', safety_level: 'CONCERNING',
    });
    expect(back).toEqual(r);
  });
  it('respuesta > 2000 chars se recorta a 2000 (acuerda con el CHECK de DB)', () => {
    const big = 'a'.repeat(2500);
    const row = reflectionInsertRow('u', { ...r, response: big });
    expect((row.response as string).length).toBe(2000);
  });
  it('question_index inválido → -1', () => {
    const row = reflectionInsertRow('u', { ...r, questionIndex: NaN });
    expect(row.question_index).toBe(-1);
  });
  it('defaults seguros en filas incompletas', () => {
    const back = reflectionFromRow({ reflection_date: 'd', response: 'x' });
    expect(back.dimensionId).toBe('unknown');
    expect(back.safetyLevel).toBe('NORMAL');
    expect(back.questionIndex).toBe(-1);
  });
});
