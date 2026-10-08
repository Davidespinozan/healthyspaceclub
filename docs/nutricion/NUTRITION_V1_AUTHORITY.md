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
| `66e1c11` | Ledger inicial |
| `c9f0b10` | A2 · modalidad de entrenamiento declarada |
| `ffd9d28` | A4 · prioridad de carbohidrato (matriz cerrada) |
| `aec782a` | A7 · alcance de salud por dieta terapéutica; retirada del tope renal |
| `f2ba32a` | A7.1 · exclusión conocida antes que la respuesta terapéutica pendiente |
| `37e8d31` | A8 · seguridad del peso meta como autoridad de dominio |
| `7894cf8` | A8.1 · meta legacy inválida no bloquea ediciones ajenas |
| A9 | Cierre administrativo de CAPA 2 (`VERIFIED_CLEAN`) |

Commits previos de CAPA 1: `444ee45`, `c54c313`, `090166a`, `13f744b` (cutover energético), `4721170` (retirada de la energía legacy).

---

## Resumen por capa

| Capa | Estado |
|---|---|
| CAPA 0 · alcance y decisiones de producto | Por decisión, ver tabla. Todas `IMPLEMENTED` salvo variantes de receta (`CLOSED_DESIGN · IMPLEMENTATION_DEFERRED`). |
| CAPA 1 · energía | `IMPLEMENTED / VERIFIED_CLEAN` |
| CAPA 2 · macros diarias | **`IMPLEMENTED / VERIFIED_CLEAN`** (A9). `MACRO_PRESCRIPTION_VERSION = 4`. Clase de actividad por modalidad declarada (A2), prioridad de carbohidrato por matriz cerrada (A4), ningún ajuste por diagnóstico (A7), `INFEASIBLE` como invariante defensivo (A8.2), copy de `SPORTS_SCOPE`/`INFEASIBLE` y documentación histórica marcada (A9). |
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
| D03b | Peso meta · `TARGET WEIGHT SAFETY · DOMAIN AUTHORITY` (A8) | `IMPLEMENTED` | `classifyTargetWeight` (`targetWeightSafety.ts`), consumida por `invalidField` (onboarding), EditDataSheet y `targetWeightSafetyFrom(obData)` (datos persistidos / cambio de estatura). Rango 30–300 kg y no finitos → INVALID. IMC actual ≥ 18,5: IMC meta ≥ 18,5 → VALID · 17,0–18,49 → VALID + aviso informativo · < 17,0 → INVALID. IMC actual < 18,5: meta > peso actual → VALID_GAIN_DIRECTION (aunque siga < 17) · meta ≤ peso actual → INVALID. Umbrales con tolerancia de coma flotante (18,5 exacto → VALID; 17,0 exacto → aviso). `BMI IS A PRODUCT SAFETY GUARDRAIL, NOT A DIAGNOSIS` · `TARGET WEIGHT IS NOT ENERGY/MACRO AUTHORITY` (fuera de identidad energética, macros y vigencia). | Regla de UI «IMC meta < 18,5 → rechazo» (`18fa53a`) y aviso `bajopeso-meta` | `18fa53a`, A8 | `INVALID TARGET INVALIDATES TARGET ONLY, NOT THE NUTRITION PROFILE` · `LEGACY INVALID TARGET MAY REMAIN STORED BUT IS NON-AUTHORITATIVE` · `UNRELATED PROFILE EDITS REMAIN ALLOWED` (A8.1): EditDataSheet muestra el estado de la meta guardada vía `resolveTargetWeightState(obData)` y solo bloquea una meta NUEVA inválida (`decideTargetWeightEdit`); no saca de alcance ni detiene energía/macros/plan. Distinta de `FAT_LOSS_BLOCKED` (IMC actual + pérdida de grasa). |
| D03c | Recomposición con IMC < 18,5 | `IMPLEMENTED` | Energía: arranque en mantenimiento (`energyPrescription`). Macros: recomposición ordinaria (sin «modo bienestar»). | `legacyMacroWellness` → tabla `mantener` | `13f744b`, `1c555c6` | Era la única población que aún usaba el puente wellness. |
| D04 | Vegetariano/vegano no expuestos | `IMPLEMENTED` | `avoidAuthority.PERMANENT_AVOID_CATALOG` (sin `vegetariano`/`vegano`; `normalizeCats` descarta valores persistidos) | Opciones de restricción permanente | anterior | Decisión 01. |
| D05 | Variantes de receta (decisiones 02, 03, 04) | `CLOSED_DESIGN · IMPLEMENTATION_DEFERRED` | — | — | — | No existe estructura de variantes en el banco. No se inventa arquitectura en este paquete. |
| D06 | Semántica avena/granola/coco y guarnición | `IMPLEMENTED` | Detector de restricciones (tests `PD-01..PD-03`); guarnición no es autoridad de elegibilidad | — | anterior | Decisiones 05 y 06. |
| D07 | Alcance de salud · `USER-DECLARED NEED FOR THERAPEUTIC DIET` | `IMPLEMENTED` (A7) | `obData.requiresTherapeuticDiet` (0/1) → `nutritionProfileInput` → `profileValidation` → Scope Guard: «Sí» → `OUTSIDE_HSC_NUTRITION_SCOPE` · `therapeutic_diet_required` (4.ª regla, tras edad < 19, edad ≥ 65 y embarazo). Ausente → `PROFILE_INCOMPLETE` (nunca se asume «No»), salvo que los datos presentes ya demuestren una exclusión del Scope Guard (edad, embarazo o un «Sí» terapéutico): entonces se devuelve ese motivo aunque falten la respuesta terapéutica y/o los datos de actividad, que no lo cambiarían (A7.1, generalizado en A10.1). Usuarios existentes: flujo único «Completa tu perfil de nutrición» (planner e Inicio) derivado de la cadena real (A10). Entra en la identidad energética. | Lista de diagnósticos (`conditions`: diabetes/hipertensión/renal/colesterol) | A7 | Una sola pregunta funcional, obligatoria en onboarding y editable. Sin efecto energético con «No». |
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

