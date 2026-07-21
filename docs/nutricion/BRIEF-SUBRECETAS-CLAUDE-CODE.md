# BRIEF — Cómo funcionan las SUB-RECETAS (HSC)

## El problema
En `PLATILLOS-HSC-final-7.csv`, una fila con `rol = sub-receta` se ve así:

```
Tacos de Carne Asada, ..., Guacamole, Guacamole, 80, , sub-receta, plato, ...
```

Esa fila **NO es un alimento del catálogo SMAE**. `Guacamole` no existe en SMAE. Si el motor
intenta buscarlo ahí, no lo encuentra y sus macros se pierden (o truena el cálculo).

## La solución: el archivo SUBRECETAS-HSC-v2.csv
Ese archivo define QUÉ HAY ADENTRO de cada sub-receta. Columnas:
`subreceta, alimento, nombre_visible, gramos, rol, nota`

Ejemplo — Guacamole:
| subreceta | alimento | gramos | rol |
|---|---|---|---|
| Guacamole | Aguacate Hass | 94 | principal |
| Guacamole | Jitomate bola | 40 | principal |
| Guacamole | Cebolla blanca rebanada | 20 | principal |
| Guacamole | Chile serrano | 8 | condimento |
| Guacamole | Limón | 5 | condimento |
| Guacamole | Sal | 1 | condimento |
| Guacamole | Chile cayena en polvo | 1 | condimento |

Esos SÍ son alimentos reales de SMAE.

## LA REGLA DE CÁLCULO (lo importante)

1. **Cada sub-receta RINDE un total** = la suma de los gramos de sus ingredientes.
   - Guacamole rinde **169g** (94+40+20+8+5+1+1)

2. **Cuando un platillo usa X gramos de la sub-receta, está usando una FRACCIÓN de la receta completa.**
   - `Tacos de Carne Asada` usa `Guacamole 80g`
   - Factor = 80 / 169 = **0.47**

3. **Los macros que aporta al platillo** = (macros de TODOS los ingredientes de la sub-receta) × factor.
   - O sea: se calculan los macros del guacamole completo (169g), y se multiplican por 0.47.

4. **Las sub-recetas NO ESCALAN.** Igual que `rol = fijo`: si el usuario tiene meta de 3000 kcal,
   el pollo sube pero el guacamole se queda en 80g. Cuentan en los macros, pero no crecen.

5. **Los `condimento` dentro de la sub-receta cuentan CERO** (sal, limón, especias), igual que
   en los platillos. Pero SÍ suman al rendimiento total en gramos.

## Pseudocódigo

```
function macrosDeSubreceta(nombreSubreceta, gramosUsados):
    ingredientes = SUBRECETAS.filter(s => s.subreceta == nombreSubreceta)
    rendimientoTotal = sum(ingredientes.gramos)          # ej. 169g
    factor = gramosUsados / rendimientoTotal              # ej. 80/169 = 0.47

    macros = {kcal:0, prot:0, grasa:0, hc:0}
    for ing in ingredientes:
        if ing.rol == 'condimento': continue              # cuenta cero
        m = SMAE.lookup(ing.alimento)                     # match exacto por texto
        macros += m.porGramo * ing.gramos * factor
    return macros
```

## Las 14 sub-recetas y su rendimiento

| Sub-receta | Ingredientes | Rinde |
|---|---|---|
| Salsa verde | 5 | 131g |
| Pico de gallo | 5 | 135g |
| Salsa roja | 5 | 322g |
| Guacamole | 7 | 169g |
| Glaseado de miel y soya | 6 | 52g |
| Aderezo Chipotle | 5 | 45g |
| Aderezo César | 7 | 208g |
| Salsa Tinga | 7 | 333g |
| Aderezo de hamburguesa | 5 | 56g |
| Chimichurri | 6 | 104g |
| Vinagreta Balsámica | 5 | 46g |
| Arepa | 2 | 61g |
| Aderezo Parmesano | 9 | 73g |
| **Salsa de naranja** (NUEVA) | 6 | 91g |

## Validación hecha
- Cero sub-recetas usadas en platillos que no estén definidas en SUBRECETAS. OK
- Todos los factores de uso son < 1 (ningún platillo usa más de lo que rinde la receta). OK
- `Aderezo Parmesano` está definido pero NO se usa en ningún platillo (dato, no error).

## OJO — Diferencia entre roles similares
- `fijo` = alimento único del catálogo que no escala (aceite, miel, mayonesa, aderezo de yogurt).
  Se busca directo en SMAE.
- `sub-receta` = mezcla de varios alimentos. NO está en SMAE. Hay que resolverla contra
  SUBRECETAS-HSC-v2.csv con la fórmula de arriba.

## En pantalla (UX)
La sub-receta se muestra con su `nombre_visible` y sus gramos (ej. "Guacamole — 80g").
NO hay que desglosarle los ingredientes al usuario, pero sí estaría bien poder abrir/expandir
la receta si quiere verla.
