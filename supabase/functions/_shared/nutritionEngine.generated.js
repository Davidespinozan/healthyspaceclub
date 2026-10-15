// @ts-self-types="./nutritionEngine.generated.d.ts"
// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/utils/energyPrescription.ts
var CANONICAL_GOALS = ["FAT_LOSS", "RECOMPOSITION", "MUSCLE_GAIN", "MAINTENANCE"];
var ENERGY_PRESCRIPTION_VERSION = 2;
var FAT_LOSS_RELATIVE_DEFICIT = 0.2;
var FAT_LOSS_ABSOLUTE_DEFICIT_CAP = 750;
var MUSCLE_GAIN_RELATIVE_SURPLUS = 0.05;
var FAT_LOSS_BLOCKED_BELOW_BMI = 18.5;
var HSC_FAT_LOSS_SCOPE_MIN_ENERGY = 1200;
var InvalidPrescriptionInputError = class extends Error {
  constructor(field, received, reason) {
    super(`EnergyPrescription · input inválido · ${field}: ${reason}. Recibido: ${describe(received)}`);
    __publicField(this, "field");
    __publicField(this, "received");
    this.name = "InvalidPrescriptionInputError";
    this.field = field;
    this.received = received;
  }
};
function describe(v) {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (v === null || v === void 0) return String(v);
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return Object.prototype.toString.call(v);
  }
}
function normalizeText(v) {
  return v.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}
function canonicalGoalFrom(value) {
  if (typeof value !== "string") {
    throw new InvalidPrescriptionInputError("goal", value, "debe ser una cadena mapeable");
  }
  switch (normalizeText(value)) {
    case "fat_loss":
    case "bajar grasa":
      return "FAT_LOSS";
    case "recomposition":
    case "recomposicion":
      return "RECOMPOSITION";
    case "muscle_gain":
    case "ganar musculo":
    case "subir masa muscular":
      return "MUSCLE_GAIN";
    case "maintenance":
    case "bienestar integral":
      return "MAINTENANCE";
    default:
      throw new InvalidPrescriptionInputError(
        "goal",
        value,
        "no mapea a ninguno de los cuatro objetivos canónicos"
      );
  }
}
function requirePositiveFinite(field, v) {
  if (typeof v !== "number") throw new InvalidPrescriptionInputError(field, v, "debe ser un número");
  if (!Number.isFinite(v)) throw new InvalidPrescriptionInputError(field, v, "debe ser finito");
  if (v <= 0) throw new InvalidPrescriptionInputError(field, v, "debe ser mayor que 0");
  return v;
}
function bmiFrom(heightCm, weightKg) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}
function goalEnergy(initialMaintenance, goal) {
  switch (goal) {
    case "MAINTENANCE":
    case "RECOMPOSITION":
      return {
        rawPrescribedEnergy: initialMaintenance,
        appliedDeficit: 0,
        appliedSurplus: 0,
        deficitBound: null
      };
    case "FAT_LOSS": {
      const candidate = initialMaintenance * FAT_LOSS_RELATIVE_DEFICIT;
      const capped = candidate > FAT_LOSS_ABSOLUTE_DEFICIT_CAP;
      const appliedDeficit = capped ? FAT_LOSS_ABSOLUTE_DEFICIT_CAP : candidate;
      return {
        rawPrescribedEnergy: initialMaintenance - appliedDeficit,
        appliedDeficit,
        appliedSurplus: 0,
        deficitBound: capped ? "absolute_cap" : "relative"
      };
    }
    case "MUSCLE_GAIN": {
      const appliedSurplus = initialMaintenance * MUSCLE_GAIN_RELATIVE_SURPLUS;
      return {
        rawPrescribedEnergy: initialMaintenance + appliedSurplus,
        appliedDeficit: 0,
        appliedSurplus,
        deficitBound: null
      };
    }
  }
}
function requireMaintenance(m) {
  if (m === null || typeof m !== "object") {
    throw new InvalidPrescriptionInputError("maintenance", m, "debe ser una MaintenanceEstimate");
  }
  const v = m.initialMaintenance;
  if (typeof v !== "number") {
    throw new InvalidPrescriptionInputError("maintenance.initialMaintenance", v, "debe ser un número");
  }
  if (!Number.isFinite(v)) {
    throw new InvalidPrescriptionInputError("maintenance.initialMaintenance", v, "debe ser finito");
  }
  if (v <= 0) {
    throw new InvalidPrescriptionInputError("maintenance.initialMaintenance", v, "debe ser mayor que 0");
  }
  return v;
}
function prescribeEnergy(request) {
  if (request === null || typeof request !== "object") {
    throw new InvalidPrescriptionInputError("request", request, "debe ser un objeto");
  }
  const goal = request.goal;
  if (!CANONICAL_GOALS.includes(goal)) {
    throw new InvalidPrescriptionInputError(
      "goal",
      goal,
      `debe ser uno de ${CANONICAL_GOALS.join(" | ")} (usa canonicalGoalFrom en el boundary)`
    );
  }
  const maintenance2 = request.maintenance;
  const m = requireMaintenance(maintenance2);
  const base = { goal, maintenance: maintenance2, engineVersion: ENERGY_PRESCRIPTION_VERSION };
  let draft;
  if (goal === "FAT_LOSS") {
    const heightCm = requirePositiveFinite("heightCm", request.heightCm);
    const weightKg = requirePositiveFinite("weightKg", request.weightKg);
    const bmi = bmiFrom(heightCm, weightKg);
    const fatLossBase = { ...base, goal: "FAT_LOSS", bmi };
    if (bmi < FAT_LOSS_BLOCKED_BELOW_BMI) {
      return { ...fatLossBase, status: "FAT_LOSS_BLOCKED" };
    }
    const energy = goalEnergy(m, "FAT_LOSS");
    if (energy.rawPrescribedEnergy <= HSC_FAT_LOSS_SCOPE_MIN_ENERGY) {
      return { ...fatLossBase, status: "OUTSIDE_HSC_FAT_LOSS_SCOPE", ...energy };
    }
    draft = { ...fatLossBase, ...energy };
  } else {
    draft = { ...base, goal, ...goalEnergy(m, goal) };
  }
  return {
    ...draft,
    status: "PRESCRIBED",
    prescribedEnergy: Math.round(draft.rawPrescribedEnergy)
  };
}

// src/utils/nutritionTrajectory.ts
var TRAJECTORY_ENGINE_VERSION = 1;
var FAT_LOSS_MIN_WINDOW_DAYS = 13;
var BODY_MIN_WINDOW_DAYS = 27;
var DAYS_PER_MONTH = 30.4375;
var FAT_LOSS_VERY_SLOW_BELOW_PCT_WEEK = 0.25;
var FAT_LOSS_ON_TARGET_FROM_PCT_WEEK = 0.5;
var FAT_LOSS_FAST_ABOVE_PCT_WEEK = 1;
var MUSCLE_GAIN_EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
var MUSCLE_GAIN_TARGET_KG_PER_MONTH = {
  BEGINNER: { min: 0.5, max: 0.8 },
  INTERMEDIATE: { min: 0.3, max: 0.6 },
  ADVANCED: { min: 0.15, max: 0.4 }
};
var RECOMP_STABLE_KG_PER_MONTH = 0.5;
var MAINTENANCE_BAND_PCT = 1;
var DIRECTION_STABLE_BAND_PCT = 0.25;
var r6 = (x) => Math.round(x * 1e6) / 1e6 || 0;
var DAY_MS = 864e5;
function ymdToUtcDay(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t / DAY_MS;
}
function elapsedDaysOf(e) {
  if ("elapsedDays" in e) {
    if (typeof e.elapsedDays !== "number" || !Number.isFinite(e.elapsedDays)) return "INVALID_DATE";
    return e.elapsedDays > 0 ? e.elapsedDays : "NON_CHRONOLOGICAL_DATES";
  }
  const a = typeof e.previousDate === "string" ? ymdToUtcDay(e.previousDate) : null;
  const b = typeof e.currentDate === "string" ? ymdToUtcDay(e.currentDate) : null;
  if (a == null || b == null) return "INVALID_DATE";
  return b > a ? b - a : "NON_CHRONOLOGICAL_DATES";
}
var isMissing = (w) => w === null || w === void 0;
var isValidWeight = (w) => typeof w === "number" && Number.isFinite(w) && w > 0;
function metricsOf(prev, curr, days) {
  const weeks = days / 7;
  const changeKg = curr - prev;
  const pct = changeKg / prev * 100;
  const pctR = r6(pct);
  return {
    previousWeightKg: prev,
    currentWeightKg: curr,
    elapsedDays: days,
    evaluationWindowWeeks: r6(weeks),
    absoluteChangeKg: r6(changeKg),
    percentChangeFromBaseline: pctR,
    percentChangePerWeek: r6(pct / weeks),
    changeKgPerMonth: r6(changeKg / days * DAYS_PER_MONTH),
    direction: pctR < -DIRECTION_STABLE_BAND_PCT ? "DOWN" : pctR > DIRECTION_STABLE_BAND_PCT ? "UP" : "STABLE"
  };
}
function classify(objective, m, level) {
  switch (objective) {
    case "FAT_LOSS": {
      const loss = r6(-m.percentChangePerWeek);
      const rate = loss < FAT_LOSS_VERY_SLOW_BELOW_PCT_WEEK ? "VERY_SLOW" : loss < FAT_LOSS_ON_TARGET_FROM_PCT_WEEK ? "BORDERLINE_SLOW" : loss <= FAT_LOSS_FAST_ABOVE_PCT_WEEK ? "ON_TARGET" : "FAST";
      return { objective, lossPercentPerWeek: loss, rate };
    }
    case "MUSCLE_GAIN": {
      const target = MUSCLE_GAIN_TARGET_KG_PER_MONTH[level];
      const gain = m.changeKgPerMonth;
      const rate = gain < target.min ? "BELOW_TARGET" : gain > target.max ? "ABOVE_TARGET" : "ON_TARGET";
      return { objective, experienceLevel: level, gainKgPerMonth: gain, targetKgPerMonth: { ...target }, rate };
    }
    case "RECOMPOSITION": {
      const c = m.changeKgPerMonth;
      const weight = c < -RECOMP_STABLE_KG_PER_MONTH ? "DOWN" : c > RECOMP_STABLE_KG_PER_MONTH ? "UP" : "RELATIVELY_STABLE";
      return { objective, changeKgPerMonth: c, weight };
    }
    case "MAINTENANCE": {
      const p = m.percentChangeFromBaseline;
      const band = p < -MAINTENANCE_BAND_PCT ? "BELOW_MAINTENANCE_BAND" : p > MAINTENANCE_BAND_PCT ? "ABOVE_MAINTENANCE_BAND" : "WITHIN_MAINTENANCE_BAND";
      return { objective, percentChangeFromBaseline: p, band };
    }
  }
}
function requiredWindowDays(objective) {
  return objective === "FAT_LOSS" ? FAT_LOSS_MIN_WINDOW_DAYS : BODY_MIN_WINDOW_DAYS;
}
function assessTrajectory(input) {
  const { objective, previousWeightKg: prev, currentWeightKg: curr, elapsed } = input;
  if (!CANONICAL_GOALS.includes(objective)) return { status: "INVALID_INPUT", reason: "UNKNOWN_OBJECTIVE" };
  if (!isMissing(prev) && !isValidWeight(prev)) return { status: "INVALID_INPUT", reason: "INVALID_WEIGHT" };
  if (!isMissing(curr) && !isValidWeight(curr)) return { status: "INVALID_INPUT", reason: "INVALID_WEIGHT" };
  const days = elapsedDaysOf(elapsed);
  if (typeof days !== "number") return { status: "INVALID_INPUT", reason: days };
  const level = input.experienceLevel;
  const needsLevel = objective === "MUSCLE_GAIN";
  if (needsLevel && !isMissing(level) && !MUSCLE_GAIN_EXPERIENCE_LEVELS.includes(level)) {
    return { status: "INVALID_INPUT", reason: "UNKNOWN_EXPERIENCE_LEVEL" };
  }
  if (!isValidWeight(prev)) return { status: "ASSESSED", sufficiency: "INSUFFICIENT_DATA", objective, missing: "PREVIOUS_WEIGHT", metrics: null };
  if (!isValidWeight(curr)) return { status: "ASSESSED", sufficiency: "INSUFFICIENT_DATA", objective, missing: "CURRENT_WEIGHT", metrics: null };
  const metrics = metricsOf(prev, curr, days);
  if (needsLevel && isMissing(level)) {
    return { status: "ASSESSED", sufficiency: "INSUFFICIENT_DATA", objective, missing: "EXPERIENCE_LEVEL", metrics };
  }
  const required = requiredWindowDays(objective);
  if (days < required) {
    return { status: "ASSESSED", sufficiency: "INSUFFICIENT_WINDOW", objective, requiredWindowDays: required, metrics };
  }
  return {
    status: "ASSESSED",
    sufficiency: "SUFFICIENT_FOR_DECISION",
    objective,
    requiredWindowDays: required,
    metrics,
    classification: classify(objective, metrics, needsLevel ? level : null)
  };
}

