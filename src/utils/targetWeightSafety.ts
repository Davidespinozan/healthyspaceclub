// ═════════════════════════════════════════════════════════════════════════════
// CARRIL A · A8 · TARGET WEIGHT SAFETY · única autoridad del peso meta
// ═════════════════════════════════════════════════════════════════════════════
//
// `pesoMeta` es metadato OPCIONAL de objetivo. Esta autoridad decide si una meta
// es aceptable; no es una autoridad energética ni de macros:
//
//   · NO entra en mantenimiento, EER, energía prescrita, déficit ni superávit.
//   · NO entra en PRW, proteína, grasa, carbohidrato ni prioridad de carbohidrato.
//   · NO entra en la vigencia del plan semanal.
//   · NO saca a nadie del alcance de Nutrition ni crea un estado clínico.
//
// El IMC aquí es una BARANDILLA DE SEGURIDAD DE PRODUCTO, no un diagnóstico, ni
// una medida de composición corporal, ni una puntuación de salud.
//
// ── MATRIZ (cerrada) ─────────────────────────────────────────────────────────
//   IMC actual < 18,5 (ya bajo peso):
//     · meta > peso actual            → VALID_GAIN_DIRECTION (aunque siga baja)
//     · meta ≤ peso actual            → INVALID · UNDERWEIGHT_NO_FURTHER_LOSS
//   IMC actual ≥ 18,5:
//     · IMC meta ≥ 18,5               → VALID
//     · 17,0 ≤ IMC meta < 18,5        → VALID_WITH_LOW_BMI_NOTICE (informativo)
//     · IMC meta < 17,0               → INVALID · TARGET_BMI_TOO_LOW
//   Antes de todo: meta no finita o fuera de 30–300 kg → INVALID · TARGET_OUT_OF_RANGE
//
// Separada a propósito del guard `FAT_LOSS_BLOCKED` (IMC ACTUAL + objetivo de
// pérdida de grasa, en `energyPrescription`): son dos autoridades distintas.
//
// Pura y determinista.
// ═════════════════════════════════════════════════════════════════════════════

/** Rango absoluto del peso meta (kg). Es el que ya aplicaba `invalidField`. */
export const TARGET_WEIGHT_MIN_KG = 30;
export const TARGET_WEIGHT_MAX_KG = 300;

/** Por debajo: zona de aviso. En el umbral exacto: VALID. */
export const TARGET_BMI_NOTICE_BELOW = 18.5;
/** Por debajo: meta inválida (salvo dirección de subida desde bajo peso). En el umbral exacto: aviso. */
export const TARGET_BMI_INVALID_BELOW = 17.0;
/** IMC actual por debajo del cual la persona ya está en bajo peso. */
export const UNDERWEIGHT_CURRENT_BMI_BELOW = 18.5;

/**
 * Tolerancia de coma flotante para comparar contra los umbrales. Un IMC
 * matemáticamente igual a 17,0 o 18,5 puede salir como 18,499999999999996 según
 * la estatura; con esta tolerancia cae SIEMPRE del lado correcto. Es órdenes de
 * magnitud menor que cualquier diferencia real (0,01 kg ≈ 0,003 de IMC).
 */
const BMI_EPSILON = 1e-9;
const atLeast = (bmi: number, threshold: number) => bmi >= threshold - BMI_EPSILON;

export type TargetWeightInvalidReason =
  | 'TARGET_OUT_OF_RANGE'
  | 'TARGET_BMI_TOO_LOW'
  | 'UNDERWEIGHT_NO_FURTHER_LOSS';

export type TargetWeightSafety =
  | { status: 'VALID'; targetBmi: number; currentBmi: number; reason?: undefined }
  | { status: 'VALID_WITH_LOW_BMI_NOTICE'; targetBmi: number; currentBmi: number; reason?: undefined }
  | { status: 'VALID_GAIN_DIRECTION'; targetBmi: number; currentBmi: number; reason?: undefined }
  | { status: 'INVALID'; reason: TargetWeightInvalidReason; targetBmi?: number; currentBmi?: number };

export interface TargetWeightInput {
  currentWeightKg: number;
  heightCm: number;
  targetWeightKg: number;
}

