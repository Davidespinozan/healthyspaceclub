# HALLAZGOS ABIERTOS — IMPLEMENTACIÓN P0 DE NUTRICIÓN

Registro de defectos **detectados pero NO corregidos**, con su alcance medido. Cada entrada
dice de qué bloque salió, por qué quedó fuera de él y qué haría falta para cerrarla.

> Esto **no** es un documento de decisiones de producto. Las decisiones viven en
> `NUTRITION-PRODUCT-DECISIONS-V2.md`. Aquí solo se registra estado técnico verificado.

| # | Hallazgo | Severidad | Origen | Estado |
|---|---|---|---|---|
| 01 | Los planes persistidos anteriores a P0-03 pueden violar restricciones o cruzar tiempos | Alta | P0-03 | **Cerrado en P0-04** |
| 02 | `AVOID_MAP.vegetariano/vegano` no lista merluza, gambas, boquerones ni sardinas | Sin impacto activo | P0-03 (auditoría de cobertura) | Deuda congelada — solo si se reactivan |
| 03 | Los ingredientes del Bowl/Food Truck no son verificables contra las restricciones | Sin impacto activo | P0-04 | Deuda previa a su reactivación |
| 04 | Seis platos dulces de desayuno están clasificados como Cena | Media | Bloque 05 (Decisión 06) | Abierto — revisión de clasificación temporal |

---

## HALLAZGO-01 — Los planes ya guardados no se validan nunca · CERRADO EN P0-04

> **Cerrado.** P0-04 valida el plan terminado en las cuatro puertas (`saveWeeklyPlan`, el pull
> de Supabase y la rehidratación de localStorage; el render conserva su gate estructural), y
> `PLAN_ENGINE_VERSION` subió 30 → 31 para que los planes anteriores se regeneren en la
> siguiente carga en lugar de quedarse vigentes para siempre. Se deja el análisis como
> registro de por qué hizo falta.

**Qué pasa.** P0-03 hace que la *generación* falle de forma segura, pero no revisa nada de lo
que ya está escrito en `user_profiles.weekly_plan`. Un plan generado **antes** de P0-03 pudo
guardarse con cualquiera de los fail-opens que ese bloque cerró:

- platillos de otro tiempo (medido antes del fix: un perfil `vegano` recibía Edamames de
  desayuno, Garbanzos Horneados de comida y Puñado de Cacahuates de cena, los 7 días);
- platillos incompatibles servidos desde un pool sin filtrar.

Hoy **no existe ninguna validación del plan persistido**. Las dos vías que podrían sustituirlo
no lo hacen en este caso:

- `planInvalidatedByAvoidChange` (P0-02) solo actúa cuando el usuario **añade** una restricción
  permanente. Un perfil que no toca sus ajustes conserva el plan intacto.
- `useAutoRegenPlan` solo regenera cuando `engineVersion` guardada < `PLAN_ENGINE_VERSION`.
  Para un perfil legacy `vegetariano`/`vegano` la regeneración ahora **lanza**
  `NoEligibleDishesError`, su `catch` registra el error y **deja el plan viejo en pantalla**.
  El efecto depende solo de `savedVersion`, así que no hay bucle: un intento por carga de app.

**Consecuencia neta.** Un perfil legacy vegetariano/vegano puede seguir mostrando hoy un plan
con cruces de tiempo, indefinidamente.

**Por qué no se arregló en P0-03.** El alcance del bloque era que el sistema *falle de manera
segura al generar*. Validar o descartar planes ya guardados es otra capa, y descartar el plan
de un perfil para el que **no existe plan posible** deja al usuario sin nada: es una decisión
de producto, no una corrección técnica.

**Qué haría falta.** Validar el plan persistido al cargarlo (tiempo de cada platillo +
restricciones efectivas) y decidir qué se le muestra a un usuario cuyo plan es inválido y no
se puede regenerar.

---

## HALLAZGO-02 — Deuda congelada: las listas veg legacy están incompletas