// src/utils/nutritionCheckin.ts
var NUTRITION_CHECKIN_VERSION = 1;
var ADHERENCE_ANSWERS = ["PRACTICALLY_ALL", "ALMOST_ALWAYS", "MOST_DAYS", "SOMETIMES", "VERY_LITTLE"];
var ADHERENCE_ANSWER_COPY_RANGE_PCT = {
  PRACTICALLY_ALL: { min: 90, max: null },
  ALMOST_ALWAYS: { min: 80, max: 89 },
  MOST_DAYS: { min: 60, max: 79 },
  SOMETIMES: { min: 30, max: 59 },
  VERY_LITTLE: { min: 0, max: 29 }
};
var ADHERENCE_ANSWER_BAND = {
  PRACTICALLY_ALL: "HIGH",
  ALMOST_ALWAYS: "HIGH",
  MOST_DAYS: "MEDIUM",
  SOMETIMES: "LOW",
  VERY_LITTLE: "LOW"
};
function adherenceBandOf(answer) {
  return isOneOf(answer, ADHERENCE_ANSWERS) ? ADHERENCE_ANSWER_BAND[answer] : null;
}
var NUTRITION_HUNGER_VALUES = ["LOW", "NORMAL", "HIGH"];
var NUTRITION_ENERGY_VALUES = ["LOW", "NORMAL", "GOOD"];
var NUTRITION_PERFORMANCE_VALUES = ["WORSE", "SAME", "BETTER", "NOT_APPLICABLE"];
var STRENGTH_EXPERIENCE_VALUES = MUSCLE_GAIN_EXPERIENCE_LEVELS;
var RECENT_STRENGTH_CONTINUITY_VALUES = ["YES", "NO"];
var WAIST_REQUIRED_OBJECTIVES = ["RECOMPOSITION"];
var STRENGTH_EXPERIENCE_REQUIRED_OBJECTIVES = ["MUSCLE_GAIN"];
function isOneOf(v, list) {
  return typeof v === "string" && list.includes(v);
}
var isAbsent = (v) => v === null || v === void 0;
var isPositiveFinite = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
var isPositiveInt = (v) => typeof v === "number" && Number.isInteger(v) && v >= 1;
function isValidYmd(v) {
  if (typeof v !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}
function validateNutritionCheckin(input) {
  const invalid = [];
  const missing = [];
  const required = (field, ok) => {
    const v = input[field];
    if (isAbsent(v)) missing.push(field);
    else if (!ok(v)) invalid.push(field);
  };
  const optional = (field, ok, requiredNow) => {
    const v = input[field];
    if (isAbsent(v)) {
      if (requiredNow) missing.push(field);
    } else if (!ok(v)) invalid.push(field);
  };
  required("objective", (v) => isOneOf(v, CANONICAL_GOALS));
  const objective = isOneOf(input.objective, CANONICAL_GOALS) ? input.objective : null;
  required("weightKg", isPositiveFinite);
  optional("waistCm", isPositiveFinite, objective != null && WAIST_REQUIRED_OBJECTIVES.includes(objective));
  required("adherenceAnswer", (v) => isOneOf(v, ADHERENCE_ANSWERS));
  required("hunger", (v) => isOneOf(v, NUTRITION_HUNGER_VALUES));
  required("energy", (v) => isOneOf(v, NUTRITION_ENERGY_VALUES));
  required("performance", (v) => isOneOf(v, NUTRITION_PERFORMANCE_VALUES));
  optional("trainsStrength", (v) => typeof v === "boolean", false);
  optional(
    "strengthExperience",
    (v) => isOneOf(v, STRENGTH_EXPERIENCE_VALUES),
    objective != null && STRENGTH_EXPERIENCE_REQUIRED_OBJECTIVES.includes(objective)
  );
  optional("recentStrengthContinuity", (v) => isOneOf(v, RECENT_STRENGTH_CONTINUITY_VALUES), false);
  required("checkinDate", isValidYmd);
  optional("cycleNumber", isPositiveInt, false);
  if (invalid.length > 0) return { status: "INVALID", invalid };
  if (missing.length > 0) return { status: "INCOMPLETE", missing };
  const answer = input.adherenceAnswer;
  return {
    status: "VALID",
    checkin: {
      objective,
      weightKg: input.weightKg,
      waistCm: isAbsent(input.waistCm) ? null : input.waistCm,
      adherence: { answer, band: ADHERENCE_ANSWER_BAND[answer] },
      hunger: input.hunger,
      energy: input.energy,
      performance: input.performance,
      trainsStrength: isAbsent(input.trainsStrength) ? null : input.trainsStrength,
      strengthExperience: isAbsent(input.strengthExperience) ? null : input.strengthExperience,
      recentStrengthContinuity: isAbsent(input.recentStrengthContinuity) ? null : input.recentStrengthContinuity,
      checkinDate: input.checkinDate,
      cycleNumber: isAbsent(input.cycleNumber) ? null : input.cycleNumber
    }
  };
}

// src/utils/adaptiveNutritionDecision.ts
var ADAPTIVE_DECISION_VERSION = 1;
var CALIBRATION_STEP_MIN = -2;
var CALIBRATION_STEP_MAX = 2;
var WAIST_SAME_TOLERANCE_CM = 0.5;
var ADAPTIVE_ACTIONS = ["MAINTAIN", "STEP_UP", "STEP_DOWN", "REVIEW", "NO_ADJUSTMENT"];
var isAbsent2 = (v) => v === null || v === void 0;
var isPositiveFinite2 = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
function isOneOf2(v, list) {
  return typeof v === "string" && list.includes(v);
}
function classifyWaistChange(previousCm, currentCm) {
  const delta = Math.round((currentCm - previousCm) * 1e6) / 1e6;
  return delta < -WAIST_SAME_TOLERANCE_CM ? "LOWER" : delta > WAIST_SAME_TOLERANCE_CM ? "HIGHER" : "SAME";
}
var hasNegativeSignals = (s) => s.hunger === "HIGH" || s.energy === "LOW" || s.performance === "WORSE";
var isAppliedStep = (a) => a === "STEP_UP" || a === "STEP_DOWN";
function isValidPrevious(p) {
  if (typeof p !== "object" || p === null) return false;
  const c = p;
  const cls = c.classification;
  return isOneOf2(c.action, ADAPTIVE_ACTIONS) && (cls === null || typeof cls === "object" && cls !== void 0 && isOneOf2(cls.objective, CANONICAL_GOALS)) && isOneOf2(c.hunger, NUTRITION_HUNGER_VALUES) && isOneOf2(c.energy, NUTRITION_ENERGY_VALUES) && isOneOf2(c.performance, NUTRITION_PERFORMANCE_VALUES) && (c.waistCm === null || isPositiveFinite2(c.waistCm));
}
function previousFatLossRate(prev) {
  if (prev == null || isAppliedStep(prev.action)) return null;
  return prev.classification?.objective === "FAT_LOSS" ? prev.classification.rate : null;
}
var rule = (action, reason) => ({ action, reason });
function fatLoss(cls, c, prev) {
  const symptoms = hasNegativeSignals(c);
  const prevRate = previousFatLossRate(prev);
  switch (cls.rate) {
    case "VERY_SLOW":
      return symptoms ? rule("REVIEW", "CONTRADICTORY_SIGNALS") : rule("STEP_DOWN", "VERY_SLOW");
    case "BORDERLINE_SLOW":
      if (prevRate === "BORDERLINE_SLOW") {
        return symptoms || hasNegativeSignals(prev) ? rule("REVIEW", "CONTRADICTORY_SIGNALS") : rule("STEP_DOWN", "BORDERLINE_SLOW_CONFIRMED");
      }
      return symptoms ? rule("REVIEW", "CONTRADICTORY_SIGNALS") : rule("MAINTAIN", "BORDERLINE_SLOW_FIRST");
    case "ON_TARGET":
      return symptoms ? rule("STEP_UP", "DEFICIT_SYMPTOMS") : rule("MAINTAIN", "ON_TARGET");
    case "FAST":
      if (symptoms) return rule("STEP_UP", "FAST_WITH_SYMPTOMS");
      return prevRate === "FAST" ? rule("STEP_UP", "FAST_CONFIRMED") : rule("MAINTAIN", "FAST_FIRST");
  }
}
function muscleGain(cls, c, prev) {
  const p = c.performance;
  switch (cls.rate) {
    case "BELOW_TARGET":
      if (p === "NOT_APPLICABLE") return rule("REVIEW", "NO_TRAINING_SIGNAL");
      return p === "BETTER" ? rule("MAINTAIN", "PERFORMANCE_IMPROVING") : rule("STEP_UP", "BELOW_TARGET");
    case "ON_TARGET": {
      if (p === "NOT_APPLICABLE") return rule("REVIEW", "NO_TRAINING_SIGNAL");
      if (p === "WORSE") return rule("REVIEW", "PERFORMANCE_WORSE");
      const prevWaist = prev?.waistCm ?? null;
      if (prevWaist != null && c.waistCm != null && classifyWaistChange(prevWaist, c.waistCm) === "HIGHER") {
        return rule("REVIEW", "WAIST_WORSENING");
      }
      return rule("MAINTAIN", "ON_TARGET");
    }
    case "ABOVE_TARGET":
      return rule("STEP_DOWN", "ABOVE_TARGET");
  }
}
function recomposition(cls, c, prev) {
  const prevWaist = prev?.waistCm ?? null;
  if (prevWaist == null || c.waistCm == null) return rule("NO_ADJUSTMENT", "INSUFFICIENT_DATA");
  const p = c.performance;
  if (p === "NOT_APPLICABLE") return rule("REVIEW", "NO_TRAINING_SIGNAL");
  const waist = classifyWaistChange(prevWaist, c.waistCm);
  const holding = p === "SAME" || p === "BETTER";
  switch (cls.weight) {
    case "RELATIVELY_STABLE":
      if (p === "WORSE") return rule("REVIEW", "PERFORMANCE_WORSE");
      if (waist === "LOWER") return rule("MAINTAIN", "WAIST_IMPROVING");
      if (waist === "SAME") return p === "BETTER" ? rule("MAINTAIN", "PERFORMANCE_IMPROVING") : rule("REVIEW", "NO_CLEAR_PROGRESS");
      return p === "SAME" ? rule("STEP_DOWN", "WAIST_WORSENING") : rule("REVIEW", "CONTRADICTORY_SIGNALS");
    case "DOWN":
      if (p === "WORSE") return rule("STEP_UP", "PERFORMANCE_WORSE");
      if (waist === "LOWER" && holding) return rule("MAINTAIN", "WAIST_IMPROVING");
      return rule("REVIEW", "CONTRADICTORY_SIGNALS");
    case "UP":
      if (waist === "HIGHER") return p === "WORSE" ? rule("REVIEW", "PERFORMANCE_WORSE") : rule("STEP_DOWN", "WAIST_WORSENING");
      if (p === "BETTER") return rule("MAINTAIN", "PERFORMANCE_IMPROVING");
      return rule("REVIEW", "CONTRADICTORY_SIGNALS");
  }
}
function maintenance(cls, c) {
  switch (cls.band) {
    case "WITHIN_MAINTENANCE_BAND":
      return hasNegativeSignals(c) ? rule("REVIEW", "NEGATIVE_SIGNALS") : rule("MAINTAIN", "WITHIN_MAINTENANCE_BAND");
    case "BELOW_MAINTENANCE_BAND":
      return rule("STEP_UP", "BELOW_MAINTENANCE_BAND");
    case "ABOVE_MAINTENANCE_BAND":
      return rule("STEP_DOWN", "ABOVE_MAINTENANCE_BAND");
  }
}
function objectiveRule(cls, c, prev) {
  switch (cls.objective) {
    case "FAT_LOSS":
      return fatLoss(cls, c, prev);
    case "MUSCLE_GAIN":
      return muscleGain(cls, c, prev);
    case "RECOMPOSITION":
      return recomposition(cls, c, prev);
    case "MAINTENANCE":
      return maintenance(cls, c);
  }
}
function decideAdaptiveNutrition(input) {
  const { objective, trajectory, checkin, currentStep, cycleIndex, previous } = input;
  const invalid = (reason) => ({ status: "INVALID_INPUT", reason });
  if (!isOneOf2(objective, CANONICAL_GOALS)) return invalid("UNKNOWN_OBJECTIVE");
  if (!Number.isInteger(currentStep) || currentStep < CALIBRATION_STEP_MIN || currentStep > CALIBRATION_STEP_MAX) return invalid("INVALID_STEP");
  if (!Number.isInteger(cycleIndex) || cycleIndex < 1) return invalid("INVALID_CYCLE_INDEX");
  if (checkin?.status !== "VALID") return invalid("CHECKIN_NOT_VALID");
  if (trajectory?.status !== "ASSESSED") return invalid("TRAJECTORY_INVALID");
  const c = checkin.checkin;
  if (trajectory.objective !== objective || c.objective !== objective) return invalid("OBJECTIVE_MISMATCH");
  if (c.cycleNumber != null && c.cycleNumber !== cycleIndex) return invalid("CYCLE_MISMATCH");
  if (trajectory.metrics != null && trajectory.metrics.currentWeightKg !== c.weightKg) return invalid("WEIGHT_MISMATCH");
  if (!isAbsent2(previous) && !isValidPrevious(previous)) return invalid("INVALID_PREVIOUS_CONTEXT");
  const prev = previous ?? null;
  const decided = (r2, blocked = null) => ({
    status: "DECIDED",
    decision: {
      action: r2.action,
      reason: r2.reason,
      objective,
      cycleIndex,
      currentStep,
      proposedStep: currentStep + (r2.action === "STEP_UP" ? 1 : r2.action === "STEP_DOWN" ? -1 : 0),
      blocked
    }
  });
  if (trajectory.sufficiency !== "SUFFICIENT_FOR_DECISION") {
    return decided(rule("NO_ADJUSTMENT", trajectory.sufficiency === "INSUFFICIENT_WINDOW" ? "INSUFFICIENT_WINDOW" : "INSUFFICIENT_DATA"));
  }
  if (c.adherence.band !== "HIGH") return decided(rule("NO_ADJUSTMENT", "ADHERENCE_NOT_HIGH"));
  const r = objectiveRule(trajectory.classification, c, prev);
  if (r.action !== "STEP_UP" && r.action !== "STEP_DOWN") return decided(r);
  const next = currentStep + (r.action === "STEP_UP" ? 1 : -1);
  if (next > CALIBRATION_STEP_MAX || next < CALIBRATION_STEP_MIN) {
    return decided(rule("REVIEW", "CALIBRATION_LIMIT_REACHED"), { action: r.action, reason: r.reason });
  }
  const opposite = r.action === "STEP_UP" ? "STEP_DOWN" : "STEP_UP";
  if (prev?.action === opposite) {
    return decided(rule("REVIEW", "DIRECTION_REVERSAL_BLOCKED"), { action: r.action, reason: r.reason });
  }
  return decided(r);
}

// src/utils/activityClassifier.ts
var DAILY_LIFE_LEVELS = ["DL1", "DL2", "DL3", "DL4"];
var TRAINING_BANDS = ["T0", "T1", "T2", "T3", "T4"];
var ACTIVITY_CATEGORIES = ["INACTIVE", "LOW_ACTIVE", "ACTIVE", "VERY_ACTIVE"];
var ACTIVITY_CLASSIFIER_VERSION = 1;
var InvalidActivityProfileError = class extends Error {
  constructor(field, received, reason) {
    super(`ActivityProfile inválido · ${field}: ${reason}. Recibido: ${describe2(received)}`);
    __publicField(this, "field");
    __publicField(this, "received");
    this.name = "InvalidActivityProfileError";
    this.field = field;
    this.received = received;
  }
};
function describe2(v) {
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (v === null || v === void 0) return String(v);
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return Object.prototype.toString.call(v);
  }
}
function trainingBandOf(weeklyTrainingMinutes) {
  if (weeklyTrainingMinutes >= 420) return "T4";
  if (weeklyTrainingMinutes >= 300) return "T3";
  if (weeklyTrainingMinutes >= 150) return "T2";
  if (weeklyTrainingMinutes >= 60) return "T1";
  return "T0";
}
var MATRIX = {
  DL1: { T0: "CLEAR_I", T1: "B_I_L", T2: "CLEAR_L", T3: "B_L_A", T4: "CLEAR_A" },
  DL2: { T0: "B_I_L", T1: "CLEAR_L", T2: "B_L_A", T3: "CLEAR_A", T4: "B_A_V" },
  DL3: { T0: "B_L_A", T1: "B_L_A", T2: "CLEAR_A", T3: "B_A_V", T4: "B_A_V" },
  DL4: { T0: "B_A_V", T1: "B_A_V", T2: "B_A_V", T3: "B_A_V", T4: "B_A_V" }
};
function activityOrdinalRank(c) {
  if (c.classificationConfidence === "CLEAR") {
    return 2 * ACTIVITY_CATEGORIES.indexOf(c.category) + 1;
  }
  return 2 * ACTIVITY_CATEGORIES.indexOf(c.lowerCategory) + 2;
}
function deriveWeeklyTrainingMinutes(t) {
  if (typeof t?.trainsHabitually !== "boolean") {
    throw new InvalidActivityProfileError(
      "habitualTraining.trainsHabitually",
      t?.trainsHabitually,
      "debe ser booleano"
    );
  }
  if (!t.trainsHabitually) return 0;
  requireDiscreteCount("habitualTraining.daysPerWeek", t.daysPerWeek, 0, 7);
  requireDiscreteCount("habitualTraining.habitualSessionMinutes", t.habitualSessionMinutes, 0, 1440);
  if (t.daysPerWeek === 0) {
    throw new InvalidActivityProfileError(
      "habitualTraining.daysPerWeek",
      t.daysPerWeek,
      "incoherente con trainsHabitually=true (declara entrenar 0 días)"
    );
  }
  if (t.habitualSessionMinutes === 0) {
    throw new InvalidActivityProfileError(
      "habitualTraining.habitualSessionMinutes",
      t.habitualSessionMinutes,
      "incoherente con trainsHabitually=true (declara sesiones de 0 minutos)"
    );
  }
  return t.daysPerWeek * t.habitualSessionMinutes;
}
function requireDiscreteCount(field, v, min, max) {
  if (typeof v !== "number") {
    throw new InvalidActivityProfileError(field, v, "debe ser un número");
  }
  if (!Number.isFinite(v)) {
    throw new InvalidActivityProfileError(field, v, "debe ser finito");
  }
  if (!Number.isInteger(v)) {
    throw new InvalidActivityProfileError(field, v, "debe ser un entero");
  }
  if (v < min || v > max) {
    throw new InvalidActivityProfileError(field, v, `debe estar en [${min}, ${max}]`);
  }
}
function isDailyLifeLevel(v) {
  return typeof v === "string" && DAILY_LIFE_LEVELS.includes(v);
}
function clear(category, matrixCell, weeklyTrainingMinutes) {
  return {
    classificationConfidence: "CLEAR",
    category,
    matrixCell,
    weeklyTrainingMinutes,
    engineVersion: ACTIVITY_CLASSIFIER_VERSION
  };
}
function borderline(lowerCategory, upperCategory, matrixCell, weeklyTrainingMinutes) {
  const lo = ACTIVITY_CATEGORIES.indexOf(lowerCategory);
  const hi = ACTIVITY_CATEGORIES.indexOf(upperCategory);
  if (hi - lo !== 1) {
    throw new Error(
      `[activityClassifier] BORDERLINE no adyacente: ${lowerCategory} ↔ ${upperCategory}. Un BORDERLINE solo puede interpolar dos categorías DRI contiguas.`
    );
  }
  return {
    classificationConfidence: "BORDERLINE",
    lowerCategory,
    upperCategory,
    matrixCell,
    weeklyTrainingMinutes,
    engineVersion: ACTIVITY_CLASSIFIER_VERSION
  };
}
function fromCellCode(code, matrixCell, weeklyTrainingMinutes) {
  switch (code) {
    case "CLEAR_I":
      return clear("INACTIVE", matrixCell, weeklyTrainingMinutes);
    case "CLEAR_L":
      return clear("LOW_ACTIVE", matrixCell, weeklyTrainingMinutes);
    case "CLEAR_A":
      return clear("ACTIVE", matrixCell, weeklyTrainingMinutes);
    case "B_I_L":
      return borderline("INACTIVE", "LOW_ACTIVE", matrixCell, weeklyTrainingMinutes);
    case "B_L_A":
      return borderline("LOW_ACTIVE", "ACTIVE", matrixCell, weeklyTrainingMinutes);
    case "B_A_V":
      return borderline("ACTIVE", "VERY_ACTIVE", matrixCell, weeklyTrainingMinutes);
  }
}
function classifyActivity(profile) {
  if (profile === null || typeof profile !== "object") {
    throw new InvalidActivityProfileError("profile", profile, "debe ser un objeto");
  }
  if (!isDailyLifeLevel(profile.dailyLife)) {
    throw new InvalidActivityProfileError(
      "dailyLife",
      profile.dailyLife,
      `debe ser uno de ${DAILY_LIFE_LEVELS.join(" | ")}`
    );
  }
  const training = profile.habitualTraining;
  if (training === null || typeof training !== "object") {
    throw new InvalidActivityProfileError("habitualTraining", training, "debe ser un objeto");
  }
  const weeklyTrainingMinutes = deriveWeeklyTrainingMinutes(training);
  const trainingBand = trainingBandOf(weeklyTrainingMinutes);
  const matrixCell = { dailyLife: profile.dailyLife, trainingBand };
  return fromCellCode(MATRIX[profile.dailyLife][trainingBand], matrixCell, weeklyTrainingMinutes);
}

