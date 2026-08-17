// ─────────────────────────────────────────────────────────────────────────────
// E2E TRACE (solo DEV) — un bloque estructurado por sesión para observar el contrato
// PRESCRITO ≠ EJECUTADO ≠ GUARDADO de extremo a extremo. No-op en producción
// (import.meta.env.DEV). No persiste nada, no toca lógica; retirable sin efectos.
//
// Uso: en el punto de cierre de sesión se ensambla lo disponible y se emite:
//   logE2ETrace({ config, generation, player, persistence, next })
// Cualquier segmento ausente se omite. Nunca lanza (un trace no puede romper la app).
// ─────────────────────────────────────────────────────────────────────────────

export interface E2ETraceInput {
  config?: Record<string, unknown>;
  generation?: Record<string, unknown>;
  player?: Record<string, unknown>;
  persistence?: Record<string, unknown>;
  next?: Record<string, unknown>;
}

/** ¿Está activo el trace? (DEV, o override manual `window.__HSC_E2E_TRACE`). */
function traceEnabled(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
    return typeof window !== 'undefined' && (window as unknown as { __HSC_E2E_TRACE?: boolean }).__HSC_E2E_TRACE === true;
  } catch { return false; }
}

export function logE2ETrace(t: E2ETraceInput): void {
  if (!traceEnabled()) return;
  try {
    const fmt = (v: unknown) => (v != null && typeof v === 'object' ? JSON.stringify(v) : String(v));
    const seg = (title: string, o?: Record<string, unknown>) =>
      o && Object.keys(o).length ? [`${title}:`, ...Object.entries(o).map(([k, v]) => `  ${k}: ${fmt(v)}`)] : [];
    const out = [
      '[HSC E2E TRACE]',
      ...seg('CONFIG', t.config),
      ...seg('GENERATION', t.generation),
      ...seg('PLAYER', t.player),
      ...seg('PERSISTENCE', t.persistence),
      ...seg('NEXT SESSION', t.next),
    ];
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));
  } catch { /* un trace nunca rompe la app */ }
}
