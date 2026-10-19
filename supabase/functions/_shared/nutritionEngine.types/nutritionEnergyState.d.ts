// ════════════════════════════════════════════════════════════════════
// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.
// Fuente única: src/utils/nutritionEngineEntry.ts (y su grafo de imports en src/utils).
// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.
// ════════════════════════════════════════════════════════════════════
import { type ActivityCategory, type DailyLifeLevel, type TrainingBand } from './activityClassifier.d.ts';
import { type NutritionEnergyResult } from './nutritionEnergyOrchestrator.d.ts';
import { type MissingProfileField, type PersistedObData } from './nutritionProfileInput.d.ts';
import type { ProfileInput } from './profileValidation.d.ts';
export declare const ENERGY_SNAPSHOT_SCHEMA_VERSION = 1;
/** Los seis estados posibles de la cadena energética, como literales. */
export type NutritionEnergyStatus = 'PRESCRIBED' | 'FAT_LOSS_BLOCKED' | 'OUTSIDE_HSC_FAT_LOSS_SCOPE' | 'OUTSIDE_HSC_NUTRITION_SCOPE' | 'PROFILE_INCOMPLETE' | 'PROFILE_UNREADABLE';
export declare const NUTRITION_ENERGY_STATUSES: readonly NutritionEnergyStatus[];
/**
 * Marcadores de ausencia para los dos estados PRE-MOTOR.
 *
 * Los replican los que `NutritionEnergyResult` ya usa en su rama de alcance: sin
 * ellos, la unión de seis estados no permitiría leer `state.prescribedEnergy` sin
 * estrechar primero, y «¿hay cifra?» es justo la pregunta que todo consumidor va
 * a hacer. En los estados pre-motor NO corrió ningún motor, así que nada de esto
 * existe — ni las versiones, porque no se produjo ninguna.
 */
interface PreEngineAbsences {
    goal?: undefined;
    scopeReason?: undefined;
    engineVersion?: undefined;
    orchestratorVersion?: undefined;
    classification?: undefined;
    maintenance?: undefined;
    bmi?: undefined;
    prescribedEnergy?: undefined;
    rawPrescribedEnergy?: undefined;
    appliedDeficit?: undefined;
    appliedSurplus?: undefined;
    deficitBound?: undefined;
}
/**
 * Estado energético productivo · unión discriminada por `status`.
 *
 * Los cuatro estados de motor se reutilizan TAL CUAL desde
 * `NutritionEnergyResult`: no se traducen, ni se renombran, ni se reconstruyen.
 * Envolverlos obligaría a inventar un discriminante nuevo e invitaría a copiar
 * campos al envoltorio, que es duplicación.
 *
 * Los dos pre-motor son nuevos porque no existen en ninguna unión cerrada: el
 * mapper devuelve `{complete:false}` y lanza, pero no produce estados.
 *
 * NOTA de uso: `state.missing` y `state.key` NO son accesibles sin estrechar por
 * `status`, porque las ramas cerradas no pueden declarar sus marcadores (son
 * CLOSED). Estrechar por `status` primero es el camino correcto de todas formas.
 */
export type NutritionEnergyState = NutritionEnergyResult | (PreEngineAbsences & {
    status: 'PROFILE_INCOMPLETE';
    /** Qué respuestas faltan, en el orden estable del mapper. Nunca vacío. */
    missing: readonly MissingProfileField[];
}) | (PreEngineAbsences & {
    status: 'PROFILE_UNREADABLE';
    /** La clave de `obData` cuyo valor no se pudo interpretar. */
    key: string;
});
/**
 * Único punto que convierte un perfil persistido en un estado energético.
 *
 * Puro y determinista. Devuelve siempre uno de los seis estados, o PROPAGA: un
 * error que no sea `InvalidPersistedProfileError` significa dato presente pero
 * inválido, y pertenece al motor que lo detectó —no a un estado de producto—.
 */
