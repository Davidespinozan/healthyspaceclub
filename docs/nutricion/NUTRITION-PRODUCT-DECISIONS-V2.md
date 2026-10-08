# NUTRICIÓN V2 — DECISIONES DE PRODUCTO

> **Qué es este documento.** Un registro acumulativo de las decisiones de producto **ya cerradas** para
> la reconstrucción del módulo de Nutrición de Healthy Space Club.
>
> **Qué NO es.** No es un plan de implementación, no es un diseño técnico y no es una especificación de
> arquitectura. Las decisiones se registran tal como se cierran, sin reinterpretarlas.
>
> **Autoría de las decisiones:** David (con ChatGPT).
> **Mantenimiento del documento:** Claude Code, como registro.
>
> **Estado del trabajo:** FASE DE DECISIONES. **No se implementa nada** hasta que David indique
> expresamente que la fase de decisiones terminó.
>
> **Modo de trabajo vigente:** solo lectura sobre el producto. No se modifica código, CSVs, banco de
> recetas, Supabase, lógica del motor ni comportamiento de producción. Este archivo es la única
> escritura autorizada.

- **Creado:** 2026-09-27
- **Última actualización:** 2026-10-05
- **Decisiones cerradas:** 7 (01, 02, 03, 04, 05, 06, 07)

---

## ÍNDICE DE DECISIONES

| # | Título | Fecha de cierre | Estado |
|---|---|---|---|
| 01 | Vegetariano y vegano | 2026-09-27 | **Cerrada** |
| 02 | Variantes de recetas por restricciones | 2026-09-27 | **Cerrada** |
| 03 | Elegibilidad de variantes | 2026-09-28 | **Cerrada** |
| 04 | Familia culinaria | 2026-09-28 | **Cerrada** |
| 05 | Semántica de restricciones: avena, granola y coco | 2026-09-30 | **Cerrada** |
| 06 | `rol:'guarnicion'` no es autoridad de elegibilidad | 2026-09-30 | **Cerrada** |
| 07 | Población de Nutrition V1: 19–64 años inclusive | 2026-10-05 | **Cerrada** |

---

## DECISIÓN 01 — Vegetariano y vegano

**Estado:** Cerrada · **Fecha:** 2026-09-27

En la versión actual de HSC **no se ofrecerán** las opciones Vegetariano ni Vegano al usuario.

El código y los datos internos relacionados **pueden permanecer** para uso futuro, pero **no deben
exponerse como capacidades actuales del producto**.

Solo se reconsiderará habilitarlas cuando:

1. exista **suficiente profundidad intencional del banco** para cada tiempo de comida —
   Desayuno, Comida, Cena y Snack—, y
2. las simulaciones demuestren **variedad y calidad suficientes**.

### Principio derivado

> **Que el código pueda técnicamente generar algo no significa que HSC deba ofrecerlo como capacidad
> de producto.**

---

## DECISIÓN 02 — Variantes de recetas por restricciones

**Estado:** Cerrada · **Fecha:** 2026-09-27

Las **recetas originales no se modificarán** para hacerlas universales.

Para usuarios **sin** una restricción determinada, HSC debe conservar como **experiencia
predeterminada la receta original**.

Cuando sea necesario adaptar un platillo para una restricción, **se podrá crear una variante
específica vinculada conceptualmente a la receta original**.

Estas **variantes de restricción no deben entrar al pool general** de usuarios que no las necesitan.

### Ejemplo conceptual (ilustrativo, no normativo)

Si *Tostadas de Atún* contiene mayonesa y más adelante creamos una variante sin huevo, un usuario
**sin** restricción de huevo debe seguir recibiendo **la receta original**. La variante adaptada podrá
ser candidata cuando las restricciones del usuario justifiquen su uso.

### Delimitación explícita

> **Todavía NO está decidido cómo se representará técnicamente esto.**
>
> Los mecanismos mencionados en conversación (`variantOf`, flags, familias, etc.) son **ejemplos de
> discusión, no decisiones de arquitectura**. No deben tratarse como acordados ni derivarse de esta
> decisión.

---

## DECISIÓN 03 — Elegibilidad de variantes

