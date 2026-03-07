/* ─── Guía para Elegir Alimentos en el Supermercado ─── */

export interface FoodItem {
  name: string;
  best: string[];
  avoid: string[];
  tip?: string;
}

export interface FoodCategory {
  id: string;
  icon: string;
  title: string;
  items: FoodItem[];
}

export const foodGuideIntro = {
  title: '¿Cómo elegir productos en el supermercado?',
  paragraphs: [
    'En Healthy Space no creemos en alimentos "buenos" o "malos". Creemos en elecciones que se sienten bien en tu cuerpo, tu energía y tu mente.',
    'Esta guía existe para ayudarte a elegir con claridad qué productos comprar y qué versiones se adaptan mejor a tu estilo de vida, sin prohibiciones, sin culpa y sin obsesión.',
    'No es una lista rígida. Es un mapa suave para orientarte. Tú sigues eligiendo, nosotros solo te mostramos qué suele sentirse mejor.',
  ],
  howTo: [
    'Úsala cuando vayas al súper.',
    'No necesitas seguir TODO perfecto: elige lo que más te resuene.',
    'No se trata de "nunca más comer X", sino de conocer opciones mejores.',
    'Puedes leerla por secciones: lácteos, panes, proteínas, bebidas, etc.',
  ],
};

export const foodGuideCategories: FoodCategory[] = [
  /* ── LÁCTEOS ── */
  {
    id: 'lacteos',
    icon: '🥛',
    title: 'Lácteos',
    items: [
      {
        name: 'Yogurt',
        best: [
          'Yogur natural sin azúcar — Solo "leche + fermentos", evita picos de energía y antojos.',
          'Yogur griego light — Más proteína, te mantiene más satisfecha con menos cantidad.',
          'Skyr natural — El más alto en proteína y más denso nutricionalmente.',
          'Kéfir natural sin azúcar — Excelente para digestión y microbiota.',
        ],
        avoid: [
          'Yogures con azúcar añadida o sabores ("fresa", "durazno", etc.).',
          'Yogures con fruta añadida industrial.',
          'Yogures saborizados con jarabes.',
          'Yogures bebibles tipo Yakult (más azúcar que alimento).',
        ],
      },
      {
        name: 'Quesos',
        best: [
          'Panela — ligero y versátil.',
          'Oaxaca — buena opción moderada.',
          'Cottage — alto en proteína, bajo en grasa.',
          'Ricotta — suave y ligero.',
          'Mozzarella light — menos grasa, buen sabor.',
          'Feta — sabor intenso, poca cantidad rinde mucho.',
        ],
        avoid: [
          'Quesos procesados tipo "amarillo".',
          'Quesos untables industriales.',
        ],
        tip: 'Opciones más densas (Manchego, Cheddar, Gouda, Parmesano) — úsalas en poca cantidad. No son "malos", solo más densos en grasas saturadas.',
      },
      {
        name: 'Leche',
        best: [
          'Descremada.',
          'Semidescremada.',
          'Vegetal sin azúcar (almendra, avena, soya).',
        ],
        avoid: [
          'Leches saborizadas.',
          'Bebidas vegetales con azúcar o gomas espesantes.',
        ],
      },
    ],
  },

  /* ── CEREALES & PANES ── */
  {
    id: 'cereales',
    icon: '🌾',
    title: 'Cereales y Panes',
    items: [
      {
        name: 'Pan',
        best: [
          'Pan integral real (primer ingrediente: "harina integral").',
          'Pan de centeno.',
          'Pan de masa madre.',
          'Pan estilo rústico con pocos ingredientes.',
        ],
        avoid: [
          'Pan blanco muy suave.',
          'Brioche.',
          'Pan dulce.',
          'Pan de caja con azúcar añadida.',
        ],
        tip: 'Revisa que el primer ingrediente sea "harina integral", no solo que diga "integral" en el empaque.',
      },
      {
        name: 'Tortillas',
        best: [
          'Maíz — ingredientes simples (maíz, cal, agua), buena fibra y energía estable.',
          'Integral — maíz o trigo integral como primer ingrediente, excelente fibra.',
          'Nopal — más fibra, menos carbohidratos, ideal si buscas algo más ligero.',
          'Harina (moderada) — elige las de ingredientes simples (harina, agua, aceite, sal).',
        ],
        avoid: [
          'Tortillas de harina con manteca o grasas hidrogenadas.',
          'Tortillas "fit" con aceite como primer ingrediente.',
          'Listas de ingredientes kilométricas.',
          'Tortillas "proteína" que realmente son trigo + color verde.',
        ],
      },
      {
        name: 'Avena',
        best: [
          'Avena natural (hojuelas o rolada).',
          'Sin azúcar añadida.',
          'Sin saborizantes artificiales.',
        ],
        avoid: [
          '"Instant oatmeal" con listas largas de ingredientes.',
          'Avenas con azúcar añadida.',
          'Avenas saborizadas.',
        ],
      },
      {
        name: 'Arroz',
        best: [
          'Blanco — digestión fácil.',
          'Integral — más saciedad.',
          'Basmati — menor índice glucémico.',
          'Jazmín — más aromático.',
        ],
        avoid: [],
        tip: 'Todos valen. Elige según tu objetivo del momento.',
      },
      {
        name: 'Tostadas',
        best: [
          'Horneadas, no fritas.',
          'Listas cortas de ingredientes.',
          'Hechas solo con: maíz + sal + agua.',
          'Multigrano con semillas reales.',
        ],
        avoid: [
          'Tostadas fritas.',
          'Tostadas con aceites vegetales añadidos.',
          'Tostadas "saborizadas" con listas largas de químicos.',
        ],
      },
      {
        name: 'Pan Pita & Wraps',
        best: [
          'Pita integral real o tradicional con 4-5 ingredientes.',
          'Wraps con 5-7 ingredientes máximo.',
          'Wraps de avena o trigo simples.',
        ],
        avoid: [
          'Pita rellena de aceite o muy gruesa.',
          'Wraps "high protein" con 15 ingredientes.',
          'Wraps saborizados (espinaca, tomate industrial).',
        ],
      },
      {
        name: 'Panes Crujientes',
        best: [
          'Wasa / crispbread — 100% centeno, 3 ingredientes, súper estable.',
          'Galletas de arroz o maíz natural (solo arroz + sal).',
          'Crackers integrales sin aceites hidrogenados.',
        ],
        avoid: [
          'Crackers sabor queso.',
          'Crackers con azúcar.',
          'Crackers fritos.',
        ],
      },
      {
        name: 'Granola',
        best: [
          'Avena integral como base.',
          'Nueces o semillas reales.',
          'Aceite de coco, oliva o aguacate.',
          'Endulzada con miel, maple, monk fruit o muy poca azúcar.',
          '≥ 3 g de fibra por porción.',
        ],
        avoid: [
          'Jarabe de maíz.',
          'Aceite de palma o mezclas baratas.',
          'Harinas refinadas.',
          'Azúcar como primer ingrediente.',
          'Colorantes o saborizantes.',
        ],
        tip: 'Usa 2 cucharadas como topping o ¼ taza si es parte del desayuno completo. Una granola limpia tiene ingredientes que reconoces.',
      },
      {
        name: 'Cereales',
        best: [
          '≥ 3 g de fibra por porción.',
          '< 8 g de azúcar.',
          'Primer ingrediente: grano entero ("integral", "entero").',
          'Lista corta, sin colorantes.',
        ],
        avoid: [
          'Todo lo que diga "frosted", "chocolateado", "mielado".',
          'Cereal que manche la leche de colores.',
          '> 10 g de azúcar por porción.',
          'Azúcar como primer o segundo ingrediente.',
        ],
      },
    ],
  },

  /* ── PROTEÍNAS ── */
  {
    id: 'proteinas',
    icon: '🥩',
    title: 'Proteínas',
    items: [
      {
        name: 'Carnes',
        best: [
          'Pechuga de pollo.',
          'Pavo.',
          'Res magra (bola, lomo, sirloin, cuete).',
          'Pescado blanco (tilapia, merluza, bacalao).',
          'Salmón (más grasa buena).',
        ],
        avoid: [
          'Empanizados.',
          'Carnes frías procesadas (salchicha, chorizo, jamón industrial).',
          'Cortes muy grasos (ribeye, arrachera muy marmoleada).',
        ],
        tip: 'No son prohibidos; solo más densos o con más aditivos.',
      },
      {
        name: 'Jamón de Pavo',
        best: [
          '≥ 90% pechuga de pavo.',
          'Ingredientes mínimos: pavo, sal, especias (3-5 máximo).',
          '< 400-500 mg de sodio por porción.',
          'Pechuga de pavo natural en rebanadas gruesas.',
        ],
        avoid: [
          'Fécula, almidón o proteína vegetal (lo "rellenan").',
          'Carragenina, goma guar, goma xantana.',
          'Azúcar o jarabes.',
          'Saborizantes y colorantes.',
          'Jamón "tipo pavo" con < 50% carne real.',
        ],
        tip: 'Entre más corto el listado de ingredientes, mejor.',
      },
      {
        name: 'Legumbres',
        best: [
          'Garbanzo.',
          'Frijol entero.',
          'Lentejas.',
          'Soya / edamame.',
        ],
        avoid: [
          'Frijoles refritos con manteca.',
          'Hummus industrial con aceites procesados.',
        ],
        tip: 'Excelente fuente de proteína vegetal.',
      },
    ],
  },

  /* ── ACEITES ── */
  {
    id: 'aceites',
    icon: '🫒',
    title: 'Aceites y Grasas',
    items: [
      {
        name: 'Aceites Recomendados',
        best: [
          'Aceite de coco (refinado o virgen) — ideal para cocinar a alta temperatura, muy estable.',
          'Aceite de oliva extra virgen — rico en polifenoles, ideal crudo y salteos suaves.',
          'Ghee (mantequilla clarificada) — altísimo punto de humo, sabor delicado.',
          'Aceite de aguacate — muy rico en grasas monoinsaturadas, alto punto de humo, sabor neutro. ⭐ Favorito de tu nutrióloga.',
        ],
        avoid: [],
        tip: 'Busca: prensado en frío, envase oscuro, fecha reciente, 100% puro.',
      },
      {
        name: 'Aceites con Moderación',
        best: [
          'Aceite de girasol "alto oleico" — DEBE decir "alto oleico", sin este apellido no es estable al calor.',
        ],
        avoid: [
          'Aceite de maíz o mezclas "vegetales" — muchos omega-6 que se oxidan fácil.',
          'Aceite de linaza, chía, nuez o sésamo a temperaturas altas — se oxidan rápido.',
        ],
        tip: 'Aceites de linaza, chía, nuez y sésamo úsalos siempre en crudo: ensaladas, dips, encima de tostadas.',
      },
      {
        name: 'Crema de Nueces',
        best: [
          'Solo 1-2 ingredientes: la semilla (+ sal opcional). Nada más.',
          'Maní/cacahuate — más económica, más proteína, ideal para snacks y smoothies.',
          'Almendra — más baja en carbohidratos, rica en vitamina E, buena para control de glucosa.',
          'Nuez de la India (cashew) — cremosa, ideal para salsas y dips.',
          'Avellana — perfecta para antojos dulces, base de "nutella casera".',
        ],
        avoid: [
          'Aceite vegetal añadido (girasol, canola, soya, palma).',
          'Azúcar, miel, jarabe de maíz.',
          'Maltodextrina.',
          'Estabilizantes y gomas (mono y diglicéridos, goma guar, carragenina).',
        ],
        tip: 'Si la crema se separa (aceite arriba) es buena señal: significa que es 100% natural, sin estabilizantes.',
      },
    ],
  },

  /* ── VEGETALES & FRUTAS ── */
  {
    id: 'vegetales-frutas',
    icon: '🥦',
    title: 'Vegetales y Frutas',
    items: [
      {
        name: 'Vegetales',
        best: [
          'Más digestibles: calabacín, zanahoria cocida, espinaca cocida, champiñones, chayote, ejotes.',
          'Más fibra (te llenan más): brócoli, coliflor, col verde, col morada, espárragos.',
        ],
        avoid: [],
        tip: 'TODOS funcionan. Si tienes digestión sensible, evita crudos en exceso o coles muy fibrosas en la noche.',
      },
      {
        name: 'Frutas',
        best: [
          'Ligeras (menos dulces, buena saciedad): manzana, frutos rojos, kiwi, pera.',
          'Dulces (energía rápida): plátano, mango, uvas, piña.',
        ],
        avoid: [],
        tip: '¿Entrenaste? → Dulces. ¿Quieres saciedad? → Ligeras.',
      },
    ],
  },

  /* ── ENDULZANTES ── */
  {
    id: 'endulzantes',
    icon: '🍯',
    title: 'Endulzantes',
    items: [
      {
        name: 'Los Mejores (según evidencia)',
        best: [
          'Stevia (alta pureza, ≥ 95% rebaudiana) — casi sin impacto en glucosa, no afecta insulina.',
          'Monk fruit (fruta del monje) — dulzor limpio, cero impacto glucémico, no afecta microbiota. ⭐ Fav de la nutrióloga.',
          'Eritritol — casi no se absorbe, no eleva glucosa, ideal para hornear (moderación si eres sensible).',
        ],
        avoid: [],
      },
      {
        name: 'Opcionales (útiles pero no perfectos)',
        best: [
          'Xilitol — no eleva mucho la glucosa, buen sabor, beneficioso para salud dental. Puede dar gases en algunas personas.',
          'Miel, maple, panela, dátil — naturales, antioxidantes, sabor profundo. Ideales para un postre consciente, no uso diario.',
        ],
        avoid: [],
      },
      {
        name: 'NO Recomendados',
        best: [],
        avoid: [
          'Sucralosa — puede alterar microbiota y reducir sensibilidad al dulzor.',
          'Aspartame — se asocia a más antojos e inflamación crónica leve.',
          'Acesulfame-K — sabor químico, siempre en ultraprocesados, no aporta beneficios.',
        ],
        tip: 'Si abusas de edulcorantes, tu umbral de dulzor sube y necesitas cada vez más. La clave es usarlos con consciencia.',
      },
    ],
  },

  /* ── MERMELADAS ── */
  {
    id: 'mermeladas',
    icon: '🍓',
    title: 'Mermeladas',
    items: [
      {
        name: 'Cómo Elegir',
        best: [
          'Fruta real como primer ingrediente.',
          'Lista corta: 3-5 ingredientes máximo.',
          'Sin colorantes.',
          'Sin jarabes ni saborizantes.',
          'Dulzor suave, no artificial.',
        ],
        avoid: [
          'Jarabe de maíz o concentrados "sabor a fruta".',
          'Colorantes rojos o azules.',
          'Maltodextrina.',
          'Gomas en exceso (goma guar, carragenina).',
          'Aceites añadidos.',
          'Azúcar o jarabe de glucosa como primer ingrediente.',
        ],
      },
      {
        name: 'Mermeladas Sin Azúcar',
        best: [
          'Con monk fruit, stevia pura o eritritol como edulcorante.',
          'Máximo 5-7 ingredientes.',
        ],
        avoid: [
          'Con sucralosa, acesulfame-K o aspartame.',
          'Más de 7 ingredientes.',
        ],
        tip: 'Receta casera en 3 min: fruta picada + gotas de limón en sartén a fuego bajo, machaca y endulza con monk fruit.',
      },
    ],
  },
];
