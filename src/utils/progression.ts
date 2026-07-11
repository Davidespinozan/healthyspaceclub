// Sobrecarga progresiva por DOBLE PROGRESIÓN (método estándar de fuerza/hipertrofia):
// trabajas dentro de un rango de reps; cuando llegas al TOPE del rango en tu serie más
// dura, subes el peso y reinicias al piso del rango. Si no, mantienes el peso y buscas
// más reps. Usa el historial que la app YA guarda (lastExercisePerformance).
export interface ProgressionTarget {
  kg: number | null;                 // peso objetivo (null = sin dato / peso corporal / banda)
  reps: string;                      // meta de reps ("8-10", "10")
  action: 'first-time' | 'add-weight' | 'add-reps' | 'add-tension' | 'add-difficulty' | 'hold';
  note: string;                      // cue corto para el usuario (2ª persona)
}

export function parseRepRange(reps: string): [number, number] {
  const m = String(reps).match(/(\d+)\s*[-–a]\s*(\d+)/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  const n = parseInt(String(reps).replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? [n, n] : [8, 12];
}

/**
 * @param lastSets  series de la última vez [{reps,kg}] (o undefined si nunca)
 * @param repRange  reps prescritas hoy ("8-10")
 * @param incrementKg  cuánto subir al progresar (típico 2.5 tren superior, 5 tren inferior/compuesto)
 */
export function computeProgression(
  lastSets: { reps: number; kg: number }[] | undefined,
  repRange: string,
  incrementKg: number,
  isBand = false,
): ProgressionTarget {
  const [lo, hi] = parseRepRange(repRange);
  const working = (lastSets ?? []).filter((s) => s.reps > 0);
  if (working.length === 0) {
    return { kg: null, reps: `${lo}-${hi}`, action: 'first-time',
      note: isBand
        ? `Primera vez: elige una liga donde llegues a ${hi} reps con buena técnica.`
        : `Primera vez: encuentra un peso donde llegues a ${hi} reps con buena técnica.` };
  }
  const refKg = Math.max(...working.map((s) => s.kg));
  // serie más dura al peso de referencia = la de menos reps a ese kg
  const repsAtRef = Math.min(...working.filter((s) => s.kg === refKg).map((s) => s.reps));

  // BANDAS: no hay kg → doble progresión sobre la TENSIÓN. Al tope de reps → liga más dura.
  if (isBand) {
    if (repsAtRef >= hi) return { kg: null, reps: `${lo}-${hi}`, action: 'add-tension',
      note: `Dominaste ${repsAtRef} reps — sube a una liga más dura (o dóblala) y vuelve a ${lo}.` };
    return { kg: null, reps: `${Math.min(repsAtRef + 1, hi)}-${hi}`, action: 'add-reps',
      note: `Busca ${hi} reps limpias con la misma liga (la vez pasada ${repsAtRef}).` };
  }

  if (refKg <= 0) {
    // Peso corporal: doble progresión sobre la DIFICULTAD. Al tope de reps → hazlo más
    // difícil (tempo, pausa, variante más dura), no sumar reps al infinito.
    if (repsAtRef >= hi) return { kg: 0, reps: `${lo}-${hi}`, action: 'add-difficulty',
      note: `Dominaste ${repsAtRef} reps — hazlo más difícil: tempo más lento, pausa abajo, o una variante más dura.` };
    return { kg: 0, reps: `${Math.min(repsAtRef + 1, hi)}-${hi}`, action: 'add-reps',
      note: `Busca ${hi} reps limpias (la vez pasada ${repsAtRef}).` };
  }
  if (repsAtRef >= hi) {
    const next = Math.round((refKg + incrementKg) * 2) / 2; // a 0.5 kg
    return { kg: next, reps: `${lo}-${hi}`, action: 'add-weight',
      note: `Llegaste al tope (${repsAtRef} reps). Sube a ${next} kg y empieza en ${lo}.` };
  }
  return { kg: refKg, reps: `${Math.min(repsAtRef + 1, hi)}-${hi}`, action: 'add-reps',
    note: `Mantén ${refKg} kg y busca ${hi} reps (la vez pasada ${repsAtRef}).` };
}

/** Incremento sugerido según el músculo: tren inferior/compuestos grandes suben más. */
export function incrementForMuscle(muscleGroup?: string): number {
  const heavy = ['cuadriceps', 'isquios', 'gluteo', 'espalda'];
  return muscleGroup && heavy.includes(muscleGroup) ? 5 : 2.5;
}
