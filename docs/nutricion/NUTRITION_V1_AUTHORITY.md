# HSC Nutrition V1 · Authority Ledger

Registro único de **qué autoridad decide cada concepto** de HSC Nutrition V1, en qué estado está y qué legado reemplazó.

Última actualización: 2026-10-07 · rama `fix/nutrition-restriction-detection` (sin push, sin deploy).

## Estados

| Estado | Significado |
|---|---|
| `OPEN` | Sin decisión de producto cerrada. |
| `CLOSED_DESIGN` | Decisión cerrada en diseño. **No** implica código. |
| `IMPLEMENTED` | Hay código productivo que aplica la decisión. |
| `VERIFIED_CLEAN` | Implementado **y** verificado: sin autoridades paralelas ni consumidores legacy (barrido del árbol + tests de contrato). |
| `RETIRED` | Autoridad legacy borrada del código. |
| `OUT_OF_SCOPE` | Fuera de V1 por decisión explícita. |
| `LEGACY ACTIVE · PENDING CAPA 4` | Regla legacy que sigue operando porque su reemplazo todavía no está diseñado. No se borra antes. |

`CLOSED_DESIGN ≠ IMPLEMENTED` · `IMPLEMENTED ≠ VERIFIED_CLEAN`.

## Commits de este checkpoint

| Commit | Contenido |
|---|---|
| `18fa53a` | CAPA 0 · rechazo de peso meta con IMC < 18,5 + retirada de copy muerto contradictorio |
| `4c021d5` | CAPA 2 · autoridad `macroPrescription` (núcleo + adaptador + tests) |
| `1c555c6` | CAPA 2 · migración de consumidores, vigencia por macros, `PLAN_ENGINE_VERSION` 33, retirada de macros legacy |
| (este documento) | Ledger |

Commits previos de CAPA 1: `444ee45`, `c54c313`, `090166a`, `13f744b` (cutover energético), `4721170` (retirada de la energía legacy).

---

## Resumen por capa

| Capa | Estado |
|---|---|
| CAPA 0 · alcance y decisiones de producto | Por decisión, ver tabla. Todas `IMPLEMENTED` salvo variantes de receta (`CLOSED_DESIGN · IMPLEMENTATION_DEFERRED`). |
| CAPA 1 · energía | `IMPLEMENTED / VERIFIED_CLEAN` |
| CAPA 2 · macros diarias | `IMPLEMENTED`. **No** `VERIFIED_CLEAN` todavía: falta copy dedicado para `INFEASIBLE`/`SPORTS_SCOPE` y `LOGICA-NUTRICIONAL-HSC.md` sigue describiendo política legacy. La clase de actividad sale de la modalidad declarada (A2), la prioridad de carbohidrato de la matriz cerrada (A4) y ningún diagnóstico ajusta macros (A7). |
| CAPA 3 | `OPEN`. No hay definición de esta capa en el repo ni implementación dedicada. No se infiere cierre. |
| CAPA 4 · reparto en tiempos de comida | `OPEN / DESIGN IN PROGRESS`. Punto de reanudación: **MEAL FREQUENCY & EATING OPPORTUNITIES**. Sus reglas legacy siguen activas (ver abajo). |
| CAPA 5+ | `OPEN` |

---

## CAPA 0 · alcance y decisiones de producto

Fuente de las decisiones: `docs/nutricion/NUTRITION-PRODUCT-DECISIONS-V2.md`.

