# LÓGICA NUTRICIONAL — Calculadora HSC
## Documento de decisiones (basado en evidencia)

Este documento define la lógica del sistema de cálculo nutricional, auditada contra
la ciencia actual y las guías vigentes (2020-2025). Es la especificación para
implementar/corregir en el código de HSC.

Cada decisión trae su fundamento y su fuente.

---

## CÓMO SE IMPLEMENTA ESTO (léelo primero)

Este documento es una ESPECIFICACIÓN para corregir el sistema nutricional de HSC.
Los cambios se dividen en dos responsabilidades:

### Lo que hace la persona (Magaly), NO Claude Code:
1. **Cargar la base de datos a Supabase.** Ya existe la base SMAE 5ª edición lista:
   - `foods.csv` — 2,870 alimentos (macros + micros + fibra por porción)
   - `food_measures.csv` — la medida casera de cada alimento
   - `schema_completo.sql` — crea las tablas en Supabase
   Magaly corre el SQL en Supabase y sube los dos CSV a las tablas `foods` y
   `food_measures`. (El proyecto de Supabase se define con David.)

### Lo que hace Claude Code (en el código):
2. **Reemplazar la base vieja por la nueva.** HSC hoy usa `smeNutritionDB` del
   Sistema Mexicano de Equivalentes **4ª edición** (en `src/utils/smeCalc.ts`).
   Cambiar a leer los alimentos desde la tabla `foods` de Supabase (5ª edición,
   2,870 alimentos). NO seguir usando la base 4ª edición hardcodeada.
3. **Corregir el cálculo** (`src/utils/tdee.ts`, `src/store/index.ts`) según los
   puntos de este documento: piso de seguridad, déficit porcentual, capa de macros,
   restricciones de menores/embarazo, factor "Atleta", descripciones de actividad.
4. **Agregar las preguntas** del onboarding que faltan (embarazo/lactancia; opcional
   % grasa y meta) — ver sección "PREGUNTAS DEL ONBOARDING".

### Regla importante para Claude Code:
- NO inventar valores nutricionales ni fórmulas. Todo está especificado aquí con su
  fuente. Si algo no está claro, preguntar antes de asumir.
- En la interfaz NUNCA mencionar "SMAE" ni la fuente de los datos. Solo la marca HSC.
- Los valores nutricionales se muestran, pero el usuario nunca ve de dónde vienen.

---

## PUNTO 8 — VALIDACIÓN DEL PESO META ✅ DEFINIDO

### El problema
Si el usuario pone un peso meta muy alejado o hacia bajo peso, la app no debe
alentar metas peligrosas ni poco realistas (que frustran y hacen abandonar).

### La regla (3 niveles, usando IMC del peso meta)
IMC meta = peso_meta / (estatura_m)². Cambio% = |meta − actual| / actual × 100.

| Situación | Qué hace la app |
|---|---|
| Meta en IMC saludable (18.5–24.9) y cercana | Adelante, sin aviso |
| Meta saludable pero lejana (>10% de cambio, bajando) | La acepta pero sugiere META POR ETAPAS: primer objetivo bajar 5-8% (~0.92×peso). Al lograrlo, siguiente etapa. |
| Meta hacia bajo peso (IMC meta < 18.5) | BANDERA ROJA: avisa que queda bajo un peso saludable; sugiere meta más segura o consultar profesional. |

### Enfoque
Advertir fuerte pero (para adultos) no bloquear del todo — respeta autonomía + da
la información de seguridad. Para bajo peso, el aviso es fuerte.

### Fundamento y fuentes
- IMC saludable 18.5–24.9: **Cleveland Clinic (2026), NIH, OMS**.
- Primera meta 5–10% del peso en ~6 meses: **guía clínica AHA/ACC/TOS**; **NIH
  (NHLBI)**; **NICE**. Incluso 3-5% ya da beneficios (triglicéridos, glucosa).
- Ponerse metas mejora la pérdida de peso vs. no ponerse (estudio de 35,380
  personas, 2016) — dividir en etapas motiva, no desmotiva.

**Nota:** en el prototipo v8 esto ya está implementado y probado.

---

### Matiz CRÍTICO — el IMC no distingue músculo de grasa
El IMC solo usa peso y estatura. Una persona muy musculosa puede salir "sobrepeso/
obeso" en IMC cuando en realidad tiene poca grasa. Por eso el % de grasa (si el
usuario lo dio) SIEMPRE le gana al IMC cuando hay conflicto.

