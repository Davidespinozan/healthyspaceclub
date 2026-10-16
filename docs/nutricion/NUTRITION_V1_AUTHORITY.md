# HSC Nutrition V1 · Authority Ledger

Registro único de **qué autoridad decide cada concepto** de HSC Nutrition V1, en qué estado está y qué legado reemplazó.

Última actualización: 2026-10-15 · rama `fix/nutrition-restriction-detection` · Adaptive Nutrition Bloque 9 (commit local, sin push hasta cerrar la QA del domingo). Producción: schema de calibración (`20261017120000`) aplicado y Edge `nutrition-checkin` v5 desplegada; frontend solo en el preview del PR #1 (sin merge a `main`).

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
| `VISUAL_QA_PENDING` | Implementado y verificado por tests (y, si aplica, desplegado), pendiente de la confirmación visual del usuario. |

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
| CAPA 1 · energía | `IMPLEMENTED / VERIFIED_CLEAN` · V2: FAT_LOSS = M − min(0,20·M, 750) (`aa188b0`, `ENERGY_PRESCRIPTION_VERSION = 2`) |
| Peso nutricional | `IMPLEMENTED / VERIFIED_CLEAN` + visual (Bloque 4, `f5ed417`) |
| Adaptive Nutrition (Bloques 1–9) | Ver sección propia. Bloques 1–5 `VERIFIED_CLEAN`; 6–8 `VISUAL_QA_PENDING_SUNDAY`; 9 `IMPLEMENTED / VERIFIED_CLEAN` (tests) |
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

## Peso nutricional (Adaptive Bloque 4) · `IMPLEMENTED / VERIFIED_CLEAN` + visual

| Concepto | Regla |
|---|---|
| Autoridad | `obData.peso` (peso nutricional). Lo fijan: onboarding, la corrección explícita de «Mis datos» y el SERVIDOR (abrir calibración y check-in, escritura estrecha de `peso` en la misma transacción). |
| `weight_log` | Solo historial. Un pesaje no mueve peso nutricional, energía, macros, `plan_goal` ni plan. |
| Mediana rodante (`weightTrend.ts`: `nextNutritionWeight` / `deriveStableNutritionWeight`) | `RETIRED` (Bloque 9; sin consumidores desde el Bloque 4). |

---

## ADAPTIVE NUTRITION · Bloques 1–9

### Estado por bloque

| Bloque | Contenido | Estado | Commit |
|---|---|---|---|
| MB1 | Trayectoria (`nutritionTrajectory`) | `IMPLEMENTED / VERIFIED_CLEAN` | `7bb374e`, `2b5a56b` |
| MB2 | Check-in de dominio (`nutritionCheckin`) | `IMPLEMENTED / VERIFIED_CLEAN` | `5631e66` |
| MB3 | Decisión (`adaptiveNutritionDecision`): ±2 (`CALIBRATION_LIMIT_REACHED`), inversión bloqueada (`DIRECTION_REVERSAL_BLOCKED`) | `IMPLEMENTED / VERIFIED_CLEAN` | `050f9cd` |
| MB4 | Persistencia (`nutrition_calibrations`, `nutrition_adaptive_checkins`) | `IMPLEMENTED / VERIFIED_CLEAN` | `e29ac72` |
| Bloque 1 / 1B | Bundle compartido del motor para Edge + tipos | `IMPLEMENTED / VERIFIED_CLEAN` | `f424dd2`, `ad5f6c4` |
| Bloque 2 | Autoridad del SERVIDOR: Edge `nutrition-checkin` decide; el cliente solo declara (lista blanca) | `IMPLEMENTED / VERIFIED_CLEAN` | `5d40c82` |
| Bloque 3 | CAPA 1 V2 · pérdida de grasa 20 % / 750 kcal | `IMPLEMENTED / VERIFIED_CLEAN` + visual | `aa188b0` |
| Bloque 4 | Autoridad del peso nutricional | `IMPLEMENTED / VERIFIED_CLEAN` + visual | `f5ed417` |
| Bloque 5 | Capa de energía calibrada; base cruda congelada; suelo T1; schema `base_energy_raw` | `IMPLEMENTED / DEPLOYED / E2E VERIFIED` | `8d0d5d1`, `4c0e245` (+ migración `20261017120000`, Edge v4) |
| Bloques 6–8 | Snapshot V2 + hidratación · `STRENGTH_REQUIRED` · integración completa | `IMPLEMENTED / DEPLOYED (Edge v5)` · **`VISUAL_QA_PENDING_SUNDAY`** | `c7e5a49` |
| Bloque 9 | Integración final, retirada de legacy Adaptive, ledger | `IMPLEMENTED / VERIFIED_CLEAN` (tests; sin push hasta la QA del domingo) | este checkpoint |

