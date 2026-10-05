// ── Banda del banco de comidas según la meta YA calculada ─────────────────
//
// CAPA 1E · FASE C5 · este fichero contenía además `calcTDEE` (Mifflin-St Jeor ×
// `ACTIVITY_FACTORS`). Quedó sin un solo consumidor productivo cuando C4 cedió la
// autoridad energética al HSC Energy Engine, y era el último importador de
// `ACTIVITY_FACTORS` — así que retirarlo es lo que permitió borrar esa tabla.
//
// Lo que queda no es energía: es la selección de banda del banco de platillos a
// partir de una cifra YA prescrita. Su único llamador es `projectEnergy`, en la
// rama `PRESCRIBED`, donde la cifra existe por construcción.

// Recibe el planGoal FINAL (con déficit/superávit + piso ya aplicados).
// planA ~3000, planB ~2500, planC ~2000, planD ~1500.
// NOTA (Fase 4): se colapsará a UN solo banco que escala por usuario.
export function assignPlan(planGoal: number): string {
  if (planGoal >= 2750) return 'planA';
  if (planGoal >= 2250) return 'planB';
  if (planGoal >= 1750) return 'planC';
  return 'planD';
}
