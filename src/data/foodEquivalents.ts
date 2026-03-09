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

/* ─── Sistema Mexicano de Equivalentes — 4ª Edición ─── */

export interface SmeFood {
  name: string;
  amount: string;
}

export interface SmeSubgroup {
  name: string;
  kcal: number;
  cho: number;
  prot: number;
  fat: number;
  foods: SmeFood[];
}

export interface SmeGroup {
  id: string;
  icon: string;
  label: string;
  color: string;
  note: string;
  subgroups: SmeSubgroup[];
}

export const smeGroups: SmeGroup[] = [
  {
    id: 'verduras',
    icon: '🥬',
    label: 'Verduras',
    color: '#4caf50',
    note: '1 equivalente = ½ taza cocida ó 1 taza cruda. Son de libre consumo; úsalas para dar volumen, fibra y micronutrientes a tus comidas.',
    subgroups: [
      {
        name: 'Todas las verduras',
        kcal: 25, cho: 4, prot: 2, fat: 0,
        foods: [
          { name: 'Acelgas',          amount: '½ tz cocidas / 1 tz crudas' },
          { name: 'Apio',             amount: '1 tz crudo' },
          { name: 'Betabel',          amount: '½ tz cocido' },
          { name: 'Brócoli',          amount: '½ tz cocido' },
          { name: 'Calabaza',         amount: '½ tz cocida' },
          { name: 'Cebolla',          amount: '½ tz' },
          { name: 'Champiñones',      amount: '1 tz crudos' },
          { name: 'Chayote',          amount: '½ tz cocido' },
          { name: 'Chile poblano',    amount: '1 pieza mediana' },
          { name: 'Col / Repollo',    amount: '1 tz cruda' },
          { name: 'Coliflor',         amount: '½ tz cocida' },
          { name: 'Ejotes',           amount: '½ tz cocidos' },
          { name: 'Espárragos',       amount: '½ tz cocidos (5 piezas)' },
          { name: 'Espinacas',        amount: '1 tz crudas / ½ tz cocidas' },
          { name: 'Jitomate',         amount: '1 tz crudo' },
          { name: 'Jícama',           amount: '1 tz cruda' },
          { name: 'Lechuga',          amount: '2 tz crudas' },
          { name: 'Nopal',            amount: '½ tz cocido' },
          { name: 'Pepino',           amount: '1 tz crudo' },
          { name: 'Pimiento',         amount: '1 tz crudo' },
          { name: 'Zanahoria',        amount: '½ tz cocida / 1 tz cruda' },
        ],
      },
    ],
  },
  {
    id: 'frutas',
    icon: '🍎',
    label: 'Frutas',
    color: '#e91e63',
    note: '1 equivalente aporta ~15 g de carbohidratos y 60 kcal. Prefiere la fruta entera sobre jugos para conservar la fibra.',
    subgroups: [
      {
        name: 'Todas las frutas',
        kcal: 60, cho: 15, prot: 0, fat: 0,
        foods: [
          { name: 'Ciruela',     amount: '2 pz medianas (100g)' },
          { name: 'Durazno',     amount: '1 pz mediana (115g)' },
          { name: 'Fresa',       amount: '1 tz (150g)' },
          { name: 'Guayaba',     amount: '1 pz grande (90g)' },
          { name: 'Kiwi',        amount: '1 pz grande (90g)' },
          { name: 'Mandarina',   amount: '1 pz mediana (130g)' },
          { name: 'Mango',       amount: '½ tz picado (85g)' },
          { name: 'Manzana',     amount: '1 pz pequeña (90g)' },
          { name: 'Melón',       amount: '¾ tz (120g)' },
          { name: 'Naranja',     amount: '1 pz mediana (130g)' },
          { name: 'Papaya',      amount: '1 tz (150g)' },
          { name: 'Pera',        amount: '1 pz pequeña (100g)' },
          { name: 'Piña',        amount: '¾ tz (120g)' },
          { name: 'Plátano',     amount: '½ pz mediana (60g)' },
          { name: 'Sandía',      amount: '1 tz (160g)' },
          { name: 'Uvas',        amount: '½ tz / 15 pz (80g)' },
        ],
      },
    ],
  },
  {
    id: 'cereales',
    icon: '🌾',
    label: 'Cereales y Tubérculos',
    color: '#ff9800',
    note: 'Las porciones son de alimento cocido o listo para comer. Los que contienen grasa adicionada aportan casi el doble de calorías.',
    subgroups: [
      {
        name: 'Sin grasa adicionada',
        kcal: 70, cho: 15, prot: 2, fat: 0,
        foods: [
          { name: 'Arroz cocido',           amount: '⅓ taza (60g)' },
          { name: 'Avena cocida',           amount: '½ taza (120g)' },
          { name: 'Avena cruda',            amount: '¼ taza (20g)' },
          { name: 'Bolillo',                amount: '¼ pieza (25g)' },
          { name: 'Camote cocido',          amount: '½ pieza pequeña (75g)' },
          { name: 'Cereal sin azúcar',      amount: '¾ taza (20g)' },
          { name: 'Elote en grano',         amount: '½ taza (75g)' },
          { name: 'Galletas integrales',    amount: '5 piezas (20g)' },
          { name: 'Palomitas sin aceite',   amount: '3 tazas (24g)' },
          { name: 'Pan integral',           amount: '1 rebanada (25g)' },
          { name: 'Papa cocida',            amount: '½ pieza mediana (90g)' },
          { name: 'Pasta cocida',           amount: '⅓ taza (55g)' },
          { name: 'Tortilla de maíz',       amount: '1 pieza (30g)' },
          { name: 'Tostada horneada',       amount: '2 piezas (20g)' },
        ],
      },
      {
        name: 'Con grasa adicionada',
        kcal: 115, cho: 15, prot: 2, fat: 5,
        foods: [
          { name: 'Croissant',                  amount: '½ pieza (25g)' },
          { name: 'Galletas de mantequilla',    amount: '3 piezas (25g)' },
          { name: 'Hot cake / panqué pequeño',  amount: '1 pieza pequeña (35g)' },
          { name: 'Pan dulce',                  amount: '½ pieza (35g)' },
          { name: 'Tortilla de harina con grasa', amount: '1 pieza pequeña (30g)' },
          { name: 'Waffle',                     amount: '1 pieza pequeña (35g)' },
        ],
      },
    ],
  },
  {
    id: 'leguminosas',
    icon: '🫘',
    label: 'Leguminosas',
    color: '#795548',
    note: 'Al combinar leguminosas + cereales obtienes una proteína completa comparable a la de origen animal. Excelente fuente de fibra y hierro.',
    subgroups: [
      {
        name: 'Todas las leguminosas',
        kcal: 120, cho: 20, prot: 8, fat: 1,
        foods: [
          { name: 'Edamame cocido',          amount: '½ taza (90g)' },
          { name: 'Frijoles cocidos',        amount: '½ taza (90g)' },
          { name: 'Garbanzos cocidos',       amount: '½ taza (82g)' },
          { name: 'Habas cocidas',           amount: '½ taza (90g)' },
          { name: 'Lentejas cocidas',        amount: '½ taza (90g)' },
          { name: 'Soya cocida / Tofu firme', amount: '¼ taza (50g)' },
        ],
      },
    ],
  },
  {
    id: 'aoa',
    icon: '🥩',
    label: 'Alimentos de Origen Animal',
    color: '#b71c1c',
    note: 'Todos aportan ~7g de proteína por equivalente (30g / 1 oz). La diferencia está en el contenido de grasa saturada.',
    subgroups: [
      {
        name: 'Muy bajo aporte de grasa',
        kcal: 40, cho: 0, prot: 7, fat: 1,
        foods: [
          { name: 'Atún en agua',               amount: '30g (¼ taza escurrido)' },
          { name: 'Camarón cocido',             amount: '5 pz grandes (30g)' },
          { name: 'Clara de huevo',             amount: '3 claras (90g)' },
          { name: 'Pechuga de pollo sin piel',  amount: '30g (1 oz)' },
          { name: 'Pechuga de pavo sin piel',   amount: '30g (1 oz)' },
          { name: 'Pescado blanco cocido',      amount: '30g (1 oz)' },
          { name: 'Queso cottage light',        amount: '¼ taza (60g)' },
          { name: 'Yogur griego 0% grasa',      amount: '¼ taza (60g)' },
        ],
      },
      {
        name: 'Bajo aporte de grasa',
        kcal: 55, cho: 0, prot: 7, fat: 3,
        foods: [
          { name: 'Atún en aceite (bien escurrido)', amount: '30g (1 oz)' },
          { name: 'Huevo entero',                    amount: '1 pieza (50g)' },
          { name: 'Lomo de cerdo',                   amount: '30g (1 oz)' },
          { name: 'Queso panela',                    amount: '40g' },
          { name: 'Res magra (lomo, filete)',         amount: '30g (1 oz)' },
          { name: 'Rosticería muslo sin piel',        amount: '30g (1 oz)' },
          { name: 'Sardinas en agua',                amount: '30g (1 oz)' },
        ],
      },
      {
        name: 'Moderado aporte de grasa',
        kcal: 75, cho: 0, prot: 7, fat: 5,
        foods: [
          { name: 'Bistec de res',          amount: '30g (1 oz)' },
          { name: 'Chuleta de cerdo',       amount: '30g (1 oz)' },
          { name: 'Jamón de pierna',        amount: '45g (1½ oz)' },
          { name: 'Muslo de pollo sin piel', amount: '30g (1 oz)' },
          { name: 'Queso mozzarella',       amount: '30g (1 oz)' },
          { name: 'Queso Oaxaca',           amount: '30g (1 oz)' },
          { name: 'Salchicha de pavo',      amount: '1 pieza (45g)' },
        ],
      },
      {
        name: 'Alto aporte de grasa',
        kcal: 100, cho: 0, prot: 7, fat: 8,
        foods: [
          { name: 'Carne molida regular',         amount: '30g (1 oz)' },
          { name: 'Chorizo',                      amount: '25g' },
          { name: 'Costilla de cerdo',            amount: '30g (1 oz)' },
          { name: 'Queso amarillo / manchego',    amount: '30g (1 oz)' },
          { name: 'Salchicha de cerdo',           amount: '1 pieza (45g)' },
          { name: 'Tocino',                       amount: '1 rebanada (15g)' },
        ],
      },
    ],
  },
  {
    id: 'lacteos',
    icon: '🥛',
    label: 'Leche y Derivados',
    color: '#2196f3',
    note: '1 taza (240 ml) es la base del equivalente líquido. Para yogur la porción es mayor por su mayor densidad.',
    subgroups: [
      {
        name: 'Descremada (0–2% grasa)',
        kcal: 95, cho: 12, prot: 9, fat: 2,
        foods: [
          { name: 'Leche descremada líquida',      amount: '1 taza (240 ml)' },
          { name: 'Leche descremada en polvo',     amount: '4 cdas (25g)' },
          { name: 'Yogur natural descremado',      amount: '¾ taza (180g)' },
          { name: 'Yogur griego bajo en grasa',    amount: '½ taza (120g)' },
        ],
      },
      {
        name: 'Semidescremada (2–5% grasa)',
        kcal: 125, cho: 12, prot: 9, fat: 5,
        foods: [
          { name: 'Leche semidescremada',          amount: '1 taza (240 ml)' },
          { name: 'Leche de soya sin azúcar',      amount: '1 taza (240 ml)' },
          { name: 'Yogur natural semidescremado',  amount: '¾ taza (180g)' },
        ],
      },
      {
        name: 'Entera (>5% grasa)',
        kcal: 150, cho: 12, prot: 9, fat: 8,
        foods: [
          { name: 'Leche entera líquida',    amount: '1 taza (240 ml)' },
          { name: 'Leche entera en polvo',   amount: '4 cdas (30g)' },
          { name: 'Yogur natural entero',    amount: '¾ taza (180g)' },
        ],
      },
    ],
  },
  {
    id: 'aceites',
    icon: '🫒',
    label: 'Aceites y Grasas',
    color: '#ffc107',
    note: '1 cdita (5 ml) = 1 equivalente sin proteína. Las grasas con proteína (nueces, semillas, aguacate) aportan ~3g extra de proteína y carbohidratos.',
    subgroups: [
      {
        name: 'Sin proteína',
        kcal: 45, cho: 0, prot: 0, fat: 5,
        foods: [
          { name: 'Aceite de canola / girasol / maíz', amount: '1 cdita (5 ml)' },
          { name: 'Aceite de oliva',                   amount: '1 cdita (5 ml)' },
          { name: 'Aderezo para ensalada',             amount: '1 cucharada (15 ml)' },
          { name: 'Crema de leche',                    amount: '1 cucharada (15g)' },
          { name: 'Mantequilla',                       amount: '1 cdita (5g)' },
          { name: 'Mayonesa',                          amount: '1 cdita (5g)' },
        ],
      },
      {
        name: 'Con proteína (frutos secos y aguacate)',
        kcal: 70, cho: 3, prot: 3, fat: 5,
        foods: [
          { name: 'Aguacate',                    amount: '⅓ pieza / 2 cdas (50g)' },
          { name: 'Almendras',                   amount: '7 piezas (15g)' },
          { name: 'Cacahuate',                   amount: '15 piezas (15g)' },
          { name: 'Crema de cacahuate natural',  amount: '1 cucharada (15g)' },
          { name: 'Nuez',                        amount: '4 mitades (15g)' },
          { name: 'Pistache',                    amount: '15 piezas (15g)' },
          { name: 'Semillas de girasol',         amount: '2 cdas (15g)' },
          { name: 'Ajonjolí',                    amount: '2 cdas (15g)' },
          { name: 'Aceitunas',                   amount: '8 piezas (50g)' },
        ],
      },
    ],
  },
  {
    id: 'azucares',
    icon: '🍯',
    label: 'Azúcares',
    color: '#9c27b0',
    note: 'Aportan energía de absorción rápida. Úsalos con moderación; en este sistema se incluyen para reconocerlos, no para promoverlos.',
    subgroups: [
      {
        name: 'Sin grasa adicionada',
        kcal: 40, cho: 10, prot: 0, fat: 0,
        foods: [
          { name: 'Azúcar blanca o morena', amount: '2 cditas (10g)' },
          { name: 'Cajeta',                 amount: '1 cucharada (15g)' },
          { name: 'Miel de abeja',          amount: '2 cditas (14g)' },
          { name: 'Mermelada',              amount: '1 cucharada (20g)' },
          { name: 'Piloncillo rallado',     amount: '1 cucharada (12g)' },
        ],
      },
      {
        name: 'Con grasa adicionada',
        kcal: 85, cho: 10, prot: 0, fat: 5,
        foods: [
          { name: 'Chocolate oscuro (≥70%)', amount: '½ oz (15g)' },
          { name: 'Galleta de mantequilla',  amount: '1 pieza grande (12g)' },
          { name: 'Granola',                 amount: '¼ taza (30g)' },
        ],
      },
    ],
  },
];
