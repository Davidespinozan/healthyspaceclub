import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Los tests de integración de nutrición generan planes semanales REALES (buildWeeklyPlan × matrices
    // de calorías/semillas/restricciones). Cada uno ~1-3 s; el default de 5 s se queda corto bajo carga
    // sostenida. Timeout de infraestructura (no cambia ninguna aserción).
    testTimeout: 20000,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'e2e', 'dist'],
    css: true,
  },
});