> **No es un problema de food safety del producto actual.** La Decisión 01 establece que HSC
> **no ofrece** dieta vegetariana ni vegana, y desde P0-03 la autoridad de restricciones
> (`avoidAuthority`) **solo admite las 10 categorías soportadas**: `vegetariano`/`vegano` no
> pueden convertirse en restricción efectiva ni llegar al motor por ninguna vía. Por tanto
> ningún usuario puede alcanzar la fuga descrita aquí. Se registra como **deuda previa a una
> futura reactivación**, no como defecto activo, y **no se corrige**: ampliar esas listas
> sería construir compatibilidad para una capacidad que el producto retiró.

**Qué pasa.** Las listas de términos `vegetariano` y `vegano` de `AVOID_MAP`
(`src/utils/planEngine.ts`) enumeran cortes y especies, pero **les faltan** `sardina(s)`,
`merluza`, `gamba(s)`, `boqueron(es)` — exactamente las especies que las categorías `pescado` y
`mariscos` **sí** incorporaron en P0-01. Las listas veg nunca se actualizaron.

**Alcance medido** sobre los 307 platillos del banco:

| Categoría | Platillos con producto animal que NO excluye |
|---|---|
| `vegetariano` | 4 — Tostada de Sardina y Tomate (Desayuno), Merluza al Horno con Patatas (Comida), Gambas al Ajillo con Pan (Cena), Aceitunas con Boquerones (Snack) |
| `vegano` | 3 — las mismas menos la Tostada de Sardina, que cae por otro ingrediente lácteo |

**Alcanzabilidad: ninguna.** La autoridad descarta `vegetariano`/`vegano` antes de que lleguen
al motor, así que estas exclusiones no se evalúan nunca en producción. Si algún día se
reactivaran, el comportamiento medido —invocando el predicado a mano— sería:

- sin región, en LATAM y en REST → **0 fugas**: `dishAllowedInRegion` descarta antes los
  platillos `region:ES`, que son justamente los cuatro;
- en **EUROPE** → **25 de 25 planes vegetarianos servían merluza** (262 ocurrencias, barrido de
  5 niveles calóricos × 5 semillas). Es el dato que haría falta cerrar antes de reactivar.

**Por qué no lo vio nadie antes.** La matriz de planes de `dietTermCompleteness.test.ts`
generaba planes **sin pasar región**, así que estructuralmente no podía seleccionar un platillo
`region:ES`. Y el oracle «independiente» de ese mismo test **compartía la laguna**: su
`ANIMAL_WORDS` tampoco listaba merluza, gambas ni boquerones. Un oracle con el mismo punto
ciego que el sistema no es independiente.

**Por qué no se corrige.** La categoría está fuera del producto activo: ampliar sus términos
sería diseñar compatibilidad para una capacidad que la Decisión 01 retiró. Tampoco es un fallo
de *fallback*: es un hueco en la capa de **términos** (clase P0-01). Las invariantes que P0-03
posee se cumplen — ningún fallback sirve algo que el detector excluye.

**Estado en los tests.** Fijado en `dietTermCompleteness.test.ts` (`DEUDA_PESCADO_ES`), con el
oracle ya corregido, dentro del bloque marcado como **capacidad inactiva**. El test afirma que
las fugas son *exactamente* esas cuatro: no pueden aparecer nuevas en silencio, y si alguien
cierra la deuda el test avisa.

**Si algún día se reactivan.** Añadir las especies ausentes a las listas, vaciar
`DEUDA_PESCADO_ES` y revisar si hay más divergencias entre esas listas legacy y las 10
categorías que P0-01 corrigió. Pero antes de eso, lo que la Decisión 01 pide resolver es la
**profundidad del banco**: sin desayunos veganos no hay plan posible, y los términos son el
último de los problemas.

---

## HALLAZGO-03 — El Bowl/Food Truck no es verificable contra las restricciones

**Estado del producto.** La funcionalidad Bowl/Food Truck está **pausada**: el food truck no
está operando y esta capacidad no forma parte del HSC que se está preparando. Se registra como
**deuda previa a su reactivación**, no como defecto activo.

**Qué pasa.** Un bowl entra al plan como alimento EXTERNO con macros conocidas pero **sin
ingredientes** (`ings: []`, ver `buildDayWithFixed`). P0-04 lo reconoce por su estructura, no
por su nombre, y puede comprobar su nombre y su porción contra las restricciones — una señal
débil, que detecta «Bowl de Salmón» con pescado excluido pero no la composición real. Es
además la única exención del chequeo de tiempo, acotada y justificada: el bowl ocupa el tiempo
que el usuario eligió al pedirlo.

