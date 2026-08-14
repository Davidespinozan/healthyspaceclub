// ════════════════════════════════════════════════════════════════
// EXPANSIÓN BACKLOG — PENDIENTE DE GRABAR
// Ejercicios/variantes nuevos SIN video conectado. Producción sigue video-gated:
// como ninguno de estos ids está en VIDEO_VARIANT_IDS, hasPlayableVariant() los
// excluye de selección/anchors/slots/superseries/cardio/player/fallback. Aparecen
// SOLO en la página interna de producción de videos (/videos-review.html) para
// grabarlos. Cuando su video se conecte (migración → VIDEO_VARIANT_IDS), pasan a
// producción automáticamente sin tocar el motor.
//
// Todo se aísla aquí y se fusiona en exercises.ts:
//   · BACKLOG_EXERCISES  → patrones nuevos (bases nuevas).
//   · BACKLOG_VARIANTS   → variantes nuevas que cuelgan de un patrón EXISTENTE (por id).
// El merge en exercises.ts recalcula equipment = unión de variantes (invariante).
// ════════════════════════════════════════════════════════════════
import type { Exercise, ExerciseVariant, Equipment, MuscleGroup } from '../types';

// ── Helpers de variante (reducen boilerplate, tipado estricto) ──────────────
/** Variante de TAPETE puro (piso, sin infraestructura). matOnly = true. */
const mat = (id: string, name: string, notes: string, extra: Partial<ExerciseVariant> = {}): ExerciseVariant =>
  ({ id, name, equipment: ['cuerpo'], matOnly: true, difficulty: 'principiante', notes, ...extra });
/** Variante de peso corporal que REQUIERE soporte (barra/banco/pared/step). matOnly = false. */
const support = (id: string, name: string, notes: string, extra: Partial<ExerciseVariant> = {}): ExerciseVariant =>
  ({ id, name, equipment: ['cuerpo'], matOnly: false, difficulty: 'intermedio', notes, ...extra });
/** Variante con banda/liga. */
const band = (id: string, name: string, notes: string, extra: Partial<ExerciseVariant> = {}): ExerciseVariant =>
  ({ id, name, equipment: ['ligas'], matOnly: false, difficulty: 'principiante', notes, ...extra });
/** Variante de gimnasio (implemento/aparato). */
const gym = (id: string, name: string, notes: string, extra: Partial<ExerciseVariant> = {}): ExerciseVariant =>
  ({ id, name, equipment: ['gym'], matOnly: false, difficulty: 'intermedio', notes, ...extra });
/** Marca hold isométrico: se prescribe por tiempo (segundos), no reps. */
const HOLD = (reps: string): Partial<ExerciseVariant> => ({ prescriptionType: 'time', defaultReps: reps });

const stepsGeneric = [
  { title: 'Posición', desc: 'Colócate con la técnica descrita en el nombre de la variante.' },
  { title: 'Ejecución', desc: 'Realiza el movimiento de forma controlada, sin perder la postura.' },
  { title: 'Respiración', desc: 'Exhala en el esfuerzo; mantén el core activo todo el rango.' },
];

// ── Bases nuevas (patrones nuevos) ──────────────────────────────────────────
// helper: arma un Exercise con defaults y equipment = unión de sus variantes.
function mkBase(o: {
  id: string; name: string; desc: string; muscleGroup: MuscleGroup; secondaryMuscles?: MuscleGroup[];
  type: Exercise['type']; difficulty: Exercise['difficulty']; movementPattern: string; exerciseRole: string;
  goals?: Exercise['goals']; impact?: Exercise['impact']; fallRisk?: boolean; matOnly?: boolean;
  cardioStyle?: Exercise['cardioStyle']; prescriptionType?: 'reps' | 'time';
  defaultReps?: string; defaultSets?: number; defaultRest?: number; tip?: string; variants: ExerciseVariant[];
}): Exercise {
  const equipment = [...new Set(o.variants.flatMap((v) => v.equipment))] as Equipment[];
  return {
    id: o.id, name: o.name, desc: o.desc, muscleGroup: o.muscleGroup, secondaryMuscles: o.secondaryMuscles,
    equipment, goals: o.goals ?? ['fuerza', 'condicion'], type: o.type, difficulty: o.difficulty,
    movementPattern: o.movementPattern, exerciseRole: o.exerciseRole,
    ...(o.impact ? { impact: o.impact } : {}), ...(o.fallRisk ? { fallRisk: true } : {}),
    ...(o.matOnly !== undefined ? { matOnly: o.matOnly } : {}),
    ...(o.cardioStyle ? { cardioStyle: o.cardioStyle } : {}),
    ...(o.prescriptionType ? { prescriptionType: o.prescriptionType } : {}),
    defaultSets: o.defaultSets ?? 3, defaultReps: o.defaultReps ?? '10-15', defaultRest: o.defaultRest ?? 45,
    steps: stepsGeneric, ...(o.tip ? { tip: o.tip } : {}), variants: o.variants,
    category: `${o.defaultSets ?? 3} series`, bg: 'linear-gradient(135deg,#EAE3D2,#D7CDB9)',
  };
}

