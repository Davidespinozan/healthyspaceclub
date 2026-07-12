// ── Motor único de metas nutricionales ────────────────────────────────────
// Fuente ÚNICA de verdad para la meta calórica. Reemplaza la lógica que estaba
// TRIPLICADA (tdee.ts assignPlan, store finishOnboardingCalc, store recalcFromObData).
// Basado en LOGICA-NUTRICIONAL-HSC.md (Magaly) + calcPlan() del prototipo:
//   · Punto 1 — piso calórico de seguridad
//   · Punto 2/10/11 — modo bienestar (menores, embarazo, bajo peso) → sin déficit
//   · Punto 4 — déficit/superávit PORCENTUAL (no offset fijo)
//   · Punto 6 — factor de actividad (incluye "Atleta" 1.9)
//   · %grasa opcional → BMR Katch-McArdle (más preciso que Mifflin)
//   · Punto 8/12 — avisos de peso meta y tiempo estimado (helpers abajo)
// Los MENSAJES no viven aquí: se devuelven CÓDIGOS y la UI los traduce (ES/EN).

export const ACTIVITY_FACTORS: Record<string, number> = {
  Sedentaria: 1.2,
  Ligera: 1.375,
  Moderada: 1.55,
  Alta: 1.725,
  Atleta: 1.9,
};

export interface ObInput {
  sexo: string;                 // 'Hombre' | (otro → fórmula mujer, conservador)
  pesoKg: number;
  estaturaCm: number;
  edad: number;
  activity: string;             // clave de ACTIVITY_FACTORS
  goal: string;                 // objetivo del onboarding
  grasa?: number | null;        // % grasa corporal (opcional) → Katch-McArdle
  embarazo?: boolean;           // embarazo/lactancia → bloquea déficit
  pesoMeta?: number | null;     // peso meta (opcional) → avisos/tiempo
}

/**
 * Único punto de coerción de obData (Record<string, string|number>) → ObInput
 * tipado, con los defaults canónicos. Antes esta lógica estaba duplicada y con
 * pequeñas variaciones en el store (x2) y en WeeklyNutritionPlanner, con riesgo
 * de drift de defaults y de nombres de clave. Centralizar evita ese footgun.
 */
export function parseObData(ob: Record<string, string | number>): ObInput {
  return {
    sexo: String(ob.sex || 'Hombre'),
    pesoKg: Number(ob.peso || 70),
    estaturaCm: Number(ob.estatura || 170),
    edad: Number(ob.edad || 28),
    activity: String(ob.activity || 'Moderada'),
    goal: String(ob.goal || ''),
    grasa: ob.grasa != null && ob.grasa !== '' ? Number(ob.grasa) : null,
    embarazo: ob.embarazo === 1 || ob.embarazo === 'si',
    pesoMeta: ob.pesoMeta != null && ob.pesoMeta !== '' ? Number(ob.pesoMeta) : null,
  };
}

export type WellnessReason = 'menor' | 'embarazo' | 'bajopeso' | null;

export interface NutritionTargets {
  bmr: number;                  // metabolismo basal (Mifflin o Katch-McArdle)
  tdee: number;                 // gasto total = bmr × factor actividad
  planGoal: number;             // meta calórica final (protegida por el piso)
  floor: number;                // piso aplicado = max(piso_sexo, bmr)
  capped: boolean;              // true si el piso subió la meta (avisar)
  wellnessMode: boolean;        // true = sin déficit (protección)
  wellnessReason: WellnessReason;
  // ── Capa de macros (Punto 3) — metas diarias ──
  protG: number;                // proteína g/día
  fatG: number;                 // grasa g/día
  carbG: number;                // carbohidratos g/día
  fiberG: number;               // fibra g/día
}

// Punto 4 — ajuste PORCENTUAL del TDEE según objetivo. Regex para no depender de
// strings exactos (arregla la fragilidad #7).
export function goalFactor(goal: string): number {
  const g = (goal || '').toLowerCase();
  if (/recompos/.test(g)) return 0.90;                    // Recomposición: −10%
  if (/bajar|perder|d[eé]ficit/.test(g)) return 0.80;     // Bajar grasa/peso: −20%
  if (/ganar|subir|m[uú]sculo|masa|super[aá]vit/.test(g)) return 1.12; // Ganar músculo: +12%
  return 1.0;                                             // Bienestar integral / mantener
}

// Punto 1 — piso por sexo (mujer 1200 / hombre 1500 kcal).
export function sexFloor(sexo: string): number {
  return sexo === 'Hombre' ? 1500 : 1200;
}

// ¿El objetivo implica bajar? (para riesgo de bajo peso). Recomp cuenta como bajar.
function wantsToLose(goal: string): boolean {
  return /bajar|perder|recompos/.test((goal || '').toLowerCase());
}

// Objetivo normalizado para la tabla de proteína (independiente de variantes de texto).
function normalizeGoal(goal: string): 'bajar' | 'recomp' | 'ganar' | 'mantener' {
  const g = (goal || '').toLowerCase();
  if (/recompos/.test(g)) return 'recomp';
  if (/bajar|perder/.test(g)) return 'bajar';
  if (/ganar|subir|m[uú]sculo|masa/.test(g)) return 'ganar';
  return 'mantener';
}

