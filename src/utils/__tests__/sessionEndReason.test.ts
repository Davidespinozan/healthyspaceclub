import { describe, it, expect } from 'vitest';
import { deriveSessionEndReason, type SessionEndInput } from '../sessionEndReason';

// ═══════════════════════════════════════════════════════════════════════════
// FASE 1B · deriveSessionEndReason — motivo por el que la sesión no usa todo el tiempo (por SEÑALES,
// no por duración). Anti-CASE-F: la duración corta NUNCA basta para DOSE_COMPLETE.
// ═══════════════════════════════════════════════════════════════════════════
const base: SessionEndInput = {
  availableMinutes: 90, plannedMinutes: 60, weeklyRemaining: 0,
  timeFitTrimmed: false, headroomEndedEarly: false, readinessLow: false, deload: false,
};
const r = (o: Partial<SessionEndInput>) => deriveSessionEndReason({ ...base, ...o }).reason;

describe('deriveSessionEndReason', () => {
  it('1 · time-fit recortó dosis → TIME_LIMITED', () => {
    expect(r({ timeFitTrimmed: true, weeklyRemaining: 5 })).toBe('TIME_LIMITED');
  });
  it('2 · dosis cubierta + headroom endedEarly + remaining≈0 → DOSE_COMPLETE', () => {
    expect(r({ headroomEndedEarly: true, weeklyRemaining: 0 })).toBe('DOSE_COMPLETE');
  });
  it('3 · readiness baja / deload → RECOVERY_LIMITED (precedencia máxima)', () => {
    expect(r({ readinessLow: true })).toBe('RECOVERY_LIMITED');
    expect(r({ deload: true })).toBe('RECOVERY_LIMITED');
  });
  it('4 · sobra tiempo sin evidencia → AVAILABLE_TIME_UNUSED', () => {
    expect(r({ availableMinutes: 120, plannedMinutes: 70 })).toBe('AVAILABLE_TIME_UNUSED');
  });
  it('5 · selectedTime 120 + planned 80 (sin señales) NO es DOSE_COMPLETE', () => {
    const reason = r({ availableMinutes: 120, plannedMinutes: 80 });
    expect(reason).not.toBe('DOSE_COMPLETE');
    expect(reason).toBe('AVAILABLE_TIME_UNUSED');
  });
  it('6 · selectedTime 45 + planned 30 (sin señales) NO implica volumen cubierto', () => {
    expect(r({ availableMinutes: 45, plannedMinutes: 30 })).not.toBe('DOSE_COMPLETE');
  });
  it('7 · weeklyRemaining>0 + time-fit trim → TIME_LIMITED', () => {
    expect(r({ weeklyRemaining: 6, timeFitTrimmed: true })).toBe('TIME_LIMITED');
  });
  it('8 · weeklyRemaining=0 + 36 min sobrantes + headroom cedió → DOSE_COMPLETE', () => {
    expect(r({ availableMinutes: 120, plannedMinutes: 84, weeklyRemaining: 0, headroomEndedEarly: true })).toBe('DOSE_COMPLETE');
  });
  it('9 · ninguna señal suficiente → AVAILABLE_TIME_UNUSED (fallback seguro, nunca DOSE_COMPLETE)', () => {
    expect(r({ headroomEndedEarly: undefined, weeklyRemaining: 3 })).toBe('AVAILABLE_TIME_UNUSED');
  });
  it('10 · cambiar SOLO availableMinutes (señales fisiológicas iguales) NO altera el motivo', () => {
    const phys = { headroomEndedEarly: true, weeklyRemaining: 0 };
    const a = r({ ...phys, availableMinutes: 60 });
    const b = r({ ...phys, availableMinutes: 120 });
    expect(a).toBe(b); // DOSE_COMPLETE en ambos
    const c = r({ timeFitTrimmed: true, availableMinutes: 45 });
    const d = r({ timeFitTrimmed: true, availableMinutes: 120 });
    expect(c).toBe(d); // TIME_LIMITED en ambos
  });

  // ── Precedencia con señales que coinciden (razonada, no accidental) ──
  it('precedencia · readiness baja + time-fit → RECOVERY_LIMITED (recuperación domina)', () => {
    expect(r({ readinessLow: true, timeFitTrimmed: true, weeklyRemaining: 8 })).toBe('RECOVERY_LIMITED');
  });
  it('precedencia · deload + headroom cedió + remaining0 → RECOVERY_LIMITED (no DOSE_COMPLETE)', () => {
    expect(r({ deload: true, headroomEndedEarly: true, weeklyRemaining: 0 })).toBe('RECOVERY_LIMITED');
  });
  it('precedencia · time-fit + remaining0 + sin recovery → TIME_LIMITED (recorte manda sobre dosis aparente)', () => {
    expect(r({ timeFitTrimmed: true, weeklyRemaining: 0, headroomEndedEarly: false })).toBe('TIME_LIMITED');
  });
  it('HYBRID_COMPLETE reservado: NUNCA se deriva en Fase 1', () => {
    for (const o of [{}, { readinessLow: true }, { timeFitTrimmed: true }, { headroomEndedEarly: true, weeklyRemaining: 0 }, { availableMinutes: 120, plannedMinutes: 60 }]) {
      expect(r(o)).not.toBe('HYBRID_COMPLETE');
    }
  });
  it('spareMinutes = max(0, disponible − planeado)', () => {
    expect(deriveSessionEndReason({ ...base, availableMinutes: 120, plannedMinutes: 84 }).spareMinutes).toBe(36);
    expect(deriveSessionEndReason({ ...base, availableMinutes: 60, plannedMinutes: 70 }).spareMinutes).toBe(0);
  });
});