| ID | Concepto | Estado | Autoridad actual | Legado reemplazado | Commit | Notas |
|---|---|---|---|---|---|---|
| D01 | Edad 19–64 | `IMPLEMENTED` | `nutritionScopeGuard` → `OUTSIDE_HSC_NUTRITION_SCOPE` (`age_under_19` / `age_65_or_over`) | `wellnessMode` por menor de 18 / ≥ 70 (retirado en C5) | `090166a` | Sin energía no hay macros: `resolveMacroPrescription` devuelve `null`. Probado con 18/19/64/65. |
| D02 | Embarazo/lactancia | `OUT_OF_SCOPE` · `IMPLEMENTED` | Scope Guard → `pregnancy_or_lactation` | Mantenimiento «bienestar» legacy | `090166a` | Sin energía ni macros. |
| D03a | Bajo peso + pérdida de grasa | `IMPLEMENTED` | `energyPrescription` → `FAT_LOSS_BLOCKED` | Rama `riesgoBajoPeso` del `wellnessMode` legacy | `13f744b` | Sin macros. |
| D03b | Peso meta con IMC < 18,5 | `IMPLEMENTED` | `invalidField` → `'pesoMetaBajoPeso'` (bloquea el paso del onboarding) | Aviso `bajopeso-meta` / `metaBajoPeso` (solo advertía) | `18fa53a` | `pesoMeta` solo se captura en onboarding y no alimenta ningún motor; no hay datos persistidos que «ignorar». |
| D03c | Recomposición con IMC < 18,5 | `IMPLEMENTED` | Energía: arranque en mantenimiento (`energyPrescription`). Macros: recomposición ordinaria (sin «modo bienestar»). | `legacyMacroWellness` → tabla `mantener` | `13f744b`, `1c555c6` | Era la única población que aún usaba el puente wellness. |
| D04 | Vegetariano/vegano no expuestos | `IMPLEMENTED` | `avoidAuthority.PERMANENT_AVOID_CATALOG` (sin `vegetariano`/`vegano`; `normalizeCats` descarta valores persistidos) | Opciones de restricción permanente | anterior | Decisión 01. |
| D05 | Variantes de receta (decisiones 02, 03, 04) | `CLOSED_DESIGN · IMPLEMENTATION_DEFERRED` | — | — | — | No existe estructura de variantes en el banco. No se inventa arquitectura en este paquete. |
| D06 | Semántica avena/granola/coco y guarnición | `IMPLEMENTED` | Detector de restricciones (tests `PD-01..PD-03`); guarnición no es autoridad de elegibilidad | — | anterior | Decisiones 05 y 06. |
| D07 | Alcance de salud · `USER-DECLARED NEED FOR THERAPEUTIC DIET` | `IMPLEMENTED` (A7) | `obData.requiresTherapeuticDiet` (0/1) → `nutritionProfileInput` → `profileValidation` → Scope Guard: «Sí» → `OUTSIDE_HSC_NUTRITION_SCOPE` · `therapeutic_diet_required` (4.ª regla, tras edad < 19, edad ≥ 65 y embarazo). Ausente → `PROFILE_INCOMPLETE` (nunca se asume «No»). Entra en la identidad energética. | Lista de diagnósticos (`conditions`: diabetes/hipertensión/renal/colesterol) | A7 | Una sola pregunta funcional, obligatoria en onboarding y editable. Sin efecto energético con «No». |
| — | Lista de diagnósticos como autoridad de Nutrition | `RETIRED` (A7) | — | Captura en onboarding y EditDataSheet retirada. `obData.conditions` en datos antiguos: `LEGACY DATA · NON-AUTHORITATIVE` (nadie lo lee; sin migración). Ajustes de macros por enfermedad: `NONE`. | A7 | Contradice `LOGICA-NUTRICIONAL-HSC.md` §punto 2 («Condiciones … Sin bloqueo»): documento histórico, no se reescribe. |
| — | Copy contradictorio (`avisoMenor`, `avisoEmbarazo`, `avisoBajoPeso`, `avisoAdultoMayor`, `avisoTopado`) | `RETIRED` | Copys `sinMeta*` por estado energético | Avisos del `wellnessMode` legacy | `18fa53a` | Tenían 0 consumidores y contradecían el alcance V1. |

---

## CAPA 1 · energía · `IMPLEMENTED / VERIFIED_CLEAN`

| Concepto | Autoridad | Legado retirado |
|---|---|---|
| Lectura del perfil | `nutritionProfileInput` → `profileValidation` | `parseObData` con defaults (retirado en CAPA 2) |
| Alcance | `nutritionScopeGuard` | `wellnessMode` |
| Actividad | `activityClassifier` (DL1–DL4 × T0–T4) | `ACTIVITY_FACTORS`, `obData.activity` |
| Mantenimiento | `maintenanceEstimate` (DRI 2023 EER) | Mifflin-St Jeor / Katch-McArdle, `calcTDEE` |
| Prescripción | `energyPrescription` | `goalFactor`, `sexFloor` |
| Estado | `nutritionEnergyState` (6 estados) + `energy_snapshot` | `plan_goal`/`tdee` como autoridad |
| Proyección al store | `energyHydration.projectEnergy` / `decideEnergyHydration` | — |

Verificación (este checkpoint, sin cambios de código en CAPA 1): 0 apariciones productivas de `legacyEnergy`, `computeNutritionTargets`, `calcTDEE`, `ACTIVITY_FACTORS`, `goalFactor`, `sexFloor`, Mifflin, Katch; ninguna lectura de las columnas `plan_goal`/`tdee` como autoridad; `planGoal` solo se escribe en el store desde la proyección.

---

## CAPA 2 · macros diarias · `IMPLEMENTED`

Autoridad: `src/utils/macroPrescription.ts` (`MACRO_PRESCRIPTION_VERSION = 1`). Proyección: `store.macroTargets`, escrita en el mismo `set()` que `planGoal`.

