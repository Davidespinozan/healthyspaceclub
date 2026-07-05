# Plan de integración — Nutrición HSC

Combina la especificación de Magaly (`LOGICA-NUTRICIONAL-HSC.md`) con la auditoría de
bugs/recomendaciones de Claude Code. Objetivo: dejar el sistema nutricional correcto,
seguro y completo, sin duplicar trabajo con lo que Magaly aún tiene pendiente.

Fecha: 2026-06-27.

---

## Cómo se cruzan las dos fuentes

| Recomendación Claude Code | Cubierta por spec de Magaly |
|---|---|
| #2 No hay meta de proteína | ✅ Punto 3.1 (proteína g/kg por objetivo + actividad) |
| #5/#7 Lógica de metas triplicada y frágil | ↔ Se unifica al hacer Punto 4 (déficit %) |
| #6 BMR solo binario | Parcial — Magaly mantiene Mifflin binario; agrega embarazo (Punto 2) |
| #8 Escalado se salta días en silencio | ↔ Se ataca al mover a base 5ª ed (Punto 5) |
| #14 Parser frágil / base hardcodeada | ✅ Punto 5 (leer `foods`/`food_measures` de Supabase) |
| #1 Restricciones alimentarias no funcionan | ❌ NO en el paquete — es territorio del "Plan del día"/banco que Magaly aún trabaja. **COORDINAR.** |
| #4 Bug EN en card de Hoy | ❌ NO en el paquete — mejora independiente nuestra |
| #9-12 Contenido escrito sin conectar | ❌ NO — Magaly hará su propio banco de platillos. **COORDINAR antes de invertir.** |
| #16-19 Código muerto | ❌ NO — limpiar al final (algo se toca en Punto 5) |

---

## Reparto de responsabilidades

**Magaly (fuera del código):**
- Subir `foods.csv` + `food_measures.csv` a Supabase y correr `schema_completo.sql`
  (define con David en qué proyecto). → Bloquea la Fase 4.
- Entregar el banco de platillos + "Plan del día" + tips (pendiente suyo). → Bloquea
  Track B (restricciones reales + contenido).

**David (enviar a Claude Code):**
- `PROTOTIPO-calculadora.html` (referencia de UX/mensajes) → necesario para Fase 2.
- `schema_completo.sql` → necesario para Fase 4.
- `food_measures.csv` (opcional, referencia de forma).

**Regla transversal (de Magaly):** en la app NUNCA mencionar la fuente de los datos
("SMAE"), solo la marca HSC. No inventar valores — todos están en la spec con su fuente.

---

## ⚠️ DÓNDE VIVE CADA COSA (no confundir — aclaración de David)

El prototipo de Magaly junta TODO en un formulario. En el SaaS real está separado en
tres lugares. **No mezclar.**

| Pieza | Vive en | Qué lleva |
|---|---|---|
| **Cálculo de meta** (sexo, edad, peso, estatura, actividad, objetivo + NUEVO: embarazo/lactancia, %grasa opcional, peso meta opcional) | **Onboarding de la app** — `src/screens/OnboardingScreen.tsx` (pasos 3-6) → `obData` → `calcTDEE` | Datos del cuerpo/objetivo. El motor (piso, déficit %, macros, validaciones) corre aquí. |
| **Preferencias de la semana** (cocinas, antojos, evitar) | **Flujo "hacer plan nutricional"** — `WeeklyNutritionPlanner.tsx` (QUESTIONS) | SOLO preferencias de comida. **NUNCA** preguntas de cálculo. Cuando mucho, *muestra* los macros ya calculados. |
| **Registro/calculadora de alimentos** (buscar alimento, armar platillo) | Pantalla propia (evoluciona `FoodLogSheet`/food-log) usando la base 5ª ed | Es la "Calculadora" del prototipo. Ni onboarding ni flujo de plan. |

**Regla:** las preguntas de cálculo (embarazo, %grasa, peso meta, actividad/Atleta) van
**solo en el onboarding**. El "Plan del día" del prototipo es un stub → es el banco que
Magaly aún arma.

---

## FASES (orden recomendado)

