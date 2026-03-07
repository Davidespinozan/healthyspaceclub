/* ─── Alimentos Equivalentes ─── */

export interface FoodGroupSymbol {
  id: string;
  icon: string;
  label: string;
  color: string;
}

export const foodGroupSymbols: FoodGroupSymbol[] = [
  { id: 'verduras',     icon: '🥬', label: 'Verduras',          color: '#4caf50' },
  { id: 'frutas',       icon: '🍎', label: 'Frutas',            color: '#e91e63' },
  { id: 'cereales',     icon: '🌾', label: 'Cereales',          color: '#ff9800' },
  { id: 'proteinas',    icon: '🥩', label: 'Proteínas',         color: '#b71c1c' },
  { id: 'leguminosas',  icon: '🫘', label: 'Leguminosas',       color: '#795548' },
  { id: 'lacteos',      icon: '🥛', label: 'Lácteos',           color: '#2196f3' },
  { id: 'aceites',      icon: '🫒', label: 'Aceites y Grasas',  color: '#ffc107' },
  { id: 'grasa-prot',   icon: '🥜', label: 'Grasa con Proteína', color: '#9c27b0' },
];

export const equivalentDefinition = {
  title: '¿Qué es un Alimento Equivalente?',
  text: 'Es aquella porción (o ración) de alimento cuyo aporte nutrimental es similar a los de su mismo grupo en calidad y en cantidad, lo que permite que puedan ser intercambiables entre sí.',
  example: 'Por ejemplo, 1 manzana y ½ plátano corresponden ambos a 1 equivalente de fruta, y por lo tanto contienen el mismo aporte nutricional.',
};

export const equivalentBenefits = [
  'Armar un plan con tus porciones.',
  'Conocer los diferentes grupos de alimentos.',
  'Cambiar un alimento por otro con el mismo valor nutricional.',
  'No abandonar el plan en caso de no encontrar algún alimento, alergias, intolerancias o para sustituir alimentos que no sean de tu agrado.',
];

export interface EquivalentExample {
  title: string;
  optionA: { name: string; desc: string };
  optionB: { name: string; desc: string };
  equivalences: string[];
  note: string;
}

export const equivalentExample: EquivalentExample = {
  title: 'Ejemplo: Mismo equivalente, distinta receta',
  optionA: {
    name: 'Tacos de pollo',
    desc: 'En 2 pz de tortillas agrega ⅓ de aguacate + 90 gr de pechuga de pollo a la plancha + pico de gallo.',
  },
  optionB: {
    name: 'Sandwich de atún',
    desc: 'Mezcla 1 lata de atún en agua + 1 cda de mayonesa + lechuga y pepino picado. Acompaña con 2 pz de pan tostado.',
  },
  equivalences: [
    '🥩 Proteína ×3 → 90 gr de pechuga de pollo = 1 lata de atún en agua',
    '🌾 Cereales ×2 → 2 pz de tortillas = 2 piezas de pan tostado',
    '🫒 Grasa ×1 → ⅓ de pz de aguacate = 1 cda de mayonesa',
    '🥬 Verduras libres → Solo se intercambian por las de tu preferencia',
  ],
  note: 'Puedes hacer los cambios que quieras según tus gustos, antojos, intolerancias, siempre y cuando respetes tus equivalentes.',
};

export interface FoodGroupExchange {
  from: string;
  to: string;
}

export const foodGroupExchanges: FoodGroupExchange[] = [
  { from: '1 cereal',                                to: '1 fruta' },
  { from: '1 azúcar',                                to: '1 fruta' },
  { from: '1 grasa sin proteína',                    to: '1 grasa con proteína' },
  { from: '1 lácteo (con <5 g de carbohidratos)',    to: '1 proteína' },
  { from: '1 scoop de proteína',                     to: '2 proteínas' },
  { from: '1 leguminosa',                            to: '1 cereal + 1 proteína' },
];

export const exchangeNote = 'Este intercambio hace referencia a quitar y/o agregar un grupo de alimento por otro, con un valor calórico y nutricional aproximado. No es recomendable hacerlo diario, solo en ocasiones especiales, ya que estos intercambios no son 100% equivalentes.';
