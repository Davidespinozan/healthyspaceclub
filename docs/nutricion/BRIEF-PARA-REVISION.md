# Nutrición HSC — Brief para revisión externa

Documento autocontenido para pedir una segunda opinión. Incluye contexto, la visión de
producto, las decisiones tomadas, el plan por fases y —importante— las **decisiones que
siguen abiertas**. Al final hay preguntas concretas para el revisor.

---

## 1. Contexto: qué es HSC y cómo está la nutrición hoy

**Healthy Space Club (HSC)** es una app de fitness (entrenamiento + nutrición + comunidad)
con IA, **bilingüe ES/EN**, dirigida a **LATAM, España y US**, por suscripción. React + Vite
+ Zustand + Supabase (Postgres + Edge Functions). La IA corre server-side (Claude Haiku).

**Cómo funciona la nutrición HOY (auditado):**
- En el **onboarding** se calcula la meta calórica: BMR **Mifflin-St Jeor** × factor de
  actividad, y ajuste de objetivo con offset **FIJO** (`−500` bajar / `+300` subir), **sin
  piso de seguridad**, **sin macros**, **sin protección** para menores ni embarazo.
- El plan de comidas es un **banco estático hand-authored** (`src/data/mealPlan.ts`):
  4 planes por nivel calórico × 28 días × 5 comidas. Las porciones son **texto libre**
  ("1 ½ tz arroz"). Las calorías/macros **no están guardadas**: las **adivina** un parser
  de ~374 líneas de regex → puede fallar en silencio (0 kcal).
- La IA solo **elige 7 días** del banco por índice; y **estima** las calorías de un texto
  cuando el usuario registra "comí otra cosa". La IA **no** genera comidas.
- Registro de comida: tabla `food_log` (manual/estimado por IA), `meal_progress` (checks),
  `weekly_plan` (jsonb). Historial de peso: `weight_log`.

**Problemas de fondo detectados:** el motor de cálculo es inseguro (sin pisos, sin macros,
sin protección de menores/embarazo); el banco de porciones-en-texto es frágil; y hay lógica
de metas **triplicada** en 3 archivos que puede desincronizarse.

---

## 2. Lo que aportó la nutrióloga (Magaly)

Un paquete con: (a) **`LOGICA-NUTRICIONAL-HSC.md`** — spec basada en evidencia (7 puntos con
fuente: pisos de seguridad, déficit/superávit porcentual, capa de macros, protección de
menores/embarazo, factor Atleta, recalibración); (b) **`PROTOTIPO-calculadora.html`** —
prototipo funcional de la UX; (c) **`foods.csv`** (2,870 alimentos, SMAE 5ª ed, macros+micros+
fibra por porción); (d) **`food_measures.csv`** (medida casera + gramos); (e)
**`schema_completo.sql`** (tablas `foods`, `food_measures`, `platillos`,
`platillo_ingredientes`, `registro_diario`, `perfil_usuario`).

Aún pendiente de ella: el **banco de platillos curado** y el **"Plan del día"** (quiere
agregar ~25 platillos nuevos y quitar algunos).

**Reglas de ella:** no inventar valores (todo con fuente); en la UI **NUNCA** mencionar la
fuente de los datos ("SMAE"), solo la marca HSC.

---

## 3. La visión de producto (el norte) — decidido con el fundador

**Cada día el usuario elige entre DOS modos, contra la MISMA meta diaria:**

- **A) Seguir el plan** — platillos curados por la nutrióloga, escalados a su meta.
- **B) Calcular lo suyo** — registra lo que realmente comió, **estilo MyFitnessPal** (busca
  el alimento y lo agrega), pero con **UX muy superior** y **memoria** que lo conoce.

**Por qué DOS modos:** casi nadie sigue un plan rígido día con día; la gente improvisa con
lo que tiene. Un buen SaaS debe servir para uso real (los fundadores tampoco seguirían un
plan rígido). El modo B es el que hace que la app se use **a diario**.

**Decisiones duras de la visión:**
- **NADA de IA armando el plato.** El registro es manual (el usuario busca lo que comió).
  *(Esto se recalca porque una propuesta previa de "IA arma el plato" fue rechazada.)*