**Umbrales de % grasa (ACE — American Council on Exercise):**
| Categoría | Hombres | Mujeres |
|---|---|---|
| Atleta | 6–13% | 14–20% |
| Fitness | 14–17% | 21–24% |
| Aceptable | 18–24% | 25–31% |
| Obeso | 25%+ | 32%+ |

**Reglas cuando el usuario quiere SUBIR y el IMC meta sale alto (≥25):**
- IMC alto + % grasa BAJO (hombre <18%, mujer <25%) → es MÚSCULO. No alarma; la app
  reconoce buena composición y lo deja ganar músculo.
- IMC alto + SIN dato de % grasa → aviso NEUTRO ("el IMC no distingue músculo de
  grasa; si entrenas fuerte, ignóralo"). No alarma.
- IMC alto + % grasa ALTO (hombre 25%+, mujer 32%+) → aviso de subir gradual (ganar
  músculo, no grasa).

**Principio:** el % de grasa manda sobre el IMC. El IMC es un atajo cuando no hay más
datos; el % de grasa es la verdad cuando existe.

**Fuentes del % grasa:** ACE (American Council on Exercise); confirmado Healthline
(2025), InBody (2025), BodySpec (2026), FatScan (2026). Todas coinciden en que el
IMC misclasifica a personas musculosas y que el % grasa lo corrige.

---

## PUNTOS 9-12 — VALIDACIONES DE SEGURIDAD ADICIONALES ✅ DEFINIDO

### PUNTO 9 — Datos imposibles (validación de entrada)
No dejar continuar con valores fuera de rango:
- Peso: 30–300 kg · Estatura: 120–220 cm · Edad: 15–100 años
- % grasa: hombre 3–50%, mujer 8–55% · Peso meta: 30–300 kg
Mensaje suave ("Revisa este dato") sin avanzar. (En prototipo v10.)

### PUNTO 10 — Bajo peso + querer bajar (bandera roja)
Si IMC actual < 18.5 Y objetivo es bajar grasa/recomposición → NO déficit. Se pone
en modo bienestar (igual que menores/embarazo). Protege contra adelgazamiento de
alguien que ya está en o bajo peso saludable.

### PUNTO 11 — Salud mental / relación con la comida
Cuando se detecta riesgo (bajo peso + querer bajar; metas muy bajo lo saludable),
la app NO da plan de déficit y muestra un mensaje NEUTRO y cálido (tono elegido = C):
> "Ajustamos tu plan a modo bienestar. Para objetivos más específicos, un
> especialista puede ayudarte mejor."
- Principio: proteger sin que se note ni se señale a la persona. Suena a ajuste
  normal, no a "detectamos que tienes un problema".
- NO usar mensajes que insinúen un problema (se sienten pasivo-agresivos).
- Recursos de ayuda (línea de apoyo TCA del país): disponibles pero DISCRETOS (ej.
  enlace pequeño en ajustes), nunca como alarma en la cara.

### PUNTO 12 — Tiempo estimado realista
Al mostrar el plan, si el objetivo es bajar y hay peso meta, mostrar el tiempo
estimado a ritmo seguro (0.5–1% del peso/semana):
> "A un ritmo saludable, llegar a tu meta toma aprox. X-Y meses. Lo sano toma tiempo."
- Es honesto, motiva (ve el camino) y previene que busque dietas extremas.
- Fuente del ritmo 0.5-1%/sem: consenso clínico (mismas fuentes del Punto 4/8).

**Nota:** puntos 9-12 ya implementados y probados en el prototipo v10.

---

## PUNTO 1 — PISO CALÓRICO DE SEGURIDAD ✅ DEFINIDO

### El problema detectado (auditoría)
HSC calcula `planGoal = TDEE − 500` (para bajar grasa) **sin ningún piso**. Una
mujer pequeña y sedentaria podía recibir una meta por debajo de 1200 kcal sin que
el código lo impidiera ni lo advirtiera. Riesgo de seguridad real.

### La regla definida
La meta calórica NUNCA baja del **mayor** de estos tres valores:

1. **Piso absoluto por sexo:** 1200 kcal (mujer) / 1500 kcal (hombre)
2. **Piso metabólico personal:** el BMR de la persona (nunca por debajo de su
   metabolismo basal)
3. El resultado del cálculo normal (TDEE ± ajuste)

En fórmula:
```
planGoal = max( (TDEE − ajuste),  piso_sexo,  BMR )
donde piso_sexo = 1200 si mujer, 1500 si hombre
```

### Aviso transparente
Cuando el sistema tope la meta (porque el cálculo pedía menos), debe AVISAR al
usuario, no toparlo en silencio. Ejemplo de mensaje:
> "Ajustamos tu meta a {X} kcal — bajar más no es seguro sin acompañamiento
> profesional."

### Fundamento (fuentes 2024-2025)
- **Harvard Health (2024):** la ingesta no debe caer por debajo de 1200 (mujer) /
  1500 (hombre) salvo supervisión profesional; comer menos pone en riesgo la salud
  por falta de nutrientes.
- **Hackensack Meridian / Dietary Guidelines 2020-2025:** nunca menos de 1200
  (mujer) / 1500 (hombre) sin guía personalizada de médico o dietista.
- **Forbes Health (2026, revisado por médico + dietista + ACE):** su calculadora
  no muestra menos de 1200 kcal sin importar el peso; por debajo es muy difícil
  cubrir macro y micronutrientes.
- El piso metabólico (BMR) añade protección para personas con BMR alto: comer bajo
  el BMR dispara enlentecimiento metabólico, hambre y pérdida de músculo.

### Nota profesional
Incluso 1200 kcal no es apropiado para todos a largo plazo (solo mujeres muy
pequeñas, sedentarias, corto plazo). El piso metabólico (BMR) hace que el mínimo
se adapte a cada cuerpo, en vez de un número genérico.

---

## PUNTO 2 — ACCESO CON RESTRICCIONES DE SEGURIDAD ✅ DEFINIDO

### Principio
Nadie se bloquea de la app. Todos pueden acceder y usarla. Pero según su caso, se
aplican **restricciones de seguridad** — la app protege, no excluye.

### El problema detectado (auditoría)
HSC no valida edad ni condiciones. Un menor de edad podía recibir una meta de
déficit calórico automática. No hay protección para embarazo ni casos especiales.

### La regla definida (3 niveles de restricción)

| Caso | Acceso | Restricción |
|---|---|---|
| **Menor de 18** | Sí | NO déficit. Modo bienestar/mantenimiento (comer sano, sin restricción). Sugiere profesional para composición corporal. |
| **Embarazo / lactancia** | Sí | NO déficit (no bajar de peso). Puede registrar/comer sano. Aviso de acompañamiento profesional. |
| **Adulto mayor (65+)** | Sí | Sin bloqueo. Solo aviso (cuidar masa muscular). |
| **Condiciones** (diabetes, renal, TCA, etc.) | Sí | Sin bloqueo. Aviso general de consultar profesional. |

### Qué datos preguntar en el onboarding
- **Edad:** ya la pregunta HSC (sirve para detectar menores)
- **Sexo:** ya la pregunta HSC
- **AGREGAR:** "¿Estás embarazada o en lactancia?" (para bloquear déficit)
- **NO preguntar** condiciones médicas una por una (invasivo y alarga el onboarding).
  En su lugar, un **aviso general para todos:** "Si tienes alguna condición de
  salud, consulta a tu profesional antes de seguir un plan."

### Fundamento
- **Menores < 18:** siguen en crecimiento y desarrollo (óseo, hormonal, muscular);
  es la edad de mayor riesgo de trastornos de conducta alimentaria (TCA). Una
  herramienta de déficit calórico automático sin supervisión es un riesgo real.
- **Embarazo/lactancia:** requerimientos especiales; el déficit está contraindicado.
- El límite es 18 (no 15) por el riesgo de TCA en adolescencia y porque el costo de
  ser conservador es bajo (el menor igual usa la app en modo bienestar).

---

## PUNTO 3 — CAPA DE MACROS (en construcción)

### El problema detectado (auditoría)
HSC **no prescribe macros**. Solo calcula calorías. No hay objetivo de proteína,
ni reparto, ni mínimos. Los macros solo se muestran (descriptivos), no se fijan.
Esta capa es territorio nuevo — la aportamos nosotras.

### Orden de cálculo (principio): proteína primero, luego grasa, luego carbos rellenan.

---

### 3.1 — PROTEÍNA ✅ DEFINIDO

**g/kg de peso según objetivo + actividad:**

| Objetivo | Sedentario/ligero | Moderado | Alto/fuerza |
|---|---|---|---|
| Bajar grasa (déficit) | 2.0 | 2.2 | 2.4 |
| Mantener / bienestar | 1.6 | 1.8 | 2.0 |
| Recomposición | 1.8 | 2.0 | 2.2 |
| Ganar músculo | 1.8 | 2.0 | 2.2 |

> **Nota:** valores ajustados al alza (vs. base ISSN mínima) porque el público de HSC
> es fitness/wellness activo, no población sedentaria general. Todo dentro del rango
> seguro ISSN/ACSM; techo 2.4 g/kg. Decisión de criterio de la nutrióloga (Magaly).

- **Techo de seguridad:** 2.4 g/kg (no pasar; >3.0 es solo atletas en casos
  específicos, no el usuario promedio).
- **Distribución:** repartir pareja, ~0.25 g/kg o 20–40 g por comida (cada comida
  del plan lleva su dosis de proteína, no concentrarla).
- **Nota (refinamiento futuro):** en IMC muy alto, usar peso ajustado o masa magra
  en vez de peso total. Por ahora, peso total para la mayoría.

**Fundamento (ISSN Position Stand + ACSM, 2017-2025):**
- 1.4–2.0 g/kg basta para construir/mantener músculo en la mayoría de personas activas.
- En déficit sube a 2.3–3.1 g/kg para proteger masa magra (por eso "bajar grasa"
  tiene los valores más altos).
- Dosis repartidas cada 3-4 h optimizan la síntesis proteica.

---

### 3.2 — GRASA ✅ DEFINIDO

- **Rango:** 20–35% de las calorías del día (parte baja ~20-25% en déficit, media
  en mantener/ganar).
- **Piso de seguridad:** nunca menos de 0.5 g/kg (ideal 0.6–0.8). Protege ácidos
  grasos esenciales y función hormonal. Si el 20% de calorías queda por debajo del
  piso de g/kg (persona pequeña), manda el piso.
- **Calidad:** priorizar insaturadas (aguacate, nueces, aceite de oliva, pescado).
  Saturadas < 10% de calorías. Cero grasas trans.

**Fundamento y fuentes:**
- Rango 20–35%: **Dietary Guidelines for Americans 2020–2025** (AMDR oficial).
  Confirmado en fuentes 2024-2026 (Nourish 2024, WeightWatchers 2026).
- Piso 0.5–1 g/kg: **NASM** (curso CNC) y Macros Inc (2025) citando paper de
  natural bodybuilding contest prep (evidence-based).
- Saturadas <10%: Dietary Guidelines 2020-2025 (AHA aún más estricta, <7%).
- Nordic Nutrition Recommendations 2023 confirman rangos y calidad de grasa.
- Nota: el AMDR 20-35% no ha cambiado en años porque sigue vigente y respaldado
  (estable, no desactualizado).

---

### 3.3 — CARBOHIDRATOS ✅ DEFINIDO

- **Cómo se calculan:** RELLENAN las calorías que quedan tras fijar proteína y
  grasa. No se fijan primero.
- **Rango de referencia:** 45–65% de calorías (AMDR). En esta app, como la proteína
  va alta, es normal y correcto que caigan en la parte baja (~40-50%).
- **Piso de seguridad:** nunca menos de **130 g/día** (mínimo de glucosa para el
  cerebro; RDA oficial). Debajo de eso hay riesgo de cetosis.
- **Calidad:** principalmente granos enteros, verduras, frutas y leguminosas.
  Meta de ~400 g/día de verduras + frutas.

**Fuentes:**
- Rango 45–65% y RDA 130 g/día: **Dietary Guidelines for Americans 2020–2025**;
  DRI del National Academies. Confirmado Mayo Clinic (enero 2025), Medical News
  Today (agosto 2025).
- Calidad + 400 g verduras/frutas: **WHO Guideline on Carbohydrate Intake 2023**
  (recomendación fuerte).
- Los carbos rellenan tras grasa y proteína: WHO 2023.

---

### 3.4 — FIBRA ✅ DEFINIDO (HSC no lo tiene — lo aportamos)

- **Mínimo:** 14 g por cada 1,000 kcal (Adequate Intake oficial). En absoluto,
  **al menos 25 g/día** (WHO 2023). Referencia: ~25-28 g mujer, ~35-38 g hombre.
- **Azúcar añadida:** < 10% de las calorías.
- Se logra con el BANCO de platillos (whole foods: verduras, leguminosas, granos
  enteros), no con un número — el banco de calidad lo cumple solo.

**Fuentes:**
- 14 g/1000 kcal: Adequate Intake, **National Academies / Dietary Guidelines
  2020-2025**.
- ≥25 g/día: **WHO Guideline on Carbohydrate Intake 2023** (recomendación fuerte).
- Fibra como "nutriente de preocupación pública por subconsumo": **Scientific
  Report of the 2025 Dietary Guidelines Advisory Committee (diciembre 2024)**.
- Azúcar añadida <10%: Dietary Guidelines 2020-2025.

---

### 3.5 — REPARTO DE MACROS ENTRE COMIDAS ✅ DEFINIDO

**Reparto de calorías por comida:** 25% desayuno / 35% comida / 25% cena / 15% snacks.

**Reparto de macros dentro de las comidas:**
- **Proteína:** repartida PAREJA en las comidas principales (desayuno, comida, cena
  llevan cada una ~25-40 g). No concentrarla en una sola comida. Snacks pueden
  llevar algo, menos.
- **Carbohidratos:** siguen el reparto calórico (más en la comida, que es la más
  grande). Se pueden cargar alrededor de la actividad física si la persona entrena.
- **Grasa:** distribuida, más flexible.
- **Verduras:** presentes en comida y cena SIEMPRE (base del plato).

**Regla simple para el banco de platillos:** cada comida principal lleva una fuente
de proteína + verduras; los carbos de calidad se acomodan según el tamaño de la comida.

**Fundamento:**
- Proteína repartida cada 3-4 h (~0.25 g/kg o 20-40 g por toma): **ISSN Position
  Stand: protein and exercise** — optimiza síntesis proteica.
- Reparto calórico con foco temprano: evidencia de mayor pérdida de peso y mejor
  perfil metabólico al consumir más temprano (metaanálisis citados por ISSN
  nutrient timing), balanceado con adherencia realista (cena 25%, no 20%).

---

## ✅ PUNTO 3 COMPLETO — Capa de macros definida (proteína, grasa, carbos, fibra, reparto)

---

## PENDIENTES (siguientes puntos a definir)
- PUNTO 5 — Actualizar base de datos a 5ª edición (2,870 alimentos)
- PUNTO 6 — Fix del factor "Atleta" (1.9) inalcanzable en onboarding

---

## PUNTO 4 — DÉFICIT / SUPERÁVIT PORCENTUAL ✅ DEFINIDO

### El problema detectado (auditoría)
HSC usa offset FIJO: −500 (bajar), +300 (subir). Un −500 fijo es peligroso para
personas pequeñas y flojo para grandes. Ej: quien quema 2800 kcal, −500 deja 2300
(bien); quien quema 1600, −500 deja 1100 (clínicamente muy bajo, riesgo).

### DÉFICIT (bajar grasa) — porcentaje del TDEE
| Intensidad | Déficit | Para quién |
|---|---|---|
| Suave | 10–15% | Cerca de meta / máxima sostenibilidad |
| **Estándar (default)** | **20%** | La mayoría — sweet spot con evidencia |
| Agresivo | 25% | Más grasa que perder |

- Nunca pasar de 25% sin supervisión. Déficits >1000 kcal no recomendados sin médico.

### SUPERÁVIT (ganar músculo) — porcentaje del TDEE, según experiencia
| Nivel | Superávit |
|---|---|
| Principiante (<1 año) | 10–15% |
| Intermedio/avanzado | 5–10% |
| **Default HSC (wellness)** | **+10-12%** |

- Meta de ganancia: 0.25–0.5% del peso/semana (novato/intermedio); más lento avanzado.
- Pasado ~20% de superávit, el músculo se estanca y la grasa se acelera.
- **Mujeres:** 10-15% (almacenan grasa más fácil por estrógeno). Nota tranquilizadora:
  es muy difícil "ponerse musculosa"; con superávit moderado + entrenar 3-4×/sem se
  ganan 2-4 kg músculo/año = cuerpo tonificado, no "fisicoculturista".

### Cómo se combina con el piso (Punto 1)
El porcentaje calcula el objetivo; el piso SIEMPRE lo protege:
```
planGoal = max( TDEE × (1 − 0.20),  piso_sexo,  BMR )   // déficit
planGoal = TDEE × (1 + 0.12)                              // superávit
```
Reemplaza el `TDEE − 500` de HSC por `TDEE × 0.80`, protegido por el piso.

### Recalibración (nota profesional)
Todos son estimados iniciales. Recalcular cada 4 semanas según progreso real. Si en
2-3 semanas no hay cambio, ajustar.

**Fuentes:**
- Déficit 20% sweet spot, nunca bajo BMR/1200/1500: Green Relief Health (2026),
  TrainCalc (2026), Built With Science, Nutrimaster (2026).
- Superávit 10-20% + 0.25-0.5%/sem: **Nutrition Recommendations for Bodybuilders in
  the Off-Season, narrative review (Iraki, Fitschen, Espinar & Helms, 2019)**.
  Confirmado Micron/BodySpec (2026).
- Ajuste por experiencia y nota de mujeres: Micron (2026), review 2019.

---

## PUNTO 7 — RECALIBRACIÓN (ajuste con el tiempo) ✅ DEFINIDO

### Por qué (lo más importante del sistema)
Todo cálculo inicial es un ESTIMADO, no una certeza. Ninguna fórmula acierta perfecto
para cada cuerpo. Lo que hace que un plan funcione no es el número inicial perfecto,
sino AJUSTAR según lo que pasa en la vida real (como un GPS que recalcula con el
tráfico). Un buen nutriólogo no da un número y abandona; ajusta según la respuesta.

### Cómo funciona
- **Dato que necesita:** peso del usuario, registrado ~1×/semana.
- **Compara:** lo esperado (predicción del plan) vs. lo real (peso registrado).
- **Ventana:** evalúa la TENDENCIA de 2-3 semanas, NO un solo día (el peso diario
  varía por agua/sal/hormonas; un día es ruido, 3 semanas es señal).

### Reglas de ajuste
| Observación (en 2-3 semanas) | Acción |
|---|---|
| Baja al ritmo esperado (~0.5% peso/sem) | Nada, va bien |
| No baja / subió (objetivo bajar grasa) | Recalibra: −150-200 kcal |
| Baja demasiado rápido (>1% peso/sem) | Recalibra: +100-150 kcal (déficit muy agresivo) |
| Ganar músculo: no sube | +100-150 kcal |
| Ganar músculo: sube muy rápido (>0.5%/sem) | −100 kcal (gana grasa de más) |

### Combina con el piso (Punto 1)
La recalibración NUNCA baja del piso de seguridad. Si el usuario llegó al piso y aún
no progresa, en vez de recortar más: mensaje "estás en tu mínimo seguro; para seguir,
agrega actividad o consulta a un profesional."

### Nota
Es una función que se construye después del cálculo base (requiere registro de peso
en el tiempo), pero es la que hace que TODO lo demás funcione para todos, no solo
para aquellos a quienes la fórmula inicial acertó.

---

## PENDIENTES FINALES (rápidos, de implementación)

### PUNTO 5 — Base de datos: SMAE 4ª ed → 5ª ed ✅ RESUELTO
HSC hoy usa el Sistema Mexicano de Equivalentes **4ª edición** hardcodeado en
`src/utils/smeCalc.ts` (`smeNutritionDB` / `smeGroups`).

**Cambio:** usar la **5ª edición (2,870 alimentos)** ya lista y verificada:
- Magaly carga `foods.csv` + `food_measures.csv` a Supabase (tablas `foods`,
  `food_measures`) usando `schema_completo.sql`.
- Claude Code cambia el código para leer los alimentos desde esas tablas de Supabase
  en vez de la base 4ª edición hardcodeada.
- La base nueva ya trae macros, micros y fibra por porción, con conversión a 100g.
- Recordatorio: en la app NO se menciona la fuente (SMAE). Solo HSC.

### PUNTO 6 — Factor de actividad: 5 niveles + descripciones ✅ DEFINIDO

Se AGREGA el nivel "Atleta" (5º nivel, factor 1.9) que existía en código pero no
era alcanzable. Onboarding queda con 5 tarjetas.

**Descripciones cortas (lo que ve el usuario) — con frecuencia + ejemplo:**

| Nivel | Factor | Descripción |
|---|---|---|
| Sedentaria | 1.2 | Poco o nada de ejercicio. Trabajo de escritorio, mayormente sentada. |
| Ligera | 1.375 | Ejercicio ligero 1–3 días por semana. Caminatas, algo de movimiento. |
| Moderada | 1.55 | Ejercicio 3–5 días por semana. Gym o deporte regular. |
| Alta | 1.725 | Ejercicio intenso 6–7 días por semana. Entrenas casi diario. |
| Atleta | 1.9 | Entrenas muy fuerte, 2 veces al día, o trabajo físico pesado. |

**Línea guía arriba de las opciones:** "Piensa en tu semana completa, no solo el gym."

**Por qué importa:** los factores de actividad fallan por autoevaluación imprecisa
(la gente sobreestima). Buenas descripciones = mejor clasificación = todo el cálculo
más preciso, sin tocar ninguna fórmula. El error común: entrenar 1h pero estar
sentado 15h y elegir "Alta". La línea guía lo corrige.

---

## ✅ AUDITORÍA NUTRICIONAL COMPLETA — 7 puntos definidos
1. Piso calórico de seguridad
2. Acceso con restricciones (menores, embarazo)
3. Capa de macros (proteína, grasa, carbos, fibra, reparto)
4. Déficit/superávit porcentual
5. Base de datos 5ª edición
6. Factor de actividad: 5 niveles + descripciones
7. Recalibración con el tiempo

---

## PREGUNTAS DEL ONBOARDING ✅ DEFINIDO

Cada pregunta existe porque un cálculo la necesita. Ni una de más, ni una de menos.

### Obligatorias (7)
| Pregunta | Para qué la usa el sistema |
|---|---|
| Sexo | Fórmula Mifflin + piso de seguridad (1200/1500) |
| Edad | Fórmula Mifflin + detectar menores (Punto 2) |
| Peso (kg) | Fórmula Mifflin + proteína (g/kg) + grasa (g/kg) |
| Estatura (cm) | Fórmula Mifflin |
| Nivel de actividad | Factor × BMR (5 niveles con descripciones, Punto 6) |
| Objetivo (bajar/mantener/subir/recomp) | Define déficit/superávit + tabla de proteína |
| ¿Embarazo/lactancia? | Bloqueo de seguridad, no déficit (Punto 2) |

### Opcionales (2) — deben sentirse CLARAMENTE opcionales ("si lo sabes")
| Pregunta | Para qué |
|---|---|
| % de grasa corporal | Si lo sabe → usa Katch-McArdle (más preciso) en vez de Mifflin |
| Peso meta / objetivo | Mostrar progreso y motivación (no indispensable para el cálculo) |

- **Importante:** las opcionales se pueden saltar sin trabarse. Si se exigen, la
  gente se frustra y abandona el onboarding.
- **Nivel de experiencia entrenando:** NO va en el onboarding nutricional (aplica al
  entrenamiento, no a la nutrición). Reservar para el módulo de entrenamiento si existe.
- La app se adapta a cuántos datos tenga cada quien: con % grasa → Katch-McArdle;
  sin él → Mifflin. Usa lo mejor posible con lo disponible.

---

## YA CONFIRMADO COMO CORRECTO EN HSC (no tocar)
- Fórmula BMR: **Mifflin-St Jeor** (la más recomendada, fuentes actuales) ✅
- Factores de actividad: 1.2 / 1.375 / 1.55 / 1.725 (estándar) ✅
- kcal de alimentos desde tabla, no fórmula Atwater ✅

## REPARTO DE CALORÍAS POR COMIDA (definido en sesión aparte)
- Desayuno 25% / Comida 35% / Cena 25% / Snacks 15%
- Base razonable (evidencia de comer más temprano + adherencia realista)
- Ajustable por la nutrióloga

## FÓRMULA DE PROTEÍNA POR OBJETIVO (definido, pendiente integrar en Punto 3)
Basado en ISSN Position Stand (fuente certificada):
| Objetivo | Proteína (g/kg/día) |
|---|---|
| Bajar grasa (déficit) | 1.8 – 2.4 |
| Mantener / recomposición | 1.6 – 2.0 |
| Ganar músculo | 1.6 – 2.2 |
| Sedentario / salud general | 1.2 – 1.6 |
Se ajusta también por nivel de actividad (más fuerza → más arriba del rango).
