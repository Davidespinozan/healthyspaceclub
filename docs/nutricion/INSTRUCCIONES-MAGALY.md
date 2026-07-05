# Cómo capturar los platillos (para que el sistema calcule 0% de error)

Hola Magaly 👋 — con este formato el sistema arma las calorías y macros de cada platillo
**exactos**, y puedes meter o sacar platillos las veces que quieras sin que nada se rompa.
La idea es simple: en vez de escribir el platillo como texto ("200 g de pechuga a la
plancha"), lo capturas como una **lista de ingredientes**, cada uno con **su nombre tal cual
está en el catálogo** y **sus gramos**. Nada más. Con eso no hay adivinanzas.

---

## Te paso 3 archivos

1. **`CATALOGO-ALIMENTOS.csv`** — la lista de todos los alimentos disponibles (2,870). De aquí
   copias el nombre EXACTO de cada ingrediente. Trae 4 columnas:
   - `alimento` → el nombre que debes copiar tal cual.
   - `grupo` → para filtrar/buscar (Verduras, Cereales, etc.).
   - `equivalencia_casera` → tu ayuda para pasar a gramos (ej. *"1 taza = 188 g"*).
   - `kcal_por_100g` → referencia.
2. **`PLANTILLA-PLATILLOS-v2.csv`** — la hoja que vas a llenar (ya trae ejemplos).
3. Este instructivo.

---

## Las 3 reglas de oro (de aquí sale el 0% de error)

### 1) Un renglón por ingrediente
Cada ingrediente del platillo es un renglón. El nombre del platillo se repite en cada renglón
suyo. No escribas el platillo como una frase larga; desármalo en sus ingredientes.

### 2) La columna `alimento` se COPIA del catálogo, idéntica
Busca tu ingrediente en `CATALOGO-ALIMENTOS.csv` y **copia y pega** el nombre tal cual
(mismos acentos, mismas palabras). Ejemplo: si tu platillo lleva pollo, el catálogo lo tiene
como **"Pechuga de pollo sin piel"** → eso es lo que va en la columna, no "pollo" ni "pechuga
a la plancha". El sistema compara el nombre **exacto**; si no coincide letra por letra, lo
rechaza y me lo regresa para que lo corrijas (nunca lo adivina).

### 3) La columna `gramos` es un número, en gramos netos (lo que se come)
Siempre gramos, nunca "1 taza" ni "½ pieza". ¿Cómo paso mi porción a gramos? Usa la columna
`equivalencia_casera` del catálogo:
- El catálogo dice *"Arroz cocido → 1 taza = 188 g"*.
- Tu platillo lleva ½ taza de arroz → pones **94**.
- Lleva 2 tazas → pones **376**.

Si ya trabajas la porción en gramos, mejor aún: ponla directo.

---

## Guarniciones, condimentos y salsas

- **Condimentos sin calorías relevantes** (sal, limón, especias, hierbas, chile al gusto):
  **no los pongas**. No cambian el cálculo.
- **Verduras de guarnición que sí cuentan** (una porción de pimiento, calabacita, nopal):
  ponlas como un ingrediente más, con sus gramos. Puedes escribir "guarnición" en la columna
  `nota` si quieres.
- **Salsas/mezclas caseras** (pico de gallo, salsa verde): si quieres que cuenten, desármalas
  en sus ingredientes con gramos; si son mínimas, déjalas fuera.

---

## Si un alimento NO está en el catálogo

No inventes uno parecido. Escríbelo en la columna `nota` como **"NUEVO: descripción"** (ej.
*"NUEVO: crema de girasol"*) y déjame el renglón. Yo lo doy de alta con su valor real
(de una fuente confiable) y te confirmo. Así nunca metemos un dato inventado.

---

## Ejemplo de un platillo completo

| platillo | tiempo | alimento | gramos | nota |
|---|---|---|---|---|
| Alambre de Pollo | Comida | Pechuga de pollo sin piel | 200 | |
| Alambre de Pollo | Comida | Arroz cocido | 188 | |
| Alambre de Pollo | Comida | Queso Oaxaca | 30 | |
| Alambre de Pollo | Comida | Pimiento fresco | 50 | guarnición |

Esos 4 renglones = un platillo. El sistema suma sus macros solo.

**La columna `tiempo`** usa uno de estos valores: `Desayuno`, `Comida`, `Cena`,
`Snack AM`, `Snack PM`.

---

## Qué NO hacer (esto es lo que mete error)

- ❌ Escribir el alimento con tus palabras ("pollito a la plancha") en vez de copiar del catálogo.
- ❌ Poner cantidades caseras en la columna gramos ("1 taza", "½ pza").
- ❌ Inventar un alimento que no está en el catálogo.
- ❌ Juntar varios ingredientes en un solo renglón ("pollo con arroz y ensalada").

---

## Cómo me lo entregas

Llena **`PLANTILLA-PLATILLOS-v2.csv`** (puedes trabajarla en Excel o Google Sheets) con todos
los platillos que quieras — 30, 100, los que sean. Me la regresas y yo la cargo al sistema.
Meter o sacar platillos después es igual de fácil: es solo agregar o quitar renglones.

Cualquier duda de "¿cómo se llama X en el catálogo?" o "¿cuántos gramos son mi porción?",
me dices y te ayudo. 🙌