/** El peso actual o la estatura no permiten evaluar la meta. FAIL-CLOSED. */
export class InvalidTargetWeightContextError extends Error {
  readonly field: 'currentWeightKg' | 'heightCm';
  readonly received: unknown;
  constructor(field: 'currentWeightKg' | 'heightCm', received: unknown) {
    super(`No se puede evaluar el peso meta · ${field} debe ser un número finito > 0. Recibido: ${String(received)}`);
    this.name = 'InvalidTargetWeightContextError';
    this.field = field;
    this.received = received;
  }
}

const positiveFinite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const bmiOf = (weightKg: number, heightCm: number) => {
  const m = heightCm / 100;
  return weightKg / (m * m);
};

/** ¿La meta sirve como objetivo? Solo INVALID no sirve. */
export const isAcceptedTargetWeight = (s: TargetWeightSafety): boolean => s.status !== 'INVALID';

/**
 * Clasificación de seguridad del peso meta · ÚNICA autoridad.
 *
 * El peso meta se valida aquí entero (incluido NaN/±Infinity y el rango
 * 30–300). El peso actual y la estatura son CONTEXTO: si no son números
 * positivos y finitos no hay forma honesta de evaluar, y se lanza.
 */
export function classifyTargetWeight(input: TargetWeightInput): TargetWeightSafety {
  const { currentWeightKg, heightCm, targetWeightKg } = input;
  if (!positiveFinite(currentWeightKg)) throw new InvalidTargetWeightContextError('currentWeightKg', currentWeightKg);
  if (!positiveFinite(heightCm)) throw new InvalidTargetWeightContextError('heightCm', heightCm);

  if (typeof targetWeightKg !== 'number' || !Number.isFinite(targetWeightKg)
    || targetWeightKg < TARGET_WEIGHT_MIN_KG || targetWeightKg > TARGET_WEIGHT_MAX_KG) {
    return { status: 'INVALID', reason: 'TARGET_OUT_OF_RANGE' };
  }

  const currentBmi = bmiOf(currentWeightKg, heightCm);
  const targetBmi = bmiOf(targetWeightKg, heightCm);

  // Ya en bajo peso: la DIRECCIÓN manda. Subir nunca se rechaza por el IMC meta.
  if (!atLeast(currentBmi, UNDERWEIGHT_CURRENT_BMI_BELOW)) {
    return targetWeightKg > currentWeightKg
      ? { status: 'VALID_GAIN_DIRECTION', targetBmi, currentBmi }
      : { status: 'INVALID', reason: 'UNDERWEIGHT_NO_FURTHER_LOSS', targetBmi, currentBmi };
  }

  if (atLeast(targetBmi, TARGET_BMI_NOTICE_BELOW)) return { status: 'VALID', targetBmi, currentBmi };
  if (atLeast(targetBmi, TARGET_BMI_INVALID_BELOW)) return { status: 'VALID_WITH_LOW_BMI_NOTICE', targetBmi, currentBmi };
  // Con IMC actual ≥ 18,5, un IMC meta < 17 implica siempre bajar de peso.
  return { status: 'INVALID', reason: 'TARGET_BMI_TOO_LOW', targetBmi, currentBmi };
}

/**
 * Adaptador para el `obData` PERSISTIDO (legacy, localStorage, Supabase,
 * hidratado, tras un cambio de estatura o de peso). Misma autoridad, sin copia
 * de la fórmula.
 *
 * `null` = no hay peso meta declarado, o el peso actual / la estatura guardados
 * no permiten evaluarlo. Un resultado `INVALID` significa que la meta guardada
 * NO es autoritativa: no se usa como objetivo y se ofrece corregirla. No toca
 * la energía, las macros, el plan ni el alcance.
 */
export function targetWeightSafetyFrom(
  obData: Record<string, string | number | undefined> | null | undefined,
): TargetWeightSafety | null {
  const ob = obData ?? {};
  const raw = ob.pesoMeta;
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return null;
  const currentWeightKg = Number(ob.peso);
  const heightCm = Number(ob.estatura ?? ob.altura);
  if (!positiveFinite(currentWeightKg) || !positiveFinite(heightCm)) return null;
  return classifyTargetWeight({ currentWeightKg, heightCm, targetWeightKg: Number(raw) });
}
