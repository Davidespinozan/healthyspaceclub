// ─────────────────────────────────────────────────────────────────────────────
// F2C-9A · FUENTE ÚNICA de disponibilidad de video + POLÍTICA central required/preferred.
//
// PROBLEMA que resuelve: antes la "disponibilidad de video" que usa el PROGRAMADOR estaba
// dispersa como `VIDEO_VARIANT_IDS.has(id)` en varios módulos (workoutPlanner, cardioMain, …),
// y ese Set es un SNAPSHOT compile-time (generado desde supabase/migrations) desacoplado de la
// tabla `exercise_videos` en vivo que usa el player. Doble fuente → agregar/mapear un video no lo
// volvía elegible sin regenerar el snapshot a mano.
//
// AHORA: un ÚNICO punto (`hasVideo`) responde "¿este id tiene clip reproducible?". Su base es el
// snapshot (VIDEO_VARIANT_IDS) y admite un OVERLAY de runtime aditivo (`registerAvailableVideos`)
// para que la app, al cargar `exercise_videos`, alimente disponibilidad SIN tocar el programador.
// El overlay solo AGREGA (nunca quita): con overlay vacío, `hasVideo` === `VIDEO_VARIANT_IDS.has`
// → comportamiento byte-identical. La política required/preferred vive también aquí, centralizada.
//
// F2C-9A NO cambia elegibilidad (el overlay queda inerte hasta que se cablee) ni la programación.
// ─────────────────────────────────────────────────────────────────────────────
import { VIDEO_VARIANT_IDS } from '../data/videoAvailability';

// Overlay de runtime. ADITIVO y opcional: la app puede registrar los ids con clip real de
// `exercise_videos` para unificar la fuente sin modificar el programador. Vacío por defecto.
const runtimeAvailable = new Set<string>();

/** Registra ids (ejercicio/variante) con clip reproducible — típicamente desde `exercise_videos`.
 *  Aditivo: solo agrega disponibilidad. Idempotente. */
export function registerAvailableVideos(ids: Iterable<string>): void {
  for (const id of ids) if (id) runtimeAvailable.add(id);
}

/** Limpia el overlay de runtime (para tests / logout). No afecta el snapshot base. */
export function clearRegisteredVideos(): void {
  runtimeAvailable.clear();
}

/**
 * FUENTE ÚNICA de "¿este id (ejercicio o variante) tiene video reproducible?".
 * = snapshot compile-time (VIDEO_VARIANT_IDS) ∪ overlay de runtime (exercise_videos registrados).
 * Con overlay vacío es idéntico a `VIDEO_VARIANT_IDS.has(id)`.
 */
export function hasVideo(id: string): boolean {
  return VIDEO_VARIANT_IDS.has(id) || runtimeAvailable.has(id);
}

// ── POLÍTICA CENTRAL de video ───────────────────────────────────────────────────────────────────
// 'required'  = el movimiento DEBE tener clip para prescribirse (fuerza, trabajo técnico: interval/
//               power/drill). Sin video → fuera.
// 'preferred' = el clip GANA, pero se admite VIDEOLESS cuando es seguro/autoexplicativo (política
//               temporal de cardio CONTINUO — la excepción marcha/paso de F2C-6).
export type VideoPolicy = 'required' | 'preferred';
export type VideoRole = 'strength' | 'cardioContinuous' | 'cardioIntense';

/**
 * Política de video por ROL. Autoridad ÚNICA del required/preferred. Cambiar el retorno de
 * 'cardioContinuous' de 'preferred' → 'required' (cuando la cobertura de clips suba) es un cambio
 * de UNA línea aquí; NO toca el programador ni la arquitectura (los gates leen esta función).
 */
export function videoPolicyFor(ctx: { role: VideoRole }): VideoPolicy {
  return ctx.role === 'cardioContinuous' ? 'preferred' : 'required';
}
