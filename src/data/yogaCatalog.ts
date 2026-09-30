// ════════════════════════════════════════════════════════════════
// CATÁLOGO DE YOGA — 33 contenidos únicos
//
// Los 33 vídeos NO son 33 rutinas: son un vocabulario de movimiento que el
// generador compone en prácticas. Este archivo describe QUÉ ADMITE cada pieza;
// `yogaGenerator` decide CUÁL usar y CUÁNTO, y `YogaFlowPlayer` la ejecuta.
//
// Procedencia de los datos:
//  · realSec  → medido con ffprobe sobre los archivos definitivos ya recortados.
//               NO heredar los valores de la implementación vieja: declaraban
//               40 s para un vídeo de 10 s y 75 s para uno de 39 s.
//  · phases / focus / prescripción → auditoría manual de David y Magaly.
//  · laterality → auditoría visual. NO se infiere del nombre del archivo.
//
// La URL del vídeo no vive aquí: `exercise_videos` es la única fuente de verdad
// y se resuelve por `id`. Duplicarla fue el error de `yogaFlows.ts`.
//
// Partimos de 35 archivos físicos; dos pares resultaron byte a byte idénticos
// (mismo MD5), así que el catálogo son 33. Las identidades conservadas de esos
// pares son `flow-vinyasa` y `flow-equilibrio`.
// ════════════════════════════════════════════════════════════════
import type { YogaContent } from '../types';