### Reglas cerradas (`CLOSED_DESIGN` → `IMPLEMENTED`)

| Concepto | Regla | Autoridad |
|---|---|---|
| Base congelada | `rawPrescribedEnergy` de CAPA 1 (crudo) calculado en el SERVIDOR al abrir la calibración, con el peso base que la RPC fija como peso nutricional. Inmutable (`base_energy_raw numeric NOT NULL`, guard). `base_energy_kcal` (integer) sin autoridad. | `planStartCalibration`, migración `20261017120000` |
| Energía calibrada | `base × (1 + 0,05 × step)`, `step ∈ {−2…+2}`, calculada como `base × (100 + 5·step) / 100` desde el paso ABSOLUTO: sin compounding. Redondeo una vez al final; step 0 = `prescribedEnergy` de CAPA 1 a la base. | `adaptiveCalibrationEnergy.calibratedEnergy` |
| Suelo T1 | Al bajar (`step < 0`), crudo ≤ 1200 → REVIEW · `SAFETY_FLOOR_REACHED`; el paso NO se mueve (`proposed = previous`, la bajada queda en `blocked_*`). Se evalúa sobre el CRUDO. | planificador del servidor + CHECK de `reason` |
| Paso decidido vs efectivo | `current_step` = paso DECIDIDO. El efectivo se deriva por fecha recorriendo la cadena de check-ins (cada uno parte del decidido anterior; el último = `current_step`), o no se adopta. | `adaptiveEnergyAuthority.deriveEffectiveStep` |
| Domingo (D-B5-SUNDAY) | Un paso rige desde el PRIMER DOMINGO IGUAL O POSTERIOR a `checkin_date` (check-in en domingo → ese mismo día). Sin columna: se deriva de `checkin_date`. | `firstSundayOnOrAfter` / `effectiveFromForCheckin` (misma regla, paridad probada) |
| Adopción | Solo con calibración ACTIVE v2, base cruda presente, objetivo = el de CAPA 1 actual, fuerza satisfecha (si aplica), cadena verificable. Si no: CAPA 1 exactamente como antes. | `resolveEffectiveNutritionEnergy` |
| Calibración ilegible | `UNAVAILABLE`: CAPA 1 provisional; el plan no se juzga (no hay regeneración falsa). | store + `weeklyPlanCurrentness(adaptiveUnavailable)` |
| `STRENGTH_REQUIRED` (Bloque 7) | MUSCLE_GAIN / RECOMPOSITION exigen `strength` DECLARADO; la clase MIXED, «no entreno» o un valor ilegible no bastan. Cliente: sin energía adaptativa. Servidor: START y check-in → 422 `STRENGTH_REQUIRED`. FAT_LOSS / MAINTENANCE no lo exigen. | `strengthRequirement` (compartida) |
| Trust boundary | El cliente nunca declara base, paso, kcal ni resultado; solo lo que la persona declara (lista blanca de la Edge). Las filas las escribe solo `service_role`. El cliente las LEE (RLS own-only) y deriva con el mismo motor compartido. | Edge `nutrition-checkin`, RPC `nutrition_server_*` |
| Snapshot V2 | Objeto DERIVADO en el store (no persistido): objetivo, peso nutricional, base de CAPA 1, energía efectiva (cruda y entera), procedencia de la calibración (id, versión, base congelada, paso decidido/efectivo, `effectiveFrom`, pendiente), estado de fuerza, motivo de no-adopción y versiones. | `NutritionSnapshotV2` |
| Proyección | Una sola (`projectNutritionEnergy`): `planGoal`, banda del banco y macros salen de la energía que manda en el MISMO `set()`; `energyState` sigue siendo CAPA 1; `tdee` = mantenimiento de CAPA 1. La hidratación lee la calibración ANTES de proyectar. Al volver a foco se re-proyecta (cruce al domingo). | store, `useAdaptiveEnergyRefresh` |
| Vigencia del plan | Contrato existente: STALE cuando `gen.kcal`/macros ≠ meta vigente → solo cuando el paso RIGE (el domingo), nunca antes. | `weeklyPlanCurrentness` |
| Peso | La energía adaptativa usa base congelada + paso: ni un pesaje suelto ni el peso del check-in la recalculan. | — |

