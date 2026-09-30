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
- **Última actualización:** 2026-09-30
- **Decisiones cerradas:** 5 (01, 02, 03, 04, 05)

---

## ÍNDICE DE DECISIONES

| # | Título | Fecha de cierre | Estado |
|---|---|---|---|
| 01 | Vegetariano y vegano | 2026-09-27 | **Cerrada** |
| 02 | Variantes de recetas por restricciones | 2026-09-27 | **Cerrada** |
| 03 | Elegibilidad de variantes | 2026-09-28 | **Cerrada** |
| 04 | Familia culinaria | 2026-09-28 | **Cerrada** |
| 05 | Semántica de restricciones: avena, granola y coco | 2026-09-30 | **Cerrada** |

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
