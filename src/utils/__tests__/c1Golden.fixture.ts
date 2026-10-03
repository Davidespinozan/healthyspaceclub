// GENERADO MECÁNICAMENTE desde el código PRE-C1 (HEAD c219c57). NO editar a mano.
// Cada fila es el resultado EXACTO de `computeNutritionTargets` antes del seam.
import type { ObInput } from '../nutritionTargets';

/** `bmr|tdee|planGoal|floor|capped|wellnessMode|wellnessReason|protG|fatG|carbG|fiberG` */
export type GoldenRow = string;

export const C1_GOLDEN_CASES: readonly { readonly o: ObInput; readonly r: GoldenRow }[] = [
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1688|2616|2616|1688|0|1|menor|126|81|346|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1688|2616|2616|1688|0|1|menor|126|81|346|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1688|2616|2616|1688|0|1|menor|126|81|346|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1688|2616|2616|1688|0|1|menor|126|81|346|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1688|2616|2616|1688|0|1|menor|126|81|346|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1688|2616|2616|1688|0|1|menor|126|81|346|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1683|2609|2609|1683|0|1|menor|126|81|344|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1683|2609|2609|1683|0|1|menor|126|81|344|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1683|2609|2609|1683|0|1|menor|126|81|344|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1683|2609|2609|1683|0|1|menor|126|81|344|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1683|2609|2609|1683|0|1|menor|126|81|344|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1683|2609|2609|1683|0|1|menor|126|81|344|37"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1678|2601|2081|1678|0|0|-|154|51|252|29"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1678|2601|2913|1678|0|0|-|140|97|370|41"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1678|2601|2341|1678|0|0|-|140|65|299|33"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1678|2601|2601|1678|0|0|-|126|81|342|36"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1678|2601|2913|1678|0|0|-|140|97|370|41"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1678|2601|2601|1678|0|0|-|126|81|342|36"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1448|2244|1795|1500|0|0|-|154|44|196|25"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1448|2244|2513|1500|0|0|-|140|84|299|35"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1448|2244|2020|1500|0|0|-|140|56|239|28"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1448|2244|2244|1500|0|0|-|126|70|278|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1448|2244|2513|1500|0|0|-|140|84|299|35"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1448|2244|2244|1500|0|0|-|126|70|278|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1443|2237|2013|1500|0|0|-|154|49|239|28"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1443|2237|2505|1500|0|0|-|140|84|297|35"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1443|2237|2013|1500|0|0|-|140|56|237|28"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1443|2237|2237|1500|0|0|-|126|70|276|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1443|2237|2505|1500|0|0|-|140|84|297|35"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1443|2237|2237|1500|0|0|-|126|70|276|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1423|2206|1985|1500|0|0|-|154|49|232|28"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1423|2206|2471|1500|0|0|-|140|82|293|35"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1423|2206|1985|1500|0|0|-|140|55|233|28"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1423|2206|2206|1500|0|0|-|126|69|270|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1423|2206|2471|1500|0|0|-|140|82|293|35"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1423|2206|2206|1500|0|0|-|126|69|270|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1418|2198|2198|1500|0|1|adultoMayor|126|68|271|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1418|2198|2198|1500|0|1|adultoMayor|126|68|271|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1418|2198|2198|1500|0|1|adultoMayor|126|68|271|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1418|2198|2198|1500|0|1|adultoMayor|126|68|271|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1418|2198|2198|1500|0|1|adultoMayor|126|68|271|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1418|2198|2198|1500|0|1|adultoMayor|126|68|271|31"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1393|2159|2159|1500|0|1|adultoMayor|126|67|263|30"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1393|2159|2159|1500|0|1|adultoMayor|126|67|263|30"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1393|2159|2159|1500|0|1|adultoMayor|126|67|263|30"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1393|2159|2159|1500|0|1|adultoMayor|126|67|263|30"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1393|2159|2159|1500|0|1|adultoMayor|126|67|263|30"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1393|2159|2159|1500|0|1|adultoMayor|126|67|263|30"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1522|2359|2359|1522|0|1|menor|126|73|300|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1522|2359|2359|1522|0|1|menor|126|73|300|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1522|2359|2359|1522|0|1|menor|126|73|300|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1522|2359|2359|1522|0|1|menor|126|73|300|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1522|2359|2359|1522|0|1|menor|126|73|300|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 16,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1522|2359|2359|1522|0|1|menor|126|73|300|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1517|2351|2351|1517|0|1|menor|126|73|298|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1517|2351|2351|1517|0|1|menor|126|73|298|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1517|2351|2351|1517|0|1|menor|126|73|298|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1517|2351|2351|1517|0|1|menor|126|73|298|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1517|2351|2351|1517|0|1|menor|126|73|298|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 17,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1517|2351|2351|1517|0|1|menor|126|73|298|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1512|2344|1875|1512|0|0|-|154|46|211|26"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1512|2344|2625|1512|0|0|-|140|88|318|37"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1512|2344|2110|1512|0|0|-|140|59|255|30"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1512|2344|2344|1512|0|0|-|126|73|296|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1512|2344|2625|1512|0|0|-|140|88|318|37"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 18,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1512|2344|2344|1512|0|0|-|126|73|296|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1282|1987|1590|1282|0|0|-|154|42|149|22"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1282|1987|2225|1282|0|0|-|140|74|250|31"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1282|1987|1788|1282|0|0|-|140|50|195|25"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1282|1987|1987|1282|0|0|-|126|62|231|28"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1282|1987|2225|1282|0|0|-|140|74|250|31"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 64,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1282|1987|1987|1282|0|0|-|126|62|231|28"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1277|1979|1781|1277|0|0|-|154|44|192|25"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1277|1979|2216|1277|0|0|-|140|74|248|31"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1277|1979|1781|1277|0|0|-|140|49|195|25"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1277|1979|1979|1277|0|0|-|126|62|229|28"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1277|1979|2216|1277|0|0|-|140|74|248|31"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 65,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1277|1979|1979|1277|0|0|-|126|62|229|28"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1257|1948|1753|1257|0|0|-|154|43|188|25"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1257|1948|2182|1257|0|0|-|140|73|241|31"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1257|1948|1753|1257|0|0|-|140|49|188|25"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1257|1948|1948|1257|0|0|-|126|61|224|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1257|1948|2182|1257|0|0|-|140|73|241|31"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 69,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1257|1948|1948|1257|0|0|-|126|61|224|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1252|1941|1941|1252|0|1|adultoMayor|126|60|224|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1252|1941|1941|1252|0|1|adultoMayor|126|60|224|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1252|1941|1941|1252|0|1|adultoMayor|126|60|224|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1252|1941|1941|1252|0|1|adultoMayor|126|60|224|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1252|1941|1941|1252|0|1|adultoMayor|126|60|224|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 70,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1252|1941|1941|1252|0|1|adultoMayor|126|60|224|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1227|1902|1902|1227|0|1|adultoMayor|126|59|217|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1227|1902|1902|1227|0|1|adultoMayor|126|59|217|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1227|1902|1902|1227|0|1|adultoMayor|126|59|217|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1227|1902|1902|1227|0|1|adultoMayor|126|59|217|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1227|1902|1902|1227|0|1|adultoMayor|126|59|217|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 70,
      "estaturaCm": 170,
      "edad": 75,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1227|1902|1902|1227|0|1|adultoMayor|126|59|217|27"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Sedentaria",
      "goal": "Bajar grasa"
    },
    "r": "1768|2122|1768|1768|1|0|-|164|49|168|25"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Sedentaria",
      "goal": "Bajar grasa"
    },
    "r": "1327|1592|1327|1327|1|0|-|124|37|125|19"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Sedentaria",
      "goal": "Ganar músculo"
    },
    "r": "1768|2122|2377|1768|0|0|-|148|79|269|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Sedentaria",
      "goal": "Ganar músculo"
    },
    "r": "1327|1592|1783|1327|0|0|-|112|59|201|25"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Sedentaria",
      "goal": "Recomposición"
    },
    "r": "1768|2122|1910|1768|0|0|-|148|53|210|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Sedentaria",
      "goal": "Recomposición"
    },
    "r": "1327|1592|1433|1327|0|0|-|112|40|156|20"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Sedentaria",
      "goal": "Bienestar integral"
    },
    "r": "1768|2122|2122|1768|0|0|-|131|66|251|30"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Sedentaria",
      "goal": "Bienestar integral"
    },
    "r": "1327|1592|1592|1327|0|0|-|99|50|187|22"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Sedentaria",
      "goal": "Subir masa muscular"
    },
    "r": "1768|2122|2377|1768|0|0|-|148|79|269|33"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Sedentaria",
      "goal": "Subir masa muscular"
    },
    "r": "1327|1592|1783|1327|0|0|-|112|59|201|25"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Sedentaria",
      "goal": ""
    },
    "r": "1768|2122|2122|1768|0|0|-|131|66|251|30"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Sedentaria",
      "goal": ""
    },
    "r": "1327|1592|1592|1327|0|0|-|99|50|187|22"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Ligera",
      "goal": "Bajar grasa"
    },
    "r": "1768|2431|1945|1768|0|0|-|164|49|212|27"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Ligera",
      "goal": "Bajar grasa"
    },
    "r": "1327|1825|1460|1327|0|0|-|124|37|158|20"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Ligera",
      "goal": "Ganar músculo"
    },
    "r": "1768|2431|2723|1768|0|0|-|148|91|328|38"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Ligera",
      "goal": "Ganar músculo"
    },
    "r": "1327|1825|2044|1327|0|0|-|112|68|246|29"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Ligera",
      "goal": "Recomposición"
    },
    "r": "1768|2431|2188|1768|0|0|-|148|61|262|31"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Ligera",
      "goal": "Recomposición"
    },
    "r": "1327|1825|1643|1327|0|0|-|112|46|195|23"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Ligera",
      "goal": "Bienestar integral"
    },
    "r": "1768|2431|2431|1768|0|0|-|131|76|306|34"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Ligera",
      "goal": "Bienestar integral"
    },
    "r": "1327|1825|1825|1327|0|0|-|99|57|229|26"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Ligera",
      "goal": "Subir masa muscular"
    },
    "r": "1768|2431|2723|1768|0|0|-|148|91|328|38"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Ligera",
      "goal": "Subir masa muscular"
    },
    "r": "1327|1825|2044|1327|0|0|-|112|68|246|29"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Ligera",
      "goal": ""
    },
    "r": "1768|2431|2431|1768|0|0|-|131|76|306|34"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Ligera",
      "goal": ""
    },
    "r": "1327|1825|1825|1327|0|0|-|99|57|229|26"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1768|2740|2192|1768|0|0|-|180|54|247|31"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Moderada",
      "goal": "Bajar grasa"
    },
    "r": "1327|2057|1646|1327|0|0|-|136|40|186|23"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1768|2740|3069|1768|0|0|-|164|102|374|43"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Moderada",
      "goal": "Ganar músculo"
    },
    "r": "1327|2057|2304|1327|0|0|-|124|77|279|32"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1768|2740|2466|1768|0|0|-|164|69|297|35"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Moderada",
      "goal": "Recomposición"
    },
    "r": "1327|2057|1851|1327|0|0|-|124|51|224|26"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1768|2740|2740|1768|0|0|-|148|85|346|38"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Moderada",
      "goal": "Bienestar integral"
    },
    "r": "1327|2057|2057|1327|0|0|-|112|64|258|29"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1768|2740|3069|1768|0|0|-|164|102|374|43"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Moderada",
      "goal": "Subir masa muscular"
    },
    "r": "1327|2057|2304|1327|0|0|-|124|77|279|32"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1768|2740|2740|1768|0|0|-|148|85|346|38"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Moderada",
      "goal": ""
    },
    "r": "1327|2057|2057|1327|0|0|-|112|64|258|29"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Alta",
      "goal": "Bajar grasa"
    },
    "r": "1768|3050|2440|1768|0|0|-|197|60|278|34"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Alta",
      "goal": "Bajar grasa"
    },
    "r": "1327|2289|1831|1327|0|0|-|149|45|208|26"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Alta",
      "goal": "Ganar músculo"
    },
    "r": "1768|3050|3416|1768|0|0|-|180|114|418|48"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Alta",
      "goal": "Ganar músculo"
    },
    "r": "1327|2289|2564|1327|0|0|-|136|85|314|36"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Alta",
      "goal": "Recomposición"
    },
    "r": "1768|3050|2745|1768|0|0|-|180|76|335|38"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Alta",
      "goal": "Recomposición"
    },
    "r": "1327|2289|2060|1327|0|0|-|136|57|251|29"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Alta",
      "goal": "Bienestar integral"
    },
    "r": "1768|3050|3050|1768|0|0|-|164|95|385|43"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Alta",
      "goal": "Bienestar integral"
    },
    "r": "1327|2289|2289|1327|0|0|-|124|71|289|32"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Alta",
      "goal": "Subir masa muscular"
    },
    "r": "1768|3050|3416|1768|0|0|-|180|114|418|48"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Alta",
      "goal": "Subir masa muscular"
    },
    "r": "1327|2289|2564|1327|0|0|-|136|85|314|36"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Alta",
      "goal": ""
    },
    "r": "1768|3050|3050|1768|0|0|-|164|95|385|43"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Alta",
      "goal": ""
    },
    "r": "1327|2289|2289|1327|0|0|-|124|71|289|32"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Atleta",
      "goal": "Bajar grasa"
    },
    "r": "1768|3359|2687|1768|0|0|-|197|66|326|38"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Atleta",
      "goal": "Bajar grasa"
    },
    "r": "1327|2521|2017|1327|0|0|-|149|49|245|28"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Atleta",
      "goal": "Ganar músculo"
    },
    "r": "1768|3359|3762|1768|0|0|-|180|125|479|53"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Atleta",
      "goal": "Ganar músculo"
    },
    "r": "1327|2521|2824|1327|0|0|-|136|94|359|40"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Atleta",
      "goal": "Recomposición"
    },
    "r": "1768|3359|3023|1768|0|0|-|180|84|387|42"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Atleta",
      "goal": "Recomposición"
    },
    "r": "1327|2521|2269|1327|0|0|-|136|63|290|32"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Atleta",
      "goal": "Bienestar integral"
    },
    "r": "1768|3359|3359|1768|0|0|-|164|105|440|47"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Atleta",
      "goal": "Bienestar integral"
    },
    "r": "1327|2521|2521|1327|0|0|-|124|78|331|35"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Atleta",
      "goal": "Subir masa muscular"
    },
    "r": "1768|3359|3762|1768|0|0|-|180|125|479|53"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Atleta",
      "goal": "Subir masa muscular"
    },
    "r": "1327|2521|2824|1327|0|0|-|136|94|359|40"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 82,
      "estaturaCm": 178,
      "edad": 34,
      "activity": "Atleta",
      "goal": ""
    },
    "r": "1768|3359|3359|1768|0|0|-|164|105|440|47"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 62,
      "estaturaCm": 162,
      "edad": 29,
      "activity": "Atleta",
      "goal": ""
    },
    "r": "1327|2521|2521|1327|0|0|-|124|78|331|35"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 40,
      "estaturaCm": 170,
      "edad": 30,
      "activity": "Ligera",
      "goal": "Bajar grasa"
    },
    "r": "1152|1584|1584|1200|0|1|bajopeso|64|49|222|22"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 50,
      "estaturaCm": 190,
      "edad": 30,
      "activity": "Ligera",
      "goal": "Recomposición"
    },
    "r": "1543|2122|2122|1543|0|1|bajopeso|80|66|302|30"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 65,
      "estaturaCm": 165,
      "edad": 30,
      "activity": "Moderada",
      "goal": "Bajar grasa",
      "embarazo": true
    },
    "r": "1370|2124|2124|1370|0|1|embarazo|117|66|266|30"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 80,
      "estaturaCm": 178,
      "edad": 55,
      "activity": "Alta",
      "goal": "Bajar grasa",
      "conditions": [
        "renal"
      ]
    },
    "r": "1643|2834|2267|1643|0|0|-|80|55|363|32"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 75,
      "estaturaCm": 160,
      "edad": 72,
      "activity": "Alta",
      "goal": "Bajar grasa",
      "conditions": [
        "renal"
      ]
    },
    "r": "1229|2120|2120|1229|0|1|adultoMayor|75|66|307|30"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 90,
      "estaturaCm": 180,
      "edad": 30,
      "activity": "Moderada",
      "goal": "Bajar grasa",
      "grasa": 15
    },
    "r": "2022|3134|2507|2022|0|0|-|198|61|292|35"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 60,
      "estaturaCm": 160,
      "edad": 45,
      "activity": "Alta",
      "goal": "Ganar músculo",
      "grasa": 15
    },
    "r": "1472|2539|2844|1472|0|0|-|132|95|365|40"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 90,
      "estaturaCm": 180,
      "edad": 30,
      "activity": "Moderada",
      "goal": "Bajar grasa",
      "grasa": 30
    },
    "r": "1731|2683|2146|1731|0|0|-|198|54|217|30"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 60,
      "estaturaCm": 160,
      "edad": 45,
      "activity": "Alta",
      "goal": "Ganar músculo",
      "grasa": 30
    },
    "r": "1277|2203|2467|1277|0|0|-|132|82|300|35"
  },
  {
    "o": {
      "sexo": "Hombre",
      "pesoKg": 45,
      "estaturaCm": 150,
      "edad": 60,
      "activity": "Sedentaria",
      "goal": "Bajar grasa"
    },
    "r": "1093|1312|1500|1500|1|0|-|90|37|202|21"
  },
  {
    "o": {
      "sexo": "Mujer",
      "pesoKg": 40,
      "estaturaCm": 148,
      "edad": 60,
      "activity": "Sedentaria",
      "goal": "Bajar grasa"
    },
    "r": "864|1037|1200|1200|1|1|bajopeso|64|37|153|17"
  }
];

/** Barrido completo de 635040 combinaciones, reducido a un dígito FNV-1a estable. */
export const C1_GOLDEN_SWEEP_COUNT = 635040;
export const C1_GOLDEN_SWEEP_DIGEST = '9934729c';