### Legado Adaptive retirado en el Bloque 9

| Item | Motivo |
|---|---|
| `resolveCalibratedEnergy` / `CalibrationEnergyEvidence` (Bloque 5) | Adoptaba el paso DECIDIDO; sustituido por `resolveEffectiveNutritionEnergy`. |
| `getActiveCalibration` / `listRecentCheckins` / `getCheckinAtCycle` (MB4) | Sin consumidores; sustituidos por `loadAdaptiveCalibrationData`. |
| `weightTrend.ts` (mediana del peso) | Sin consumidores desde el Bloque 4. |

### Conservado

| Item | Clasificación | Motivo |
|---|---|---|
| `nutritionCheckinClient.callNutritionCheckin` | `KEEP` | Entrada del cliente a la Edge; no hay todavía UI de calibración/check-in. |
| `base_energy_kcal` (columna + mapeo) | `DEFER` | Retirarla exige migración. Sin autoridad. |
| Versiones v1 de MB1–MB3 en las filas | `KEEP_FOR_COMPATIBILITY` | Trazabilidad de cada check-in. |

### Versiones vigentes

`ENERGY_PRESCRIPTION_VERSION = 2` · `MACRO_PRESCRIPTION_VERSION = 4` · `PLAN_ENGINE_VERSION = 33` · `ENERGY_CALIBRATION_VERSION = 2` · `CALIBRATION_ENERGY_VERSION = 1` · `NUTRITION_SNAPSHOT_VERSION = 2` · `ADAPTIVE_DECISION_VERSION = 1`. Ningún bump en los Bloques 5–9.

### Pendientes de Adaptive

- QA visual del domingo 2026-10-18 (Bloques 6–8) con la cuenta QA CONTROLADA (historia backdated, autorizada).
- No existe UI para abrir una calibración ni para enviar check-ins: la integración funciona extremo a extremo, pero ningún socio real puede entrar al flujo todavía. `STRENGTH_REQUIRED` tampoco tiene copy visible.
- QA en producción del suelo T1 (requiere una ventana de check-in real).
- Merge del PR #1 / deploy del frontend a `main`; conciliación del ledger de migraciones de Supabase (se aplican por SQL Editor / `db query`).

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
   nutrition_calibrations + nutrition_adaptive_checkins (solo servidor) ─▶ adaptiveEnergyAuthority
              (paso efectivo por domingo · base congelada × (1+0,05·step) · Snapshot V2)
                                                              │
   store.recalcFromObData / hydrateEnergyFromSnapshot / refreshAdaptiveEnergy (projectNutritionEnergy, un solo set)
                                                              │
                  ┌───────────────────────────┬───────────────┴──────────────┐
            planGoal / tdee / mealPlanKey     macroTargets (macroPrescription)
                  └────────────┬──────────────┘
          planner · auto-regen (vigencia) · coach · onboarding · «Meta de hoy»
                               │
                     planEngine (reparto CAPA 4 legacy)
```
