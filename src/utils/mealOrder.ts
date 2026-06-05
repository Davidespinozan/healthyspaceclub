// Orden cronológico de comidas del día — usado por el planner semanal y por
// TabHoy para intercalar los snacks donde van (desayuno → snack AM → comida →
// snack PM → cena) en vez de listarlos al final.
export function mealChrono(time: string): number {
  if (time.includes('Desayuno')) return 0;
  if (time.includes('Snack AM')) return 1;
  if (time.includes('Comida')) return 2;
  if (time.includes('Snack PM')) return 3;
  if (time.includes('Cena')) return 4;
  return 99;
}

/**
 * Ordena una lista de comidas cronológicamente conservando el índice ORIGINAL
 * de cada una (necesario para las keys de check, que se stampan por índice).
 */
export function chronoMeals<T extends { time: string }>(meals: T[]): { meal: T; i: number }[] {
  return meals
    .map((meal, i) => ({ meal, i }))
    .sort((a, b) => mealChrono(a.meal.time) - mealChrono(b.meal.time));
}