// src/utils/maintenanceEstimate.ts
var BIOLOGICAL_SEXES = ["male", "female"];
var ADULT_ROUTE_MIN_AGE_YEARS = 19;
var MAINTENANCE_ESTIMATE_VERSION = 1;
var EER_COEFFICIENTS = {
  male: {
    INACTIVE: { intercept: 753.07, age: -10.83, heightCm: 6.5, weightKg: 14.1 },
    LOW_ACTIVE: { intercept: 581.47, age: -10.83, heightCm: 8.3, weightKg: 14.94 },
    ACTIVE: { intercept: 1004.82, age: -10.83, heightCm: 6.52, weightKg: 15.91 },
    VERY_ACTIVE: { intercept: -517.88, age: -10.83, heightCm: 15.61, weightKg: 19.11 }
  },
  female: {
    INACTIVE: { intercept: 584.9, age: -7.01, heightCm: 5.72, weightKg: 11.71 },
    LOW_ACTIVE: { intercept: 575.77, age: -7.01, heightCm: 6.6, weightKg: 12.14 },
    ACTIVE: { intercept: 710.25, age: -7.01, heightCm: 6.54, weightKg: 12.34 },
    VERY_ACTIVE: { intercept: 511.83, age: -7.01, heightCm: 9.07, weightKg: 12.56 }
  }
};
var InvalidMaintenanceInputError = class extends Error {
  constructor(field, received, reason) {
    super(`MaintenanceEstimate · input inválido · ${field}: ${reason}. Recibido: ${describe3(received)}`);
    __publicField(this, "field");
    __publicField(this, "received");
    this.name = "InvalidMaintenanceInputError";
    this.field = field;
    this.received = received;
  }
};
function describe3(v) {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (v === null || v === void 0) return String(v);
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return Object.prototype.toString.call(v);
  }
}
function biologicalSexFrom(value) {
  if (typeof value !== "string") {
    throw new InvalidMaintenanceInputError("sex", value, "debe ser una cadena mapeable");
  }
  switch (value.trim().toLowerCase()) {
    case "male":
    case "hombre":
      return "male";
    case "female":
    case "mujer":
      return "female";
    default:
      throw new InvalidMaintenanceInputError(
        "sex",
        value,
        "no mapea a ninguna ecuación DRI (se esperaba 'Hombre'/'Mujer' o 'male'/'female')"
      );
  }
}
function isBiologicalSex(v) {
  return v === "male" || v === "female";
}
function isActivityCategory(v) {
  return typeof v === "string" && ACTIVITY_CATEGORIES.includes(v);
}
function requirePositiveFinite2(field, v) {
  if (typeof v !== "number") throw new InvalidMaintenanceInputError(field, v, "debe ser un número");
  if (!Number.isFinite(v)) throw new InvalidMaintenanceInputError(field, v, "debe ser finito");
  if (v <= 0) throw new InvalidMaintenanceInputError(field, v, "debe ser mayor que 0");
  return v;
}
function validateAnthropometry(a) {
  if (a === null || typeof a !== "object") {
    throw new InvalidMaintenanceInputError("anthropometry", a, "debe ser un objeto");
  }
  if (!isBiologicalSex(a.sex)) {
    throw new InvalidMaintenanceInputError(
      "sex",
      a.sex,
      `debe ser uno de ${BIOLOGICAL_SEXES.join(" | ")} (usa biologicalSexFrom en el boundary)`
    );
  }
  if (typeof a.ageYears !== "number") {
    throw new InvalidMaintenanceInputError("ageYears", a.ageYears, "debe ser un número");
  }
  if (!Number.isFinite(a.ageYears)) {
    throw new InvalidMaintenanceInputError("ageYears", a.ageYears, "debe ser finito");
  }
  if (a.ageYears < ADULT_ROUTE_MIN_AGE_YEARS) {
    throw new InvalidMaintenanceInputError(
      "ageYears",
      a.ageYears,
      `la ruta adulta del DRI empieza en ${ADULT_ROUTE_MIN_AGE_YEARS} años (no hay tope superior)`
    );
  }
  requirePositiveFinite2("heightCm", a.heightCm);
  requirePositiveFinite2("weightKg", a.weightKg);
  return a;
}
function eerForCategory(anthropometry, category) {
  const a = validateAnthropometry(anthropometry);
  if (!isActivityCategory(category)) {
    throw new InvalidMaintenanceInputError(
      "category",
      category,
      `debe ser una de ${ACTIVITY_CATEGORIES.join(" | ")}`
    );
  }
  const c = EER_COEFFICIENTS[a.sex][category];
  return c.intercept + c.age * a.ageYears + c.heightCm * a.heightCm + c.weightKg * a.weightKg;
}
function validateClassification(c) {
  if (c === null || typeof c !== "object") {
    throw new InvalidMaintenanceInputError("classification", c, "debe ser un objeto");
  }
  const conf = c.classificationConfidence;
  if (conf !== "CLEAR" && conf !== "BORDERLINE") {
    throw new InvalidMaintenanceInputError(
      "classification.classificationConfidence",
      conf,
      "debe ser 'CLEAR' o 'BORDERLINE'"
    );
  }
  if (typeof c.engineVersion !== "number" || !Number.isFinite(c.engineVersion)) {
    throw new InvalidMaintenanceInputError(
      "classification.engineVersion",
      c.engineVersion,
      "debe ser un número finito"
    );
  }
  if (conf === "CLEAR") {
    if (!isActivityCategory(c.category)) {
      throw new InvalidMaintenanceInputError(
        "classification.category",
        c.category,
        "CLEAR exige una categoría DRI válida"
      );
    }
    if (c.lowerCategory !== void 0 || c.upperCategory !== void 0) {
      throw new InvalidMaintenanceInputError(
        "classification",
        c,
        "CLEAR no puede traer lowerCategory/upperCategory"
      );
    }
    return;
  }
  if (!isActivityCategory(c.lowerCategory) || !isActivityCategory(c.upperCategory)) {
    throw new InvalidMaintenanceInputError(
      "classification.lowerCategory/upperCategory",
      { lower: c.lowerCategory, upper: c.upperCategory },
      "BORDERLINE exige dos categorías DRI válidas"
    );
  }
  if (c.category !== void 0) {
    throw new InvalidMaintenanceInputError("classification", c, "BORDERLINE no puede traer category");
  }
  const lo = ACTIVITY_CATEGORIES.indexOf(c.lowerCategory);
  const hi = ACTIVITY_CATEGORIES.indexOf(c.upperCategory);
  if (hi - lo !== 1) {
    throw new InvalidMaintenanceInputError(
      "classification.lowerCategory/upperCategory",
      `${c.lowerCategory} ↔ ${c.upperCategory}`,
      "un BORDERLINE solo puede interpolar dos categorías DRI contiguas"
    );
  }
}
function estimateMaintenance(anthropometry, classification) {
  const a = validateAnthropometry(anthropometry);
  validateClassification(classification);
  const base = {
    source: "DRI_2023_EER_ADULT",
    engineVersion: MAINTENANCE_ESTIMATE_VERSION,
    classifierEngineVersion: classification.engineVersion
  };
  if (classification.classificationConfidence === "CLEAR") {
    const eer = eerForCategory(a, classification.category);
    return {
      ...base,
      classificationConfidence: "CLEAR",
      category: classification.category,
      eer,
      initialMaintenance: eer
    };
  }
  const lowerEER = eerForCategory(a, classification.lowerCategory);
  const upperEER = eerForCategory(a, classification.upperCategory);
  return {
    ...base,
    classificationConfidence: "BORDERLINE",
    lowerCategory: classification.lowerCategory,
    upperCategory: classification.upperCategory,
    lowerEER,
    upperEER,
    initialMaintenance: (lowerEER + upperEER) / 2
  };
}

