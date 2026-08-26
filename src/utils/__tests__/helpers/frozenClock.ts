import { vi } from 'vitest';

// TEST-STABILITY-1 · reloj congelado para los tests de entrenamiento.
// computeWeeklyVolume (workoutPlanner.ts) ventana los últimos 7 días vía Date.now().
// Los fixtures de estos tests usan fechas fijas (referencia 2026-08-19), así que sin
// congelar el reloj "envejecen" fuera de la ventana y fallan según la fecha real.
// Congelamos a 2026-08-19 12:00 LOCAL (mediodía → dayKey estable en cualquier TZ), la
// misma referencia con la que se autoraron los fixtures. Solo Date (no timers). Test-only.
export function freezeTrainingTestDate(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 7, 19, 12, 0, 0)); // 19 ago 2026, 12:00 hora local
}

export function restoreTrainingTestDate(): void {
  vi.useRealTimers();
}
