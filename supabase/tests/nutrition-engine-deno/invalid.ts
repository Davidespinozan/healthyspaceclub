// Fixture NEGATIVO: `deno check` debe FALLAR aquí con TS2322. Prueba que el
// checker sí está aplicando los tipos generados (si fueran `any`, esto pasaría).
// Lo ejecuta check.sh; nunca forma parte del build.
import type { AdaptiveAction } from '../../functions/_shared/nutritionEngine.generated.js';

export const action: AdaptiveAction = 'BAJAR_CALORIAS';