## CAPA 2 · macros diarias · `IMPLEMENTED / VERIFIED_CLEAN`

Autoridad: `src/utils/macroPrescription.ts` (`MACRO_PRESCRIPTION_VERSION = 4`: v1 CAPA 2 · v2 modalidad declarada A2 · v3 prioridad de carbohidrato A4 · v4 sin tope renal A7; las prescripciones persistidas de otra versión se descartan al cargar). Proyección: `store.macroTargets`, escrita en el mismo `set()` que `planGoal`.

| Concepto | Estado | Regla | Legado retirado (`1c555c6`) |
|---|---|---|---|
| Orden de autoridad | `IMPLEMENTED` | Energía (dura) → proteína → grasa → carbohidrato residual | — |
| PRW | `IMPLEMENTED` | IMC < 30: peso actual. IMC ≥ 30: peso a IMC 30 + 0,25 × exceso. Política operativa; no es masa magra. | Peso actual como denominador universal |
| Proteína | `IMPLEMENTED` | PRW × factor. Mantenimiento / ganancia / recomposición ordinaria: sin entrenamiento estructurado 1,0 · baja demanda 1,2 · fuerza, resistencia, mixto, equipo/intermitente 1,6. Pérdida de grasa: 1,3 · 1,3 · 1,8. Deporte especializado → `SPORTS_SCOPE`. Clase desde la modalidad DECLARADA (A2). Sin techo universal, sin factor de edad ni de sexo, sin tope renal. | Tabla `GKG`, arrays por objetivo, `actIdx`, techo 2,4, tope ≥ 70, `wellnessMode`, tope renal 1,0 (A7) |
| Grasa | `IMPLEMENTED` | 25 % de la energía. AMDR 20–35 % solo como referencia. | `FAT_PCT` 22/25/28/30, piso 0,6 g/kg |
| Carbohidrato | `IMPLEMENTED` | Residuo: `E − 4P − 9G`. Sin pisos (50 g, 130 g) ni clamp. Residuo ≤ 0 → `INFEASIBLE` (`CARB_RESIDUAL_NON_POSITIVE`): **`DEFENSIVE_INVARIANT_UNREACHABLE_CURRENT_POLICY`** (A8.2: 36.353.024 perfiles válidos con las autoridades reales, 0 INFEASIBLE, carbohidrato mínimo 34,4 % de la energía, residuo mínimo 556 kcal). Condición algebraica: proteína ≥ 75 % de la energía. Protegido por la rejilla de frontera `macroClosure.test.ts`. | Piso de 50 g (y el de 130 g de la especificación legacy) |
| Estados | `IMPLEMENTED` | `VALID` / `REVIEW` / `INFEASIBLE` / `SPORTS_SCOPE`. Solo `VALID`/`REVIEW` se sirven. | — |
| `REVIEW` | Arquitectura `IMPLEMENTED`; regla general `OPEN` | Hoy NO hay ningún disparador: el tope renal se retiró en A7 y la prioridad de carbohidrato no dispara REVIEW (umbrales `OPEN / NOT IMPLEMENTED`). | — |
| Prioridad de carbohidrato | `IMPLEMENTED` como metadato (A4) | Fuente: `DECLARED MODALITY + T-BAND` · `deriveCarbohydratePriority(clase, banda)`. Semántica: `CONTEXT METADATA`. Efecto automático en macros: `NONE` (STANDARD/ELEVATED/HIGH no mueven gramos ni disparan REVIEW). Resistencia/mixto/equipo en T4 → status `SPORTS_SCOPE` con motivo `CARB_PRIORITY_SPORTS_SCOPE`; deporte especializado → `SPORTS_SCOPE` (`SPECIALIZED_SPORT`). Umbral de REVIEW: `OPEN / NOT IMPLEMENTED`. | `STANDARD FOR ALL → RETIRED` |
| Redondeo | `IMPLEMENTED` | Energía intacta. Proteína y grasa a gramos enteros; carbohidrato derivado de los gramos redondeados → `4P + 9G + 4C` = energía ± 2 kcal. El estado se decide sobre valores sin redondear. | — |
| Fibra | `IMPLEMENTED` (informativa) | 14 g / 1000 kcal (LOGICA §3.4). Solo se muestra en onboarding; no es objetivo del solver. | Igual que antes |
| Vigencia del plan | `IMPLEMENTED` | `weeklyPlanCurrentness` compara `gen.kcal` **y** `gen.protG/fatG/carbG`; sin macros servibles → `NOT_CURRENT`. `PLAN_ENGINE_VERSION` 32 → 33. | Planes con macros legacy quedan `STALE` |
| Consumidores | `IMPLEMENTED` | Planner, auto-regeneración, coach, onboarding, tarjeta «Meta de hoy» leen `store.macroTargets`. | `legacyMacros`, `legacyMacroWellness`, `parseObData` (`RETIRED`) |
| `SPORTS_SCOPE` | `IMPLEMENTED` (A9: copy) | `OUTSIDE STANDARD HSC SPORTS-NUTRITION SCOPE` — no es error, enfermedad ni dato corrupto. Rutas: deporte especializado declarado (`SPECIALIZED_SPORT`, cualquier banda) · resistencia/mixto/equipo en T4 (`CARB_PRIORITY_SPORTS_SCOPE`). La energía sigue prescrita; sin gramos; no se genera ni regenera plan (`NOT_CURRENT`); el coach no recibe bloque de nutrición. Planner y onboarding explican el motivo con texto propio (`sportsScopeSpecialized` / `sportsScopeHighDemand`), vía `nonServableMacroNotice`. | — |
| `INFEASIBLE` (UX) | `IMPLEMENTED` (A9) | Respaldo defensivo genérico: «No pudimos calcular una prescripción nutricional válida con estos datos…» (`macrosUnavailable`). Sin pantalla propia ni explicación de la aritmética. Estado y motivo legibles por máquina conservados. | — |

