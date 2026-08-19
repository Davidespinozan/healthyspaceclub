// ─────────────────────────────────────────────────────────────────────────
// computeWeeklyCardio — describe el CARDIO REALMENTE COMPLETADO recientemente (Fase 1 del Session
// Composer). Responde "¿cuánto cardio hizo?", NO "¿cuánto debería hacer?" (eso es un cardioTarget de
// Fase 2, aún sin diseñar). Puro y determinista (nowMs inyectable para tests). Fuente: CompletedSession
// modernas (modality='cardio', durationSeconds REAL). NO usa duración prescrita, NO cuenta fuerza/
// finisher/supplemental-fuerza como cardio, dedup por sessionId. NO modifica CompletedSession ni cardioMain.
// ─────────────────────────────────────────────────────────────────────────
import { dayKey } from './localDate';
import type { CompletedSession } from '../types';

export interface WeeklyCardio {
  minutes7d: number;
  sessions7d: number;
  minutes14d: number;   // contexto adicional (dato real, sin inferir)
  sessions14d: number;
}

/** Segundos válidos de una sesión → minutos; datos corruptos (NaN/negativo/no-finito) → 0 (no inventa). */
function safeMinutes(durationSeconds: unknown): number {
  const s = typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds : 0;
  return s / 60;
}

export function computeWeeklyCardio(completedSessions: CompletedSession[], nowMs: number = Date.now()): WeeklyCardio {
  const since7 = dayKey(new Date(nowMs - 6 * 86400000));   // ventana 7 días (incl. hoy), fecha LOCAL
  const since14 = dayKey(new Date(nowMs - 13 * 86400000)); // ventana 14 días
  const seen = new Set<string>();
  let min7 = 0, sess7 = 0, min14 = 0, sess14 = 0;

  for (const s of completedSessions) {
    if (!s || s.modality !== 'cardio') continue;              // SOLO cardio (fuerza/supplemental-fuerza fuera)
    if (typeof s.date !== 'string' || s.date < since14) continue; // fuera de 14d → irrelevante
    // Dedup/idempotencia: sessionId estable; sin él, cae a completedAtIso (evita doble conteo cross-device).
    const key = s.sessionId || s.completedAtIso || '';
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const mins = safeMinutes(s.durationSeconds);
    min14 += mins; sess14 += 1;
    if (s.date >= since7) { min7 += mins; sess7 += 1; }
  }
  return {
    minutes7d: Math.round(min7), sessions7d: sess7,
    minutes14d: Math.round(min14), sessions14d: sess14,
  };
}
