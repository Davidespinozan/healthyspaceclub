// ── Macros legacy + avisos de peso meta ───────────────────────────────────
//
// Este archivo YA NO calcula energía. Lo que queda son dos cosas que no son
// energía y una coerción compartida:
//
//   1 · MACROS legacy  → `legacyMacros` + `legacyMacroWellness` (+ sus helpers)
//   2 · AVISOS de peso meta y validación de rangos → `targetWeightNotice`,
//       `estimateTimeMonths`, `invalidField`
//   3 · `parseObData` / `ObInput` → único punto de coerción obData → tipado
//
// Los MENSAJES no viven aquí: se devuelven CÓDIGOS y la UI los traduce (ES/EN).
//
// ── CÓMO LLEGÓ A SER ESTO ───────────────────────────────────────────────────
// Hasta C4 este archivo era el «motor único de metas nutricionales»: calculaba
// BMR (Mifflin-St Jeor / Katch-McArdle), TDEE por factor de actividad, el
// déficit/superávit porcentual, el piso de seguridad por sexo y el `wellnessMode`
// — y de paso las macros, que usaban el `planGoal` calculado unas líneas arriba.
//
//   C1  separó las dos mitades en un seam, para que retirar la energía no
//       dejara a las macros sin su entrada.
//   C4  cedió la autoridad energética al HSC Energy Engine (DRI 2023 EER +
//       clasificación de actividad + prescripción) y dejó la mitad legacy sin un
//       solo consumidor productivo.
//   C5  la borró: `legacyEnergy`, `LegacyEnergy`, `computeNutritionTargets`,
//       `NutritionTargets`, `WellnessReason`, `goalFactor`, `sexFloor` y
//       `ACTIVITY_FACTORS`. También `calcTDEE`, en `tdee.ts`, que era su último
//       importador.
//
// ── EL SEAM, QUE AHORA ES LA FIRMA ──────────────────────────────────────────
//
//   store.planGoal  ◀── HSC Energy Engine (única autoridad energética)
//        │
//        ▼ energía explícita
//   legacyMacros(o, energyKcal, wellnessMode) ──▶ protG · fatG · carbG · fiberG
//
// `energyKcal` es la ÚNICA fuente de energía de `fatG`, `carbG` y `fiberG`. Ya no
// existe ninguna composición que la inyecte implícitamente, así que tampoco
// existe un fallback a la energía legacy: no hay energía legacy.
//
// ── DEUDA PENDIENTE · LA RETIRA CAPA 2 ──────────────────────────────────────
// `legacyMacroWellness` es un bridge temporal. No calcula energía (C5 verificó
// que no queda ni una fórmula en el archivo), pero su existencia preserva la
// política macro de una población concreta: ver su propio docblock.
//
// C5 es NUMÉRICAMENTE NEUTRO EN MACROS: ni un gramo cambia respecto a C4.

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
  conditions?: string[];        // condiciones de salud (renal → tope de proteína, etc.)
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
    conditions: typeof ob.conditions === 'string' && ob.conditions
      ? String(ob.conditions).split(',').map(s => s.trim()).filter(Boolean)
      : [],
  };
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