// src/utils/profileValidation.ts
var InvalidProfileInputError = class extends Error {
  constructor(field, received, reason) {
    super(`Perfil nutricional inválido · ${field}: ${reason}. Recibido: ${describe4(received)}`);
    __publicField(this, "field");
    __publicField(this, "received");
    this.name = "InvalidProfileInputError";
    this.field = field;
    this.received = received;
  }
};
function describe4(v) {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (v === null || v === void 0) return String(v);
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return Object.prototype.toString.call(v);
  }
}
function requireNumber(field, v) {
  if (typeof v !== "number") {
    throw new InvalidProfileInputError(field, v, "debe ser un número");
  }
  return v;
}
function validateNutritionProfile(input) {
  const core = validateProfileCore(input);
  if (typeof input.requiresTherapeuticDiet !== "boolean") {
    throw new InvalidProfileInputError(
      "requiresTherapeuticDiet",
      input.requiresTherapeuticDiet,
      "debe ser booleano"
    );
  }
  return { ...core, requiresTherapeuticDiet: input.requiresTherapeuticDiet };
}
function validateProfileCore(input) {
  const facts = validateScopeFacts(input);
  const activityProfile = input.activityProfile;
  if (activityProfile === null || typeof activityProfile !== "object") {
    throw new InvalidProfileInputError("activityProfile", activityProfile, "debe ser un objeto");
  }
  return { ...facts, activityProfile };
}
function validateScopeFacts(input) {
  if (input === null || typeof input !== "object") {
    throw new InvalidProfileInputError("profile", input, "debe ser un objeto");
  }
  let sex;
  try {
    sex = biologicalSexFrom(input.sex);
  } catch {
    throw new InvalidProfileInputError(
      "sex",
      input.sex,
      "dato obligatorio ausente o no mapeable (se esperaba 'Hombre'/'Mujer')"
    );
  }
  let goal;
  try {
    goal = canonicalGoalFrom(input.goal);
  } catch {
    throw new InvalidProfileInputError(
      "goal",
      input.goal,
      "dato obligatorio ausente o no mapeable a un objetivo canónico"
    );
  }
  const ageYears = requireNumber("ageYears", input.ageYears);
  if (!Number.isFinite(ageYears)) {
    throw new InvalidProfileInputError("ageYears", ageYears, "debe ser finito");
  }
  const heightCm = requireNumber("heightCm", input.heightCm);
  const weightKg = requireNumber("weightKg", input.weightKg);
  if (typeof input.pregnantOrLactating !== "boolean") {
    throw new InvalidProfileInputError(
      "pregnantOrLactating",
      input.pregnantOrLactating,
      "debe ser booleano"
    );
  }
  return {
    sex,
    goal,
    ageYears,
    heightCm,
    weightKg,
    pregnantOrLactating: input.pregnantOrLactating
  };
}

// src/utils/nutritionScopeGuard.ts
var NUTRITION_SCOPE_REASONS = ["age_under_19", "age_65_or_over", "pregnancy_or_lactation", "therapeutic_diet_required"];
var NUTRITION_V1_MAX_AGE_YEARS = 64;
function checkNutritionScope(profile) {
  return checkKnownScopeExclusions(profile) ?? checkTherapeuticDiet(profile);
}
function checkKnownScopeExclusions(profile) {
  if (profile.ageYears < ADULT_ROUTE_MIN_AGE_YEARS) {
    return {
      status: "OUTSIDE_HSC_NUTRITION_SCOPE",
      scopeReason: "age_under_19",
      goal: profile.goal
    };
  }
  if (profile.ageYears > NUTRITION_V1_MAX_AGE_YEARS) {
    return {
      status: "OUTSIDE_HSC_NUTRITION_SCOPE",
      scopeReason: "age_65_or_over",
      goal: profile.goal
    };
  }
  if (profile.pregnantOrLactating) {
    return {
      status: "OUTSIDE_HSC_NUTRITION_SCOPE",
      scopeReason: "pregnancy_or_lactation",
      goal: profile.goal
    };
  }
  return null;
}
function checkScopeWithPendingInputs(profile) {
  return checkKnownScopeExclusions(profile) ?? (profile.requiresTherapeuticDiet === true ? checkTherapeuticDiet({ requiresTherapeuticDiet: true, goal: profile.goal }) : null);
}
function checkTherapeuticDiet(profile) {
  if (profile.requiresTherapeuticDiet) {
    return {
      status: "OUTSIDE_HSC_NUTRITION_SCOPE",
      scopeReason: "therapeutic_diet_required",
      goal: profile.goal
    };
  }
  return null;
}

// src/utils/nutritionEnergyOrchestrator.ts
var ORCHESTRATOR_VERSION = 1;
function resolveNutritionEnergy(rawProfile) {
  const profile = validateNutritionProfile(rawProfile);
  const outside = checkNutritionScope(profile);
  if (outside) {
    return { ...outside, orchestratorVersion: ORCHESTRATOR_VERSION };
  }
  const classification = classifyActivity(profile.activityProfile);
  const maintenance2 = estimateMaintenance(
    {
      sex: profile.sex,
      ageYears: profile.ageYears,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg
    },
    classification
  );
  const prescription = prescribeEnergy(
    profile.goal === "FAT_LOSS" ? {
      goal: "FAT_LOSS",
      maintenance: maintenance2,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg
    } : { goal: profile.goal, maintenance: maintenance2 }
  );
  return { ...prescription, classification, orchestratorVersion: ORCHESTRATOR_VERSION };
}
function resolveKnownNutritionScope(rawProfile) {
  const facts = validateScopeFacts(rawProfile);
  const outside = checkScopeWithPendingInputs({ ...facts, requiresTherapeuticDiet: rawProfile.requiresTherapeuticDiet });
  return outside ? { ...outside, orchestratorVersion: ORCHESTRATOR_VERSION } : null;
}

// src/utils/nutritionProfileInput.ts
var NUTRITION_PROFILE_INPUT_VERSION = 1;
var InvalidPersistedProfileError = class extends Error {
  constructor(key, received) {
    super(
      `obData.${key} tiene un valor que no se puede interpretar: se esperaba 0 o 1. Recibido: ${typeof received === "string" ? `'${received}'` : String(received)}`
    );
    __publicField(this, "key");
    __publicField(this, "received");
    this.key = key;
    this.received = received;
    this.name = "InvalidPersistedProfileError";
  }
};
var PERSISTED_BOOLEAN_KEYS = ["embarazo", "trainsHabitually", "requiresTherapeuticDiet"];
var MISSING_PROFILE_FIELDS = [
  "sex",
  "goal",
  "ageYears",
  "heightCm",
  "weightKg",
  "pregnantOrLactating",
  "requiresTherapeuticDiet",
  "dailyLife",
  "trainsHabitually",
  "trainingDaysPerWeek",
  "trainingSessionMinutes"
];
function declared(ob, key) {
  if (!(key in ob)) return false;
  const v = ob[key];
  if (v === void 0 || v === null) return false;
  return typeof v === "string" ? v.trim() !== "" : true;
}
function num(ob, key) {
  return Number(ob[key]);
}
function boolFrom10(key, v) {
  if (v === 0 || v === "0") return false;
  if (v === 1 || v === "1") return true;
  throw new InvalidPersistedProfileError(key, v);
}
function heightKey(ob) {
  if (declared(ob, "estatura")) return "estatura";
  if (declared(ob, "altura")) return "altura";
  return null;
}
function nutritionProfileInputFrom(obData) {
  const r = mapProfile(obData, false);
  if (!r.complete) return r;
  const { requiresTherapeuticDiet } = r.profile;
  if (requiresTherapeuticDiet === null) {
    throw new InvalidPersistedProfileError("requiresTherapeuticDiet", obData?.requiresTherapeuticDiet);
  }
  return { complete: true, profile: { ...r.profile, requiresTherapeuticDiet } };
}
var PENDING_FOR_SCOPE = [
  "requiresTherapeuticDiet",
  "dailyLife",
  "trainsHabitually",
  "trainingDaysPerWeek",
  "trainingSessionMinutes"
];
function pendingScopeProfileFrom(obData) {
  const strict = mapProfile(obData, false);
  if (strict.complete) return null;
  if (!strict.missing.every((f) => PENDING_FOR_SCOPE.includes(f))) return null;
  const ob = obData && typeof obData === "object" ? obData : {};
  const therapeutic = declared(ob, "requiresTherapeuticDiet") ? boolFrom10("requiresTherapeuticDiet", ob.requiresTherapeuticDiet) : null;
  const pregnant = boolFrom10("embarazo", ob.embarazo);
  const withActivity = mapProfile(obData, true);
  return {
    sex: String(ob.sex),
    goal: String(ob.goal),
    ageYears: num(ob, "edad"),
    heightCm: num(ob, heightKey(ob)),
    weightKg: num(ob, "peso"),
    pregnantOrLactating: pregnant,
    requiresTherapeuticDiet: therapeutic,
    activityProfile: withActivity.complete ? withActivity.profile.activityProfile : null
  };
}
function mapProfile(obData, therapeuticDietMayBePending) {
  const ob = obData && typeof obData === "object" ? obData : {};
  const missing = [];
  const pregnant = declared(ob, "embarazo") ? boolFrom10("embarazo", ob.embarazo) : null;
  const trains = declared(ob, "trainsHabitually") ? boolFrom10("trainsHabitually", ob.trainsHabitually) : null;
  const therapeutic = declared(ob, "requiresTherapeuticDiet") ? boolFrom10("requiresTherapeuticDiet", ob.requiresTherapeuticDiet) : null;
  if (!declared(ob, "sex")) missing.push("sex");
  if (!declared(ob, "goal")) missing.push("goal");
  if (!declared(ob, "edad")) missing.push("ageYears");
  const hKey = heightKey(ob);
  if (hKey === null) missing.push("heightCm");
  if (!declared(ob, "peso")) missing.push("weightKg");
  if (pregnant === null) missing.push("pregnantOrLactating");
  if (therapeutic === null && !therapeuticDietMayBePending) missing.push("requiresTherapeuticDiet");
  if (!declared(ob, "dailyLife")) missing.push("dailyLife");
  if (trains === null) missing.push("trainsHabitually");
  if (trains === true) {
    if (!declared(ob, "trainingDaysPerWeek")) missing.push("trainingDaysPerWeek");
    if (!declared(ob, "trainingSessionMinutes")) missing.push("trainingSessionMinutes");
  }
  if (missing.length > 0) return { complete: false, missing };
  if (pregnant === null) throw new InvalidPersistedProfileError("embarazo", ob.embarazo);
  if (trains === null) throw new InvalidPersistedProfileError("trainsHabitually", ob.trainsHabitually);
  const habitualTraining = trains === true ? {
    trainsHabitually: true,
    daysPerWeek: num(ob, "trainingDaysPerWeek"),
    habitualSessionMinutes: num(ob, "trainingSessionMinutes")
  } : { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 };
  const profile = {
    sex: String(ob.sex),
    goal: String(ob.goal),
    ageYears: num(ob, "edad"),
    heightCm: num(ob, hKey),
    weightKg: num(ob, "peso"),
    pregnantOrLactating: pregnant,
    requiresTherapeuticDiet: therapeutic,
    activityProfile: {
      dailyLife: ob.dailyLife,
      habitualTraining
    }
  };
  return { complete: true, profile };
}