**Defensas que SÍ quedan activas** (de P0-03 y P0-04, no se retiran):

- el día se rearma con las restricciones **efectivas actuales**, no con el `gen.avoid` guardado;
- `buildDayWithFixed` falla cerrado si algún tiempo queda sin candidatos;
- `saveWeeklyPlan` valida el plan resultante y lo rechaza si no cumple;
- el call-site de `TabHoy` está protegido y el día se queda como estaba si algo falla.

**Qué haría falta antes de reactivar.** Que los bowls lleguen con sus ingredientes modelados
—como cualquier platillo del banco— para que el detector de P0-01 pueda evaluarlos de verdad.
Mientras no exista eso, un bowl es un alimento que el usuario elige a ojo y HSC no puede
afirmar que respete sus restricciones.

---

## HALLAZGO-04 — Seis platos dulces de desayuno están clasificados como Cena

**De dónde sale.** De la auditoría del Bloque 05. Al retirar el filtro de `guarnicion`
(Decisión 06) quedó a la vista que los platillos de Cena sin verdura no son un problema de
etiquetado: son **recetas de desayuno colocadas en el tiempo equivocado**.

**Los seis:**

| Platillo | `tiempo` actual | Composición |
|---|---|---|
Hot Cakes de Camote | Cena | avena, camote, huevo, leche, canela, nueces, miel |
Hot Cakes de Zanahoria | Cena | harina de avena, zanahoria, huevo, yogurt griego, leche, canela, crema de cacahuate, nueces, miel |
Crepas Dulces de Plátano y Cacahuate | Cena | avena, leche, huevo, plátano, crema de cacahuate, miel |
Overnight Oats de Mango y Coco | Cena | avena, leche, yogurt, mango, coco, chía, miel |
Overnight Oats de Zanahoria | Cena | avena, leche, yogurt, zanahoria, chía, nueces, pasas, miel |
Yogurt con Frutos Rojos y Almendras | Cena | yogurt griego, frambuesa, zarzamora, arándanos, granola, almendras, miel |

**Corrección posterior: son seis, no cinco.** La auditoría original del Bloque 05 solo encontró
cinco porque partía de los platillos SIN `rol:'guarnicion'`. **Hot Cakes de Zanahoria** sí lleva
el tag, en un ingrediente llamado `Zanahoria rallada (topping)` de 20 g, así que pasaba el
antiguo filtro y no aparecía en esa lista. La radiografía posterior del modelo de datos lo
localizó por otra vía —el cruce `sabor` × `tiempo`, donde los dulces de Cena son exactamente
seis— y es un buen resumen de por qué el tag no servía como autoridad: 20 g de zanahoria rallada
por encima bastaban para que un hot cake con miel contara como «comida con verdura».

**Por qué no es urgente.** Ninguno llega hoy al plato. Medido sobre 1.400 días generados: el
solver los descarta por encaje de macros con errores del **28 % al 60 %** frente a una banda de
aceptación del 12 %. Es decir, el motor ya los está filtrando por una razón legítima —no cuadran
el tamaño de una cena— y no por su clasificación.

**Por qué conviene resolverlo igualmente.** Mientras sigan marcados como Cena:

- inflan el pool nominal de Cena (54) con 6 recetas que en la práctica nunca se sirven, lo que
  distorsiona cualquier medición de profundidad del banco;
- si en el futuro se ajustan las bandas de aceptación o los targets, podrían volverse elegibles
  sin que nadie lo haya decidido;
- Overnight Oats de Zanahoria es además el caso que más confunde el diagnóstico: tiene 40 g de
  zanahoria como ingrediente principal, así que «no tiene verdura» nunca fue su problema.

**Qué haría falta.** Una decisión de producto de Magaly sobre su `tiempo` en
`PLATILLOS-HSC-final.csv`, y regenerar el banco. **No se toca en este bloque**: la Decisión 06
prohíbe expresamente cambiar recetas y tiempos de comida, y reclasificar es justamente eso.