/**
 * ⚠️ DEUDA TEMPORAL DE C4 · LA RETIRA **CAPA 2** ⚠️
 *
 * Predicado de «modo bienestar» para la capa de MACROS, extraído de `legacyEnergy`
 * sin calcular una sola kcal.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * `legacyMacros` usa `wellnessMode` en un único sitio —`objKey`— y de ahí salen
 * la tabla de proteína (`GKG`) y el porcentaje de grasa (`FAT_PCT`). Hasta C4 ese
 * booleano lo producía `legacyEnergy`. Al retirarle la autoridad energética había
 * dos salidas: pasar `false` siempre, que CAMBIARÍA las macros de una población
 * real, o extraer el predicado. C4 cambia la ENERGÍA y no rediseña las macros, así
 * que extrae.
 *
 * ── QUIÉN ES ESA POBLACIÓN, Y POR QUÉ ES UNA SOLA ───────────────────────────
 * El predicado legacy tiene cuatro ramas. Tres son INALCANZABLES en PRESCRIBED:
 *   · `edad < 18`        → el Scope Guard corta en < 19
 *   · `embarazo`         → el Scope Guard lo saca de alcance
 *   · `edad >= 70`       → el Scope Guard corta en > 64 (Nutrition V1 = 19–64)
 *   · `IMC < 18.5` ∧ FAT_LOSS → `FAT_LOSS_BLOCKED` lo intercepta
 * Queda exactamente una: **`IMC < 18.5` ∧ RECOMPOSICIÓN**, porque el guard de IMC
 * vive dentro de la rama FAT_LOSS y `wantsToLose` también casa `/recompos/`. Ese
 * caso conserva `objKey = 'mantener'` exactamente como hasta ahora.
 *
 * Se conserva el predicado ÍNTEGRO en vez de recortarlo a esa rama: recortarlo
 * sería DECIDIR la política macro, y esa decisión es de CAPA 2. Esto preserva.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 * No calcula energía. No llama a `legacyEnergy` ni a `computeNutritionTargets`.
 * No lee `ACTIVITY_FACTORS`, `goalFactor` ni `sexFloor`. Devuelve un booleano y
 * nada más: no es, ni puede convertirse en, autoridad energética.
 *
 * ── QUÉ HARÁ CAPA 2 ────────────────────────────────────────────────────────
 * Decidir DESDE CERO si la ruta `IMC<18.5` + Recomposición debe existir y cuáles
 * son sus macros. Cuando lo haga, esta función desaparece.
 */
export function legacyMacroWellness(o: ObInput): boolean {
  const menor = o.edad < 18;
  const hM = o.estaturaCm / 100;
  const imc = hM > 0 ? o.pesoKg / (hM * hM) : 0;
  const riesgoBajoPeso = imc > 0 && imc < 18.5 && wantsToLose(o.goal);
  const mayor70 = o.edad >= 70;
  return menor || !!o.embarazo || riesgoBajoPeso || mayor70;
}

/**
 * Mitad de MACROS legacy. **SOBREVIVE HASTA LA FASE D.**
 *
 * ── EL SEAM ─────────────────────────────────────────────────────────────────
 * RECIBE la energía; no la calcula. Es la única diferencia respecto a antes de
 * C1, y es toda la razón de ser de este bloque: hasta ahora las macros usaban un
 * `planGoal` calculado unas líneas más arriba por la fórmula legacy, así que
 * retirar esa fórmula en C4 las habría dejado sin energía. Ahora C4 puede pasar
 * `prescribedEnergy` aquí y borrar `legacyEnergy` sin tocar una sola regla macro.
 *
 * `energyKcal` es la ÚNICA fuente de energía de `fatG`, `carbG` y `fiberG`. Esta
 * función no tiene acceso a `legacyEnergy` ni la invoca: la dependencia es
 * inequívocamente el argumento.
 *
 * ── POR QUÉ `wellnessMode` ES UN PARÁMETRO ──────────────────────────────────
 * `objKey` lo necesita: en modo bienestar la tabla de proteína usa 'mantener' en
 * vez del objetivo declarado. Es la ÚNICA dependencia que las macros tienen de la
 * mitad energética, y pasarla explícitamente la hace visible y auditable. Las
 * alternativas eran peores: recalcularla aquí duplicaría la lógica energética que
 * C4 va a retirar (una segunda fórmula), y suprimirla cambiaría la proteína de
 * menores, embarazo, bajo peso y ≥70 — que C1 no puede tocar.
 *
 * Cómo se resuelve esta dependencia en C4 NO está decidido, y C1 no lo prejuzga.
 * El problema real es que `wellnessMode` legacy MEZCLA dos decisiones sobre los
 * mismos datos: una energética —que CAPA 1 ya reemplazó por el alcance y el guard
 * de IMC— y una de MACROS, que debe sobrevivir hasta la Fase D. El caso de ≥70 lo
 * muestra: en la cadena nueva la edad NO altera la energía (no hay tope superior
 * de edad), pero la política macro de adulto mayor sigue vigente. C4 tendrá que
 * separar la parte macro de esta señal SIN devolverle autoridad energética, y esa
 * separación se diseña allí, no aquí.
 *
 * ── QUÉ NO CAMBIA AQUÍ ──────────────────────────────────────────────────────
 * `actIdx`, `GKG`, el tope de 2.4, el tope de 2.0 por ≥70, el tope renal de 1.0,
 * `FAT_PCT`, el piso de grasa de 0.6 g/kg y la fibra por 1000 kcal: idénticos.
 * `obData.activity` sigue alimentando `actIdx` exactamente igual.
 */
