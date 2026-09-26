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
  },
  {
    id: 'child-pose', name: 'Postura del Niño', nameEn: "Child's Pose", realSec: 15.9,
    phases: ['centering', 'cooldown'], focus: ['relajacion', 'movilidad'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 45, minSec: 30, maxSec: 90, repeatable: true,
    posStart: 'kneeling', posEnd: 'kneeling',
  },
  {
    id: 'child-pose-brazos', name: 'Niño con Brazos Extendidos', nameEn: "Child's Pose, Arms Extended", realSec: 25.7,
    phases: ['centering', 'cooldown'], focus: ['relajacion'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 50, minSec: 40, maxSec: 90, repeatable: false,
    posStart: 'kneeling', posEnd: 'kneeling',
  },
  {
    id: 'puppy-pose', name: 'Niño a Cachorro', nameEn: 'Child to Puppy Pose', realSec: 23.2,
    phases: ['centering', 'warmup', 'cooldown'], focus: ['movilidad', 'relajacion'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 45, minSec: 35, maxSec: 70, repeatable: false,
    posStart: 'kneeling', posEnd: 'kneeling',
  },

  // ── WARMUP · movilizar ────────────────────────────────────────
  {
    id: 'standing-side-bend', name: 'Inclinación Lateral de Pie', nameEn: 'Standing Side Bend', realSec: 28.7,
    phases: ['warmup'], focus: ['movilidad'],
    mode: 'reps', laterality: 'contained',
    defaultPrescription: 58, minSec: 29, maxSec: 86, repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'revolved-chair', name: 'Silla con Torsión', nameEn: 'Revolved Chair', realSec: 13.1,
    phases: ['warmup', 'standing'], focus: ['movilidad'],
    mode: 'reps', laterality: 'contained',
    defaultPrescription: 52, minSec: 26, maxSec: 78, repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'sun-salutation', name: 'Saludo al Sol', nameEn: 'Sun Salutation', realSec: 24.0,
    phases: ['warmup', 'standing'], focus: ['flow', 'movilidad'],
    mode: 'rounds', laterality: 'none',
    defaultPrescription: 24, rounds: [1, 4], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'flow-vinyasa', name: 'Vinyasa', nameEn: 'Vinyasa', realSec: 34.9,
    phases: ['warmup', 'standing'], focus: ['flow'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 35, rounds: [1, 3], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'warrior1-sun-salutation', name: 'Saludo con Guerrero I', nameEn: 'Sun Salutation with Warrior I', realSec: 47.6,
    phases: ['warmup', 'standing'], focus: ['flow', 'movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 48, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },

  // ── STANDING · el cuerpo de la práctica ───────────────────────
  {
    id: 'flow-guerreros', name: 'Serie de Guerreros', nameEn: 'Warrior Series', realSec: 58.0,
    phases: ['standing'], focus: ['flow'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 58, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'flow-guerreros-corto', name: 'Guerreros I-II-Invertido', nameEn: 'Warrior I-II-Reverse', realSec: 59.3,
    phases: ['standing'], focus: ['flow', 'movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 59, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'flow-saludo-guerreros', name: 'Saludo al Sol y Guerreros', nameEn: 'Sun Salutation and Warriors', realSec: 84.6,
    phases: ['standing'], focus: ['flow'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 85, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    // Único unilateral entre los flows: el vídeo muestra UN lado. El generador
    // duplica la prescripción y el player pide el cambio de lado.
    id: 'warrior-unilateral', name: 'Guerrero Completo', nameEn: 'Full Warrior', realSec: 37.7,
    phases: ['standing'], focus: ['flow'],
    mode: 'rounds', laterality: 'unilateral',
    defaultPrescription: 38, rounds: [1, 2], repeatable: false,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'flow-zancada', name: 'Zancada y Torsión', nameEn: 'Low Lunge and Twist', realSec: 74.2,
    phases: ['standing'], focus: ['flow', 'movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 74, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'flow-silla', name: 'Silla y Torsión', nameEn: 'Chair and Twist', realSec: 39.9,
    phases: ['standing'], focus: ['flow'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 40, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'flow-skandasana', name: 'Apertura y Skandasana', nameEn: 'Wide-Leg Opening and Skandasana', realSec: 53.3,
    phases: ['standing', 'peak'], focus: ['movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 53, rounds: [1, 2], repeatable: true,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'flow-equilibrio', name: 'Serie de Equilibrio', nameEn: 'Balance Series', realSec: 49.0,
    phases: ['standing', 'peak'], focus: ['flow', 'movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 49, rounds: [1, 2], repeatable: false,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'flow-wild-thing', name: 'Perro de Tres Patas y Wild Thing', nameEn: 'Three-Legged Dog and Wild Thing', realSec: 49.3,
    phases: ['standing', 'peak'], focus: ['flow'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 49, rounds: [1, 2], repeatable: false,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'triangle-pose', name: 'Triángulo', nameEn: 'Triangle Pose', realSec: 31.7,
    phases: ['standing'], focus: ['movilidad'],
    mode: 'timer', laterality: 'contained',
    defaultPrescription: 64, minSec: 40, maxSec: 90, repeatable: false,
    posStart: 'standing', posEnd: 'standing',
  },
  {
    id: 'lizard-lunge', name: 'Zancada del Lagarto', nameEn: 'Lizard Lunge', realSec: 32.9,
    phases: ['standing', 'peak'], focus: ['movilidad'],
    mode: 'timer', laterality: 'unilateral',
    defaultPrescription: 45, minSec: 30, maxSec: 70, repeatable: false,
    posStart: 'prone', posEnd: 'standing',
  },
  {
    id: 'pigeon-dinamica', name: 'Plancha a Paloma', nameEn: 'Plank to Pigeon', realSec: 23.9,
    phases: ['standing', 'cooldown'], focus: ['movilidad'],
    mode: 'reps', laterality: 'contained',
    defaultPrescription: 48, minSec: 24, maxSec: 72, repeatable: false,
    posStart: 'prone', posEnd: 'prone',
  },

  // ── PEAK · el punto alto ──────────────────────────────────────
  {
    id: 'side-plank-yoga', name: 'Plancha Lateral', nameEn: 'Side Plank', realSec: 12.4,
    phases: ['peak'], focus: ['flow'],
    mode: 'timer', laterality: 'unilateral',
    defaultPrescription: 30, minSec: 20, maxSec: 45, repeatable: false,
    posStart: 'prone', posEnd: 'prone',
  },
  {
    id: 'boat-pose', name: 'Postura del Barco', nameEn: 'Boat Pose', realSec: 14.0,
    phases: ['peak'], focus: ['flow'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 35, minSec: 25, maxSec: 50, repeatable: false,
    posStart: 'seated', posEnd: 'seated',
  },
  {
    id: 'camel-pose', name: 'Postura del Camello', nameEn: 'Camel Pose', realSec: 12.9,
    phases: ['peak'], focus: ['movilidad'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 35, minSec: 25, maxSec: 50, repeatable: false,
    posStart: 'kneeling', posEnd: 'kneeling',
    difficulty: 'intermedio',
  },
  {
    id: 'locust-pose', name: 'Postura de la Langosta', nameEn: 'Locust Pose', realSec: 10.2,
    phases: ['peak'], focus: ['movilidad'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 30, minSec: 20, maxSec: 45, repeatable: true,
    posStart: 'prone', posEnd: 'prone',
  },
  {
    id: 'bridge-pose', name: 'Postura del Puente', nameEn: 'Bridge Pose', realSec: 24.6,
    phases: ['peak', 'cooldown'], focus: ['movilidad'],
    mode: 'reps', laterality: 'none',
    defaultPrescription: 50, minSec: 25, maxSec: 75, repeatable: true,
    posStart: 'supine', posEnd: 'supine',
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
    difficulty: 'avanzado', excludeFromAutoGeneration: true,
  },

  // ── COOLDOWN · bajar y cerrar ─────────────────────────────────
  {
    id: 'pigeon-pose', name: 'Paloma con Flexión', nameEn: 'Pigeon with Forward Fold', realSec: 39.2,
    phases: ['cooldown'], focus: ['movilidad', 'relajacion'],
    mode: 'timer', laterality: 'contained',
    defaultPrescription: 80, minSec: 50, maxSec: 140, repeatable: false,
    posStart: 'quadruped', posEnd: 'seated',
  },
  {
    id: 'seated-forward-fold', name: 'Flexión Sentada', nameEn: 'Seated Forward Fold', realSec: 12.6,
    phases: ['cooldown'], focus: ['relajacion', 'movilidad'],
    mode: 'timer', laterality: 'none',
    defaultPrescription: 50, minSec: 35, maxSec: 100, repeatable: false,
    posStart: 'seated', posEnd: 'seated',
  },
  {
    id: 'seated-twist', name: 'Torsión Sentada', nameEn: 'Seated Twist', realSec: 22.1,
    phases: ['cooldown'], focus: ['relajacion', 'movilidad'],
    mode: 'timer', laterality: 'contained',
    defaultPrescription: 60, minSec: 40, maxSec: 100, repeatable: false,
    posStart: 'seated', posEnd: 'seated',
  },
  {
    id: 'flow-enfriamiento', name: 'Happy Baby y Torsión Supina', nameEn: 'Happy Baby and Supine Twist', realSec: 42.2,
    phases: ['cooldown'], focus: ['relajacion', 'movilidad'],
    mode: 'rounds', laterality: 'contained',
    defaultPrescription: 42, rounds: [1, 2], repeatable: true,
    posStart: 'supine', posEnd: 'supine',
  },
  {
    // Cierre natural: es el único contenido que termina SENTADA viniendo del suelo.
    id: 'flow-cierre', name: 'Cierre Rodillas al Pecho', nameEn: 'Knees-to-Chest Closing', realSec: 59.6,
    phases: ['cooldown'], focus: ['relajacion'],
    mode: 'rounds', laterality: 'none',
    defaultPrescription: 60, rounds: [1, 1], repeatable: false,
    posStart: 'supine', posEnd: 'seated',
  },
];

/** Índice por id. */
export const YOGA_BY_ID: ReadonlyMap<string, YogaContent> =
  new Map(YOGA_CATALOG.map(c => [c.id, c]));

/** Contenidos que el generador PUEDE elegir automáticamente en V1. */
export const YOGA_SELECTABLE: YogaContent[] =
  YOGA_CATALOG.filter(c => !c.excludeFromAutoGeneration);
