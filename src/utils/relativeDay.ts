// Helper de tiempo relativo entre dos fechas YYYY-MM-DD — Lote Track-3a.
//
// Devuelve un kind discreto que el caller traduce vía t() — separa
// la lógica del label, para mantener la función pura y testeable.
//
// Estados:
//   - 'today'      → dateStr === today
//   - 'yesterday'  → dateStr es exactamente 1 día antes de today
//   - 'days-ago'   → cualquier otro caso (incluye fechas futuras
//                    defensivamente → days clampeado a >= 0)

export type RelativeDayKind = 'today' | 'yesterday' | 'days-ago';

export interface RelativeDayResult {
  kind: RelativeDayKind;
  /** Días de diferencia (today - date). 0 para 'today', 1 para 'yesterday', N>=2 para 'days-ago'. */
  days: number;
}

export function relativeDayKind(dateStr: string, today: string): RelativeDayResult {
  if (dateStr === today) return { kind: 'today', days: 0 };

  const todayMs = Date.parse(today);
  const dateMs = Date.parse(dateStr);
  if (!Number.isFinite(todayMs) || !Number.isFinite(dateMs)) {
    return { kind: 'days-ago', days: 0 };
  }

  const days = Math.round((todayMs - dateMs) / 86_400_000);
  if (days === 1) return { kind: 'yesterday', days: 1 };
  // Clampeo defensivo: una fecha futura (raro pero posible por desfase
  // de TZ entre devices) no debería decir "hace -3 días".
  return { kind: 'days-ago', days: Math.max(0, days) };
}