// src/utils/nutritionEnergyState.ts
var ENERGY_SNAPSHOT_SCHEMA_VERSION = 1;
var NUTRITION_ENERGY_STATUSES = [
  "PRESCRIBED",
  "FAT_LOSS_BLOCKED",
  "OUTSIDE_HSC_FAT_LOSS_SCOPE",
  "OUTSIDE_HSC_NUTRITION_SCOPE",
  "PROFILE_INCOMPLETE",
  "PROFILE_UNREADABLE"
];
function resolveNutritionEnergyState(obData) {
  const input = readProfile(obData);
  if (input.kind === "unreadable") return { status: "PROFILE_UNREADABLE", key: input.key };
  if (input.kind === "incomplete") return { status: "PROFILE_INCOMPLETE", missing: input.missing };
  if (input.kind === "pending_scope") {
    return resolveKnownNutritionScope(input.profile) ?? { status: "PROFILE_INCOMPLETE", missing: input.missing };
  }
  return resolveNutritionEnergy(input.profile);
}
function readProfile(obData) {
  try {
    const r = nutritionProfileInputFrom(obData);
    if (r.complete) return { kind: "ok", profile: r.profile };
    const pending = pendingScopeProfileFrom(obData);
    return pending ? { kind: "pending_scope", profile: pending, missing: r.missing } : { kind: "incomplete", missing: r.missing };
  } catch (e) {
    if (e instanceof InvalidPersistedProfileError) return { kind: "unreadable", key: e.key };
    throw e;
  }
}
var ENERGY_IDENTITY_FIELDS = [
  "sex",
  "ageYears",
  "heightCm",
  "weightKg",
  "goal",
  "pregnantOrLactating",
  "requiresTherapeuticDiet",
  "dailyLife",
  "trainsHabitually",
  "daysPerWeek",
  "habitualSessionMinutes"
];
function fnv1a32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
var numStr = (n) => Object.is(n, -0) ? "0" : String(n);
function energyInputIdentity(profile) {
  const ap = profile.activityProfile;
  const t = ap?.habitualTraining;
  const entrena = t?.trainsHabitually === true;
  const payload = [
    `v${ENERGY_SNAPSHOT_SCHEMA_VERSION}`,
    biologicalSexFrom(profile.sex),
    numStr(profile.ageYears),
    numStr(profile.heightCm),
    numStr(profile.weightKg),
    canonicalGoalFrom(profile.goal),
    profile.pregnantOrLactating ? "1" : "0",
    // A7.1 · `null` = respuesta pendiente (solo con una exclusión ya conocida).
    profile.requiresTherapeuticDiet === null ? "-" : profile.requiresTherapeuticDiet ? "1" : "0",
    ap ? ap.dailyLife : "-",
    ap ? entrena ? "1" : "0" : "-",
    ap ? entrena && t ? numStr(t.daysPerWeek) : "0" : "-",
    ap ? entrena && t ? numStr(t.habitualSessionMinutes) : "0" : "-"
  ].join("|");
  return fnv1a32(payload);
}
var CURRENT_VERSIONS = {
  classifier: ACTIVITY_CLASSIFIER_VERSION,
  maintenance: MAINTENANCE_ESTIMATE_VERSION,
  prescription: ENERGY_PRESCRIPTION_VERSION,
  orchestrator: ORCHESTRATOR_VERSION
};
var currentEngineVersions = () => ({ ...CURRENT_VERSIONS });
function buildEnergySnapshot(obData, computedAt) {
  if (!isIsoUtcTimestamp(computedAt)) {
    throw new Error(
      `buildEnergySnapshot: computedAt debe ser ISO UTC canónico (YYYY-MM-DDTHH:mm:ss.sssZ, lo que produce Date.toISOString). Recibido: ${String(computedAt)}`
    );
  }
  const read = readProfile(obData);
  if (read.kind === "pending_scope") {
    const known = resolveKnownNutritionScope(read.profile);
    if (known) {
      return {
        state: known,
        snapshot: {
          schemaVersion: 1,
          status: known.status,
          inputIdentity: energyInputIdentity(read.profile),
          versions: currentEngineVersions(),
          computedAt
        }
      };
    }
  }
  if (read.kind !== "ok") {
    const state2 = read.kind === "unreadable" ? { status: "PROFILE_UNREADABLE", key: read.key } : { status: "PROFILE_INCOMPLETE", missing: read.missing };
    return {
      state: state2,
      snapshot: { schemaVersion: 1, status: state2.status, computedAt }
    };
  }
  const state = resolveNutritionEnergy(read.profile);
  const snapshot = {
    schemaVersion: 1,
    status: state.status,
    inputIdentity: energyInputIdentity(read.profile),
    versions: currentEngineVersions(),
    computedAt
  };
  if (state.classification) {
    snapshot.classification = {
      dailyLife: state.classification.matrixCell.dailyLife,
      trainingBand: state.classification.matrixCell.trainingBand,
      weeklyTrainingMinutes: state.classification.weeklyTrainingMinutes
    };
  }
  if (state.maintenance) {
    const m = state.maintenance;
    snapshot.maintenance = {
      initialMaintenance: m.initialMaintenance,
      confidence: m.classificationConfidence,
      ...m.classificationConfidence === "CLEAR" ? { category: m.category } : { lowerCategory: m.lowerCategory, upperCategory: m.upperCategory }
    };
  }
  if (state.prescribedEnergy !== void 0) snapshot.prescribedEnergy = state.prescribedEnergy;
  if (state.rawPrescribedEnergy !== void 0) snapshot.rawPrescribedEnergy = state.rawPrescribedEnergy;
  return { state, snapshot };
}
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
var isStr = (v) => typeof v === "string" && v.length > 0;
var IDENTITY_FORMAT = /^[0-9a-f]{8}$/;
var isIdentity = (v) => isStr(v) && IDENTITY_FORMAT.test(v);
var ISO_UTC_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function isIsoUtcTimestamp(v) {
  if (!isStr(v) || !ISO_UTC_FORMAT.test(v)) return false;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return false;
  return new Date(t).toISOString() === v;
}
var SNAPSHOT_TOP_KEYS = [
  "schemaVersion",
  "status",
  "computedAt",
  "prescribedEnergy",
  "rawPrescribedEnergy",
  "maintenance",
  "classification",
  "inputIdentity",
  "versions"
];
var PRE_ENGINE = {
  prescribedEnergy: "forbidden",
  rawPrescribedEnergy: "forbidden",
  maintenance: "forbidden",
  classification: "forbidden",
  inputIdentity: "forbidden",
  versions: "forbidden"
};
var STATUS_CONTRACT = {
  PRESCRIBED: {
    prescribedEnergy: "required",
    rawPrescribedEnergy: "required",
    maintenance: "required",
    classification: "required",
    inputIdentity: "required",
    versions: "required"
  },
  FAT_LOSS_BLOCKED: {
    prescribedEnergy: "forbidden",
    rawPrescribedEnergy: "forbidden",
    maintenance: "required",
    classification: "required",
    inputIdentity: "required",
    versions: "required"
  },
  OUTSIDE_HSC_FAT_LOSS_SCOPE: {
    prescribedEnergy: "forbidden",
    rawPrescribedEnergy: "required",
    maintenance: "required",
    classification: "required",
    inputIdentity: "required",
    versions: "required"
  },
  OUTSIDE_HSC_NUTRITION_SCOPE: {
    prescribedEnergy: "forbidden",
    rawPrescribedEnergy: "forbidden",
    maintenance: "forbidden",
    classification: "forbidden",
    inputIdentity: "required",
    versions: "required"
  },
  PROFILE_INCOMPLETE: PRE_ENGINE,
  PROFILE_UNREADABLE: PRE_ENGINE
};
function parseEnergySnapshot(raw) {
  if (raw === null || raw === void 0) return { ok: false, reason: "absent" };
  if (!isObj(raw)) return { ok: false, reason: "malformed", detail: "no es un objeto" };
  if (raw.schemaVersion !== ENERGY_SNAPSHOT_SCHEMA_VERSION) {
    return isNum(raw.schemaVersion) ? { ok: false, reason: "unknown_schema", detail: `schemaVersion=${raw.schemaVersion}` } : { ok: false, reason: "malformed", detail: "schemaVersion ausente o no numérico" };
  }
  const status = raw.status;
  if (!isStr(status) || !NUTRITION_ENERGY_STATUSES.includes(status)) {
    return { ok: false, reason: "malformed", detail: `status inválido: ${String(status)}` };
  }
  if (!isIsoUtcTimestamp(raw.computedAt)) {
    return { ok: false, reason: "malformed", detail: `computedAt no es ISO UTC canónico: ${String(raw.computedAt)}` };
  }
  for (const k of Object.keys(raw)) {
    if (!SNAPSHOT_TOP_KEYS.includes(k)) {
      return { ok: false, reason: "malformed", detail: `propiedad desconocida: ${k}` };
    }
  }
  const contrato = STATUS_CONTRACT[status];
  for (const campo of Object.keys(contrato)) {
    const presente = raw[campo] !== void 0;
    if (contrato[campo] === "required" && !presente) {
      return { ok: false, reason: "malformed", detail: `${status} sin ${campo}` };
    }
    if (contrato[campo] === "forbidden" && presente) {
      return { ok: false, reason: "malformed", detail: `${campo} en ${status}` };
    }
  }
  const out = {
    schemaVersion: 1,
    status,
    computedAt: raw.computedAt
  };
  if (raw.prescribedEnergy !== void 0) {
    if (!isNum(raw.prescribedEnergy)) return { ok: false, reason: "malformed", detail: "prescribedEnergy no numérico" };
    out.prescribedEnergy = raw.prescribedEnergy;
  }
  if (raw.rawPrescribedEnergy !== void 0) {
    if (!isNum(raw.rawPrescribedEnergy)) return { ok: false, reason: "malformed", detail: "rawPrescribedEnergy no numérico" };
    out.rawPrescribedEnergy = raw.rawPrescribedEnergy;
  }
  if (raw.maintenance !== void 0) {
    const m = raw.maintenance;
    if (!isObj(m)) return { ok: false, reason: "malformed", detail: "maintenance no es un objeto" };
    if (!isNum(m.initialMaintenance)) return { ok: false, reason: "malformed", detail: "initialMaintenance no numérico" };
    if (m.confidence !== "CLEAR" && m.confidence !== "BORDERLINE") {
      return { ok: false, reason: "malformed", detail: `confidence inválida: ${String(m.confidence)}` };
    }
    const cat = (v) => isStr(v) && ACTIVITY_CATEGORIES.includes(v);
    const esperadas = m.confidence === "CLEAR" ? ["initialMaintenance", "confidence", "category"] : ["initialMaintenance", "confidence", "lowerCategory", "upperCategory"];
    for (const k of Object.keys(m)) {
      if (!esperadas.includes(k)) {
        return { ok: false, reason: "malformed", detail: `maintenance.${k} inesperada en ${m.confidence}` };
      }
    }
    if (m.confidence === "CLEAR") {
      if (!cat(m.category)) return { ok: false, reason: "malformed", detail: "CLEAR sin category válida" };
      out.maintenance = { initialMaintenance: m.initialMaintenance, confidence: "CLEAR", category: m.category };
    } else {
      if (!cat(m.lowerCategory) || !cat(m.upperCategory)) {
        return { ok: false, reason: "malformed", detail: "BORDERLINE sin lower/upperCategory válidas" };
      }
      out.maintenance = {
        initialMaintenance: m.initialMaintenance,
        confidence: "BORDERLINE",
        lowerCategory: m.lowerCategory,
        upperCategory: m.upperCategory
      };
    }
  }
  if (raw.classification !== void 0) {
    const c = raw.classification;
    if (!isObj(c)) return { ok: false, reason: "malformed", detail: "classification no es un objeto" };
    if (!isStr(c.dailyLife) || !DAILY_LIFE_LEVELS.includes(c.dailyLife)) {
      return { ok: false, reason: "malformed", detail: `dailyLife inválido: ${String(c.dailyLife)}` };
    }
    if (!isStr(c.trainingBand) || !TRAINING_BANDS.includes(c.trainingBand)) {
      return { ok: false, reason: "malformed", detail: `trainingBand inválida: ${String(c.trainingBand)}` };
    }
    if (!isNum(c.weeklyTrainingMinutes)) {
      return { ok: false, reason: "malformed", detail: "weeklyTrainingMinutes no numérico" };
    }
    for (const k of Object.keys(c)) {
      if (!["dailyLife", "trainingBand", "weeklyTrainingMinutes"].includes(k)) {
        return { ok: false, reason: "malformed", detail: `classification.${k} inesperada` };
      }
    }
    out.classification = {
      dailyLife: c.dailyLife,
      trainingBand: c.trainingBand,
      weeklyTrainingMinutes: c.weeklyTrainingMinutes
    };
  }
  if (raw.inputIdentity !== void 0) {
    if (!isIdentity(raw.inputIdentity)) {
      return { ok: false, reason: "malformed", detail: `inputIdentity con formato inválido: ${String(raw.inputIdentity)}` };
    }
    out.inputIdentity = raw.inputIdentity;
  }
  if (raw.versions !== void 0) {
    const v = raw.versions;
    if (!isObj(v)) return { ok: false, reason: "malformed", detail: "versions no es un objeto" };
    const VERSION_KEYS = ["classifier", "maintenance", "prescription", "orchestrator"];
    for (const k of Object.keys(v)) {
      if (!VERSION_KEYS.includes(k)) return { ok: false, reason: "malformed", detail: `versions.${k} inesperada` };
    }
    for (const k of VERSION_KEYS) {
      if (!isNum(v[k])) return { ok: false, reason: "malformed", detail: `versions.${k} no numérico` };
    }
    out.versions = {
      classifier: v.classifier,
      maintenance: v.maintenance,
      prescription: v.prescription,
      orchestrator: v.orchestrator
    };
  }
  return { ok: true, snapshot: out };
}

