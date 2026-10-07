// ── Avisos y validación de PESO META + reparto legacy por comida ─────────────
//
// Este archivo ya NO calcula energía (retirada en C5) ni macros (retiradas en
// CAPA 2). Lo que queda no es una autoridad nutricional:
//
//   1 · VALIDACIÓN de rangos del onboarding → `invalidField` (el peso meta lo
//       decide `classifyTargetWeight`, A8; aquí solo se traduce a un código)
//   2 · AVISOS de peso meta → `targetWeightNotice`, `estimateTimeMonths`
//   3 · `mealCalorieSplit` (25/35/25/15) · sin consumidores productivos.
//       LEGACY · PENDIENTE CAPA 4: no se borra antes de diseñar su reemplazo.
//
// Los MENSAJES no viven aquí: se devuelven CÓDIGOS y la UI los traduce (ES/EN).
//
// ── HISTORIA ────────────────────────────────────────────────────────────────
//   C1  separó energía y macros en un seam.
//   C4  cedió la energía al HSC Energy Engine.
//   C5  borró la energía legacy (`legacyEnergy`, `computeNutritionTargets`, …).
//   CAPA 2 borró las macros legacy (`legacyMacros`, `legacyMacroWellness`, la
//       tabla `GKG`, `FAT_PCT`, el piso de grasa de 0,6 g/kg, el piso de 50 g de
//       carbohidrato) y `parseObData`, con sus defaults 70 kg / 170 cm / 28 años.
//       La autoridad de macros es ahora `macroPrescription.ts`.

import {
  classifyTargetWeight, InvalidTargetWeightContextError, type TargetWeightSafety,
} from './targetWeightSafety';

export interface ObInput {
  sexo: string;                 // 'Hombre' | 'Mujer' → umbrales de % grasa
  pesoKg: number;
  estaturaCm: number;
  edad: number;
  activity: string;             // actividad legacy del onboarding (no la lee ningún motor)
  goal: string;                 // objetivo del onboarding
  grasa?: number | null;        // % grasa corporal (opcional) → avisos de peso meta
  embarazo?: boolean;
  pesoMeta?: number | null;     // peso meta (opcional) → avisos/tiempo
}

// ── Punto 3.5 — reparto de calorías por comida (25/35/25/15) ──────────────
// Para el banco de platillos / plan del día (Fase 4).
export function mealCalorieSplit(planGoal: number): { desayuno: number; comida: number; cena: number; snacks: number } {
  return {
    desayuno: Math.round(planGoal * 0.25),
    comida:   Math.round(planGoal * 0.35),
    cena:     Math.round(planGoal * 0.25),
    snacks:   Math.round(planGoal * 0.15),
  };
}

// ── Punto 9 — validación de datos imposibles ──────────────────────────────
// Devuelve el campo inválido (o null). La UI muestra "Revisa este dato".
//
// El PESO META ya no se valida aquí: lo decide la autoridad única
// `classifyTargetWeight` (A8). Esta función solo traduce su INVALID a un código
// de UI. El aviso informativo (`VALID_WITH_LOW_BMI_NOTICE`) NO es un error.
export function invalidField(
  o: Pick<ObInput, 'sexo' | 'pesoKg' | 'estaturaCm' | 'edad' | 'grasa' | 'pesoMeta'>,
): 'edad' | 'peso' | 'estatura' | 'grasa' | 'pesoMeta' | 'pesoMetaBajoPeso' | 'pesoMetaBajoPesoActual' | null {
  if (o.edad < 13 || o.edad > 100) return 'edad';
  if (o.pesoKg < 30 || o.pesoKg > 300) return 'peso';
  if (o.estaturaCm < 120 || o.estaturaCm > 220) return 'estatura';
  if (o.grasa != null) {
    const lo = o.sexo === 'Hombre' ? 3 : 8;
    const hi = o.sexo === 'Hombre' ? 50 : 55;
    if (o.grasa < lo || o.grasa > hi) return 'grasa';
  }
  if (o.pesoMeta != null) {
    let safety: TargetWeightSafety;
    try {
      safety = classifyTargetWeight({ currentWeightKg: o.pesoKg, heightCm: o.estaturaCm, targetWeightKg: o.pesoMeta });
    } catch (e) {
      // Sin peso o estatura evaluables la meta no se puede juzgar: se señala el dato de base.
      if (e instanceof InvalidTargetWeightContextError) return e.field === 'heightCm' ? 'estatura' : 'peso';
      throw e;
    }
    if (safety.status === 'INVALID') {
      switch (safety.reason) {
        case 'TARGET_OUT_OF_RANGE':          return 'pesoMeta';
        case 'TARGET_BMI_TOO_LOW':           return 'pesoMetaBajoPeso';
        case 'UNDERWEIGHT_NO_FURTHER_LOSS':  return 'pesoMetaBajoPesoActual';
      }
    }
  }
  return null;
}