export const BACKLOG_EXERCISES: Exercise[] = [
  mkBase({
    id: 'pseudo-planche', name: 'Pseudo Planche', desc: 'Empuje con hombros adelantados sobre las manos — fuerza de empuje y control escapular avanzado.',
    muscleGroup: 'pecho', secondaryMuscles: ['hombros', 'triceps', 'core'], type: 'compuesto', difficulty: 'avanzado',
    movementPattern: 'horizontal-push', exerciseRole: 'secondary', matOnly: true,
    tip: 'Inclina los hombros por delante de las muñecas — ahí está la dificultad, no en bajar más.',
    variants: [
      mat('pseudo-planche-lean', 'Inclinación (hold)', 'Isométrico en plancha con hombros adelantados — base de fuerza para la planche.', { isDefault: true, ...HOLD('15-30 seg') }),
      mat('pseudo-planche-push-up', 'Flexión pseudo planche', 'Flexión con manos a la cadera y hombros adelantados — empuje muy exigente.', { difficulty: 'avanzado' }),
    ],
  }),
  mkBase({
    id: 'dead-bug', name: 'Dead Bug', desc: 'Anti-extensión en el piso alternando brazo y pierna opuestos — control lumbopélvico.',
    muscleGroup: 'core', type: 'activacion', difficulty: 'principiante',
    movementPattern: 'core-anti-extension', exerciseRole: 'isolation', matOnly: true,
    tip: 'La zona lumbar NO debe despegarse del piso — si se arquea, baja menos la pierna.',
    variants: [
      mat('dead-bug-clasico', 'Dead bug', 'Boca arriba, extiende brazo y pierna contrarios sin arquear la espalda.', { isDefault: true, defaultReps: '8-12 por lado' }),
      mat('dead-bug-hold', 'Dead bug (hold)', 'Sostén brazo y pierna extendidos manteniendo la lumbar pegada.', HOLD('20-40 seg')),
    ],
  }),
  mkBase({
    id: 'plancha-dinamica', name: 'Plancha Dinámica', desc: 'Familia de planchas con movimiento — anti-extensión y anti-rotación con demanda de hombro.',
    muscleGroup: 'core', secondaryMuscles: ['hombros'], type: 'activacion', difficulty: 'intermedio',
    movementPattern: 'core-anti-extension', exerciseRole: 'isolation', matOnly: true,
    tip: 'La cadera no debe rotar ni hundirse — pies un poco más abiertos = más estabilidad.',
    variants: [
      mat('plancha-shoulder-taps', 'Toques de hombro', 'En plancha alta, toca el hombro contrario alternando sin girar la cadera.', { isDefault: true, defaultReps: '10-16' }),
      mat('plancha-knee-drive', 'Rodilla al pecho', 'En plancha alta, lleva una rodilla al pecho alternando (mountain climber lento).', { defaultReps: '10-16' }),
      mat('plank-walk', 'Plancha caminando', 'Baja de plancha alta a antebrazos y sube, alternando el brazo que inicia.', { defaultReps: '8-12' }),
      mat('walkout', 'Walkout', 'De pie, camina con las manos hasta plancha y regresa.', { defaultReps: '6-10' }),
      mat('bear-plank', 'Plancha del oso (hold)', 'Cuadrupedia con rodillas 5 cm del piso, espalda plana.', HOLD('20-40 seg')),
      mat('bear-plank-shoulder-taps', 'Oso + toques de hombro', 'Desde plancha del oso, toca hombro contrario sin mover la cadera.', { difficulty: 'intermedio', defaultReps: '10-16' }),
    ],
  }),
  mkBase({
    id: 'activacion-escapular-prona', name: 'Activación Escapular Prona', desc: 'Elevaciones boca abajo (Y/T/W) para retracción escapular y deltoides posterior — trabajo de espalda SIN barra.',
    muscleGroup: 'espalda', secondaryMuscles: ['hombros'], type: 'activacion', difficulty: 'principiante',
    movementPattern: 'rear-delt', exerciseRole: 'isolation', matOnly: true,
    tip: 'No es un sustituto de una tracción real (no hay carga vertical) — es activación postural y de escápula.',
    variants: [
      mat('prone-y-raise', 'Elevación en Y', 'Boca abajo, brazos en Y, elévalos apretando las escápulas.', { isDefault: true, defaultReps: '12-15' }),
      mat('prone-t-raise', 'Elevación en T', 'Boca abajo, brazos en cruz (T), elévalos juntando omóplatos.', { defaultReps: '12-15' }),
      mat('prone-w-raise', 'Elevación en W', 'Boca abajo, codos flexionados (W), retrae y baja los codos.', { defaultReps: '12-15' }),
      mat('reverse-snow-angel', 'Ángel invertido', 'Boca abajo, desliza los brazos del muslo a arriba de la cabeza rozando el piso.', { defaultReps: '10-12' }),
      mat('swimmer', 'Nadador (superman alterno)', 'Superman alternando brazo y pierna opuestos como nadando.', { defaultReps: '12-16' }),
    ],
  }),
  mkBase({
    id: 'colgado-barra', name: 'Colgado y Progresiones de Dominada', desc: 'Cuelgues y progresiones hacia la dominada — REQUIERE barra. Rellena el hueco de tracción vertical sin máquina.',
    muscleGroup: 'espalda', secondaryMuscles: ['antebrazo', 'biceps'], type: 'activacion', difficulty: 'intermedio',
    movementPattern: 'vertical-pull', exerciseRole: 'secondary', matOnly: false,
    tip: 'La negativa (bajar lento desde arriba) es la mejor progresión hacia tu primera dominada.',
    variants: [
      gym('scapular-pull-up', 'Pull-up escapular', 'Colgado, sube el cuerpo solo deprimiendo las escápulas sin doblar codos.', { isDefault: true, difficulty: 'principiante', defaultReps: '8-12' }),
      gym('dead-hang', 'Colgado pasivo (hold)', 'Cuelga de la barra con brazos extendidos, hombros activos.', { difficulty: 'principiante', ...HOLD('20-40 seg') }),
      gym('flexed-arm-hang', 'Colgado en flexión (hold)', 'Sostente arriba con la barbilla sobre la barra.', HOLD('10-25 seg')),
      gym('dominada-negativa', 'Dominada negativa', 'Parte arriba y baja lo más lento posible (5-6 s).', { defaultReps: '4-6' }),
      { id: 'dominada-asistida-banda', name: 'Dominada asistida con banda', equipment: ['gym', 'ligas'], matOnly: false, difficulty: 'principiante', notes: 'Banda en la barra bajo los pies/rodilla para asistir el tirón.', defaultReps: '6-10' },
    ],
  }),
  mkBase({
    id: 'copenhagen-plank', name: 'Plancha Copenhagen', desc: 'Plancha lateral con la pierna de arriba apoyada en un banco — aductores y core lateral. REQUIERE superficie elevada.',
    muscleGroup: 'core', secondaryMuscles: ['isquios', 'gluteo'], type: 'activacion', difficulty: 'avanzado', fallRisk: true,
    movementPattern: 'core-lateral', exerciseRole: 'isolation', matOnly: false, prescriptionType: 'time', defaultReps: '15-30 seg por lado',
    tip: 'Empieza SIEMPRE por la palanca corta (rodilla apoyada) — la larga es muy exigente para el aductor.',
    variants: [
      support('copenhagen-short-lever', 'Palanca corta', 'Plancha lateral con la rodilla de arriba apoyada en el banco.', { isDefault: true, ...HOLD('15-30 seg por lado') }),
      support('copenhagen-long-lever', 'Palanca larga', 'Plancha lateral con el tobillo de arriba apoyado en el banco.', { difficulty: 'avanzado', ...HOLD('10-25 seg por lado') }),
    ],
  }),
  mkBase({
    id: 'locomocion-suelo', name: 'Locomoción y Gateos', desc: 'Desplazamientos en el piso (gateos, gusano, shuffle) — acondicionamiento funcional de cuerpo completo, solo tapete.',
    muscleGroup: 'cuerpo-completo', secondaryMuscles: ['core', 'hombros'], type: 'funcional', difficulty: 'intermedio',
    movementPattern: 'full-body', exerciseRole: 'conditioning', matOnly: true, goals: ['condicion', 'fuerza'],
    tip: 'Mantén la cadera baja y estable en los gateos — no debe rebotar de lado a lado.',
    variants: [
      mat('bear-crawl', 'Gateo del oso', 'Cuadrupedia con rodillas elevadas, avanza brazo y pierna contrarios.', { isDefault: true, defaultReps: '8-12 pasos' }),
      mat('crab-walk', 'Caminata del cangrejo', 'Sentado con manos y pies apoyados, cadera elevada, avanza.', { defaultReps: '8-12 pasos' }),
      mat('lateral-crawl', 'Gateo lateral', 'Gateo del oso desplazándote de lado.', { defaultReps: '8-10 por lado' }),
      mat('inchworm', 'Gusano', 'De pie, camina con las manos a plancha y regresa los pies a las manos.', { defaultReps: '6-10' }),
      mat('walkout-to-pushup', 'Walkout + flexión', 'Walkout a plancha, una flexión, y regresa.', { difficulty: 'intermedio', defaultReps: '6-10' }),
      mat('lateral-shuffle', 'Desplazamiento lateral', 'En media sentadilla, desplázate lateral rápido y controlado.', { defaultReps: '20-30 seg' }),
      mat('fast-feet', 'Pies rápidos', 'Pisadas rápidas en el lugar en media sentadilla.', { defaultReps: '20-30 seg' }),
    ],
  }),
  mkBase({
    id: 'thruster-banda', name: 'Thruster con Banda', desc: 'Sentadilla + press encadenados con banda — patrón de cuerpo completo para circuitos, solo liga.',
    muscleGroup: 'cuerpo-completo', secondaryMuscles: ['cuadriceps', 'hombros', 'gluteo'], type: 'funcional', difficulty: 'intermedio',
    movementPattern: 'full-body', exerciseRole: 'secondary', goals: ['fuerza', 'condicion'],
    tip: 'Usa el impulso de las piernas para arrancar el press — es un movimiento fluido, no dos separados.',
    variants: [
      band('band-thruster', 'Thruster con banda', 'Pisando la banda, sentadilla y al subir empuja a press sobre la cabeza.', { isDefault: true, difficulty: 'intermedio', defaultReps: '10-15' }),
      band('band-squat-to-press', 'Sentadilla a press', 'Igual que el thruster con pausa entre la sentadilla y el press.', { defaultReps: '10-15' }),
    ],
  }),
];