**Estado:** Cerrada · **Fecha:** 2026-09-28

Las variantes por restricción son **alternativas condicionadas**, no platillos del banco general.

### Reglas

1. Si el usuario **no selecciona ninguna restricción**, las variantes **NO participan** en la
   generación.
2. Una variante **puede participar** cuando existe **al menos una restricción activa** que justifica
   la adaptación.
3. Para poder participar, la variante debe ser **compatible con TODAS** las restricciones activas del
   usuario.
4. La existencia de una variante **NO elimina** un original que todavía sea compatible con todas las
   restricciones del usuario.
5. Por tanto, **una variante amplía el pool restringido; no reemplaza automáticamente al original.**

### Ejemplo conceptual (ilustrativo, no normativo)

Si una variante elimina huevo y el usuario selecciona *sin huevo*, puede ser elegible. Si además el
usuario selecciona *sin lácteos*, esa misma variante solamente puede participar si **también** es
compatible con *sin lácteos*.

### Delimitación explícita

> **No usar semántica OR pura ni AND pura** basada simplemente en una lista de restricciones.
>
> **La representación técnica exacta sigue pendiente.** No debe diseñarse ni implementarse todavía.

---

## DECISIÓN 04 — Familia culinaria

**Estado:** Cerrada · **Fecha:** 2026-09-28

Original y variante **pertenecen a la misma familia culinaria** para efectos de variedad.

El motor **no debe considerar** original y variante como dos conceptos completamente independientes
simplemente porque tengan nombres diferentes.

Esto será relevante especialmente **cuando un original compatible y alguna variante puedan coexistir
en el pool**.

### Delimitación explícita

> **La representación técnica de family/id todavía está pendiente.** No debe implementarse.

---

## DECISIÓN 05 — Semántica de restricciones: avena, granola y coco

**Estado:** Cerrada · **Fecha:** 2026-09-30
**Origen:** revisión de producto del bloque de implementación P0-01 (corrección del detector de
restricciones alimentarias). Las tres preguntas se habían registrado como *PRODUCT DECISION REQUIRED*
porque su pertenencia dependía de un criterio nutricional que no estaba documentado.

### PD-01 — La avena NO activa gluten

`avena`, `avena cocida` y `harina de avena` **no** activan la restricción de gluten.

Se mantiene el comportamiento implementado en P0-01.

### PD-02 — La granola genérica SÍ activa gluten

La **granola genérica SÍ** activa la restricción de gluten.

Una receta futura solo podrá considerarse compatible con *sin gluten* si el ingrediente está
**modelado explícitamente como una variante sin gluten**. **No se infiere.**

### PD-03 — El coco NO activa frutos secos

`coco rallado` y `coco en hojuelas` **no** activan la restricción de frutos secos.

Se mantiene el comportamiento implementado en P0-01.

### Principio derivado

> **La compatibilidad no se infiere.** Cuando un alimento pertenece a una categoría de restricción
> por su forma habitual de producción —como la granola, que suele llevar malta de cebada o trigo—,
> la pertenencia se asume por defecto. La excepción tiene que estar **declarada en el dato**, no
> deducida del nombre ni del contexto.

### Delimitación explícita

> Esta decisión cubre **únicamente** la avena, la granola y el coco.
>
> **No** generaliza la exención por «sin gluten» a otros alimentos. Si en el futuro apareciera un
> `pan sin gluten` o una `pasta sin gluten`, su tratamiento es una decisión aparte que **no** queda
> tomada aquí.
>
> Tampoco decide nada sobre el resto de la semántica de restricciones.

---

## DECISIÓN 06 — `rol:'guarnicion'` no es autoridad de elegibilidad

**Estado:** Cerrada · **Fecha:** 2026-09-30

La regla histórica «verduras presentes en Comida y Cena» **se conserva como objetivo de calidad
nutricional, a revisar posteriormente**, pero **deja de implementarse como un filtro duro basado
en `rol:'guarnicion'`**.

### Intención histórica

La regla está escrita en `LOGICA-NUTRICIONAL-HSC.md` §3.5:

> **Verduras:** presentes en comida y cena SIEMPRE (base del plato).

