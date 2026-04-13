// ── TDEE con Mifflin-St Jeor ──────────────────────────────────────────────
// Inputs vienen directo del onboarding store (obData)

const ACTIVITY_FACTORS: Record<string, number> = {
  'Sedentaria':  1.2,
  'Ligera':      1.375,
  'Moderada':    1.55,
  'Alta':        1.725,
  'Atleta':      1.9,
};

export function calcTDEE(
  sexo: string,
  pesoKg: number,
  estaturaСm: number,
  edad: number,
  activity: string,
): number {
  // BMR Mifflin-St Jeor
  const bmr = sexo === 'Hombre'
    ? 10 * pesoKg + 6.25 * estaturaСm - 5 * edad + 5
    : 10 * pesoKg + 6.25 * estaturaСm - 5 * edad - 161;

  const factor = ACTIVITY_FACTORS[activity] ?? 1.375;
  return Math.round(bmr * factor);
}

// ── Asigna el plan calórico según objetivo y TDEE ─────────────────────────
// planA ~3000, planB ~2500, planC ~2000, planD ~1500
export function assignPlan(tdee: number, goal: string): string {
  // Ajuste por objetivo (same logic as store finishOnboarding)
  let target = tdee;
  if      (goal === 'Bajar grasa corporal' || goal === 'Bajar grasa' || goal === 'Bajar de peso') target = tdee - 500;
  else if (goal === 'Subir masa muscular' || goal === 'Ganar músculo') target = tdee + 300;
  else if (goal === 'Recomposición' || goal === 'Recomponer') target = tdee - 200;
  // Bienestar integral → maintenance

  if (target >= 2750) return 'planA';   // ~3000
  if (target >= 2250) return 'planB';   // ~2500
  if (target >= 1750) return 'planC';   // ~2000
  return 'planD';                        // ~1500
}
