// ═════════════════════════════════════════════════════════════════════════════
// CAPA 1E · FASE C4 · ENERGY PROJECTION + HYDRATION DECISION
// ═════════════════════════════════════════════════════════════════════════════
//
// Dos preguntas, un módulo, porque son la MISMA pregunta vista desde dos sitios:
// «¿qué campos del store se derivan de un estado energético?» (proyección) y
// «¿el estado energético que hay en la base de datos sigue siendo el vigente?»
// (hidratación). Separarlas en dos archivos obligaría a que el segundo importara
// al primero para nada más que reexportarlo.
//
// ── LO QUE ESTE MÓDULO *NO* HACE ───────────────────────────────────────────────
//   · NO lee el reloj         → `computedAt` llega como argumento.
//   · NO escribe en la base   → devuelve una DECISIÓN; escribe el store.
//   · NO toca el store        → no lo importa, así que no puede haber ciclo.
//   · NO conoce `legacyEnergy` → no existe ninguna ruta de vuelta a la energía
//     legacy. Un perfil que no se puede resolver se queda SIN CIFRA; nunca
//     hereda una cifra vieja ni una cifra calculada por la ruta muerta.
//   · NO confía en `user_profiles.plan_goal` ni en `user_profiles.tdee`. No los
//     recibe. Esas dos columnas son PROYECCIONES que esta app escribe para que
//     otras lecturas (SQL, soporte) vean la cifra; no son la autoridad. La
//     autoridad es `energy_snapshot`, y si no está, no hay autoridad.
//
import { assignPlan } from './tdee';
import type { PersistedObData } from './nutritionProfileInput';
import {
  buildEnergySnapshot,
  parseEnergySnapshot,
  type EnergySnapshotV1,
  type EnergySnapshotVersions,
  type NutritionEnergyState,
} from './nutritionEnergyState';

// ═════════════════════════════════════════════════════════════════════════════
// 1 · PROYECCIÓN · estado energético → campos del store
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Los tres campos del store que se derivan del estado energético.
 *
 * `mealPlanKey` viaja con ellos aunque no sea una cifra energética porque
 * selecciona la BANDA del banco de comidas estático, y esa banda se elige a
 * partir de la cifra prescrita. Dejarlo fuera permitiría que un usuario
 * represcrito a 1.600 kcal siguiera viendo el banco de 2.800.
 */
export interface EnergyProjection {
  planGoal: number | null;
  tdee: number | null;
  mealPlanKey: string;
}

/**
 * Única función que convierte uno de los seis estados en campos del store.
 *
 * `switch` exhaustivo SIN `default`: si CAPA 2 añade un séptimo estado, esto no
 * compila. Un `default` lo convertiría en «proyecta null y sigue», que es
 * exactamente el silencio que C4 viene a eliminar.
 */