Se implementó cuatro días después en el commit `c96398c` («verduras forzadas en comida y cena
(pool con guarnición)»), reduciendo los pools de Comida y Cena a los platillos que llevaran el
tag. Antes de ese commit `guarnicion` no tenía ningún significado en el motor.

La base nutricional citada en el repo es un **objetivo diario** —«~400 g/día de verduras +
frutas», WHO 2023—, no un requisito por comida; la forma «por comida» aparece como «regla simple
**para el banco** de platillos», es decir una heurística de construcción.

### Por qué `guarnicion` no es una autoridad válida

1. **Es un campo de registro opcional.** `INSTRUCCIONES-MAGALY.md`: «Verduras de guarnición que
   sí cuentan […] ponlas como un ingrediente más, con sus gramos. Puedes escribir "guarnición" en
   la columna `nota` **si quieres**». Un campo voluntario decidía qué recetas existían.
2. **Las mismas instrucciones permiten no usarlo.** «Salsas/mezclas caseras (pico de gallo, salsa
   verde): si quieres que cuenten, desármalas en sus ingredientes; si son mínimas, déjalas fuera».
   Los platillos con pico de gallo y guacamole siguieron la instrucción al pie de la letra y
   quedaron fuera del plan.
3. **Tiene un segundo significado, de display.** El tag imprime «al gusto» sin gramos
   (`portionStr`) y afecta la lista de compra. Ganó la elegibilidad el 9-jul y el display el
   12-jul: dos responsabilidades sobre una misma etiqueta.
4. **No describe verdura con fiabilidad.** De los 136 ingredientes `guarnicion` de Comida/Cena, 9
   son **elote** (SMAE: Cereales S/G) y 1 **arúgula** (Libres en energía).
5. **Se le escapaba verdura real.** 4 de los 10 platillos excluidos SÍ llevan verdura: Overnight
   Oats de Zanahoria tiene 40 g de zanahoria como ingrediente `principal`.
6. **No cubría la ruta IA.** `safeBankByTiempo` siempre usó los pools nominales, así que la regla
   solo se aplicaba en la ruta determinista. Era una garantía asimétrica.

### Evidencia de la simulación

Medido sobre **200 planes / 1.400 días** (5 perfiles × 5 combinaciones de restricciones × 8
semillas), comparando el motor con y sin el filtro:

| | Resultado |
|---|---|
Platillos que entran | **3 de 10**, en el **3,5 %** de los slots Comida+Cena |
Los otros 7 | **nunca** se sirven: el solver ya los rechaza por encaje de macros (28–60 % de error frente a una banda de aceptación del 12 %) |
De los 3 que entran | **2 llevan verdura real** (~28 g vía guacamole); ninguno es de los 5 sin verdura |
Error de macros | 0,45 % → 0,46 % (**+0,01 pp**) |
Variedad por tiempo | 5,46 → 5,42 platillos distintos en 7 días |
Cruces de tiempo / fugas de restricción | **0 / 0** |

Conclusión: **el filtro protegía mucho menos de lo que su redacción sugería**, y el solver ya
hacía la mayor parte del trabajo que se le atribuía. Retirarlo no produce cenas dulces.

### Separación que esta decisión establece

> **Elegibilidad del platillo** — la decide su `tiempo` (y las restricciones del socio). Es una
> cuestión binaria y estructural: ¿puede este platillo ocupar este slot?
>
> **Calidad vegetal del plan** — es una propiedad del plan completo y del día, no de un tag en una
> receta. Medible en gramos, acumulable, y materia de objetivo nutricional.

Mezclarlas era el error: un tag de registro voluntario no puede decidir qué recetas existen.

### Lo que NO queda decidido

> La **estrategia de frutas y verduras queda pendiente**. En concreto, esta decisión **no** define:
>
> - cuánta verdura es «suficiente» (20 g, 40 g, 100 g…) ni si se mide por comida o por día;
> - si se implementa `hasVegetable()` con la clasificación SMAE de `foods.csv` —la fuente más
>   sólida disponible, hoy inalcanzable porque `gen_banco.py` no arrastra el grupo del alimento—;
> - si un platillo sin verdura debería recibir una guarnición automáticamente;
> - si hay que reclasificar recetas entre tiempos (ver HALLAZGO-04);
> - ninguna receta nueva.
>
> Tampoco cambia la semántica de **display** de `guarnicion`, que sigue intacta.