export interface LegacyMacros {
  protG: number;
  fatG: number;
  carbG: number;
  fiberG: number;
}

export function legacyMacros(o: ObInput, energyKcal: number, wellnessMode: boolean): LegacyMacros {
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
  // El umbral de 70 años se evalúa AQUÍ, no se recibe: es el umbral de un tope de
  // PROTEÍNA, no la regla energética de `wellnessMode` que casualmente usa el mismo
  // número. Son dos decisiones distintas sobre la misma edad, y C4 retira solo una.
  const mayor70 = o.edad >= 70;
  // Adulto mayor (>=70): tope de proteína a 2.0 g/kg. Sigue por encima del piso
  // anti-sarcopenia (1.6) pero evita 2.2-2.4 g/kg, que sin diagnóstico renal puede
  // forzar el riñón en una demografía con enfermedad renal crónica frecuente.
  if (mayor70 && gkg > 2.0) gkg = 2.0;
  // Enfermedad renal capturada: tope de proteína a 1.0 g/kg (rango protector para ERC).
  // Prevalece sobre todo lo anterior — la seguridad renal manda. La UI refuerza el
  // 'consulta a tu médico/nefrólogo' con el disclaimer.
  const renal = (o.conditions ?? []).includes('renal');
  if (renal && gkg > 1.0) gkg = 1.0;
  const protG = Math.round(o.pesoKg * gkg);
  // Grasa 20–35% kcal (Magaly 3.2): déficit en la parte baja, media en mantener/ganar.
  // Piso de seguridad 0.6 g/kg (protege función hormonal aunque el % quede bajo).
  const FAT_PCT: Record<string, number> = { bajar: 0.22, recomp: 0.25, mantener: 0.28, ganar: 0.30 };
  const fatPct = FAT_PCT[objKey] ?? 0.27;
  const fatG = Math.round(Math.max(energyKcal * fatPct / 9, o.pesoKg * 0.6));
  // Carbos = el RESTO (así las macros suman EXACTO la meta calórica, no la exceden).
  // Piso bajo (50 g) solo para casos extremos; a metas bajas rellena el resto en vez de
  // forzar 130 g, que hacía que el plan se pasara ~14% de la meta (déficit de mujer chica).
  const carbG = Math.round(Math.max(50, (energyKcal - protG * 4 - fatG * 9) / 4));
  const fiberG = Math.round(energyKcal / 1000 * 14);                // 14 g / 1000 kcal

  return { protG, fatG, carbG, fiberG };
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
): 'edad' | 'peso' | 'estatura' | 'grasa' | 'pesoMeta' | 'pesoMetaBajoPeso' | null {
  if (o.edad < 13 || o.edad > 100) return 'edad';
  if (o.pesoKg < 30 || o.pesoKg > 300) return 'peso';
  if (o.estaturaCm < 120 || o.estaturaCm > 220) return 'estatura';
  if (o.grasa != null) {
    const lo = o.sexo === 'Hombre' ? 3 : 8;
    const hi = o.sexo === 'Hombre' ? 50 : 55;
    if (o.grasa < lo || o.grasa > hi) return 'grasa';
  }
  if (o.pesoMeta != null && (o.pesoMeta < 30 || o.pesoMeta > 300)) return 'pesoMeta';
  // CAPA 0 · D03 · un peso meta con IMC < 18,5 se RECHAZA (antes solo era un
  // aviso, `bajopeso-meta`). HSC no acompaña hacia el bajo peso.
  if (o.pesoMeta != null) {
    const hM = o.estaturaCm / 100;
    if (o.pesoMeta / (hM * hM) < 18.5) return 'pesoMetaBajoPeso';
  }
  return null;
}

// ── Punto 8 — aviso de peso meta (IMC + % grasa manda sobre IMC) ───────────
// `bajopeso-meta` ya no existe: CAPA 0 · D03 convirtió ese aviso en un rechazo
// (`invalidField` → 'pesoMetaBajoPeso'), así que un peso meta así no llega aquí.
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