// src/utils/trainingModality.ts
var TRAINING_MODALITIES_KEY = "trainingModalities";
var TRAINING_MODALITIES = [
  "strength",
  "endurance",
  "team_intermittent",
  "low_demand",
  "specialized_sport"
];
var STRUCTURED = ["strength", "endurance", "team_intermittent"];
var isModality = (v) => TRAINING_MODALITIES.includes(v);
function canonicalTrainingModalities(ms) {
  return TRAINING_MODALITIES.filter((m) => ms.includes(m));
}
function serializeTrainingModalities(ms) {
  return canonicalTrainingModalities(ms).join(",");
}
function readTrainingModalities(raw) {
  if (raw === void 0 || raw === null) return { kind: "MISSING" };
  if (typeof raw !== "string") return { kind: "INVALID", received: raw };
  const tokens = raw.split(",").map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { kind: "MISSING" };
  if (!tokens.every(isModality)) return { kind: "INVALID", received: raw };
  return { kind: "DECLARED", modalities: canonicalTrainingModalities(tokens) };
}
function declaredTrainingModalitiesForForm(raw) {
  if (typeof raw !== "string") return [];
  return canonicalTrainingModalities(raw.split(",").map((t) => t.trim()).filter(isModality));
}
function deriveProteinActivityClass(trainsHabitually, modalities) {
  if (!trainsHabitually) return { kind: "CLASS", activityClass: "NO_STRUCTURED_TRAINING" };
  const ms = canonicalTrainingModalities(modalities ?? []);
  if (ms.length === 0) return { kind: "TRAINING_MODALITY_REQUIRED" };
  if (ms.includes("specialized_sport")) return { kind: "CLASS", activityClass: "SPECIALIZED_SPORT" };
  const structured = ms.filter((m) => STRUCTURED.includes(m));
  if (structured.length >= 2) return { kind: "CLASS", activityClass: "MIXED" };
  if (structured.length === 1) {
    switch (structured[0]) {
      case "strength":
        return { kind: "CLASS", activityClass: "STRENGTH" };
      case "endurance":
        return { kind: "CLASS", activityClass: "ENDURANCE_GENERAL" };
      case "team_intermittent":
        return { kind: "CLASS", activityClass: "TEAM_INTERMITTENT" };
    }
  }
  return { kind: "CLASS", activityClass: "LOW_DEMAND" };
}

// src/utils/macroPrescription.ts
var MACRO_PRESCRIPTION_VERSION = 4;
var PROTEIN_ACTIVITY_CLASSES = [
  "NO_STRUCTURED_TRAINING",
  "LOW_DEMAND",
  "STRENGTH",
  "ENDURANCE_GENERAL",
  "MIXED",
  "TEAM_INTERMITTENT",
  "SPECIALIZED_SPORT"
];
var CARB_PRIORITY_MATRIX = {
  NO_STRUCTURED_TRAINING: { T0: "STANDARD", T1: "STANDARD", T2: "STANDARD", T3: "STANDARD", T4: "STANDARD" },
  LOW_DEMAND: { T0: "STANDARD", T1: "STANDARD", T2: "STANDARD", T3: "STANDARD", T4: "STANDARD" },
  STRENGTH: { T0: "STANDARD", T1: "ELEVATED", T2: "ELEVATED", T3: "ELEVATED", T4: "ELEVATED" },
  ENDURANCE_GENERAL: { T0: "STANDARD", T1: "ELEVATED", T2: "HIGH", T3: "HIGH", T4: "SPORTS_SCOPE" },
  MIXED: { T0: "STANDARD", T1: "ELEVATED", T2: "HIGH", T3: "HIGH", T4: "SPORTS_SCOPE" },
  TEAM_INTERMITTENT: { T0: "STANDARD", T1: "ELEVATED", T2: "HIGH", T3: "HIGH", T4: "SPORTS_SCOPE" },
  SPECIALIZED_SPORT: { T0: "SPORTS_SCOPE", T1: "SPORTS_SCOPE", T2: "SPORTS_SCOPE", T3: "SPORTS_SCOPE", T4: "SPORTS_SCOPE" }
};
var PROTEIN_FACTOR_STANDARD = {
  NO_STRUCTURED_TRAINING: 1,
  LOW_DEMAND: 1.2,
  STRENGTH: 1.6,
  ENDURANCE_GENERAL: 1.6,
  MIXED: 1.6,
  TEAM_INTERMITTENT: 1.6
};
var PROTEIN_FACTOR_FAT_LOSS = {
  NO_STRUCTURED_TRAINING: 1.3,
  LOW_DEMAND: 1.3,
  STRENGTH: 1.8,
  ENDURANCE_GENERAL: 1.8,
  MIXED: 1.8,
  TEAM_INTERMITTENT: 1.8
};
var FAT_ENERGY_FRACTION = 0.25;
var PRW_BMI_THRESHOLD = 30;
var PRW_EXCESS_FRACTION = 0.25;
var FIBER_G_PER_1000_KCAL = 14;
var InvalidMacroInputError = class extends Error {
  constructor(field, received, reason) {
    super(`MacroInput inválido · ${field}: ${reason}. Recibido: ${String(received)}`);
    __publicField(this, "field");
    __publicField(this, "received");
    this.name = "InvalidMacroInputError";
    this.field = field;
    this.received = received;
  }
};
var GOALS = ["FAT_LOSS", "RECOMPOSITION", "MUSCLE_GAIN", "MAINTENANCE"];
var positiveFinite = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
function proteinReferenceWeightKg(weightKg, heightCm) {
  if (!positiveFinite(weightKg)) throw new InvalidMacroInputError("weightKg", weightKg, "debe ser un número finito > 0");
  if (!positiveFinite(heightCm)) throw new InvalidMacroInputError("heightCm", heightCm, "debe ser un número finito > 0");
  const hM = heightCm / 100;
  const bmi = weightKg / (hM * hM);
  if (bmi < PRW_BMI_THRESHOLD) return weightKg;
  const weightAtBmi30 = PRW_BMI_THRESHOLD * hM * hM;
  return weightAtBmi30 + PRW_EXCESS_FRACTION * (weightKg - weightAtBmi30);
}
function deriveCarbohydratePriority(activityClass, trainingBand) {
  if (!PROTEIN_ACTIVITY_CLASSES.includes(activityClass)) throw new InvalidMacroInputError("activityClass", activityClass, "clase de actividad desconocida");
  if (!TRAINING_BANDS.includes(trainingBand)) throw new InvalidMacroInputError("trainingBand", trainingBand, "banda de carga desconocida");
  return CARB_PRIORITY_MATRIX[activityClass][trainingBand];
}
function proteinFactor(goal, activityClass) {
  if (activityClass === "SPECIALIZED_SPORT") return null;
  const table = goal === "FAT_LOSS" ? PROTEIN_FACTOR_FAT_LOSS : PROTEIN_FACTOR_STANDARD;
  return table[activityClass];
}
function prescribeMacros(input) {
  const { energyKcal, goal, weightKg, heightCm, activityClass } = input;
  if (!positiveFinite(energyKcal)) throw new InvalidMacroInputError("energyKcal", energyKcal, "debe ser un número finito > 0");
  if (!GOALS.includes(goal)) throw new InvalidMacroInputError("goal", goal, "objetivo canónico desconocido");
  if (!PROTEIN_ACTIVITY_CLASSES.includes(activityClass)) throw new InvalidMacroInputError("activityClass", activityClass, "clase de actividad desconocida");
  const carbohydratePriority = deriveCarbohydratePriority(activityClass, input.trainingBand);
  const prwKg = proteinReferenceWeightKg(weightKg, heightCm);
  const base = { version: MACRO_PRESCRIPTION_VERSION, energyKcal, goal, activityClass, carbohydratePriority, prwKg };
  const matrixFactor = proteinFactor(goal, activityClass);
  if (matrixFactor === null) return { ...base, status: "SPORTS_SCOPE", reason: "SPECIALIZED_SPORT" };
  if (carbohydratePriority === "SPORTS_SCOPE") return { ...base, status: "SPORTS_SCOPE", reason: "CARB_PRIORITY_SPORTS_SCOPE" };
  const factor = matrixFactor;
  const reviewReasons = [];
  const proteinRaw = prwKg * factor;
  const fatRaw = energyKcal * FAT_ENERGY_FRACTION / 9;
  const carbKcalRaw = energyKcal - proteinRaw * 4 - fatRaw * 9;
  const proteinG = Math.round(proteinRaw);
  const fatG = Math.round(fatRaw);
  if (carbKcalRaw <= 0) {
    return { ...base, status: "INFEASIBLE", reason: "CARB_RESIDUAL_NON_POSITIVE", proteinFactor: factor, proteinG, fatG, carbKcal: Math.round(carbKcalRaw) };
  }
  const carbG = Math.max(0, Math.round((energyKcal - proteinG * 4 - fatG * 9) / 4));
  const fiberG = Math.round(energyKcal / 1e3 * FIBER_G_PER_1000_KCAL);
  return {
    ...base,
    status: reviewReasons.length > 0 ? "REVIEW" : "VALID",
    proteinFactor: factor,
    proteinG,
    fatG,
    carbG,
    fiberG,
    reviewReasons
  };
}
function nonServableMacroNotice(m) {
  if (m == null) return null;
  switch (m.status) {
    case "VALID":
    case "REVIEW":
      return null;
    case "INFEASIBLE":
      return "DEFENSIVE_UNAVAILABLE";
    case "SPORTS_SCOPE":
      return m.reason === "SPECIALIZED_SPORT" ? "SPORTS_SPECIALIZED" : "SPORTS_HIGH_DEMAND";
  }
}
function isServableMacroPrescription(m) {
  return m != null && (m.status === "VALID" || m.status === "REVIEW");
}
function resolveMacroPrescription(state, obData) {
  if (state == null || state.status !== "PRESCRIBED") return { kind: "NO_ENERGY" };
  const read = nutritionProfileInputFrom(obData);
  if (!read.complete) return { kind: "NO_ENERGY" };
  const declared2 = readTrainingModalities(obData?.[TRAINING_MODALITIES_KEY]);
  const cls = deriveProteinActivityClass(
    read.profile.activityProfile.habitualTraining.trainsHabitually,
    declared2.kind === "DECLARED" ? declared2.modalities : null
  );
  if (cls.kind === "TRAINING_MODALITY_REQUIRED") return { kind: "INPUT_REQUIRED", missing: cls.kind };
  return {
    kind: "RESOLVED",
    prescription: prescribeMacros({
      energyKcal: state.prescribedEnergy,
      goal: state.goal,
      weightKg: read.profile.weightKg,
      heightCm: read.profile.heightCm,
      activityClass: cls.activityClass,
      trainingBand: state.classification.matrixCell.trainingBand
    })
  };
}