export function computeNutritionTargets(o: ObInput): NutritionTargets {
  // BMR: Katch-McArdle si hay %grasa (usa masa magra); si no, Mifflin-St Jeor.
  let bmr: number;
  if (o.grasa && o.grasa > 0) {
    const lbm = o.pesoKg * (1 - o.grasa / 100);
    bmr = Math.round(370 + 21.6 * lbm);
  } else {
    bmr = Math.round(
      o.sexo === 'Hombre'
        ? 10 * o.pesoKg + 6.25 * o.estaturaCm - 5 * o.edad + 5
        : 10 * o.pesoKg + 6.25 * o.estaturaCm - 5 * o.edad - 161,
    );
  }

  const factor = ACTIVITY_FACTORS[o.activity] ?? 1.375;
  const tdee = Math.round(bmr * factor);

  // Modo bienestar (SIN déficit): menor de 18, embarazo/lactancia, o bajo peso queriendo bajar.
  const menor = o.edad < 18;
  const hM = o.estaturaCm / 100;
  const imc = hM > 0 ? o.pesoKg / (hM * hM) : 0;
  const bajoPeso = imc > 0 && imc < 18.5;
  const riesgoBajoPeso = bajoPeso && wantsToLose(o.goal);
  const wellnessMode = menor || !!o.embarazo || riesgoBajoPeso;
  const wellnessReason: WellnessReason =
    menor ? 'menor' : o.embarazo ? 'embarazo' : riesgoBajoPeso ? 'bajopeso' : null;

  // En modo bienestar → mantenimiento (factor 1.0), nunca déficit.
  const target = tdee * (wellnessMode ? 1.0 : goalFactor(o.goal));

  // Piso de seguridad (Punto 1): nunca por debajo de max(piso_sexo, BMR).
  const floor = Math.max(sexFloor(o.sexo), bmr);
  const planGoal = Math.round(Math.max(target, floor));
  const capped = planGoal > Math.round(target) + 1;

  // ── Capa de macros (Punto 3) ──────────────────────────────────────────
  // Proteína g/kg por objetivo × actividad; en modo bienestar → 'mantener'.
  const objKey = wellnessMode ? 'mantener' : normalizeGoal(o.goal);
  const actIdx = o.activity === 'Sedentaria' || o.activity === 'Ligera' ? 0
    : o.activity === 'Moderada' ? 1 : 2; // Alta/Atleta → 2
  const GKG: Record<string, [number, number, number]> = {
    bajar:    [2.0, 2.2, 2.4],
    mantener: [1.6, 1.8, 2.0],
    recomp:   [1.8, 2.0, 2.2],
    ganar:    [1.8, 2.0, 2.2],
  };
  let gkg = (GKG[objKey] || [1.4, 1.6, 1.8])[actIdx];
  if (gkg > 2.4) gkg = 2.4;                                          // techo de seguridad
  const protG = Math.round(o.pesoKg * gkg);
  // Grasa 20–35% kcal (Magaly 3.2): déficit en la parte baja, media en mantener/ganar.
  // Piso de seguridad 0.6 g/kg (protege función hormonal aunque el % quede bajo).
  const FAT_PCT: Record<string, number> = { bajar: 0.22, recomp: 0.25, mantener: 0.28, ganar: 0.30 };
  const fatPct = FAT_PCT[objKey] ?? 0.27;
  const fatG = Math.round(Math.max(planGoal * fatPct / 9, o.pesoKg * 0.6));
  // Carbos = el RESTO (así las macros suman EXACTO la meta calórica, no la exceden).
  // Piso bajo (50 g) solo para casos extremos; a metas bajas rellena el resto en vez de
  // forzar 130 g, que hacía que el plan se pasara ~14% de la meta (déficit de mujer chica).
  const carbG = Math.round(Math.max(50, (planGoal - protG * 4 - fatG * 9) / 4));
  const fiberG = Math.round(planGoal / 1000 * 14);                  // 14 g / 1000 kcal

  return {
    bmr, tdee, planGoal, floor: Math.round(floor), capped, wellnessMode, wellnessReason,
    protG, fatG, carbG, fiberG,
  };
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
export function invalidField(
  o: Pick<ObInput, 'sexo' | 'pesoKg' | 'estaturaCm' | 'edad' | 'grasa' | 'pesoMeta'>,
): 'edad' | 'peso' | 'estatura' | 'grasa' | 'pesoMeta' | null {
  if (o.edad < 15 || o.edad > 100) return 'edad';
  if (o.pesoKg < 30 || o.pesoKg > 300) return 'peso';
  if (o.estaturaCm < 120 || o.estaturaCm > 220) return 'estatura';
  if (o.grasa != null) {
    const lo = o.sexo === 'Hombre' ? 3 : 8;
    const hi = o.sexo === 'Hombre' ? 50 : 55;
    if (o.grasa < lo || o.grasa > hi) return 'grasa';
  }
  if (o.pesoMeta != null && (o.pesoMeta < 30 || o.pesoMeta > 300)) return 'pesoMeta';
  return null;
}

// ── Punto 8 — aviso de peso meta (IMC + % grasa manda sobre IMC) ───────────
export type TargetWeightNoticeKind =
  | 'bajopeso-meta'    // meta bajo un peso saludable → bandera roja
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

  if (imcMeta < 18.5 && !subiendo) return { kind: 'bajopeso-meta' };
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
