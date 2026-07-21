# CORRECCIONES HSC — para David / Claude Code

Hay **dos tipos** de correcciones. Es importante no confundirlas:

- **DATOS (CSV):** ya están arregladas. Solo hay que usar los archivos nuevos.
- **CÓDIGO (app):** hay que implementarlas.

---

# PARTE 1 — DATOS (ya resuelto, solo reemplazar archivos)

## Archivos nuevos
- `PLATILLOS-HSC-final-12.csv` — reemplaza cualquier versión anterior
- `SUBRECETAS-HSC-v3.csv` — reemplaza la anterior (ahora son 15 sub-recetas)

## Qué se arregló en los datos

### 1. Verduras sueltas → CERO
Antes había 26 platillos con verduras sueltas mostrando gramos individuales
("cebolla 20g", "lechuga 40g"). **Ya no queda ninguna.** Todas están consolidadas
en una sola fila `Verduras mixtas` con nombre_visible = `Verduras (n1, n2, n3)`.

**Única excepción (siguen con línea propia):** carbo real → elote, betabel, zanahoria,
papa, camote, nopal, chícharo, calabaza de castilla.

### 2. Quesos universales
Se sustituyó panela/Oaxaca por quesos universales EN PLATILLOS GLOBALES (para mercado
España/USA):
- `Queso Panela` / `Queso fresco` → **`Queso fresco de cabra`** (no derrite, magro)
- `Queso Oaxaca` → **`Queso Mozzarella semidescremado`** (derrite)

**Los 21 usos que QUEDAN de panela/Oaxaca/fresco son TODOS en platillos mexicanos**
(Chilaquiles, Molletes, Enchiladas, Sincronizadas, Alambres, Nopales Asados, Huevos
Rancheros, Ceviche de Panela...). Es a propósito: ahí el queso es identidad del
platillo. **No tocar.**

### 3. Tope de tostadas
`max_g` de tostada de maíz: **100g → 52g** (4 piezas). Antes el motor podía servir
hasta 7.7 tostadas. Nadie se come 8 tostadas.
(La tortilla se queda en max 180g = 6 piezas, eso sí es realista.)

### 4. Entomatadas de Pollo
Movidas de **Desayuno → Comida**.

### 5. Tzatziki ahora es SUB-RECETA
Antes era el alimento `Aderezo de yogurt y pepino` (rol=fijo), por eso la app no
mostraba receta. Ahora es sub-receta #15 con sus ingredientes.

---

# PARTE 2 — CÓDIGO (implementar en la app)

## 1. Las sub-recetas no se muestran 🔴 PRIORITARIO

**Problema:** al abrir un platillo que lleva una salsa o aderezo, la app NO muestra
la receta de esa salsa. El usuario ve "Guacamole 80g" pero no sabe qué lleva ni cómo
hacerlo.

**Causa probable:** las filas con `rol = sub-receta` NO son alimentos del catálogo SMAE.
Ejemplo: `Guacamole` no existe en SMAE. Si el motor lo busca ahí, no lo encuentra.

**Solución:** resolverlas contra `SUBRECETAS-HSC-v3.csv`. La fórmula de rendimiento/factor
está en el archivo `BRIEF-SUBRECETAS-CLAUDE-CODE.md`.

**Alcance:** 41 filas en 38 platillos. Son 15 sub-recetas en total.

**UX:** el usuario debe poder ver los ingredientes de la salsa al abrir el platillo
(expandible o desplegado).

---

## 2. UNIDADES: mostrar medidas caseras, no gramos 🔴 PRIORITARIO

Nadie pesa la lechuga ni cuenta gramos de aceite. La app debe mostrar **medidas caseras**.

**IMPORTANTE:** los gramos NO se borran del CSV. El motor los sigue usando igual para
calcular macros, fibra y kcal. **Solo cambia lo que se pinta en pantalla.**

| Tipo | Qué mostrar | Ejemplo |
|---|---|---|
| `rol = guarnicion` (verduras) | **"al gusto"**, sin gramos | "Verduras (lechuga, jitomate, cebolla) — al gusto" |
| Aceite | **cucharadas** | "1 cda. de aceite de oliva" |
| Jamón / pavo | **piezas (rebanadas)** | "2 rebanadas de jamón de pavo" |
| Fruta | **tazas o piezas** | "1 plátano" / "1 taza de fresas" |
| Salsas y aderezos | **tazas o cucharadas** | "2 cdas. de tzatziki" |
| Tortillas / tostadas | **piezas** | "3 tortillas" |
| `rol = principal` (pollo, arroz, papa, carne) | **SÍ gramos** | "150g de pollo" |
| `rol = condimento` | solo el nombre, sin cantidad | "Sal, pimienta" |

**Equivalencias para convertir:**
- Aceite: 1 cda = 10g · 1 cdta = 5g
- Tortilla de maíz: 1 pza = 30g
- Tostada: 1 pza = 13g
- Jamón/pavo: 1 rebanada = 30g
- Salsas/aderezos: 1 cda = 15g · 1 taza = 240g
- Fruta: 1 plátano = 100g · 1 taza de fresas = 150g

---

## 3. Porciones anormalmente chicas + proteína de relleno en snacks 🔴

**Problema real detectado en la app:**

Con una meta de ~1900 kcal, el motor puso:
- **Comida: Burger Bowl con 80g de carne** (porción ridículamente chica)
- **Snack: 1 pieza de huevo + fresas** (huevo suelto de relleno)

Eso está al revés. **Si cabía una porción normal de carne en la comida, debió ponerla.**
No tiene sentido exprimir la comida a 80g y luego meter un huevo suelto en el snack
para compensar la proteína que faltó.

**La regla correcta:**

- Las comidas principales deben servir **porciones NORMALES**, no mínimas.
  Una porción normal de carne es ~120-150g, no 80g.
- **NO se trata de llegar al `max_g`.** El `max_g` es un TECHO, no una meta.
  Nadie quiere 300g de carne tampoco. Se trata de porciones **normales**.
- Con porciones normales en las comidas, la proteína cuadra sola y el snack puede ser
  lo que debe ser: **fruta o algo ligero**.
- **La proteína en snacks solo tiene sentido para metas MUY ALTAS** (atletas, 3000+ kcal),
  donde físicamente ya no cabe todo en 3 tiempos y sí hay que distribuir.
  Para alguien de 1900 kcal, todo cabe perfecto en desayuno/comida/cena.

**Sugerencia técnica:** el motor tiene un techo (`max_g`) pero **no tiene piso**. Por eso
puede exprimir hasta lo absurdo. Valdría la pena agregar un **`min_g`** (piso) a los
ingredientes `principal`, para que una carne nunca baje de ~120g, un pollo nunca de ~120g,
etc. Sin piso, el motor tiene libertad de bajar hasta cantidades irreales.

**También revisar:** que el motor esté escalando de verdad los `principal` hasta cumplir
el macro, y no repartiendo por porcentaje fijo. El 80g de carne sugiere que algo está mal
en el escalado.