// ── Variantes nuevas que cuelgan de un patrón EXISTENTE (por id de base) ─────
export const BACKLOG_VARIANTS: Record<string, ExerciseVariant[]> = {
  'press-horizontal': [
    mat('flexion-wide', 'Flexión abierta', 'Manos bastante más anchas que los hombros — más pecho.', { defaultReps: '10-15' }),
    mat('flexion-pausa-abajo', 'Flexión con pausa abajo', 'Pausa de 2 s con el pecho cerca del piso antes de empujar.', { defaultReps: '8-12' }),
    mat('push-up-bottom-hold', 'Flexión hold abajo', 'Sostén la posición baja de la flexión, codos a 90°.', HOLD('15-30 seg')),
    band('band-chest-press-unilateral', 'Press con banda unilateral', 'Banda anclada atrás, empuje de un brazo.', { defaultReps: '12-15 por lado' }),
    band('band-chest-press-alternado', 'Press con banda alternado', 'Banda anclada atrás, empuje alternando brazos.', { defaultReps: '12-15 por lado' }),
    band('band-push-up-resisted', 'Flexión con banda', 'Banda por la espalda sujeta con las manos, añade resistencia arriba.', { equipment: ['ligas', 'cuerpo'], defaultReps: '10-15' }),
    band('band-serratus-punch', 'Punch de serrato con banda', 'Banda anclada atrás, empuje corto protraendo el hombro al final.', { defaultReps: '12-15' }),
  ],
  'press-vertical': [
    support('pike-push-up-elevada', 'Pike push-up con pies elevados', 'Pies sobre un step/banco para mayor ángulo — más hombro. Requiere superficie elevada.', { difficulty: 'avanzado', defaultReps: '6-10' }),
  ],
  'vuelo-posterior': [
    band('band-pull-apart', 'Pull-apart con banda', 'Banda al frente a la altura del pecho, sepárala juntando escápulas.', { defaultReps: '15-20' }),
    band('band-y-raise', 'Elevación en Y con banda', 'Pisa la banda y elévala en Y sobre la cabeza.', { defaultReps: '12-15' }),
  ],
  'traccion-vertical-polea': [
    band('band-lat-pulldown', 'Jalón con banda', 'Banda anclada arriba, jala a los costados llevando codos abajo.', { defaultReps: '12-15' }),
  ],
  'remo-con-banda': [
    band('band-row-unilateral', 'Remo con banda unilateral', 'Banda anclada al frente, rema con un brazo.', { defaultReps: '12-15 por lado' }),
    band('band-high-row', 'Remo alto con banda', 'Banda anclada a la altura de la cara, rema con codos altos.', { defaultReps: '12-15' }),
  ],
  'remo-invertido': [
    support('remo-australiano-pies-elevados', 'Remo australiano pies elevados', 'Barra baja/mesa con los pies sobre un step — más difícil. Requiere barra y apoyo.', { difficulty: 'avanzado', defaultReps: '8-12' }),
  ],
  'sentadilla-bilateral': [
    mat('sentadilla-pausa', 'Sentadilla con pausa', 'Pausa de 2-3 s en el fondo antes de subir.', { defaultReps: '8-12' }),
    mat('sentadilla-tempo', 'Sentadilla tempo', 'Baja lento (4 s) y sube normal.', { defaultReps: '8-12' }),
    support('wall-sit', 'Wall sit (hold)', 'Espalda contra la pared, muslos paralelos al piso. Requiere pared.', { difficulty: 'principiante', ...HOLD('30-60 seg') }),
    band('spanish-squat-hold', 'Sentadilla española (hold)', 'Banda detrás de las rodillas anclada al frente, sostén media sentadilla.', HOLD('20-40 seg')),
    band('band-step-out-squat', 'Sentadilla con paso lateral (banda)', 'Banda en tobillos, da un paso lateral y haz media sentadilla.', { defaultReps: '10-12 por lado' }),
  ],
  'sentadilla-unilateral': [
    mat('cossack-squat', 'Sentadilla cosaca', 'Piernas muy abiertas, baja de lado a una pierna manteniendo la otra recta.', { difficulty: 'intermedio', defaultReps: '6-10 por lado' }),
    mat('shrimp-squat', 'Shrimp squat (progresión)', 'Sentadilla a una pierna sujetando el pie de atrás. Muy avanzada.', { difficulty: 'avanzado', fallRisk: true, defaultReps: '3-6 por lado' }),
    support('bulgarian-split-squat-hold', 'Búlgara isométrica (hold)', 'Pie trasero elevado, sostén el fondo. Requiere banco/silla.', HOLD('20-40 seg por lado')),
  ],
  'zancada': [
    mat('reverse-lunge-bodyweight', 'Zancada inversa (peso corporal)', 'Da un paso atrás y baja la rodilla casi al piso.', { defaultReps: '10-12 por lado' }),
    mat('walking-lunge-bodyweight', 'Zancada caminando (peso corporal)', 'Avanza alternando zancadas sin peso.', { defaultReps: '10-12 por lado' }),
    mat('split-squat-bodyweight', 'Split squat (peso corporal)', 'Pies fijos en tijera, baja y sube en el sitio.', { defaultReps: '10-12 por lado' }),
    mat('zancada-lateral-bodyweight', 'Zancada lateral (peso corporal)', 'Paso amplio de lado, baja a la pierna que se flexiona.', { defaultReps: '8-12 por lado' }),
    mat('reverse-lunge-knee-drive', 'Zancada inversa + rodilla', 'Zancada atrás y al subir lleva la rodilla al frente (equilibrio).', { difficulty: 'intermedio', defaultReps: '8-12 por lado' }),
    mat('squat-to-reach', 'Sentadilla con alcance', 'Media sentadilla tocando el piso y extendiendo arriba al subir.', { defaultReps: '10-15' }),
    band('band-reverse-lunge', 'Zancada inversa con banda', 'Pisa la banda y sujétala arriba para añadir carga.', { defaultReps: '10-12 por lado' }),
    band('band-split-squat', 'Split squat con banda', 'Pisa la banda con la pierna adelantada para resistencia.', { defaultReps: '10-12 por lado' }),
  ],
  'peso-muerto-unilateral': [
    mat('single-leg-rdl-reach', 'Peso muerto a una pierna con alcance', 'Bisagra a una pierna tocando el piso con las manos, espalda recta.', { defaultReps: '8-12 por lado' }),
  ],
  'good-morning': [
    mat('good-morning-bodyweight', 'Buenos días (peso corporal)', 'Manos en la nuca, bisagra de cadera con espalda recta.', { defaultReps: '12-15' }),
    band('band-good-morning-to-row', 'Buenos días a remo (banda)', 'Pisa la banda, bisagra y al subir suma un remo.', { difficulty: 'intermedio', defaultReps: '10-12' }),
  ],
  'extension-cuadriceps': [
    band('band-leg-extension-unilateral', 'Extensión de rodilla con banda (unilateral)', 'Banda en el tobillo anclada atrás, extiende la rodilla.', { defaultReps: '12-15 por lado' }),
  ],
  'elevacion-talones': [
    mat('single-leg-calf-raise', 'Elevación de talón a una pierna', 'De pie en una pierna, sube y baja el talón con rango completo.', { defaultReps: '12-15 por lado' }),
    mat('calf-raise-hold', 'Elevación de talón (hold)', 'Sostén arriba en puntas apretando la pantorrilla.', HOLD('20-40 seg')),
    band('band-calf-raise', 'Elevación de talón con banda', 'Banda bajo la punta del pie sujeta con las manos, sube el talón.', { defaultReps: '15-20' }),
  ],
  'hip-thrust': [
    mat('glute-bridge-hold', 'Puente de glúteo (hold)', 'Puente en el piso sosteniendo arriba apretando glúteos.', HOLD('20-45 seg')),
    mat('single-leg-bridge-hold', 'Puente a una pierna (hold)', 'Puente con una pierna extendida, sostén arriba.', { difficulty: 'intermedio', ...HOLD('15-30 seg por lado') }),
    mat('frog-pump', 'Frog pump', 'Plantas de los pies juntas, rodillas abiertas, empuja la cadera arriba.', { defaultReps: '15-20' }),
  ],
  'curl-femoral': [
    mat('hamstring-walkout', 'Caminata de isquios', 'Puente a una/dos piernas caminando los talones hacia afuera y adentro.', { difficulty: 'intermedio', defaultReps: '8-12' }),
    mat('slider-leg-curl', 'Curl de isquios con slider', 'Puente arrastrando los talones sobre superficie deslizante. Requiere piso liso/toalla.', { difficulty: 'intermedio', defaultReps: '8-12' }),
    support('nordic-curl-asistido', 'Curl nórdico asistido', 'Tobillos anclados, baja el torso frenando con isquios; ayúdate con las manos. Requiere anclaje.', { difficulty: 'avanzado', defaultReps: '4-8' }),
  ],
  'anti-lateral': [
    mat('side-plank-reach-through', 'Plancha lateral con paso de brazo', 'En plancha lateral, pasa el brazo de arriba por debajo del torso rotando.', { difficulty: 'intermedio', defaultReps: '10-12 por lado' }),
  ],
  'anti-extension-isometrica': [
    mat('hollow-body-hold', 'Hollow body (hold)', 'Boca arriba, lumbar pegada, brazos y piernas extendidos sin tocar el piso.', { difficulty: 'intermedio', ...HOLD('15-40 seg') }),
  ],
  'levantamiento-piernas': [
    mat('reverse-crunch', 'Crunch invertido', 'Boca arriba, lleva las rodillas al pecho elevando la pelvis.', { defaultReps: '12-15' }),
    support('l-sit-tuck', 'L-sit tuck (hold)', 'En paralelas/piso, sostente con rodillas al pecho. Requiere soporte de manos.', { difficulty: 'avanzado', ...HOLD('10-20 seg') }),
  ],
  'anti-rotacion': [
    band('pallof-hold-band', 'Pallof hold con banda', 'Banda anclada al costado, extiende los brazos y sostén resistiendo la rotación.', { ...HOLD('20-30 seg por lado') }),
  ],
  'burpee-sprawl': [
    mat('step-back-burpee', 'Burpee con paso atrás', 'Burpee llevando los pies atrás caminando (sin salto) — bajo impacto.', { difficulty: 'principiante', defaultReps: '8-12' }),
    mat('burpee-no-jump', 'Burpee sin salto', 'Burpee completo sin el salto final — menos impacto.', { defaultReps: '8-12' }),
  ],
  'running-drills': [
    mat('a-skip', 'A-skip', 'Skip técnico llevando rodilla arriba con brazo contrario, rebote corto.', { difficulty: 'intermedio', defaultReps: '20-30 seg' }),
    mat('acceleration-march', 'Marcha de aceleración', 'Marcha con inclinación al frente y brazos marcados, transición a trote.', { defaultReps: '20-30 seg' }),
    mat('short-acceleration-drill', 'Aceleración corta', 'Salidas de 5-10 m acelerando desde postura inclinada.', { defaultReps: '4-6 salidas' }),
  ],
  'marcha-en-lugar': [
    mat('brisk-march', 'Marcha enérgica', 'Marcha en el lugar rápida con braceo marcado.', { defaultReps: '40-60 seg' }),
    mat('knee-drive-march', 'Marcha con rodilla alta', 'Marcha llevando la rodilla a la altura de la cadera.', { defaultReps: '30-45 seg' }),
    mat('toe-taps', 'Toques de punta', 'Toca alternando la punta del pie al frente a ritmo suave.', { defaultReps: '30-45 seg' }),
    mat('heel-dig', 'Talón al frente', 'Clava el talón al frente alternando con braceo — muy bajo impacto.', { defaultReps: '30-45 seg' }),
    mat('shadow-boxing-low-impact', 'Shadow boxing (bajo impacto)', 'Golpeo suave al aire con pies en el sitio, sin saltar.', { defaultReps: '40-60 seg' }),
    mat('alternating-reach-step', 'Paso con alcance alternado', 'Paso atrás alternando mientras alcanzas al frente con el brazo.', { defaultReps: '30-45 seg' }),
  ],
  'paso-lateral': [
    mat('step-touch', 'Paso y toque', 'Paso lateral juntando el otro pie con toque, alternando.', { defaultReps: '40-60 seg' }),
    mat('low-step-jack', 'Jack de bajo impacto', 'Jumping jack sin salto: abre una pierna a la vez.', { defaultReps: '30-45 seg' }),
    mat('low-impact-skater', 'Patinador bajo impacto', 'Desplazamiento lateral tipo patinador sin salto, tocando el piso.', { difficulty: 'intermedio', defaultReps: '30-45 seg' }),
  ],
  'sentadilla-pliometrica': [
    mat('countermovement-jump', 'Salto con contramovimiento', 'Sentadilla rápida y salto vertical máximo, aterrizaje suave.', { difficulty: 'intermedio', fallRisk: true, defaultReps: '5-8' }),
    mat('tuck-jump', 'Tuck jump', 'Salto llevando las rodillas al pecho.', { difficulty: 'avanzado', fallRisk: true, defaultReps: '5-8' }),
    mat('split-squat-jump', 'Salto en tijera', 'Salto alternando la pierna adelantada en el aire.', { difficulty: 'intermedio', fallRisk: true, defaultReps: '6-10' }),
  ],
  'box-jumps': [
    mat('line-hops-lateral', 'Saltos de línea laterales', 'Saltos cortos de lado a lado sobre una línea con pies juntos.', { difficulty: 'principiante', defaultReps: '20-30 seg' }),
    mat('line-hops-forward-back', 'Saltos de línea adelante-atrás', 'Saltos cortos al frente y atrás sobre una línea.', { difficulty: 'principiante', defaultReps: '20-30 seg' }),
    support('depth-drop', 'Depth drop', 'Baja de un cajón y aterriza absorbiendo (sin re-salto). Requiere cajón.', { difficulty: 'avanzado', fallRisk: true, defaultReps: '4-6' }),
  ],
};