// src/utils/adaptiveCalibrationCore.ts
var ENERGY_CALIBRATION_VERSION = 2;
var REASON_SET = {
  INSUFFICIENT_WINDOW: true,
  INSUFFICIENT_DATA: true,
  ADHERENCE_NOT_HIGH: true,
  VERY_SLOW: true,
  BORDERLINE_SLOW_FIRST: true,
  BORDERLINE_SLOW_CONFIRMED: true,
  ON_TARGET: true,
  DEFICIT_SYMPTOMS: true,
  FAST_FIRST: true,
  FAST_CONFIRMED: true,
  FAST_WITH_SYMPTOMS: true,
  BELOW_TARGET: true,
  ABOVE_TARGET: true,
  WITHIN_MAINTENANCE_BAND: true,
  BELOW_MAINTENANCE_BAND: true,
  ABOVE_MAINTENANCE_BAND: true,
  NEGATIVE_SIGNALS: true,
  CONTRADICTORY_SIGNALS: true,
  PERFORMANCE_IMPROVING: true,
  PERFORMANCE_WORSE: true,
  NO_TRAINING_SIGNAL: true,
  WAIST_IMPROVING: true,
  WAIST_WORSENING: true,
  NO_CLEAR_PROGRESS: true,
  DIRECTION_REVERSAL_BLOCKED: true,
  CALIBRATION_LIMIT_REACHED: true
};
var ADAPTIVE_REASONS = Object.keys(REASON_SET);
var TRAJECTORY_CLASSIFICATION_VALUES = {
  FAT_LOSS: ["VERY_SLOW", "BORDERLINE_SLOW", "ON_TARGET", "FAST"],
  MUSCLE_GAIN: ["BELOW_TARGET", "ON_TARGET", "ABOVE_TARGET"],
  RECOMPOSITION: ["DOWN", "RELATIVELY_STABLE", "UP"],
  MAINTENANCE: ["BELOW_MAINTENANCE_BAND", "WITHIN_MAINTENANCE_BAND", "ABOVE_MAINTENANCE_BAND"]
};
var TRAJECTORY_SUFFICIENCY_VALUES = ["SUFFICIENT_FOR_DECISION", "INSUFFICIENT_WINDOW", "INSUFFICIENT_DATA"];
var WEIGHT_DIRECTION_VALUES = ["DOWN", "STABLE", "UP"];
var WAIST_CHANGE_VALUES = ["LOWER", "SAME", "HIGHER"];
function classificationValue(c) {
  switch (c.objective) {
    case "FAT_LOSS":
      return c.rate;
    case "MUSCLE_GAIN":
      return c.rate;
    case "RECOMPOSITION":
      return c.weight;
    case "MAINTENANCE":
      return c.band;
  }
}
function buildCheckinRecord(input) {
  const { cycleIndex, checkin: c, trajectory: t, decision: d, previousWaistCm } = input;
  if (t.status !== "ASSESSED") return { ok: false, error: "TRAJECTORY_NOT_ASSESSED" };
  if (t.objective !== c.objective || d.objective !== c.objective) return { ok: false, error: "OBJECTIVE_MISMATCH" };
  if (d.cycleIndex !== cycleIndex) return { ok: false, error: "CYCLE_MISMATCH" };
  const m = t.metrics;
  if (m != null && m.currentWeightKg !== c.weightKg) return { ok: false, error: "WEIGHT_MISMATCH" };
  const waistDirection = previousWaistCm != null && c.waistCm != null ? classifyWaistChange(previousWaistCm, c.waistCm) : null;
  return {
    ok: true,
    payload: {
      cycle_index: cycleIndex,
      checkin_date: c.checkinDate,
      objective: c.objective,
      weight_kg: c.weightKg,
      waist_cm: c.waistCm,
      adherence_answer: c.adherence.answer,
      adherence_band: c.adherence.band,
      hunger: c.hunger,
      energy: c.energy,
      performance: c.performance,
      trains_strength: c.trainsStrength,
      strength_experience: c.strengthExperience,
      recent_strength_continuity: c.recentStrengthContinuity,
      trajectory_sufficiency: t.sufficiency,
      previous_weight_kg: m?.previousWeightKg ?? null,
      elapsed_days: m?.elapsedDays ?? null,
      absolute_change_kg: m?.absoluteChangeKg ?? null,
      percent_change: m?.percentChangeFromBaseline ?? null,
      percent_change_per_week: m?.percentChangePerWeek ?? null,
      kg_per_month: m?.changeKgPerMonth ?? null,
      trajectory_direction: m?.direction ?? null,
      trajectory_classification: t.sufficiency === "SUFFICIENT_FOR_DECISION" ? classificationValue(t.classification) : null,
      previous_waist_cm: waistDirection ? previousWaistCm : null,
      waist_direction: waistDirection,
      action: d.action,
      reason: d.reason,
      previous_step: d.currentStep,
      proposed_step: d.proposedStep,
      blocked_action: d.blocked?.action ?? null,
      blocked_reason: d.blocked?.reason ?? null,
      trajectory_version: TRAJECTORY_ENGINE_VERSION,
      checkin_domain_version: NUTRITION_CHECKIN_VERSION,
      adaptive_decision_version: ADAPTIVE_DECISION_VERSION
    }
  };
}
function isOneOf3(v, list) {
  return typeof v === "string" && list.includes(v);
}
var num2 = (v) => v === null || v === void 0 || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
var str = (v) => typeof v === "string" && v !== "" ? v : null;
var isStep = (v) => v != null && Number.isInteger(v) && v >= CALIBRATION_STEP_MIN && v <= CALIBRATION_STEP_MAX;
function checkinFromRow(row) {
  const objective = row.objective;
  if (!isOneOf3(objective, CANONICAL_GOALS)) return null;
  const id = str(row.id), calibrationId = str(row.calibration_id), checkinDate = str(row.checkin_date);
  const cycleIndex = num2(row.cycle_index), weightKg = num2(row.weight_kg);
  const previousStep = num2(row.previous_step), proposedStep = num2(row.proposed_step);
  if (!id || !calibrationId || !checkinDate || cycleIndex == null || weightKg == null || !isStep(previousStep) || !isStep(proposedStep)) return null;
  if (!isOneOf3(row.adherence_answer, ADHERENCE_ANSWERS) || !isOneOf3(row.adherence_band, ["HIGH", "MEDIUM", "LOW"])) return null;
  if (!isOneOf3(row.hunger, NUTRITION_HUNGER_VALUES) || !isOneOf3(row.energy, NUTRITION_ENERGY_VALUES) || !isOneOf3(row.performance, NUTRITION_PERFORMANCE_VALUES)) return null;
  if (!isOneOf3(row.action, ADAPTIVE_ACTIONS) || !isOneOf3(row.reason, ADAPTIVE_REASONS)) return null;
  if (!isOneOf3(row.trajectory_sufficiency, TRAJECTORY_SUFFICIENCY_VALUES)) return null;
  const optional = (v, list) => v === null || v === void 0 ? null : isOneOf3(v, list) ? v : void 0;
  const strengthExperience = optional(row.strength_experience, STRENGTH_EXPERIENCE_VALUES);
  const continuity = optional(row.recent_strength_continuity, RECENT_STRENGTH_CONTINUITY_VALUES);
  const direction = optional(row.trajectory_direction, WEIGHT_DIRECTION_VALUES);
  const waistDirection = optional(row.waist_direction, WAIST_CHANGE_VALUES);
  const classification = optional(row.trajectory_classification, TRAJECTORY_CLASSIFICATION_VALUES[objective]);
  const blockedAction = optional(row.blocked_action, ["STEP_UP", "STEP_DOWN"]);
  const blockedReason = optional(row.blocked_reason, ADAPTIVE_REASONS);
  if ([strengthExperience, continuity, direction, waistDirection, classification, blockedAction, blockedReason].includes(void 0)) return null;
  if (blockedAction == null !== (blockedReason == null)) return null;
  return {
    id,
    calibrationId,
    cycleIndex,
    checkinDate,
    objective,
    weightKg,
    waistCm: num2(row.waist_cm),
    adherence: { answer: row.adherence_answer, band: row.adherence_band },
    hunger: row.hunger,
    energy: row.energy,
    performance: row.performance,
    trainsStrength: typeof row.trains_strength === "boolean" ? row.trains_strength : null,
    strengthExperience,
    recentStrengthContinuity: continuity,
    trajectory: {
      sufficiency: row.trajectory_sufficiency,
      previousWeightKg: num2(row.previous_weight_kg),
      elapsedDays: num2(row.elapsed_days),
      absoluteChangeKg: num2(row.absolute_change_kg),
      percentChange: num2(row.percent_change),
      percentChangePerWeek: num2(row.percent_change_per_week),
      kgPerMonth: num2(row.kg_per_month),
      direction,
      classification
    },
    previousWaistCm: num2(row.previous_waist_cm),
    waistDirection,
    action: row.action,
    reason: row.reason,
    previousStep,
    proposedStep,
    blocked: blockedAction ? { action: blockedAction, reason: blockedReason } : null,
    versions: {
      trajectory: num2(row.trajectory_version) ?? 0,
      checkinDomain: num2(row.checkin_domain_version) ?? 0,
      adaptiveDecision: num2(row.adaptive_decision_version) ?? 0
    },
    createdAt: String(row.created_at ?? "")
  };
}
function calibrationFromRow(row) {
  const objective = row.objective;
  const id = str(row.id), cycleStart = str(row.cycle_start), baselineDate = str(row.baseline_date);
  const baselineWeightKg = num2(row.baseline_weight_kg), currentStep = num2(row.current_step);
  if (!isOneOf3(objective, CANONICAL_GOALS) || !id || !cycleStart || !baselineDate || baselineWeightKg == null || !isStep(currentStep)) return null;
  if (!isOneOf3(row.status, ["ACTIVE", "CLOSED"])) return null;
  const lastApplied = row.last_applied_action;
  if (lastApplied != null && !isOneOf3(lastApplied, ["STEP_UP", "STEP_DOWN"])) return null;
  return {
    id,
    objective,
    status: row.status,
    baselineDate,
    cycleStart,
    baselineWeightKg,
    baselineWaistCm: num2(row.baseline_waist_cm),
    currentStep,
    baseEnergyKcal: num2(row.base_energy_kcal),
    lastCheckinId: str(row.last_checkin_id),
    lastAppliedAction: lastApplied ?? null,
    lastAppliedAt: str(row.last_applied_at),
    calibrationVersion: num2(row.calibration_version) ?? 0,
    createdAt: String(row.created_at ?? ""),
    closedAt: str(row.closed_at)
  };
}
function previousContextFromCheckin(s) {
  return {
    action: s.action,
    classification: storedClassification(s),
    hunger: s.hunger,
    energy: s.energy,
    performance: s.performance,
    waistCm: s.waistCm
  };
}
function storedClassification(s) {
  const t = s.trajectory;
  if (t.sufficiency !== "SUFFICIENT_FOR_DECISION" || t.classification == null) return null;
  switch (s.objective) {
    case "FAT_LOSS":
      return { objective: "FAT_LOSS", lossPercentPerWeek: -(t.percentChangePerWeek ?? 0) || 0, rate: t.classification };
    case "MUSCLE_GAIN": {
      if (s.strengthExperience == null) return null;
      return {
        objective: "MUSCLE_GAIN",
        experienceLevel: s.strengthExperience,
        gainKgPerMonth: t.kgPerMonth ?? 0,
        targetKgPerMonth: { ...MUSCLE_GAIN_TARGET_KG_PER_MONTH[s.strengthExperience] },
        rate: t.classification
      };
    }
    case "RECOMPOSITION":
      return { objective: "RECOMPOSITION", changeKgPerMonth: t.kgPerMonth ?? 0, weight: t.classification };
    case "MAINTENANCE":
      return { objective: "MAINTENANCE", percentChangeFromBaseline: t.percentChange ?? 0, band: t.classification };
  }
}