### Dependencias temporales y supuestos · todas cerradas (A9)

1. ~~Mapeo de clase de actividad desde los minutos~~ · **`RETIRED` en A2** (ver la sección A1/A2).
2. ~~Prioridad de carbohidrato = `STANDARD` para todos~~ · **`RETIRED` en A4** (matriz cerrada clase declarada × banda T0–T4; `MACRO_PRESCRIPTION_VERSION` 2 → 3).
3. ~~Tope renal heredado (1,0 g/kg PRW)~~ · **`RETIRED` en A7** (`RENAL_PROTEIN_FACTOR_CAP`, `declaresRenalCondition`, `RENAL_CONDITION_DECLARED`). Sin sustituto: no existe prescripción renal automática en HSC V1. `MACRO_PRESCRIPTION_VERSION` 3 → 4.
4. ~~Copy para `INFEASIBLE` / `SPORTS_SCOPE`~~ · **RESUELTO en A9** (texto por motivo en planner y onboarding).
5. ~~`LOGICA-NUTRICIONAL-HSC.md` describe la política legacy~~ · **RESUELTO en A9**: marcado como DOCUMENTO HISTÓRICO con notas «SUPERADO» por punto; `PLAN-INTEGRACION.md`, `BRIEF-PARA-REVISION.md` y `LEEME-PRIMERO.md` llevan el mismo aviso. No se reescribió su contenido.

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