### ⚡ Quick win — Fase 0: Bug EN en card de Hoy  [indep., ~10 min]
`TabHoy.tsx` usa `mealPlans` sin traducir; debe usar `getMealPlans(locale)` como el
planner. Un usuario EN ve los platillos en español en su resumen del día. Sin
dependencias. (Recomendación #4.)

---

### Fase 1 — Motor de cálculo seguro  [código, NO depende de la DB]
Puntos Magaly 1, 4, 6 + recomendaciones #5/#7. Es la base de todo.

1. **Unificar la lógica de metas** hoy triplicada (`store/index.ts:435-439`,
   `store/index.ts:1132-1136`, `tdee.ts:33-35`) en un único módulo
   `computeNutritionTargets(obData)`. Elimina el riesgo de desincronización.
2. **Piso calórico de seguridad** (Punto 1):
   `planGoal = max( TDEE − ajuste, piso_sexo, BMR )` con `piso_sexo = 1200 mujer /
   1500 hombre`. Avisar cuando se topa (no en silencio).
3. **Déficit/superávit porcentual** (Punto 4): reemplazar `−500/+300` por
   `TDEE × 0.80` (déficit 20% default) y `TDEE × 1.12` (superávit +12%), protegido
   por el piso.
4. **Factor "Atleta" (1.9)** elegible en onboarding + descripciones de los 5 niveles
   (Punto 6) con la línea guía "Piensa en tu semana completa, no solo el gym."
5. Verificación: tests unitarios del motor (casos borde: mujer pequeña sedentaria →
   piso 1200; hombre grande → % correcto; atleta seleccionable).

*No toca la base de datos de alimentos — son cálculos sobre peso/objetivo del usuario.*

---

### Fase 2 — Restricciones de seguridad + onboarding  [necesita el PROTOTIPO]
Puntos Magaly 2, 8-12 + preguntas de onboarding.

1. **Onboarding — preguntas nuevas:**
   - Obligatoria: "¿Estás embarazada o en lactancia?" (bloquea déficit).
   - Opcionales (claramente saltables): % grasa corporal (→ Katch-McArdle en vez de
     Mifflin) y peso meta (progreso/motivación).
   - Aviso general único: "Si tienes alguna condición de salud, consulta a tu
     profesional…" (no preguntar condiciones una por una).
2. **Modo bienestar (sin déficit)** para: menor de 18, embarazo/lactancia, bajo peso
   + querer bajar (IMC < 18.5). Mensaje neutro y cálido (tono C de Magaly).
3. **Validaciones de datos imposibles** (Punto 9): rangos de peso/estatura/edad/%grasa.
4. **Validación de peso meta** (Punto 8): 3 niveles por IMC meta + % grasa manda sobre
   IMC. Meta por etapas si es lejana; bandera roja si cae bajo peso.
5. **Tiempo estimado realista** (Punto 12) al mostrar el plan.
6. Portar mensajes/umbrales exactos del prototipo v8/v10 (por eso necesito el HTML).

---

### Fase 3 — Capa de macros  [código]
Punto Magaly 3 completo. Es "territorio nuevo" (HSC hoy no prescribe macros).

1. **Proteína** g/kg según objetivo × actividad (tabla 3.1, techo 2.4 g/kg).
2. **Grasa** 20-35% de kcal, piso 0.5 g/kg (manda el piso si el 20% queda por debajo).
3. **Carbohidratos** rellenan lo restante, mínimo 130 g/día.
4. **Fibra** 14 g/1000 kcal (≥25 g/día) — se cumple vía banco de platillos.
5. **Reparto por comida** 25% desayuno / 35% comida / 25% cena / 15% snacks; proteína
   pareja en las principales.
6. **Mostrar macros como META** (no solo descriptivo). Persistir en `user_profiles`
   (columnas nuevas: prot/grasa/carbos/fibra objetivo).

---

### Fase 4 — Base de datos 5ª edición  [BLOQUEADA por carga de Magaly]
Punto Magaly 5 + recomendaciones #8/#14.

1. Aplicar `schema_completo.sql` (tablas `foods`, `food_measures`) — o migración
   equivalente en `supabase/migrations/`.
2. Magaly sube los 2,870 alimentos (5ª ed) a esas tablas.
3. Código: reemplazar `smeNutritionDB` (4ª ed hardcodeada en `smeCalc.ts`) por lectura
   desde Supabase. La calculadora y el parser usan la base nueva (macros+micros+fibra
   por porción, con conversión a 100 g).
4. Reduce la fragilidad del parser (#14) y elimina los "saltos silenciosos" (#8).

**⚠️ Decisión de integración (el esquema de Magaly se traslapa con HSC):**
`schema_completo.sql` crea `registro_diario`, `perfil_usuario` y `platillos` que se
pisan con lo que HSC ya tiene. Hay que decidir en esta fase:
- `registro_diario` vs `food_log` actual → ¿migrar, reemplazar o mapear? (una sola fuente de verdad).
- `perfil_usuario.meta_kcal/prot/hc/lip` vs las metas que calculamos en el onboarding
  (Fases 1/3) → deben ser LA MISMA meta, no dos.
- `platillos` (banco) vs el banco de platillos pendiente de Magaly → coordinar.
- Las tablas nuevas usan español (`registro_diario`, `perfil_usuario`); el resto de HSC
  usa inglés (`food_log`, `user_profiles`) → definir convención.

---

### Fase 5 — Recalibración con el tiempo  [después, necesita historial de peso]
Punto Magaly 7. Ya existe `weight_log`.

- Comparar peso real vs esperado en ventana de 2-3 semanas; ajustar ±100-200 kcal
  según tabla del Punto 7, respetando SIEMPRE el piso de seguridad.

---

## Track B — Mejoras independientes (COORDINAR con Magaly)

- **B1 Restricciones alimentarias reales** (#1): que "evitar gluten/lácteos/mariscos"
  filtre de verdad. Es parte del "Plan del día"/banco que Magaly aún arma → **no
  reconstruir hasta tener su banco**, o será trabajo tirado.
- **B2 Conectar contenido** (#9-12: recetas, salsas, swaps): Magaly hará su propio
  banco de platillos → confirmar si su banco reemplaza a `recipes.ts`/`salsas.ts`
  antes de invertir en conectarlos.
- **B3 Limpieza de código muerto** (#16-19): `aiFood.ts`, tabla `meal_recipes`,
  `mealEquiv.ts`. Hacer al FINAL (parte se toca en Fase 4).

---

## Secuencia sugerida
`Fase 0 (quick win)` → `Fase 1` → `Fase 2` → `Fase 3` → `Fase 4 (cuando Magaly suba la base)`
→ coordinar Track B con el banco de Magaly → `Fase 5` (cuando haya historial de peso).

Fases 1-3 son código puro que podemos avanzar YA sin esperar a nadie.