// src/utils/adaptiveCheckinPlanner.ts
var CYCLE_LENGTH_DAYS = 14;
var CHECKIN_EARLY_DAYS = 1;
var CHECKIN_LATE_DAYS = 6;
var DECLARED_DATE_TOLERANCE_DAYS = 1;
var START_REQUEST_FIELDS = ["requestId", "localDate", "weightKg", "waistCm"];
var CHECKIN_REQUEST_FIELDS = [
  "requestId",
  "localDate",
  "weightKg",
  "waistCm",
  "adherenceAnswer",
  "hunger",
  "energy",
  "performance",
  "strengthExperience",
  "recentStrengthContinuity"
];
var DAY_MS2 = 864e5;
function ymdToDay(v) {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t / DAY_MS2;
}
var dayToYmd = (day) => new Date(day * DAY_MS2).toISOString().slice(0, 10);
function cycleStartFor(baselineDate) {
  const d = ymdToDay(baselineDate);
  if (d == null) return null;
  const dow = new Date(d * DAY_MS2).getUTCDay();
  return dayToYmd(d + (7 - dow) % 7);
}
function cycleDueDate(cycleStart, n) {
  const s = ymdToDay(cycleStart);
  return s == null || !Number.isInteger(n) || n < 1 ? null : dayToYmd(s + CYCLE_LENGTH_DAYS * n);
}
function cycleIndexForDate(cycleStart, date) {
  const s = ymdToDay(cycleStart), d = ymdToDay(date);
  if (s == null || d == null) return null;
  const offset = d - s;
  const n = Math.floor((offset + CHECKIN_EARLY_DAYS) / CYCLE_LENGTH_DAYS);
  if (n < 1) return null;
  return offset <= CYCLE_LENGTH_DAYS * n + CHECKIN_LATE_DAYS ? n : null;
}
function acceptDeclaredDate(declared2, serverUtcDate) {
  const d = ymdToDay(declared2), s = ymdToDay(serverUtcDate);
  if (d == null || s == null) return { ok: false, reason: "INVALID_DATE" };
  if (d > s + DECLARED_DATE_TOLERANCE_DAYS) return { ok: false, reason: "FUTURE_DATE" };
  if (d < s - DECLARED_DATE_TOLERANCE_DAYS) return { ok: false, reason: "DATE_OUT_OF_TOLERANCE" };
  return { ok: true, date: declared2 };
}
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var isRequestId = (v) => typeof v === "string" && UUID.test(v);
function readRequest(raw, allowed, serverUtcDate) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, rejection: { kind: "REJECT", reason: "INVALID_REQUEST" } };
  const body = raw;
  const unexpected = Object.keys(body).filter((k) => !allowed.includes(k)).sort();
  if (unexpected.length > 0) return { ok: false, rejection: { kind: "REJECT", reason: "UNEXPECTED_FIELDS", fields: unexpected } };
  if (!isRequestId(body.requestId)) return { ok: false, rejection: { kind: "REJECT", reason: "INVALID_REQUEST_ID" } };
  const date = acceptDeclaredDate(body.localDate, serverUtcDate);
  if (!date.ok) return { ok: false, rejection: { kind: "REJECT", reason: date.reason } };
  return { ok: true, body, requestId: body.requestId, date: date.date };
}
function objectiveOf(obData) {
  try {
    return canonicalGoalFrom(obData?.goal);
  } catch {
    return null;
  }
}
var isPositiveFinite3 = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
var reject = (reason, fields) => fields ? { kind: "REJECT", reason, fields } : { kind: "REJECT", reason };
function planStartCalibration(input) {
  const req = readRequest(input.request, START_REQUEST_FIELDS, input.serverUtcDate);
  if (!req.ok) return req.rejection;
  if (input.energyStatus !== "PRESCRIBED") return reject("NOT_ELIGIBLE");
  const objective = objectiveOf(input.obData);
  if (objective == null) return reject("OBJECTIVE_UNRESOLVED");
  const { weightKg, waistCm } = req.body;
  if (!isPositiveFinite3(weightKg)) return reject("INVALID_WEIGHT");
  if (waistCm !== void 0 && waistCm !== null && !isPositiveFinite3(waistCm)) return reject("INVALID_WAIST");
  const baselineWaistCm = isPositiveFinite3(waistCm) ? waistCm : null;
  if (objective === "RECOMPOSITION" && baselineWaistCm == null) return reject("WAIST_REQUIRED");
  const active = input.active?.status === "ACTIVE" ? input.active : null;
  if (active != null && active.objective === objective) return { kind: "ALREADY_ACTIVE", calibrationId: active.id };
  return {
    kind: "START",
    requestId: req.requestId,
    objective,
    baselineDate: req.date,
    cycleStart: cycleStartFor(req.date),
    baselineWeightKg: weightKg,
    baselineWaistCm,
    calibrationVersion: ENERGY_CALIBRATION_VERSION,
    closesCalibrationId: active?.id ?? null
  };
}
function referenceOnlyContext(waistCm) {
  return { action: "NO_ADJUSTMENT", classification: null, hunger: "NORMAL", energy: "NORMAL", performance: "SAME", waistCm };
}
function referencePointFor(objective, calibration, ordered) {
  const pick = objective === "FAT_LOSS" ? ordered[ordered.length - 1] : [...ordered].reverse().find((c) => c.trajectory.sufficiency === "SUFFICIENT_FOR_DECISION");
  return pick ? { kind: "CHECKIN", date: pick.checkinDate, weightKg: pick.weightKg, waistCm: pick.waistCm, checkinId: pick.id } : { kind: "BASELINE", date: calibration.baselineDate, weightKg: calibration.baselineWeightKg, waistCm: calibration.baselineWaistCm, checkinId: null };
}
function planCheckin(input) {
  const req = readRequest(input.request, CHECKIN_REQUEST_FIELDS, input.serverUtcDate);
  if (!req.ok) return req.rejection;
  const cal = input.calibration;
  if (cal == null || cal.status !== "ACTIVE") return reject("NO_ACTIVE_CALIBRATION");
  if (input.energyStatus !== "PRESCRIBED") return reject("NOT_ELIGIBLE");
  const objective = objectiveOf(input.obData);
  if (objective == null) return reject("OBJECTIVE_UNRESOLVED");
  if (objective !== cal.objective) return reject("OBJECTIVE_CHANGED");
  const cycleIndex = cycleIndexForDate(cal.cycleStart, req.date);
  if (cycleIndex == null) return reject("NOT_DUE");
  const ordered = input.history.filter((c) => c.calibrationId === cal.id).sort((a, b2) => a.cycleIndex - b2.cycleIndex);
  if (ordered.some((c) => c.cycleIndex === cycleIndex)) return reject("DUPLICATE_CYCLE");
  const last = ordered.length > 0 ? ordered[ordered.length - 1] : null;
  if (last != null && (cycleIndex < last.cycleIndex || req.date <= last.checkinDate)) return reject("OUT_OF_ORDER");
  const modalities = readTrainingModalities(input.obData?.trainingModalities);
  const trainsStrength = modalities.kind === "DECLARED" ? modalities.modalities.includes("strength") : modalities.kind === "MISSING" ? false : null;
  const b = req.body;
  const validated = validateNutritionCheckin({
    objective,
    weightKg: b.weightKg,
    waistCm: b.waistCm,
    adherenceAnswer: b.adherenceAnswer,
    hunger: b.hunger,
    energy: b.energy,
    performance: b.performance,
    trainsStrength,
    strengthExperience: b.strengthExperience,
    recentStrengthContinuity: b.recentStrengthContinuity,
    checkinDate: req.date,
    cycleNumber: cycleIndex
  });
  if (validated.status === "INVALID") return reject("CHECKIN_INVALID", validated.invalid);
  if (validated.status === "INCOMPLETE") return reject("CHECKIN_INCOMPLETE", validated.missing);
  const checkin = validated.checkin;
  const reference = referencePointFor(objective, cal, ordered);
  const trajectory = assessTrajectory({
    objective,
    previousWeightKg: reference.weightKg,
    currentWeightKg: checkin.weightKg,
    elapsed: { previousDate: reference.date, currentDate: req.date },
    experienceLevel: checkin.strengthExperience
  });
  const consecutive = last != null && last.cycleIndex === cycleIndex - 1 ? last : null;
  const previous = consecutive ? { ...previousContextFromCheckin(consecutive), waistCm: reference.waistCm } : reference.waistCm != null ? referenceOnlyContext(reference.waistCm) : null;
  const decided = decideAdaptiveNutrition({
    objective,
    trajectory,
    checkin: validated,
    currentStep: cal.currentStep,
    cycleIndex,
    previous
  });
  if (decided.status !== "DECIDED") return reject("ENGINE_INVALID");
  const record = buildCheckinRecord({ cycleIndex, checkin, trajectory, decision: decided.decision, previousWaistCm: reference.waistCm });
  if (!record.ok) return reject("ENGINE_INVALID");
  return {
    kind: "RECORD",
    requestId: req.requestId,
    calibrationId: cal.id,
    expectedLastCheckinId: cal.lastCheckinId,
    cycleIndex,
    reference,
    checkin,
    trajectory,
    decision: decided.decision,
    payload: record.payload
  };
}
export {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CLASSIFIER_VERSION,
  ADAPTIVE_ACTIONS,
  ADAPTIVE_DECISION_VERSION,
  ADAPTIVE_REASONS,
  ADHERENCE_ANSWERS,
  ADHERENCE_ANSWER_BAND,
  ADHERENCE_ANSWER_COPY_RANGE_PCT,
  ADULT_ROUTE_MIN_AGE_YEARS,
  BIOLOGICAL_SEXES,
  BODY_MIN_WINDOW_DAYS,
  CALIBRATION_STEP_MAX,
  CALIBRATION_STEP_MIN,
  CANONICAL_GOALS,
  CHECKIN_EARLY_DAYS,
  CHECKIN_LATE_DAYS,
  CHECKIN_REQUEST_FIELDS,
  CYCLE_LENGTH_DAYS,
  DAILY_LIFE_LEVELS,
  DAYS_PER_MONTH,
  DECLARED_DATE_TOLERANCE_DAYS,
  DIRECTION_STABLE_BAND_PCT,
  EER_COEFFICIENTS,
  ENERGY_CALIBRATION_VERSION,
  ENERGY_IDENTITY_FIELDS,
  ENERGY_PRESCRIPTION_VERSION,
  ENERGY_SNAPSHOT_SCHEMA_VERSION,
  FAT_ENERGY_FRACTION,
  FAT_LOSS_ABSOLUTE_DEFICIT_CAP,
  FAT_LOSS_BLOCKED_BELOW_BMI,
  FAT_LOSS_FAST_ABOVE_PCT_WEEK,
  FAT_LOSS_MIN_WINDOW_DAYS,
  FAT_LOSS_ON_TARGET_FROM_PCT_WEEK,
  FAT_LOSS_RELATIVE_DEFICIT,
  FAT_LOSS_VERY_SLOW_BELOW_PCT_WEEK,
  HSC_FAT_LOSS_SCOPE_MIN_ENERGY,
  InvalidActivityProfileError,
  InvalidMacroInputError,
  InvalidMaintenanceInputError,
  InvalidPersistedProfileError,
  InvalidPrescriptionInputError,
  InvalidProfileInputError,
  MACRO_PRESCRIPTION_VERSION,
  MAINTENANCE_BAND_PCT,
  MAINTENANCE_ESTIMATE_VERSION,
  MISSING_PROFILE_FIELDS,
  MUSCLE_GAIN_EXPERIENCE_LEVELS,
  MUSCLE_GAIN_RELATIVE_SURPLUS,
  MUSCLE_GAIN_TARGET_KG_PER_MONTH,
  NUTRITION_CHECKIN_VERSION,
  NUTRITION_ENERGY_STATUSES,
  NUTRITION_ENERGY_VALUES,
  NUTRITION_HUNGER_VALUES,
  NUTRITION_PERFORMANCE_VALUES,
  NUTRITION_PROFILE_INPUT_VERSION,
  NUTRITION_SCOPE_REASONS,
  NUTRITION_V1_MAX_AGE_YEARS,
  ORCHESTRATOR_VERSION,
  PERSISTED_BOOLEAN_KEYS,
  PROTEIN_ACTIVITY_CLASSES,
  PRW_BMI_THRESHOLD,
  PRW_EXCESS_FRACTION,
  RECENT_STRENGTH_CONTINUITY_VALUES,
  RECOMP_STABLE_KG_PER_MONTH,
  START_REQUEST_FIELDS,
  STRENGTH_EXPERIENCE_REQUIRED_OBJECTIVES,
  STRENGTH_EXPERIENCE_VALUES,
  TRAINING_BANDS,
  TRAINING_MODALITIES,
  TRAINING_MODALITIES_KEY,
  TRAJECTORY_CLASSIFICATION_VALUES,
  TRAJECTORY_ENGINE_VERSION,
  TRAJECTORY_SUFFICIENCY_VALUES,
  WAIST_CHANGE_VALUES,
  WAIST_REQUIRED_OBJECTIVES,
  WAIST_SAME_TOLERANCE_CM,
  WEIGHT_DIRECTION_VALUES,
  acceptDeclaredDate,
  activityOrdinalRank,
  adherenceBandOf,
  assessTrajectory,
  biologicalSexFrom,
  buildCheckinRecord,
  buildEnergySnapshot,
  calibrationFromRow,
  canonicalGoalFrom,
  canonicalTrainingModalities,
  checkKnownScopeExclusions,
  checkNutritionScope,
  checkScopeWithPendingInputs,
  checkinFromRow,
  classifyActivity,
  classifyWaistChange,
  currentEngineVersions,
  cycleDueDate,
  cycleIndexForDate,
  cycleStartFor,
  decideAdaptiveNutrition,
  declaredTrainingModalitiesForForm,
  deriveCarbohydratePriority,
  deriveProteinActivityClass,
  deriveWeeklyTrainingMinutes,
  eerForCategory,
  energyInputIdentity,
  estimateMaintenance,
  isIsoUtcTimestamp,
  isRequestId,
  isServableMacroPrescription,
  nonServableMacroNotice,
  nutritionProfileInputFrom,
  parseEnergySnapshot,
  pendingScopeProfileFrom,
  planCheckin,
  planStartCalibration,
  prescribeEnergy,
  prescribeMacros,
  previousContextFromCheckin,
  proteinFactor,
  proteinReferenceWeightKg,
  readTrainingModalities,
  referenceOnlyContext,
  referencePointFor,
  requiredWindowDays,
  resolveKnownNutritionScope,
  resolveMacroPrescription,
  resolveNutritionEnergy,
  resolveNutritionEnergyState,
  serializeTrainingModalities,
  trainingBandOf,
  validateNutritionCheckin,
  validateNutritionProfile,
  validateProfileCore,
  validateScopeFacts
};