---

## DECISIÓN 07 — Población de Nutrition V1: 19–64 años inclusive

**Estado:** Cerrada · **Fecha:** 2026-10-05

HSC Nutrition V1 prescribe nutrición personalizada **solo a personas de 19 a 64 años, inclusive**.

- `edad < 19` → **fuera del alcance** de Nutrición (`age_under_19`)
- `edad 19..64` → continúa el pipeline normal, sujeta a los demás guards
- `edad >= 65` → **fuera del alcance** de Nutrición (`age_65_or_over`)

### Qué SUPERSEDE

La decisión anterior era «`edad >= 19` → ruta adulta **sin tope superior**». Queda **superseded**.

### Por qué

No queremos diseñar dentro de esta versión la nutrición propia de adultos mayores: pérdida de
grasa en esa población, fragilidad, sarcopenia, necesidades clínicas asociadas, políticas
energéticas por edad avanzada ni políticas de macros específicas. El objetivo actual es hacer
Nutrición **muy bien** para el mercado inicial 19–64.

Entregar una cifra a alguien de 70 años sin ese diseño detrás sería peor que no entregarla.

### Qué NO significa

1. **No** afirma que una persona de 65 o más no pueda, fisiológicamente, recibir nutrición
   personalizada. Es **alcance de producto**, no una afirmación clínica.
2. **No** bloquea Healthy Space Club completo: solo el módulo de Nutrición personalizada.
3. **No** diseña nutrición geriátrica.
4. **No** manda a los 65+ a mantenimiento ni les da una prescripción conservadora. No reciben
   cifra: reciben el estado «fuera del alcance de HSC Nutrition».

### Principio derivado

El tope superior es una frontera de **producto**, no una limitación del motor. El DRI 2023
publica una única ruta adulta «19 years and above» sin límite, y el estimador de mantenimiento
calcula sin problema el EER de una persona de 75 años. Por eso el umbral inferior (19) **se
deriva** del motor que lo rechaza, y el superior (64) **vive en el Scope Guard**, que es el dueño
del alcance. Importarlo de un motor mentiría sobre de dónde viene.

### Delimitación explícita

- La **expansión a adultos mayores** queda **DIFERIDA** a una versión futura del producto. No se
  diseña, no se estima y no se promete fecha aquí.
- Esta decisión **no** resuelve el caso `IMC < 18.5` + **Recomposición**, que sigue abierto y se
  tratará con el puente temporal de macros.
- Esta decisión **no** toca macros, ni la energía legacy, ni el motor de platillos.

---

## ESTADO ACTUAL

Se están analizando los **70 desayunos reales del banco** para decidir qué variantes crear.

> **Todavía no hay ninguna variante aprobada.**

Ninguna receta, ingrediente, cantidad o regla de habilitación ha sido acordada. El análisis de
desayunos entregado hasta ahora es **materia prima para decidir**, no una propuesta aprobada.

---

## DECISIONES PENDIENTES / EN ANÁLISIS

Lo siguiente **está sin definir**. Nada de esta lista debe asumirse, anticiparse ni implementarse.

| # | Pendiente | Estado |
|---|---|---|
| P-1 | **Cuáles recetas tendrán variantes** | Sin definir |
| P-2 | **Ingredientes y cantidades de cada variante** | Sin definir |
| P-3 | **Reglas exactas para habilitarlas** (cuándo una variante entra al pool de un usuario) | **Resuelto a nivel de regla por la Decisión 03.** Representación técnica → P-6 |
| P-4 | **Comportamiento cuando coinciden varias restricciones** | **Resuelto a nivel de regla por la Decisión 03** (regla 3: compatible con TODAS las activas). Representación técnica → P-6 |
| P-5 | **Tratamiento de familias / repetición** (si original y variante cuentan como el mismo platillo para variedad) | **Resuelto a nivel de principio por la Decisión 04.** Representación de family/id → P-6 |
| P-6 | **Cambios necesarios al motor** | Sin definir |