- **Un solo sistema**, no dos: una sola **meta diaria** (del onboarding), una sola **base de
  alimentos**, un solo **registro del día**; los dos modos solo son **dos formas de llenarlo**.
- **Mezcla por comida**: se puede seguir el plan en el desayuno e improvisar en la comida;
  ambos cuentan al mismo anillo del día. No se bloquea el día entero en un modo.

**Cómo el modo B (MFP) NO se vuelve tedioso — vía MEMORIA (no IA):**
1. **Recientes** — lo último registrado, sin buscar.
2. **Frecuentes** — lo que más comes, primero.
3. **Mis platillos** — combos que armaste y guardaste, reusables en un clic.
4. **Sugerencias por comida** — aprende qué sueles comer en cada tiempo.
5. **"Igual que ayer"** — copiar un día o comida ya registrada.
6. **Búsqueda que te prioriza** — primero tus alimentos, luego el catálogo.
7. **Medidas caseras + stepper** — "1 taza", con +/−, sin teclear gramos.

Meta de UX: día 1 buscas; del día 5 en adelante casi todo sale de recientes/frecuentes/mis
platillos y registrar toma ~10 segundos.

---

## 4. Decisiones de arquitectura ya tomadas

- **Las preguntas de cálculo van SOLO en el onboarding** (sexo, edad, peso, estatura,
  actividad, objetivo + NUEVAS: embarazo/lactancia, %grasa opc, peso meta opc). El flujo de
  "hacer plan" se queda con preferencias de comida; la calculadora es pantalla aparte.
- **El banco de platillos debe ser ESTRUCTURADO** (no texto libre): cada platillo = lista de
  **ingredientes** (cada uno = `food_id` de la base + cantidad). Los macros = **suma** de los
  ingredientes desde la base de alimentos. Así, cuando la nutrióloga **saca/mete un platillo,
  nada se rompe y todo recalcula perfecto** (requisito explícito del fundador). Se descarta el
  modelo actual de "porción en texto + parser".
- **Los 25 platillos nuevos se autoran en formato estructurado** (plantilla que Magaly llena
  → import), no en el banco viejo de texto.
- **En la UI nunca se menciona la fuente de datos.**

---

## 5. El plan por fases

**Fases 0-3 = motor de cálculo. Código puro, no dependen de nadie, se pueden hacer YA.**

### Fase 0 — Bug: card de "Hoy" en español para usuarios EN (~10 min)
`TabHoy.tsx` usa el banco sin traducir; debe usar `getMealPlans(locale)`.

### Fase 1 — Motor de cálculo seguro
1. **Unificar** la lógica de metas hoy triplicada en un módulo único.
2. **Piso de seguridad:** `planGoal = max(TDEE − ajuste, piso_sexo, BMR)`, piso 1200 mujer /
   1500 hombre; avisar (no en silencio) cuando se topa.
3. **Déficit/superávit porcentual:** `−500/+300` → `TDEE×0.80` (déficit 20%),
   recomp `×0.90`, superávit `×1.12`, protegido por el piso.
4. **Factor "Atleta" (1.9)** elegible + descripciones de los 5 niveles.
5. Tests de casos borde. (Las fórmulas exactas ya están en `calcPlan()` del prototipo.)

### Fase 2 — Restricciones de seguridad + onboarding
1. Preguntas nuevas: **embarazo/lactancia** (obligatoria), **%grasa** (→ Katch-McArdle) y
   **peso meta** (opcionales, saltables), + aviso general de salud.
2. **Modo bienestar (sin déficit)** para menor de 18, embarazo/lactancia, y bajo peso (IMC<18.5)
   que quiere bajar. Mensaje neutro y cálido.
3. Validaciones de datos imposibles (rangos).
4. Validación de peso meta (3 niveles por IMC; el %grasa manda sobre el IMC) + tiempo estimado.
5. Portar los mensajes/umbrales exactos del prototipo.

### Fase 3 — Capa de macros
Proteína (g/kg por objetivo×actividad, techo 2.4), grasa (20-35%, piso 0.6 g/kg), carbos
(rellenan, mín 130 g), fibra (14 g/1000 kcal). Reparto por comida 25/35/25/15. Mostrar como
**meta** y persistir. **Una sola meta** (no duplicar con `perfil_usuario`).