| Concepto | Estado | Regla | Legado retirado (`1c555c6`) |
|---|---|---|---|
| Orden de autoridad | `IMPLEMENTED` | Energía (dura) → proteína → grasa → carbohidrato residual | — |
| PRW | `IMPLEMENTED` | IMC < 30: peso actual. IMC ≥ 30: peso a IMC 30 + 0,25 × exceso. Política operativa; no es masa magra. | Peso actual como denominador universal |
| Proteína | `IMPLEMENTED` | PRW × factor (tabla objetivo × clase). Deporte especializado → `SPORTS_SCOPE`. | Tabla `GKG`, arrays por objetivo, `actIdx`, techo 2,4, tope ≥ 70, `wellnessMode` |
| Grasa | `IMPLEMENTED` | 25 % de la energía. AMDR 20–35 % solo como referencia. | `FAT_PCT` 22/25/28/30, piso 0,6 g/kg |
| Carbohidrato | `IMPLEMENTED` | Residuo. Residuo ≤ 0 → `INFEASIBLE` (`CARB_RESIDUAL_NON_POSITIVE`), sin clamp. | Piso de 50 g (y el de 130 g de la especificación legacy) |
| Estados | `IMPLEMENTED` | `VALID` / `REVIEW` / `INFEASIBLE` / `SPORTS_SCOPE`. Solo `VALID`/`REVIEW` se sirven. | — |
| `REVIEW` | Arquitectura `IMPLEMENTED`; regla general `OPEN` | Hoy NO hay ningún disparador: el tope renal se retiró en A7 y la prioridad de carbohidrato no dispara REVIEW (umbrales `OPEN / NOT IMPLEMENTED`). | — |
| Prioridad de carbohidrato | `IMPLEMENTED` como metadato (A4) | Fuente: `DECLARED MODALITY + T-BAND` · `deriveCarbohydratePriority(clase, banda)`. Semántica: `CONTEXT METADATA`. Efecto automático en macros: `NONE` (STANDARD/ELEVATED/HIGH no mueven gramos ni disparan REVIEW). Resistencia/mixto/equipo en T4 → status `SPORTS_SCOPE` con motivo `CARB_PRIORITY_SPORTS_SCOPE`; deporte especializado → `SPORTS_SCOPE` (`SPECIALIZED_SPORT`). Umbral de REVIEW: `OPEN / NOT IMPLEMENTED`. | `STANDARD FOR ALL → RETIRED` |
| Redondeo | `IMPLEMENTED` | Energía intacta. Proteína y grasa a gramos enteros; carbohidrato derivado de los gramos redondeados → `4P + 9G + 4C` = energía ± 2 kcal. El estado se decide sobre valores sin redondear. | — |
| Fibra | `IMPLEMENTED` (informativa) | 14 g / 1000 kcal (LOGICA §3.4). Solo se muestra en onboarding; no es objetivo del solver. | Igual que antes |
| Vigencia del plan | `IMPLEMENTED` | `weeklyPlanCurrentness` compara `gen.kcal` **y** `gen.protG/fatG/carbG`; sin macros servibles → `NOT_CURRENT`. `PLAN_ENGINE_VERSION` 32 → 33. | Planes con macros legacy quedan `STALE` |
| Consumidores | `IMPLEMENTED` | Planner, auto-regeneración, coach, onboarding, tarjeta «Meta de hoy» leen `store.macroTargets`. | `legacyMacros`, `legacyMacroWellness`, `parseObData` (`RETIRED`) |

### ⚠️ Dependencias temporales y supuestos (impiden `VERIFIED_CLEAN`)

1. ~~Mapeo de clase de actividad desde los minutos~~ · **`RETIRED` en A2** (ver la sección A1/A2).
2. ~~Prioridad de carbohidrato = `STANDARD` para todos~~ · **`RETIRED` en A4** (matriz cerrada clase declarada × banda T0–T4; `MACRO_PRESCRIPTION_VERSION` 2 → 3).
3. ~~Tope renal heredado (1,0 g/kg PRW)~~ · **`RETIRED` en A7** (`RENAL_PROTEIN_FACTOR_CAP`, `declaresRenalCondition`, `RENAL_CONDITION_DECLARED`). Sin sustituto: no existe prescripción renal automática en HSC V1. `MACRO_PRESCRIPTION_VERSION` 3 → 4.
4. **Copy para `INFEASIBLE` / `SPORTS_SCOPE`.** No hay mensaje dedicado: el planner aborta en neutro (como sin energía), el onboarding muestra la energía sin gramos y el coach dice que no hay meta nutricional vigente.
5. **`LOGICA-NUTRICIONAL-HSC.md` §3.1–3.3** (GKG, grasa por objetivo, piso de 130 g) describe la política legacy y no se ha actualizado.

