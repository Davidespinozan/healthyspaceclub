// ── TDEE con Mifflin-St Jeor ──────────────────────────────────────────────
// La lógica de META (déficit/superávit + piso de seguridad) vive en
// nutritionTargets.ts (fuente única). Aquí quedan solo el TDEE y la banda de banco.
import { ACTIVITY_FACTORS } from './nutritionTargets';

export function calcTDEE(
  sexo: string,
  pesoKg: number,
  estaturaCm: number,
  edad: number,
  activity: string,
): number {
  // BMR Mifflin-St Jeor
  const bmr = sexo === 'Hombre'
    ? 10 * pesoKg + 6.25 * estaturaCm - 5 * edad + 5
    : 10 * pesoKg + 6.25 * estaturaCm - 5 * edad - 161;

  const factor = ACTIVITY_FACTORS[activity] ?? 1.375;
  return Math.round(bmr * factor);
}

// ── Banda del banco de comidas según la meta YA calculada ─────────────────
// Recibe el planGoal FINAL (con déficit/superávit + piso ya aplicados).
// planA ~3000, planB ~2500, planC ~2000, planD ~1500.
// NOTA (Fase 4): se colapsará a UN solo banco que escala por usuario.
export function assignPlan(planGoal: number): string {
  if (planGoal >= 2750) return 'planA';
  if (planGoal >= 2250) return 'planB';
  if (planGoal >= 1750) return 'planC';
  return 'planD';
}
