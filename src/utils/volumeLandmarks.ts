// ─────────────────────────────────────────────────────────────────────────
// volumeLandmarks — P3: VOLUMEN INDIVIDUALIZADO.
//
// Reemplaza el target plano de 14 series/músculo por un objetivo POR MÚSCULO que se
// adapta al usuario. NO fingimos conocer el MEV/MAV/MRV fisiológico exacto de nadie:
// son RANGOS OPERATIVOS estimados del coach, adaptativos, no verdades biológicas.
//
// Cadena (como pidió David):
//   baseline por músculo → ajuste del mesociclo (P1) → ajuste por recuperación/
//   rendimiento (P1/P2) → target semanal, acotado al rango operativo.
//
// Aprende qué VOLUMEN tolera y aprovecha cada quien: si con cierto volumen la fuerza
// sube y la recuperación aguanta, progresa gradual; si al subir volumen se deterioran
// recuperación/rendimiento/adherencia, mantiene o retrocede.
//
// CERO persistencia nueva: el baseline se DERIVA del historial (mediana de las últimas
// semanas → robusta a un mal día y a la semana de deload). Determinista y testeable.
// ─────────────────────────────────────────────────────────────────────────
import type { Recovery, Adherence, Trend } from './mesocycle';

export type Level = 'principiante' | 'intermedio' | 'avanzado';

export interface MuscleTarget {
  baseline: number;   // volumen habitual/tolerado estimado (series/sem)
  target: number;     // objetivo de ESTA semana (baseline × meso × adaptación, acotado)
  min: number;        // piso operativo del rango
  max: number;        // techo operativo (no asumir que más siempre es mejor)
}
export type VolumeTargets = Record<string, MuscleTarget>;

// Rangos operativos [min, max] por nivel — estimaciones del coach, NO fisiología exacta.
const OP_RANGE: Record<Level, [number, number]> = {
  principiante: [6, 14],
  intermedio: [8, 20],
  avanzado: [10, 24],
};
// Baseline conservador de arranque en frío (mitad-baja del rango) por nivel.
const COLD_START: Record<Level, number> = { principiante: 8, intermedio: 11, avanzado: 13 };

// Músculos que siempre reciben un target (aunque no haya historial → cold start).
export const MAJOR_MUSCLES = [
  'pecho', 'espalda', 'hombros', 'biceps', 'triceps',
  'cuadriceps', 'isquios', 'gluteo', 'core', 'pantorrillas', 'antebrazo',
];

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Factor de adaptación de ESTA semana (pasos chicos → progresión estable, sin saltos).
 * En deload es NEUTRAL: el volumen baja por el mesociclo, pero el baseline NO aprende
 * que ese volumen bajo es el nuevo normal.
 */
export function adaptFactor(input: {
  recovery: Recovery; performance: Trend; adherence: Adherence; isDeload: boolean;
}): number {
  if (input.isDeload) return 1;                                   // no recalibra en descarga
  if (input.performance === 'baja' || input.recovery === 'mala') return 0.92; // frena/retrocede
  // aquí ya sabemos: recuperación ≠ mala y rendimiento ≠ baja.
  if (input.performance === 'sube' && input.adherence === 'alta') return 1.05; // progresa ~5%
  return 1;                                                       // mantiene
}

/**
 * Targets de volumen por músculo. `weeklyVolumes` = volumen por músculo de las últimas
 * semanas (reciente→viejo), tal cual sale de diferenciar computeWeeklyVolume — así el
 * baseline es la MEDIANA (robusta a un mal día y a la semana de deload). Sin señales/
 * mesociclo = baseline como target (para la selección de día, que es uniforme).
 */
export function computeVolumeTargets(input: {
  weeklyVolumes: Record<string, number>[];   // reciente → viejo
  level: Level;
  weeksOfHistory: number;                     // semanas con datos (cold start si <2)
  longPause?: boolean;                        // vuelta de pausa larga → conservador
  recovery?: Recovery;
  performance?: Trend;
  adherence?: Adherence;
  volumeMultiplier?: number;                  // del mesociclo (P1) — MODULA, no reemplaza
  isDeload?: boolean;
}): VolumeTargets {
  const { level, weeksOfHistory } = input;
  const longPause = input.longPause ?? false;
  const [min, max] = OP_RANGE[level];
  const cold = COLD_START[level];
  const meso = input.volumeMultiplier ?? 1;
  const adapt = adaptFactor({
    recovery: input.recovery ?? 'media',
    performance: input.performance ?? 'estable',
    adherence: input.adherence ?? 'media',
    isDeload: input.isDeload ?? false,
  });
  // PRESUPUESTO DE PROGRESIÓN (guardrail anti doble-conteo): el multiplicador del mesociclo
  // (P1) y el factor de adaptación (P3) leen señales que se solapan (recuperación/rendimiento).
  // Su producto se acota a una banda por semana para que UNA misma señal no reduzca (ni suba)
  // el volumen dos veces de forma no acotada. En DELOAD no aplica: la descarga SÍ debe cortar
  // fuerte. Banda = límite de software, no fisiología.
  const combined = (input.isDeload ?? false) ? meso * adapt : clamp(meso * adapt, 0.80, 1.25);

  // Músculos: los del historial + los mayores (para cold start completo).
  const muscles = new Set<string>(MAJOR_MUSCLES);
  for (const wk of input.weeklyVolumes) for (const m of Object.keys(wk)) muscles.add(m);

  const out: VolumeTargets = {};
  for (const m of muscles) {
    const hist = input.weeklyVolumes.map(wk => wk[m] ?? 0).filter(v => v > 0);
    let baseline: number;
    if (hist.length === 0 || longPause) {
      baseline = cold;                                   // cold start / pausa larga → conservador
    } else {
      baseline = median(hist);                           // robusto a un mal día y al deload
      if (weeksOfHistory < 2) baseline = Math.min(baseline, cold); // poco historial → conservador
    }
    baseline = clamp(baseline, min, max);
    const target = clamp(baseline * combined, min, max);
    out[m] = { baseline: Math.round(baseline * 10) / 10, target: Math.round(target * 10) / 10, min, max };
  }
  return out;
}

/** Mapa músculo→target (número) para pickByVolumeDeficit. */
export function targetsToMap(targets: VolumeTargets): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of Object.keys(targets)) out[m] = targets[m].target;
  return out;
}