### Notas sobre los pendientes

- **P-1 a P-6 son independientes entre sí.** Cerrar uno no implica nada sobre los demás.
- **P-6 queda expresamente fuera de la Decisión 02.** Que se decida crear variantes no autoriza ni
  describe ningún cambio en `planEngine`, en el generador del banco, ni en el esquema de datos.
- Cualquier decisión sobre representación técnica pertenece a P-6 y deberá cerrarse por separado y
  de forma explícita.

---

## CONTEXTO DE REFERENCIA

> Esta sección **no contiene decisiones**. Son hechos medidos sobre el banco actual, registrados aquí
> solo para que alguien que lea el documento entienda el terreno. Si algún dato se contradice con una
> decisión, manda la decisión.

Mediciones obtenidas ejecutando el motor real en memoria (sin modificar el repositorio):

**Sobre la Decisión 01**

- Banco compatible con `vegetariano`: Desayuno 47 · Comida **5** · Cena 15 · Snack 106.
- Banco compatible con `vegano` en LATAM: Desayuno **0** · Comida **0** · Cena **0** · Snack 44.
- Con `vegano`, los cinco tiempos del día se llenan con platillos cuyo `tiempo` es `Snack`, por el
  fallback de pool vacío en `buildDay`, y los 7 días quedan entre −35 % y −38 % de la meta calórica.

**Sobre la Decisión 02 (desayunos, 70 platillos)**

- Contienen gluten: 34 · lácteos: 50 · huevo: 41.
- **Ya compatibles simultáneamente con sin gluten + sin lácteos + sin huevo: 2**
  (`Pollo Deshebrado con Alubias`, `Tacos de Machaca`).
- Clasificación de adaptabilidad del análisis entregado: 12 FÁCIL · 14 POSIBLE PERO CAMBIA BASTANTE ·
  42 NO TIENE SENTIDO ADAPTARLO.

**Documentos y análisis de referencia**

- Reconstrucción funcional completa del módulo (30 secciones) — entregada en conversación, sin archivo.
- Auditoría de restricciones por tiempo de comida y falsos compatibles del filtro — ídem.
- Análisis de profundidad realmente utilizable por tiempo, nivel calórico y región — ídem.
- Análisis de los 70 desayunos con datos estructurales — ídem.

---

## HISTORIAL DE CAMBIOS

| Fecha | Cambio |
|---|---|
| 2026-09-27 | Creación del documento. Se registran las Decisiones 01 y 02, el Estado Actual y los pendientes P-1 a P-6. |
| 2026-09-28 | Se registran las Decisiones 03 (Elegibilidad de variantes) y 04 (Familia culinaria). P-3, P-4 y P-5 quedan resueltos a nivel de regla/principio; su representación técnica se mantiene abierta dentro de P-6. |
| 2026-09-30 | Se registra la Decisión 05 (semántica de avena, granola y coco), cerrada en la revisión de producto del bloque P0-01. Solo PD-02 implicó cambio de comportamiento; PD-01 y PD-03 confirman lo implementado. |
| 2026-10-05 | Se registra la Decisión 07 (población de Nutrition V1 = 19–64 inclusive), que **supersede** la decisión previa de «>=19 sin tope superior». Implementada en el Scope Guard como `age_65_or_over`. La expansión a adultos mayores queda diferida. |

---

## CÓMO SE AÑADEN DECISIONES NUEVAS

Cada decisión nueva se agrega **al final de la lista de decisiones**, con el siguiente número
consecutivo, **sin editar ni reescribir las anteriores**. Si una decisión nueva modifica o revoca una
anterior, la anterior **se conserva** y se marca como *Revisada por la Decisión NN* — no se borra.

Plantilla:

```
## DECISIÓN NN — <título>

**Estado:** Cerrada · **Fecha:** YYYY-MM-DD

<texto de la decisión, tal como se cierra>

### Principio derivado        (si aplica)
### Delimitación explícita    (qué NO queda decidido)
```

También se actualizan: el **índice de decisiones**, el **historial de cambios**, el contador de
decisiones cerradas de la cabecera y —si corresponde— la tabla de **pendientes**.