export const YOGA_CATALOG: YogaContent[] = [
  // ── CENTERING · llegar al tapete ──────────────────────────────
  {
    id: 'cat-cow', name: 'Cat-Cow', nameEn: 'Cat-Cow', realSec: 11.7,
    phases: ['centering', 'warmup'], focus: ['movilidad', 'relajacion'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 45, minSec: 30, maxSec: 75, repeatable: true,
    posStart: 'quadruped', posEnd: 'quadruped',
    executionType: 'repeat',
    openerFor: ['movilidad', 'flow', 'relajacion'],
    description: 'Alterna entre flexión y extensión de la columna en cuadrupedia.',
    descriptionEn: "Alternate spinal flexion and extension on all fours.",
  },
  {
    id: 'child-pose', name: 'Postura del Niño', nameEn: "Child's Pose", realSec: 15.9,
    phases: ['centering', 'cooldown'], focus: ['relajacion', 'movilidad'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 45, minSec: 30, maxSec: 90, repeatable: true,
    posStart: 'kneeling', posEnd: 'kneeling',
    executionType: 'hold',
    family: 'child-pose',
    openerFor: ['relajacion', 'movilidad', 'flow'],
    // 0–3,5 se pliega hasta la postura · 3,5–12,2 la sostiene · después sale.
    poseDemo: { sides: [{ from: 0, hold: 5.0 }] },
    description: 'Descansa sentada sobre los talones con los brazos extendidos al frente.',
    descriptionEn: "Rest back on your heels with your arms stretched forward.",
  },
  {
    id: 'child-pose-brazos', name: 'Postura del Niño con Variación de Brazos', nameEn: "Child's Pose, Arm Variation", realSec: 25.7,
    phases: ['centering', 'cooldown'], focus: ['relajacion'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 50, minSec: 40, maxSec: 90, repeatable: false,
    posStart: 'kneeling', posEnd: 'kneeling',
    executionType: 'hold',
    family: 'child-pose',
    openerFor: ['relajacion'],
    description: 'Descansa sobre los talones con los brazos al frente y después llévalos hacia atrás.',
    descriptionEn: "Rest back on your heels with your arms forward, then bring them behind you.",
  },
  {
    id: 'puppy-pose', name: 'Postura del Cachorro', nameEn: 'Puppy Pose', realSec: 23.2,
    phases: ['centering', 'warmup', 'cooldown'], focus: ['movilidad', 'relajacion'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 45, minSec: 35, maxSec: 70, repeatable: false,
    posStart: 'kneeling', posEnd: 'kneeling',
    executionType: 'hold',
    openerFor: ['movilidad', 'relajacion'],
    // 0–7 se arrodilla, estira brazos y baja el pecho · 7–18,5 sostiene.
    poseDemo: { sides: [{ from: 0, hold: 8.5 }] },
    description: 'Desde la postura del niño, lleva el pecho al suelo manteniendo las caderas altas.',
    descriptionEn: "From child's pose, melt your chest down while keeping the hips high.",
  },

  // ── WARMUP · movilizar ────────────────────────────────────────
  {
    id: 'standing-side-bend', name: 'Inclinación Lateral de Pie', nameEn: 'Standing Side Bend', realSec: 28.7,
    phases: ['warmup'], focus: ['movilidad'],
    mode: 'reps', laterality: 'contained',
    defaultPrescription: 58, minSec: 29, maxSec: 86, repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    // El clip hace UNA inclinación por lado: demuestra la forma, no una
    // alternancia continua. El enfoque registrado es movilidad lateral de
    // columna, y eso se consigue sosteniendo la elongación, no balanceándose.
    executionType: 'hold',
    splitBySide: true,
    openerFor: ['movilidad'],
    // 0–5 sube brazos y se inclina · 5–12,2 LADO 1 · 12,2–18,3 vuelve al centro · 18,5–25,8 LADO 2.
    poseDemo: { sides: [{ from: 0, hold: 8.0 }, { hold: 21.5 }] },
    description: 'De pie y con los brazos arriba, inclina el tronco a un lado y al otro.',
    descriptionEn: "Standing with arms overhead, bend your torso to each side.",
  },
  {
    id: 'revolved-chair', name: 'Postura de la Silla con Torsión', nameEn: 'Revolved Chair', realSec: 13.1,
    phases: ['warmup', 'standing'], focus: ['movilidad'],
    mode: 'reps', laterality: 'contained',
    defaultPrescription: 52, minSec: 26, maxSec: 78, repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    // Igual que la inclinación lateral: una torsión por lado, no una alternancia.
    // NO abre práctica — sostener una silla con torsión es carga isométrica de
    // pierna, y en frío como primera pieza es demasiado.
    executionType: 'hold',
    splitBySide: true,
    // PROTOTIPO · medido sobre el archivo real (13,118 s, 30 fps):
    //   0,0–1,2  de pie          1,2–3,0  entra a la silla y gira
    //   3,0–5,9  PRIMER LADO     6,0–7,6  cambia de lado
    //   7,6–10,1 SEGUNDO LADO    10,1–13,1 sale y se incorpora
    //
    // El primer lado SÍ enseña la entrada; el segundo salta directo a su
    // fotograma. Para entonces la persona ya vio cómo se hace, y reproducir la
    // transición grabada solo la confundiría: el vídeo cambiaría de lado por su
    // cuenta mientras ella sostiene el suyo.
    poseDemo: { sides: [{ from: 1.2, hold: 4.6 }, { hold: 8.8 }] },
    description: 'Desde la postura de la silla, gira el tronco hacia cada lado.',
    descriptionEn: "From chair pose, twist your torso to each side.",
  },
  {
    id: 'sun-salutation', name: 'Saludo al Sol', nameEn: 'Sun Salutation', realSec: 24.0,
    phases: ['warmup', 'standing'], focus: ['flow', 'movilidad'],
    mode: 'rounds', laterality: 'none',
    defaultPrescription: 24, rounds: [1, 4], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    family: 'sun-salutation',
    openerFor: ['flow', 'movilidad'],
    description: 'Secuencia que encadena posturas de pie y de suelo.',
    descriptionEn: "A sequence linking standing and floor postures.",
  },
  {
    id: 'flow-vinyasa', name: 'Vinyasa', nameEn: 'Vinyasa', realSec: 34.9,
    phases: ['warmup', 'standing'], focus: ['flow'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 35, rounds: [1, 3], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    description: 'Pinza, plancha, cobra y perro boca abajo, encadenados.',
    descriptionEn: "Forward fold, plank, cobra and downward dog, linked.",
  },
  {
    id: 'warrior1-sun-salutation', name: 'Saludo con Guerrero I', nameEn: 'Sun Salutation with Warrior I', realSec: 47.6,
    phases: ['warmup', 'standing'], focus: ['flow', 'movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 48, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    family: 'sun-salutation',
    openerFor: ['flow'],
    description: 'Secuencia fluida basada en el saludo al sol.',
    descriptionEn: "Flowing sequence based on the sun salutation.",
  },

  // ── STANDING · el cuerpo de la práctica ───────────────────────
  {
    id: 'flow-guerreros', name: 'Flow de Guerreros', nameEn: 'Warrior Flow', realSec: 58.0,
    phases: ['standing'], focus: ['flow'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 58, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    description: 'Guerrero I, II, invertido y ángulo lateral, en ambos lados.',
    descriptionEn: "Warrior I, II, reverse and side angle, on both sides.",
  },
  {
    id: 'flow-guerreros-corto', name: 'Serie de Guerreros', nameEn: 'Warrior Series', realSec: 59.3,
    phases: ['standing'], focus: ['flow', 'movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 59, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    description: 'Guerrero I, II e invertido, en ambos lados.',
    descriptionEn: "Warrior I, II and reverse, on both sides.",
  },
  {
    id: 'flow-saludo-guerreros', name: 'Saludo al Sol y Guerreros', nameEn: 'Sun Salutation and Warriors', realSec: 84.6,
    phases: ['standing'], focus: ['flow'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 85, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    family: 'sun-salutation',
    description: 'Saludo al sol enlazado con la serie de guerreros, en ambos lados.',
    descriptionEn: "Sun salutation linked into the warrior series, on both sides.",
  },
  {
    // Único unilateral entre los flows: el vídeo muestra UN lado. El generador
    // duplica la prescripción y el player pide el cambio de lado.
    id: 'warrior-unilateral', name: 'Secuencia de Guerrero', nameEn: 'Warrior Sequence', realSec: 37.7,
    phases: ['standing'], focus: ['flow'],
    mode: 'rounds', laterality: 'unilateral',
    defaultPrescription: 38, rounds: [1, 2], repeatable: false,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    description: 'Serie de guerrero hasta el ángulo lateral atado, de un solo lado.',
    descriptionEn: "Warrior series through bound side angle, on one side.",
  },
  {
    id: 'flow-zancada', name: 'Zancada y Torsión', nameEn: 'Low Lunge and Twist', realSec: 74.2,
    phases: ['standing'], focus: ['flow', 'movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 74, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    description: 'Zancada baja y zancada girada, enlazadas en ambos lados.',
    descriptionEn: "Low lunge and revolved lunge, linked on both sides.",
  },
  {
    id: 'flow-silla', name: 'Silla y Torsión', nameEn: 'Chair and Twist', realSec: 39.9,
    phases: ['standing'], focus: ['flow'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 40, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    description: 'Postura de la silla con torsión hacia cada lado.',
    descriptionEn: "Chair pose with a twist to each side.",
  },
  {
    id: 'flow-skandasana', name: 'Apertura de Piernas y Skandasana', nameEn: 'Wide-Leg Opening and Skandasana', realSec: 53.3,
    phases: ['standing', 'peak'], focus: ['movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 53, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    description: 'Apertura de piernas con sentadilla lateral hacia cada lado.',
    descriptionEn: "Wide-leg opening into a side squat on each side.",
  },
  {
    id: 'flow-equilibrio', name: 'Serie de Equilibrio', nameEn: 'Balance Series', realSec: 49.0,
    phases: ['standing', 'peak'], focus: ['flow', 'movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 49, rounds: [1, 2], repeatable: false,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    description: 'Árbol, figura cuatro y extensión de pierna, en ambos lados.',
    descriptionEn: "Tree, figure four and leg extension, on both sides.",
  },
  {
    id: 'flow-wild-thing', name: 'Perro de Tres Patas y Wild Thing', nameEn: 'Three-Legged Dog and Wild Thing', realSec: 49.3,
    phases: ['standing', 'peak'], focus: ['flow'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 49, rounds: [1, 2], repeatable: false,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'follow',
    description: 'Perro de tres patas que abre hacia la postura salvaje, en ambos lados.',
    descriptionEn: "Three-legged dog opening into wild thing, on both sides.",
  },
  {
    id: 'triangle-pose', name: 'Postura del Triángulo', nameEn: 'Triangle Pose', realSec: 31.7,
    phases: ['standing'], focus: ['movilidad'],
    mode: 'timer', laterality: 'contained',
    defaultPrescription: 64, minSec: 40, maxSec: 90, repeatable: false,
    posStart: 'standing', posEnd: 'standing',
    executionType: 'hold',
    splitBySide: true,
    // 0–4 abre piernas · 4–14 LADO 1 de frente · 14–19 gira 180° · 19–29 LADO 2 de espaldas.
    poseDemo: { sides: [{ from: 0, hold: 7.0 }, { hold: 22.0 }] },
    description: 'Triángulo hacia cada lado, con las piernas abiertas.',
    descriptionEn: "Triangle to each side, with the legs wide.",
  },
  {
    id: 'lizard-lunge', name: 'Zancada del Lagarto', nameEn: 'Lizard Lunge', realSec: 32.9,
    phases: ['standing', 'peak'], focus: ['movilidad'],
    mode: 'timer', laterality: 'unilateral',
    defaultPrescription: 45, minSec: 30, maxSec: 70, repeatable: false,
    posStart: 'prone', posEnd: 'standing',
    executionType: 'hold',
    // 0–6 entra desde plancha · 6–10,8 sostiene sobre antebrazos.
    // UNILATERAL: el clip solo trae un lado, así que los dos bloques usan el
    // MISMO fotograma. Mejor una referencia fija del lado equivocado que un
    // bucle entrando y saliendo mientras la instrucción pide sostener.
    poseDemo: { sides: [{ from: 0, hold: 8.0 }, { hold: 8.0 }] },
    description: 'Zancada profunda con las manos dentro del pie, bajando a los antebrazos.',
    descriptionEn: "Deep lunge with hands inside the foot, lowering to the forearms.",
  },
  {
    id: 'pigeon-dinamica', name: 'Plancha a Paloma', nameEn: 'Plank to Pigeon', realSec: 23.9,
    phases: ['standing', 'cooldown'], focus: ['movilidad'],
    mode: 'reps', laterality: 'contained',
    defaultPrescription: 48, minSec: 24, maxSec: 72, repeatable: false,
    posStart: 'prone', posEnd: 'prone',
    executionType: 'repeat',
    description: 'Alterna entre plancha y paloma sobre los antebrazos, cambiando de lado.',
    descriptionEn: "Alternate between plank and forearm pigeon, switching sides.",
  },

  // ── PEAK · el punto alto ──────────────────────────────────────
  {
    id: 'side-plank-yoga', name: 'Plancha Lateral', nameEn: 'Side Plank', realSec: 12.4,
    phases: ['peak'], focus: ['flow'],
    mode: 'timer', laterality: 'unilateral',
    defaultPrescription: 30, minSec: 20, maxSec: 45, repeatable: false,
    posStart: 'prone', posEnd: 'prone',
    executionType: 'hold',
    // 0–4 entra a la plancha lateral · 4,5–8 sostiene.
    // UNILATERAL: mismo fotograma en los dos bloques, igual que el Lagarto.
    poseDemo: { sides: [{ from: 0, hold: 5.0 }, { hold: 5.0 }] },
    description: 'Plancha lateral sostenida sobre un brazo.',
    descriptionEn: "Side plank held on one arm.",
  },
  {
    id: 'boat-pose', name: 'Postura del Barco', nameEn: 'Boat Pose', realSec: 14.0,
    phases: ['peak'], focus: ['flow'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 35, minSec: 25, maxSec: 50, repeatable: false,
    posStart: 'seated', posEnd: 'seated',
    executionType: 'hold',
    // 0–8 entra y eleva las piernas · 8,2–10 sostiene.
    poseDemo: { sides: [{ from: 0, hold: 9.0 }] },
    description: 'Equilibrio sentada con las piernas elevadas del suelo.',
    descriptionEn: "Seated balance with the legs lifted off the floor.",
  },
  {
    id: 'camel-pose', name: 'Postura del Camello', nameEn: 'Camel Pose', realSec: 12.9,
    phases: ['peak'], focus: ['movilidad'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 35, minSec: 25, maxSec: 50, repeatable: false,
    posStart: 'kneeling', posEnd: 'kneeling',
    executionType: 'hold',
    // 0–4,5 se arrodilla y abre el pecho · 4,5–9 sostiene · 9–12,9 vuelve.
    poseDemo: { sides: [{ from: 0, hold: 6.5 }] },
    description: 'Extensión de columna desde las rodillas, abriendo el pecho.',
    descriptionEn: "Kneeling backbend, opening the chest.",
    difficulty: 'intermedio',
  },
  {
    id: 'locust-pose', name: 'Postura de la Langosta', nameEn: 'Locust Pose', realSec: 10.2,
    phases: ['peak'], focus: ['movilidad'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 30, minSec: 20, maxSec: 45, repeatable: true,
    posStart: 'prone', posEnd: 'prone',
    executionType: 'hold',
    // 0–2,5 eleva pecho y piernas · 2,5–6,5 sostiene · 7–10,2 baja.
    poseDemo: { sides: [{ from: 0, hold: 4.5 }] },
    description: 'Boca abajo, eleva el pecho y las piernas del suelo.',
    descriptionEn: "Lying face down, lift your chest and legs off the floor.",
  },
  {
    id: 'bridge-pose', name: 'Postura del Puente', nameEn: 'Bridge Pose', realSec: 24.6,
    phases: ['peak', 'cooldown'], focus: ['movilidad'],
    mode: 'reps', laterality: 'none',
    defaultPrescription: 50, minSec: 25, maxSec: 75, repeatable: true,
    posStart: 'supine', posEnd: 'supine',
    executionType: 'repeat',
    description: 'Eleva y baja la cadera con los pies apoyados en el suelo.',
    descriptionEn: "Lift and lower the hips with your feet on the floor.",
  },
  {
    // V1: fuera de la selección automática. Sin pregunta de nivel en la UI no
    // existe señal válida para ofrecer una extensión profunda de columna, y la
    // duración elegida NO es esa señal. Permanece en catálogo y Storage.
    id: 'wheel-pose', name: 'Postura de la Rueda', nameEn: 'Wheel Pose', realSec: 14.4,
    phases: ['peak'], focus: ['flow'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 30, minSec: 20, maxSec: 40, repeatable: false,
    posStart: 'supine', posEnd: 'supine',
    executionType: 'hold',
    description: 'Extensión profunda de columna con las manos y los pies en el suelo.',
    descriptionEn: "Deep backbend with hands and feet on the floor.",
    difficulty: 'avanzado', excludeFromAutoGeneration: true,
  },
  {
    // V1: fuera de la selección automática. Inversión sobre cuello y hombros
    // (Vela → Arado → Presión de Oídos): riesgo real sin supervisión ni nivel.
    id: 'flow-inversiones', name: 'Vela, Arado y Presión de Oídos', nameEn: 'Shoulderstand, Plow and Ear Pressure', realSec: 39.4,
    phases: ['peak'], focus: ['flow'],
    mode: 'rounds', laterality: 'none',
    defaultPrescription: 39, rounds: [1, 1], repeatable: false,
    posStart: 'supine', posEnd: 'supine',
    executionType: 'follow',
    description: 'Vela, arado y presión de oídos, con salida controlada.',
    descriptionEn: "Shoulderstand, plow and ear pressure, with a controlled exit.",
    difficulty: 'avanzado', excludeFromAutoGeneration: true,
  },

  // ── COOLDOWN · bajar y cerrar ─────────────────────────────────
  {
    id: 'pigeon-pose', name: 'Postura de la Paloma', nameEn: 'Pigeon Pose', realSec: 39.2,
    phases: ['cooldown'], focus: ['movilidad', 'relajacion'],
    mode: 'timer', laterality: 'contained',
    defaultPrescription: 80, minSec: 50, maxSec: 140, repeatable: false,
    posStart: 'quadruped', posEnd: 'seated',
    executionType: 'hold',
    splitBySide: true,
    // 0–3 desde cuadrupedia · 3–16,2 LADO 1 · 16,2–22,8 cambia · 22,8–32 LADO 2.
    poseDemo: { sides: [{ from: 0, hold: 6.0 }, { hold: 27.0 }] },
    description: 'Paloma con el tronco inclinado sobre la pierna, hacia cada lado.',
    descriptionEn: "Pigeon folding over the front leg, on each side.",
  },
  {
    id: 'seated-forward-fold', name: 'Flexión Sentada', nameEn: 'Seated Forward Fold', realSec: 12.6,
    phases: ['cooldown'], focus: ['relajacion', 'movilidad'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 50, minSec: 35, maxSec: 100, repeatable: false,
    posStart: 'seated', posEnd: 'seated',
    executionType: 'hold',
    // 0–5,9 se inclina al frente · 5,9–10 sostiene.
    poseDemo: { sides: [{ from: 0, hold: 8.0 }] },
    description: 'Sentada con las piernas extendidas, inclina el tronco al frente.',
    descriptionEn: "Seated with legs extended, fold the torso forward.",
  },
  {
    id: 'seated-twist', name: 'Torsión Sentada', nameEn: 'Seated Twist', realSec: 22.1,
    phases: ['cooldown'], focus: ['relajacion', 'movilidad'],
    mode: 'timer', laterality: 'contained',
    defaultPrescription: 60, minSec: 40, maxSec: 100, repeatable: false,
    posStart: 'seated', posEnd: 'seated',
    executionType: 'hold',
    splitBySide: true,
    // 0–3,4 cruza pierna y gira · 3,4–9,2 LADO 1 · 9,2–13,4 cambia · 13,4–18,2 LADO 2.
    poseDemo: { sides: [{ from: 0, hold: 6.0 }, { hold: 16.0 }] },
    description: 'Torsión de columna sentada, hacia cada lado.',
    descriptionEn: "Seated spinal twist to each side.",
  },
  {
    id: 'flow-enfriamiento', name: 'Happy Baby y Torsión Tumbada', nameEn: 'Happy Baby and Reclined Twist', realSec: 42.2,
    phases: ['cooldown'], focus: ['relajacion', 'movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 42, rounds: [1, 2], repeatable: true,
    posStart: 'supine', posEnd: 'supine',
    executionType: 'follow',
    description: 'Happy baby y torsión tumbada, alternando lados.',
    descriptionEn: "Happy baby and reclined twist, alternating sides.",
  },
  {
    // Cierre natural: es el único contenido que termina SENTADA viniendo del suelo.
    id: 'flow-cierre', name: 'Cierre Rodillas al Pecho', nameEn: 'Knees-to-Chest Closing', realSec: 59.6,
    phases: ['cooldown'], focus: ['relajacion'],
    mode: 'rounds', laterality: 'none',
    defaultPrescription: 60, rounds: [1, 1], repeatable: false,
    posStart: 'supine', posEnd: 'seated',
    executionType: 'follow',
    description: 'Rodillas al pecho y balanceo suave hasta llegar a sentada.',
    descriptionEn: "Knees to chest and a gentle rock up to seated.",
  },
];

/** Índice por id. */
/**
 * Cómo se excluyen los miembros de cada familia. NO es una sola regla porque las
 * dos familias que existen no son el mismo problema:
 *
 *  · `strict`   — un solo miembro por práctica. Es el caso de `child-pose`: la
 *    Postura del Niño y su variación de brazos son LA MISMA postura, cumplen la
 *    misma función donde sea que caigan y verlas dos veces se lee como repetición.
 *    Medido: con la política por fase coincidían en 30 de 130 prácticas, una de
 *    ellas con el Niño en la posición 1 y la variación en la 8, de 8 piezas.
 *
 *  · `perPhase` — un miembro por FASE, dos como máximo por práctica y al menos 3
 *    piezas de separación. Es el caso de `sun-salutation`: un saludo de 24 s
 *    calentando y una secuencia de saludo+guerreros de 85 s como parte principal
 *    no son redundantes, son funciones distintas. La regla anterior —uno por
 *    práctica— mataba a `flow-saludo-guerreros`, que solo vive en `standing`:
 *    en 50 de 50 prácticas de flow la familia ya se había gastado en `warmup`.
 */
export const YOGA_FAMILY_POLICY: Record<string, 'strict' | 'perPhase'> = {
  'child-pose': 'strict',
  'sun-salutation': 'perPhase',
};

/** Piezas de separación mínima entre dos miembros de una familia `perPhase`. */
export const FAMILY_MIN_GAP = 3;
/** Miembros distintos de una misma familia admitidos por práctica (`perPhase`). */
export const FAMILY_MAX_MEMBERS = 2;

export const YOGA_BY_ID: ReadonlyMap<string, YogaContent> =
  new Map(YOGA_CATALOG.map(c => [c.id, c]));

/** Contenidos que el generador PUEDE elegir automáticamente en V1. */
export const YOGA_SELECTABLE: YogaContent[] =
  YOGA_CATALOG.filter(c => !c.excludeFromAutoGeneration);