export declare function resolveNutritionEnergyState(obData: PersistedObData | null | undefined): NutritionEnergyState;
/**
 * Los diez inputs con autoridad en CAPA 1, en ORDEN EXPLÍCITO. No se usa
 * `Object.keys`: el orden de las claves de un objeto no es parte de ningún
 * contrato, y un cambio accidental de orden invalidaría todas las identidades
 * guardadas sin que cambiara ningún input.
 *
 * Cada uno está aquí porque se puede demostrar que cambia el resultado:
 *   sex                  → selecciona el bloque de coeficientes EER
 *   ageYears             → término `age` del EER + umbral del Scope Guard
 *   heightCm, weightKg   → términos del EER + IMC del guard de FAT_LOSS
 *   goal                 → rama de la prescripción
 *   pregnantOrLactating  → tercera regla del Scope Guard
 *   requiresTherapeuticDiet → cuarta regla del Scope Guard (A7)
 *   dailyLife            → fila de la matriz de clasificación
 *   trainsHabitually     → banda de entrenamiento
 *   daysPerWeek, habitualSessionMinutes → `días × minutos` → banda
 *
 * NO entran, porque no llegan a `ProfileInput` ni a ningún motor de CAPA 1:
 * `activity`/`actividad`, `nivel`, `country`, `movilidad`, `avoid`, `conditions`,
 * `pesoMeta`/`targetWeight`, `grasa`/`bodyFat`, logs de entrenamiento,
 * `completedSessions`, readiness, pasos y wearables.
 */
export declare const ENERGY_IDENTITY_FIELDS: readonly string[];
/**
 * Identidad canónica de los inputs energéticos.
 *
 * ── CANONICALIZACIÓN ────────────────────────────────────────────────────────
 * NO se hashea `obData` crudo: se hashea la forma ya normalizada, usando los
 * normalizadores de los propios módulos CLOSED (`biologicalSexFrom`,
 * `canonicalGoalFrom`). Así quedan resueltos, sin lógica nueva:
 *
 *   · `70` vs `'70'`                  → el mapper ya aplicó `Number()`
 *   · `1` vs `'1'`                    → el mapper ya produjo booleanos reales
 *   · `estatura` vs `altura`          → el mapper ya resolvió el alias
 *   · `'Hombre'` vs `'male'`          → `biologicalSexFrom` → `'male'`
 *   · `'Subir masa muscular'` vs `'MUSCLE_GAIN'` → `canonicalGoalFrom`
 *   · días/minutos obsoletos con `trainsHabitually: false` → forzados a 0 aquí
 *
 * Lo último se fuerza otra vez aunque el mapper ya lo haga: así un `ProfileInput`
 * construido a mano tampoco puede producir dos identidades para el mismo hecho
 * nutricional («no entrena»).
 *
 * NO incluye el timestamp ni las versiones de motor. Las versiones viajan aparte
 * en el snapshot a propósito: si solo cambia un motor, los inputs son los mismos
 * y la identidad coincide, pero hay que recomputar — y eso se decide comparando
 * las versiones, no el hash.
 *
 * Lanza si `sex` o `goal` no son mapeables. Para los cuatro estados de motor eso
 * ya ocurrió sin error dentro de la cadena, así que no puede pasar.
 */
export declare function energyInputIdentity(profile: Omit<ProfileInput, 'requiresTherapeuticDiet' | 'activityProfile'> & {
    requiresTherapeuticDiet: boolean | null;
    activityProfile: ProfileInput['activityProfile'] | null;
}): string;
/** Resumen de la estimación de mantenimiento. Solo donde el motor la produjo. */
export interface EnergySnapshotMaintenance {
    /** El nombre del motor, no «maintenance»: deja sitio a un adaptado en V2. */
    initialMaintenance: number;
    confidence: 'CLEAR' | 'BORDERLINE';
    category?: ActivityCategory;
    lowerCategory?: ActivityCategory;
    upperCategory?: ActivityCategory;
}
/** Resumen de la clasificación de actividad. Solo donde el motor la produjo. */
export interface EnergySnapshotClassification {
    dailyLife: DailyLifeLevel;
    trainingBand: TrainingBand;
    weeklyTrainingMinutes: number;
}
/** Versiones de los motores que produjeron este resultado. */
export interface EnergySnapshotVersions {
    classifier: number;
    maintenance: number;
    prescription: number;
    orchestrator: number;
}
/**
 * Snapshot energético V1 · **la fuente de verdad** que C4 persistirá en
 * `user_profiles.energy_snapshot`.
 *
 * Su EXISTENCIA es la prueba de que la cifra es nueva y no legacy: por eso C2
 * construye el tipo y el constructor, pero **no escribe ninguno**. Si C2
 * escribiera snapshots mientras `plan_goal` lo sigue produciendo la ruta legacy,
 * la base de datos tendría dos cifras que se contradicen y «existe snapshot»
 * dejaría de significar nada.
 *
 * ── CAMPOS OPCIONALES POR CONTRATO, NO POR COMODIDAD ────────────────────────
 * Cada `?` corresponde a un estado donde esa información **no existe**. No se
 * inventa un mantenimiento para quien quedó fuera de alcance, ni una
 * clasificación para quien no completó su perfil, ni una identidad para un perfil
 * del que no se pudo derivar una representación canónica.
 *
 * ── LO QUE NO LLEVA ─────────────────────────────────────────────────────────
 * Macros (otra autoridad, muere en la Fase D) · consumo del día (eso es
 * `nutrition_day_summary`) · copia de `obData` (ya está persistido; duplicarlo
 * crearía dos verdades de los inputs) · historial (es el snapshot VIGENTE, no una
 * serie) · `bmi` y `appliedDeficit` (derivables de lo que ya está).
 */