### A1/A2 · Fuente de la clase de actividad proteica

| Concepto | Estado |
|---|---|
| Fuente de la modalidad | `USER_DECLARED` · `obData.trainingModalities` (CSV canónico: `strength`, `endurance`, `team_intermittent`, `low_demand`, `specialized_sport`). Se captura en el onboarding (paso 9, con «Sí») y se edita en la hoja de datos. |
| Derivación | `deriveProteinActivityClass(trainsHabitually, modalities)` en `trainingModality.ts`. «No entreno» → `NO_STRUCTURED_TRAINING`. Especializado domina. 1 estructurada → su clase. 2 o más → `MIXED`. Solo baja demanda → `LOW_DEMAND`. |
| Falta la declaración (entrena y sin modalidad, o valor inválido) | `MacroResolution.INPUT_REQUIRED` · `TRAINING_MODALITY_REQUIRED`. Sin prescripción, sin `MacroStatus` nuevo. El plan guardado queda `NOT_CURRENT` (no se borra) y el planner pide la modalidad. |
| Carga de entrenamiento | `T0–T4 · SEPARATE DIMENSION` (energía). No decide la clase. |
| Historial observado (`completedSessions`, `workout_log`, `trainingGoal`, `activityLog`, modalidad del día) | `NON_AUTHORITATIVE FOR NUTRITION MODALITY` |
| Mapeo anterior (minutos/banda → clase, `STRUCTURED_BANDS`, `proteinActivityClassFrom`) | `RETIRED` · `MACRO_PRESCRIPTION_VERSION` 1 → 2; las prescripciones v1 persistidas se descartan al cargar. |
| Energía | No depende de la modalidad (fuera de `ENERGY_IDENTITY_FIELDS`). |

### Cruce de capas aceptado

**NUEVAS MACROS DIARIAS → REPARTO DE COMIDAS LEGACY (temporal).** El objetivo diario `{kcal, protG, fatG, carbG}` viene de CAPA 1 + CAPA 2; su reparto entre tiempos de comida sigue siendo el de CAPA 4 legacy, sin adaptador adicional.

---

## CAPA 4 · reparto en tiempos de comida · `OPEN / DESIGN IN PROGRESS`

Reanudar en: **MEAL FREQUENCY & EATING OPPORTUNITIES**.

| Regla | Estado | Dónde |
|---|---|---|
| `SHARE_KCAL` 25 / 7,5 / 35 / 7,5 / 25 | `LEGACY ACTIVE · PENDING CAPA 4` | `planEngine.ts` |
| `SHARE_PROT` 32 / 2 / 32 / 2 / 32 | `LEGACY ACTIVE · PENDING CAPA 4` | `planEngine.ts` |
| Snacks por slot (> 2200 kcal) | `LEGACY ACTIVE · PENDING CAPA 4` | `planEngine.ts` |
| Snack denso (umbral 2800 kcal) | `LEGACY ACTIVE · PENDING CAPA 4` | `planEngine.ts` |
| Solver (`fitSlot`/`solve`/`topUpDay`/`topUpMeals`), topes de porción | `LEGACY ACTIVE · PENDING CAPA 4` | `planEngine.ts` |
| Bandas del banco estático (`assignPlan` 2750/2250/1750 → `mealPlanKey`) | `LEGACY ACTIVE · PENDING CAPA 4` | `tdee.ts`, `energyHydration.ts` |
| `mealCalorieSplit` 25/35/25/15 | `LEGACY ACTIVE · PENDING CAPA 4` (sin consumidores productivos) | `nutritionTargets.ts` |
| `canonicalTime`/`eligibleTimes`, FORMULA/ASSEMBLY/STRUCTURED, complementos, comida ≠ platillo, presentación | `OPEN` | — |

## CAPA 5+ · `OPEN`

---

## Mapa de autoridad vigente

```
obData ─▶ nutritionProfileInput ─▶ profileValidation ─▶ Scope Guard ─▶ ActivityClassifier
       ─▶ maintenanceEstimate ─▶ energyPrescription ─▶ NutritionEnergyState ─▶ energy_snapshot
                                                              │
                     store.recalcFromObData / hydrateEnergyFromSnapshot (un solo set)
                                                              │
                  ┌───────────────────────────┬───────────────┴──────────────┐
            planGoal / tdee / mealPlanKey     macroTargets (macroPrescription)
                  └────────────┬──────────────┘
          planner · auto-regen (vigencia) · coach · onboarding · «Meta de hoy»
                               │
                     planEngine (reparto CAPA 4 legacy)
```