// ── Punto 8 — aviso de peso meta (IMC + % grasa manda sobre IMC) ───────────
// `bajopeso-meta` ya no existe: la seguridad del peso meta (bloqueo y aviso de IMC
// bajo) es de `classifyTargetWeight` (A8). Aquí solo quedan avisos de contexto.
export type TargetWeightNoticeKind =
  | 'sube-musculo'     // sube + IMC alto pero % grasa bajo = músculo (ok)
  | 'sube-neutro-imc'  // sube + IMC alto, sin dato de grasa (aviso neutro)
  | 'sube-gradual'     // sube + % grasa alto → subir gradual
  | 'meta-etapas';     // meta saludable pero lejana → por etapas

export interface TargetWeightNotice {
  kind: TargetWeightNoticeKind;
  etapaKg?: number;    // solo para 'meta-etapas'
}

export function targetWeightNotice(o: ObInput): TargetWeightNotice | null {
  if (!o.pesoMeta || !o.estaturaCm) return null;
  const hM = o.estaturaCm / 100;
  const imcMeta = o.pesoMeta / (hM * hM);
  const pctCambio = Math.abs(o.pesoMeta - o.pesoKg) / o.pesoKg * 100;
  const subiendo = o.pesoMeta > o.pesoKg;
  // Umbrales ACE de % grasa (bajo = atleta/fitness; alto = obeso).
  const grasaBaja = o.grasa != null && (o.sexo === 'Hombre' ? o.grasa < 18 : o.grasa < 25);
  const grasaAlta = o.grasa != null && (o.sexo === 'Hombre' ? o.grasa >= 25 : o.grasa >= 32);

  if (subiendo && imcMeta >= 25) {
    if (grasaBaja) return { kind: 'sube-musculo' };
    if (o.grasa == null) return { kind: 'sube-neutro-imc' };
    if (grasaAlta) return { kind: 'sube-gradual' };
    return null;
  }
  if (pctCambio > 10 && !subiendo && !grasaBaja) {
    return { kind: 'meta-etapas', etapaKg: Math.round(o.pesoKg * 0.92) };
  }
  return null;
}

// ── Punto 12 — tiempo estimado a ritmo seguro (0.5–1% peso/semana) ─────────
export function estimateTimeMonths(o: ObInput): { min: number; max: number } | null {
  if (!o.pesoMeta || o.pesoMeta >= o.pesoKg) return null;
  const kgBajar = o.pesoKg - o.pesoMeta;
  const semMax = Math.ceil(kgBajar / (o.pesoKg * 0.01));   // ritmo rápido 1%/sem
  const semMin = Math.ceil(kgBajar / (o.pesoKg * 0.005));  // ritmo lento 0.5%/sem
  const mesesMax = Math.round(semMin / 4.3);
  const mesesMin = Math.round(semMax / 4.3);
  if (mesesMin < 1) return null;
  return { min: mesesMin, max: mesesMax };
}
