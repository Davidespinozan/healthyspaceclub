/**
 * nutritionCoach.ts — el "coach": lee lo consumido del día vs la meta y decide
 * qué decirle al usuario (vas bien / te falta proteína / te pasaste) y qué
 * priorizar en lo que resta. Función PURA (sin UI, sin i18n) → devuelve datos
 * + CÓDIGOS de mensaje; la UI traduce. Le da igual si la comida fue del plan o
 * propia: solo lee los números (por eso "registrar todo" mantiene al coach vivo).
 */

export interface CoachMacros { kcal: number; prot: number; carbs: number; fat: number }

export interface CoachInput {
  consumed: CoachMacros;
  target: CoachMacros;
  mealsDone: number;
  mealsTotal: number;
}

export type MacroStatus = 'good' | 'watch' | 'over';
export type CoachTone = 'good' | 'watch' | 'over';
/** Código del titular — la UI lo mapea a una frase i18n con los números. */
export type CoachHeadline = 'start' | 'good' | 'protein' | 'over' | 'doneGood' | 'doneShort';

export interface MacroRead {
  key: 'prot' | 'carbs' | 'fat';
  consumed: number;
  target: number;
  left: number;        // lo que falta (0 si ya llegó)
  pct: number;         // 0-100, topado a 100 para barras
  status: MacroStatus;
}

export interface Coach {
  kcalConsumed: number;
  kcalTarget: number;
  kcalLeft: number;      // puede ser negativo (te pasaste)
  kcalPct: number;       // 0-100 (topado)
  over: boolean;         // te pasaste de kcal (con tolerancia)
  mealsDone: number;
  mealsLeft: number;
  perMealKcal: number;   // kcal sugeridas por comida restante (0 si no quedan)
  tone: CoachTone;
  focus: 'prot' | null;  // macro a priorizar (v1: proteína, la clave del objetivo)
  headline: CoachHeadline;
  protLeft: number;      // proteína que falta (atajo para el titular)
  macros: MacroRead[];
}

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function macroRead(key: MacroRead['key'], consumed: number, target: number, pace: number): MacroRead {
  const pct = target > 0 ? (consumed / target) * 100 : 0;
  const left = Math.max(0, Math.round(target - consumed));
  let status: MacroStatus;
  if (target <= 0) {
    status = 'good';
  } else if (consumed > target * (key === 'prot' ? 1.25 : 1.15)) {
    status = 'over';
  } else if (key === 'prot') {
    // proteína: buena si mantiene el paso del día (o casi llegó); si no, a vigilar
    status = (pct >= pace * 85 || pct >= 95) ? 'good' : 'watch';
  } else {
    status = 'good'; // carbos/grasa: solo marcamos exceso; el resto es libre
  }
  return { key, consumed: Math.round(consumed), target: Math.round(target), left, pct: clampPct(pct), status };
}

export function computeCoach(input: CoachInput): Coach {
  const { consumed, target, mealsDone, mealsTotal } = input;
  const mealsLeft = Math.max(0, mealsTotal - mealsDone);
  const dayDone = mealsTotal > 0 && mealsDone >= mealsTotal;
  const pace = mealsTotal > 0 ? mealsDone / mealsTotal : 0; // 0..1

  const kcalLeft = Math.round(target.kcal - consumed.kcal);
  const kcalPct = clampPct(target.kcal > 0 ? (consumed.kcal / target.kcal) * 100 : 0);
  const over = target.kcal > 0 && consumed.kcal > target.kcal * 1.05;
  const perMealKcal = mealsLeft > 0 ? Math.max(0, Math.round(kcalLeft / mealsLeft)) : 0;

  const prot = macroRead('prot', consumed.prot, target.prot, pace);
  const macros: MacroRead[] = [
    prot,
    macroRead('carbs', consumed.carbs, target.carbs, pace),
    macroRead('fat', consumed.fat, target.fat, pace),
  ];

  const proteinBehind = prot.status === 'watch';
  const focus: Coach['focus'] = proteinBehind ? 'prot' : null;

  let tone: CoachTone;
  let headline: CoachHeadline;
  if (dayDone) {
    if (over) { tone = 'over'; headline = 'over'; }
    else if (proteinBehind) { tone = 'watch'; headline = 'doneShort'; }
    else { tone = 'good'; headline = 'doneGood'; }
  } else if (mealsDone === 0) {
    tone = 'good'; headline = 'start';
  } else if (over) {
    tone = 'over'; headline = 'over';
  } else if (proteinBehind) {
    tone = 'watch'; headline = 'protein';
  } else {
    tone = 'good'; headline = 'good';
  }

  return {
    kcalConsumed: Math.round(consumed.kcal),
    kcalTarget: Math.round(target.kcal),
    kcalLeft,
    kcalPct,
    over,
    mealsDone,
    mealsLeft,
    perMealKcal,
    tone,
    focus,
    headline,
    protLeft: prot.left,
    macros,
  };
}