export function projectEnergy(
  state: NutritionEnergyState,
  previousMealPlanKey: string,
): EnergyProjection {
  // `maintenance` existe en los TRES estados de prescripción porque viaja en
  // `PrescriptionBase`; no existe fuera del alcance de nutrición ni antes de que
  // corra un motor. No se inventa donde no está.
  const maintenance = state.maintenance?.initialMaintenance ?? null;

  switch (state.status) {
    case 'PRESCRIBED':
      // La única rama con cifra, y por tanto la única que recalcula la banda del
      // banco. `assignPlan` nunca ve `null` ni `0`.
      return {
        planGoal: state.prescribedEnergy,
        tdee: maintenance,
        mealPlanKey: assignPlan(state.prescribedEnergy),
      };

    case 'FAT_LOSS_BLOCKED':
    case 'OUTSIDE_HSC_FAT_LOSS_SCOPE':
      // Sin prescripción, pero el mantenimiento SÍ se estimó: se proyecta porque
      // es información real, no una meta. `mealPlanKey` se conserva, inerte.
      return { planGoal: null, tdee: maintenance, mealPlanKey: previousMealPlanKey };

    case 'OUTSIDE_HSC_NUTRITION_SCOPE':
      // <19, >=65 o embarazo/lactancia: el Scope Guard cortocircuita antes de
      // ejecutar un solo motor, así que no hay mantenimiento que proyectar.
      return { planGoal: null, tdee: null, mealPlanKey: previousMealPlanKey };

    case 'PROFILE_INCOMPLETE':
    case 'PROFILE_UNREADABLE':
      // No corrió nada: ni cifra, ni mantenimiento.
      return { planGoal: null, tdee: null, mealPlanKey: previousMealPlanKey };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · DECISIÓN DE HIDRATACIÓN
// ═════════════════════════════════════════════════════════════════════════════

/** Por qué se pudo ADOPTAR el snapshot guardado tal cual. */
export type EnergyAdoptReason =
  /** Parsea, la identidad de inputs coincide y las versiones de motor coinciden. */
  | 'snapshot_current'
  /**
   * Estado pre-motor y el guardado dice lo mismo. Los pre-motor no llevan
   * identidad ni versiones (no hay perfil canónico ni motor que versionar), así
   * que lo único comparable es el `status` — y si no cambió, no hay nada que
   * reescribir salvo el `computedAt`, que es churn, no información.
   */
  | 'pre_engine_unchanged';

/** Por qué hay que volver a resolver y persistir. */
export type EnergyRecalcReason =
  /** Perfil legacy: nunca tuvo snapshot. Se recalcula IGNORANDO `plan_goal`. */
  | 'snapshot_absent'
  /** Estructura corrupta. No se confía en ningún campo suelto de dentro. */
  | 'snapshot_malformed'
  /** `schemaVersion` desconocida: lo escribió una versión futura. No se adivina. */
  | 'snapshot_unknown_schema'
  /** Cambió una respuesta que entra en los motores (peso, edad, actividad…). */
  | 'stale_identity'
  /** Cambió el código de algún motor: la misma entrada ya no da la misma salida. */
  | 'stale_versions'
  /** El `status` guardado y el recién resuelto no son el mismo. */
  | 'status_changed'
  /**
   * Identidad y versiones vigentes pero las CIFRAS no coinciden. Por
   * construcción esto es imposible: misma entrada + mismo motor ⇒ misma salida.
   * Si pasa, el snapshot se editó por fuera o hay un bug, y en ninguno de los
   * dos casos se adopta.
   */
  | 'snapshot_contradictory';

/**
 * ADOPT lleva el estado y la proyección porque el llamador los necesita para un
 * único `set()`. RECALC NO lleva ninguno: así es imposible que un llamador
 * adopte cifras de una decisión que dijo «no las adoptes». Quien recibe RECALC
 * tiene exactamente una salida — delegar en la acción central.
 */
export type EnergyHydrationOutcome =
  | {
      action: 'ADOPT';
      reason: EnergyAdoptReason;
      state: NutritionEnergyState;
      projection: EnergyProjection;
    }
  | { action: 'RECALC'; reason: EnergyRecalcReason; state?: undefined; projection?: undefined };

/** Igualdad campo a campo de las cuatro versiones de motor. */
function sameVersions(a: EnergySnapshotVersions, b: EnergySnapshotVersions): boolean {
  return (
    a.classifier === b.classifier &&
    a.maintenance === b.maintenance &&
    a.prescription === b.prescription &&
    a.orchestrator === b.orchestrator
  );
}

/**
 * Las tres cifras que el snapshot guarda y que, con identidad y versiones
 * vigentes, DEBEN reproducirse exactamente. Se comparan con `!==` incluyendo los
 * `undefined`: una cifra presente donde la nueva no la tiene es tan
 * contradictoria como una cifra distinta.
 */
function sameFigures(a: EnergySnapshotV1, b: EnergySnapshotV1): boolean {
  return (
    a.prescribedEnergy === b.prescribedEnergy &&
    a.rawPrescribedEnergy === b.rawPrescribedEnergy &&
    a.maintenance?.initialMaintenance === b.maintenance?.initialMaintenance
  );
}

/**
 * Decide si el `energy_snapshot` guardado se puede adoptar o hay que volver a
 * resolver. **Pura.** No escribe, no lee el reloj, no toca la red.
 *
 * ── POR QUÉ SE RESUELVE EL ESTADO AUNQUE SE VAYA A ADOPTAR ──────────────────
 * «El snapshot sigue vigente» no es una propiedad que se pueda leer del propio
 * snapshot: se demuestra comparándolo contra lo que los motores producen HOY con
 * el perfil de HOY. Esa resolución es pura y síncrona, no persiste nada y no
 * sustituye a la cifra guardada — la confirma. Lo que la vigencia decide es si
 * hay que ESCRIBIR, y en `ADOPT` no se escribe.
 *
 * Además es lo que permite devolver un `NutritionEnergyState` completo: el
 * snapshot es deliberadamente lossy (no lleva `goal`, ni `scopeReason`, ni
 * `missing`, ni `bmi`), así que no se puede reconstruir un estado desde él.
 * Reconstruirlo a medias crearía un séptimo estado-fantasma.
 *
 * ── PROPAGA ─────────────────────────────────────────────────────────────────
 * Si `obData` tiene un dato PRESENTE pero inválido, `buildEnergySnapshot` lanza
 * y esta función lanza con él. No se convierte en RECALC: un `'DL9'` guardado no
 * se arregla recalculando, y taparlo aquí es exactamente el fail-open que C4
 * prohíbe. El llamador decide, y su única opción legítima es quedarse SIN CIFRA.
 */
export function decideEnergyHydration(input: {
  /** El `ob_data` ya hidratado. */
  obData: PersistedObData | null | undefined;
  /** El valor crudo de la columna `user_profiles.energy_snapshot`. */
  rawSnapshot: unknown;
  /** ISO. Solo se usa para construir el snapshot de comparación. */
  computedAt: string;
  /** `mealPlanKey` vigente: se conserva en los estados sin cifra. */
  previousMealPlanKey: string;
}): EnergyHydrationOutcome {
  const parsed = parseEnergySnapshot(input.rawSnapshot);

  // Los tres motivos de no-parseo son casos distintos y se reportan distintos,
  // pero la acción es la misma: no hay autoridad guardada que adoptar.
  if (!parsed.ok) {
    switch (parsed.reason) {
      case 'absent':
        return { action: 'RECALC', reason: 'snapshot_absent' };
      case 'unknown_schema':
        return { action: 'RECALC', reason: 'snapshot_unknown_schema' };
      case 'malformed':
        return { action: 'RECALC', reason: 'snapshot_malformed' };
    }
  }

  const stored = parsed.snapshot;
  const { state, snapshot: fresh } = buildEnergySnapshot(input.obData, input.computedAt);

  if (stored.status !== fresh.status) return { action: 'RECALC', reason: 'status_changed' };

  const adopt = (reason: EnergyAdoptReason): EnergyHydrationOutcome => ({
    action: 'ADOPT',
    reason,
    state,
    projection: projectEnergy(state, input.previousMealPlanKey),
  });

  // Pre-motor: el parser garantiza que un snapshot pre-motor tiene EXACTAMENTE
  // `{schemaVersion, status, computedAt}`, así que aquí no hay identidad ni
  // versiones en NINGUNO de los dos lados. Mismo status ⇒ nada cambió.
  if (fresh.inputIdentity == null || fresh.versions == null) {
    return adopt('pre_engine_unchanged');
  }
  // El mismo status del lado guardado obliga a los mismos campos por contrato;
  // esta comprobación es la que se lo demuestra al compilador.
  if (stored.inputIdentity == null || stored.versions == null) {
    return { action: 'RECALC', reason: 'snapshot_malformed' };
  }

  if (stored.inputIdentity !== fresh.inputIdentity) {
    return { action: 'RECALC', reason: 'stale_identity' };
  }
  if (!sameVersions(stored.versions, fresh.versions)) {
    return { action: 'RECALC', reason: 'stale_versions' };
  }
  if (!sameFigures(stored, fresh)) {
    return { action: 'RECALC', reason: 'snapshot_contradictory' };
  }

  return adopt('snapshot_current');
}