export interface EnergySnapshotV1 {
    schemaVersion: 1;
    status: NutritionEnergyStatus;
    /** Solo en PRESCRIBED: es la única cifra que el producto puede prescribir. */
    prescribedEnergy?: number;
    /** En PRESCRIBED y en OUTSIDE_HSC_FAT_LOSS_SCOPE: reproduce el gate de 1200. */
    rawPrescribedEnergy?: number;
    /** Ausente en OUTSIDE_HSC_NUTRITION_SCOPE y en los dos estados pre-motor. */
    maintenance?: EnergySnapshotMaintenance;
    /** Ídem: fuera del alcance de nutrición no se clasificó a nadie. */
    classification?: EnergySnapshotClassification;
    /** Ausente en los dos estados pre-motor: no hay perfil canónico del que derivarla. */
    inputIdentity?: string;
    /** Ausente en los dos estados pre-motor: no corrió ningún motor. */
    versions?: EnergySnapshotVersions;
    /** ISO. Recibido como argumento: este módulo no lee el reloj. */
    computedAt: string;
}
/** Copia defensiva: el llamador no puede mutar las versiones del módulo. */
export declare const currentEngineVersions: () => EnergySnapshotVersions;
/**
 * Construye el snapshot de un perfil persistido.
 *
 * Toma `obData` y no un estado ya resuelto, a propósito: así es IMPOSIBLE pasar
 * un estado que no corresponda a estos inputs y guardar un snapshot que mienta.
 * Resuelve el estado por su cuenta y devuelve ambos, porque C4 necesita los dos y
 * no debe resolverlo dos veces.
 *
 * `computedAt` es un argumento obligatorio: este módulo no llama a `Date.now()`,
 * así que es puro y los tests fijan el timestamp exacto sin simular relojes.
 *
 * LANZA si `computedAt` no es un ISO UTC canónico. No es un estado de producto
 * —es un contrato que el llamador incumplió—, y dejarlo pasar guardaría en la
 * columna un timestamp que el propio parser rechazaría después.
 */
export declare function buildEnergySnapshot(obData: PersistedObData | null | undefined, computedAt: string): {
    state: NutritionEnergyState;
    snapshot: EnergySnapshotV1;
};
/**
 * Resultado de leer un `energy_snapshot` de la base de datos.
 *
 * Los tres motivos de fallo NO son el mismo caso y C4 los tratará distinto:
 *   · `absent`         → perfil legacy, nunca tuvo snapshot → recalcular
 *   · `unknown_schema` → lo escribió una versión futura → recalcular, no adivinar
 *   · `malformed`      → estructura corrupta → recalcular y no confiar en el dato
 */
export type EnergySnapshotParse = {
    ok: true;
    snapshot: EnergySnapshotV1;
    reason?: undefined;
    detail?: undefined;
} | {
    ok: false;
    reason: 'absent' | 'unknown_schema' | 'malformed';
    detail?: string;
    snapshot?: undefined;
};
export declare function isIsoUtcTimestamp(v: unknown): v is string;
/**
 * Lee un `jsonb` NO CONFIABLE y decide si es un snapshot V1 utilizable.
 *
 * Nunca hace `as EnergySnapshotV1` sobre lo que llega: valida campo por campo,
 * incluidas las combinaciones que el contrato prohíbe (una cifra prescrita en un
 * estado sin prescripción, un mantenimiento CLEAR sin categoría…). Un snapshot
 * que pase esto es estructuralmente válido; si además sus inputs siguen vigentes
 * lo decide C4 comparando `inputIdentity` y `versions`.
 *
 * NO muta el input y NO hidrata nada: devuelve una copia normalizada.
 */
export declare function parseEnergySnapshot(raw: unknown): EnergySnapshotParse;
export {};