### Fase 4 — Base de datos 5ª ed + calculadora + banco estructurado [BLOQUEADA]
Bloqueada por: Magaly sube CSVs a Supabase + decisión de integración. Incluye: aplicar el
esquema, cargar 2,870 alimentos, reemplazar la base 4ª ed hardcodeada, construir la
calculadora (modo B) y **reconstruir el banco de platillos estructurado** (modo A).

### Fase 5 — Recalibración con el tiempo
Comparar peso real vs esperado (ventana 2-3 semanas), ajustar ±100-200 kcal respetando el
piso. Usa `weight_log` existente.

**Secuencia:** 0 → 1 → 2 → 3 (ya) → 4 (cuando Magaly suba la base y se decida la integración)
→ 5 (cuando haya historial de peso).

---

## 6. Decisiones — RESUELTAS por David (2026-07-05)

**Contexto que lo simplifica todo: los usuarios actuales son de PRUEBA, aún no se lanza.**
Se aprovecha para hacer los cambios de fondo limpios, sin migración cuidadosa.

1. **Migración de usuarios:** NO aplica. Recalcular metas directamente, sin avisos. ✅
2. **Transición del banco:** reemplazar el banco viejo (texto) directo por el estructurado.
   Sin correr ambos en paralelo, sin conversión cuidadosa. ✅
3. **Features atadas al banco:** se rehacen sobre el banco estructurado (no bloquean). ✅
4. **¿4 planes o 1?** → **Colapsar a 1** que escala por usuario, cuidando **mínimos de porción
   realistas** (redondear a unidades sensatas: medio huevo sí, un tercio no). El banco debe
   tener variedad suficiente para que el escalado no fuerce porciones absurdas. ✅
5. **Localización:** la base mexicana está **perfecta para el lanzamiento en México**. Para
   España/US es un **bloqueador conocido** — NO resolver ahora, dejar marcado. Mitigación
   principal futura: **escáner de tabla nutricional** (ver Fase nueva abajo). ✅ (marcado)
6. **Una sola fuente de verdad:** NO correr dos sistemas. Elegir **una sola tabla de registro**
   y **una sola fuente de meta**, extendiendo las existentes; deprecar la otra. ✅
7. **Micronutrientes:** por ahora **solo kcal + 4 macros + fibra**. Los micros quedan guardados
   en la base para el futuro, sin usarse en la UI. ✅
8. **Calidad de datos:** limpiar los CSV **antes** de cargarlos como fuente de verdad. ✅
9. **BMR binario:** dejarlo binario por ahora; "prefiero no decir" → fórmula de mujer
   (fallback conservador). ✅ (ya implementado así en Fase 1)

---

## 6b. Dos features nuevas a agregar al plan

- **Escáner de tabla nutricional con IA (futuro):** el usuario toma **foto de la tabla
  nutricional** de un producto empaquetado; la IA la **lee** y calcula los macros según los
  gramos consumidos. Es la **mitigación principal de localización** (cubre productos que no
  están en la base mexicana). **Considerar el costo por uso** (visión = tokens caros).
  Detalle en el `PENDIENTES.md` de David. → Parte del modo B (calculadora), post-lanzamiento.
- **Disclaimer legal:** aviso visible de que **la app no sustituye consulta médica ni
  nutricional profesional.** Va junto con el aviso de salud del onboarding y/o en ajustes.

---

## 7. Preguntas para el revisor (Claude)

1. ¿El **orden** (motor primero, banco/calculadora después) es el correcto, o hay algo del
   motor que dependa de decisiones del banco que debamos resolver antes?
2. ¿La arquitectura de **"un sistema, dos modos, un registro"** es sólida, o hay una forma más
   limpia de evitar la duplicación `food_log`/`registro_diario` y `perfil`/meta-onboarding?
3. Sobre el **banco estructurado**: ¿colapsar los 4 planes en 1 que escala es buena idea, o hay
   riesgo (ej. platillos que no escalan bien, mínimos de porción)?
4. **Localización**: ¿la base mexicana + "crea tu alimento" es viable para España/US, o es un
   bloqueador que hay que resolver antes de invertir en el modo MFP?
5. **Migración de usuarios existentes** (metas que cambian): ¿mejor práctica?
6. ¿Qué riesgo o decisión abierta **NO** está en la sección 6 y debería estar?
