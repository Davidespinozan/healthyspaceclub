import { loadExercisesEn } from '../data/exercises';
import { loadMealPlanEn } from '../data/mealPlan';
import type { AppLanguage } from '../store';

// Carga los overlays de contenido EN (ejercicios + comidas) bajo demanda. Para ES
// es no-op. Idempotente. La app espera esto antes de montar el dashboard en EN.
export async function ensureLocaleAssets(lang: AppLanguage): Promise<void> {
  if (lang !== 'en') return;
  await Promise.all([loadExercisesEn(), loadMealPlanEn()]);
}
