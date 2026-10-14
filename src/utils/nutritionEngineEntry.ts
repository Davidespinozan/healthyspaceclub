// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION ENGINE · ENTRYPOINT CANÓNICO PARA EJECUCIÓN SERVER-SIDE
//
// Reexporta SOLO la lógica pura de Nutrición que una Edge Function (Deno) podrá
// ejecutar con las MISMAS reglas que el cliente:
//   · Adaptive Nutrition: trayectoria (MB1), check-in (MB2), decisión (MB3)
//   · cadena energética (CAPA 1): perfil → alcance → actividad → mantenimiento →
//     prescripción → estado/snapshot
//   · macros (CAPA 2) y modalidad de entrenamiento declarada
//
// `npm run build:nutrition-engine` lo empaqueta, sin imports externos, en
// supabase/functions/_shared/nutritionEngine.generated.ts. Ese archivo es un
// ARTEFACTO: las reglas se editan aquí, en src/. Un test regenera el bundle y lo
// compara byte a byte con el commiteado.
//
// Fuera a propósito: energyHydration / tdee (proyección hacia el store y banda
// del banco de platillos), la persistencia de calibración (cliente Supabase) y
// cualquier módulo con React, store, DOM o red.
// ─────────────────────────────────────────────────────────────────────────────
export * from './nutritionTrajectory';
export * from './nutritionCheckin';
export * from './adaptiveNutritionDecision';
export * from './energyPrescription';
export * from './maintenanceEstimate';
export * from './activityClassifier';
export * from './profileValidation';
export * from './nutritionScopeGuard';
export * from './nutritionEnergyOrchestrator';
export * from './nutritionEnergyState';
export * from './nutritionProfileInput';
export * from './macroPrescription';
export * from './trainingModality';
