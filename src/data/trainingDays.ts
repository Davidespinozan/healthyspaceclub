/** Training program — Rutinas Semanales (Semana 1 + Semana 2) */

export interface TrainingExercise {
  name: string;
  sets: string;
  note?: string;
}

export interface TrainingSection {
  title: string;
  subtitle?: string;
  exercises: TrainingExercise[];
}

export interface TrainingDay {
  day: number;
  week: number;
  title: string;
  focus: string;
  icon: string;
  color: string;
  duration: string;
  type: 'lower' | 'upper' | 'yoga' | 'rest';
  locked?: boolean;
  sections: TrainingSection[];
}

export const trainingDays: TrainingDay[] = [
  {
    day: 1,
    week: 1,
    title: 'Lower + Core',
    focus: 'Cuádriceps + estabilidad + fuerza',
    icon: 'leg',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    sections: [
      {
        title: 'Activación',
        subtitle: '3–5 min',
        exercises: [
          { name: 'Puente de glúteo', sets: '15 reps' },
          { name: 'Caminata lateral con banda', sets: '15 por lado' },
          { name: 'Sentadillas sin peso', sets: '15 reps' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Sentadilla', sets: '3–4 × 8–10', note: 'Base total de pierna' },
          { name: 'Bulgarian split squat', sets: '3 × 10 por pierna', note: 'Estabilidad + glúteo medio' },
          { name: 'Prensa de piernas', sets: '3 × 12', note: 'Volumen cuádriceps' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Extensión de cuádriceps', sets: '3 × 12–15' },
          { name: 'Pantorrillas de pie', sets: '3 × 15' },
        ],
      },
      {
        title: 'Core',
        subtitle: 'Estabilidad',
        exercises: [
          { name: 'Plancha frontal', sets: '3 × 30–40 seg' },
          { name: 'Dead bug', sets: '3 × 10 por lado' },
        ],
      },
    ],
  },
  {
    day: 2,
    week: 1,
    title: 'Upper + Core',
    focus: 'Pecho + hombros + postura + estabilidad escapular',
    icon: 'flex',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    sections: [
      {
        title: 'Activación',
        subtitle: '3–5 min',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Círculos de brazos', sets: '15 reps' },
          { name: 'Scapular push-ups', sets: '10 reps' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Press con mancuernas (banca o suelo)', sets: '3 × 10', note: 'Fuerza de pecho + estabilidad' },
          { name: 'Shoulder press', sets: '3 × 10', note: 'Hombros definidos' },
          { name: 'Push-ups (rodillas o completas)', sets: '3 × 8–12', note: 'Fuerza funcional' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Elevaciones laterales', sets: '3 × 12–15', note: 'Forma redondeada del hombro' },
          { name: 'Fondos en banca o tríceps dips', sets: '3 × 10', note: 'Firmeza de brazos' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con toque de hombros', sets: '3 × 20 toques' },
          { name: 'Hollow hold', sets: '3 × 20–30 seg' },
        ],
      },
    ],
  },
  {
    day: 3,
    week: 1,
    title: 'Power Vinyasa Flow',
    focus: 'Movilidad activa + energía + liberar tensión',
    icon: 'yoga',
    color: '#8b6914',
    duration: '25–35 min',
    type: 'yoga',
    sections: [
      {
        title: 'Calentamiento',
        subtitle: '3–5 min',
        exercises: [
          { name: 'Respiración profunda', sets: '1 min' },
          { name: 'Movilidad cervical y hombros', sets: '1 min' },
          { name: 'Cat–cow', sets: '10 reps' },
        ],
      },
      {
        title: 'Flow Principal',
        subtitle: 'Repetir 4–6 rondas',
        exercises: [
          { name: 'Sun Salutation A', sets: 'Fluido', note: 'Sincronizando respiración' },
          { name: 'Low lunge + twist', sets: '5 respiraciones por lado' },
          { name: 'Downward dog', sets: '5 respiraciones' },
          { name: 'Warrior I → Warrior II', sets: '5 respiraciones cada uno' },
          { name: 'Pyramid stretch', sets: 'Estira femorales' },
          { name: 'Child\'s pose', sets: '5 respiraciones' },
        ],
      },
      {
        title: 'Core & Control',
        subtitle: '5 min',
        exercises: [
          { name: 'Plancha alta', sets: '30 seg' },
          { name: 'Bird dog', sets: '10 por lado' },
          { name: 'Dead bug', sets: '10 por lado' },
        ],
      },
    ],
  },
  {
    day: 4,
    week: 1,
    title: 'Lower + Core',
    focus: 'Glúteos + femorales + cadena posterior',
    icon: 'glute',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Puente glúteo pausa arriba', sets: '15 reps' },
          { name: 'Patadas de glúteo', sets: '15 por lado' },
          { name: 'Good mornings sin peso', sets: '15 reps' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Hip thrust', sets: '4 × 10', note: 'Crecimiento real de glúteo' },
          { name: 'Peso muerto rumano', sets: '3 × 10', note: 'Femoral + glúteo' },
          { name: 'Curl femoral', sets: '3 × 12', note: 'Parte posterior del muslo' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Step-ups o desplantes largos', sets: '3 × 10 por pierna' },
          { name: 'Abducciones de cadera (banda o máquina)', sets: '3 × 15', note: 'Glúteo medio (forma redonda)' },
        ],
      },
      {
        title: 'Core Posterior',
        exercises: [
          { name: 'Bird dog', sets: '3 × 10 por lado' },
          { name: 'Superman', sets: '3 × 12' },
        ],
      },
    ],
  },
  {
    day: 5,
    week: 1,
    title: 'Upper + Core',
    focus: 'Espalda + brazos + postura elegante',
    icon: 'weights',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Retracciones escapulares', sets: '12 reps' },
          { name: 'Rotaciones externas con banda', sets: '12 reps' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Jalón al pecho o dominadas asistidas', sets: '3 × 10', note: 'Espalda estética y postura' },
          { name: 'Remo con mancuernas o máquina', sets: '3 × 10', note: 'Espalda media' },
          { name: 'Face pulls o pájaros', sets: '3 × 12', note: 'Hombros sanos y postura' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Curl de bíceps', sets: '3 × 12' },
          { name: 'Extensión de tríceps', sets: '3 × 12' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Bird dog lento', sets: '3 × 10 por lado' },
          { name: 'Plancha lateral', sets: '3 × 20–30 seg por lado' },
        ],
      },
    ],
  },
  {
    day: 6,
    week: 1,
    title: 'Power Vinyasa Profundo',
    focus: 'Movilidad profunda + relajación + reset nervioso',
    icon: 'deepyoga',
    color: '#8b6914',
    duration: '30–45 min',
    type: 'yoga',
    sections: [
      {
        title: 'Flow Lento',
        subtitle: '15–20 min',
        exercises: [
          { name: 'Sun Salutation lento', sets: '3 rondas suaves' },
          { name: 'Deep lizard lunge', sets: '8 respiraciones por lado' },
          { name: 'Pigeon pose', sets: '8–10 respiraciones por lado' },
          { name: 'Downward dog pedaleando pies', sets: '5 respiraciones' },
        ],
      },
      {
        title: 'Movilidad Profunda',
        subtitle: '10–15 min',
        exercises: [
          { name: 'Seated forward fold', sets: '8 respiraciones' },
          { name: 'Happy baby', sets: '6 respiraciones' },
          { name: 'Supine twist', sets: '6 respiraciones por lado' },
        ],
      },
      {
        title: 'Reset Nervioso',
        subtitle: '5 min',
        exercises: [
          { name: 'Respiración diafragmática lenta', sets: 'Inhala 4s → Exhala 6s' },
          { name: 'Savasana', sets: '2 min' },
        ],
      },
    ],
  },
  {
    day: 7,
    week: 1,
    title: 'Descanso Activo',
    focus: 'Recuperación + caminata + movilidad opcional',
    icon: 'leaf',
    color: '#6b8e6b',
    duration: 'Opcional',
    type: 'rest',
    sections: [
      {
        title: 'Opciones',
        exercises: [
          { name: 'Caminata suave al aire libre', sets: '20–30 min' },
          { name: 'Estiramientos de movilidad', sets: '10–15 min' },
          { name: 'Foam roller o masaje', sets: '10 min' },
          { name: 'Respiración y meditación', sets: '5–10 min' },
        ],
      },
    ],
  },

  /* ═══════════════════ SEMANA 2 (bloqueados) ═══════════════════ */
  {
    day: 8,
    week: 2,
    title: 'Lower + Core',
    focus: 'Cuádriceps + control + estabilidad dinámica',
    icon: 'leg',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '4–5 min',
        exercises: [
          { name: 'Puente glúteo', sets: '15 reps' },
          { name: 'Caminata lateral con banda', sets: '15 por lado' },
          { name: 'Sentadilla lenta (3 seg bajar)', sets: '12 reps', note: 'Activación + control neuromuscular' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Goblet squat (o sentadilla tempo)', sets: '4 × 10', note: 'Baja en 3 seg — más activación, protege rodillas, mejora técnica' },
          { name: 'Front-foot elevated split squat', sets: '3 × 10 por pierna', note: 'Mayor rango de movimiento — más trabajo de glúteo + cuádriceps' },
          { name: 'Prensa unilateral', sets: '3 × 10 por pierna', note: 'Corrige desbalances — mejora estabilidad' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Extensión de cuádriceps', sets: '3 × 15', note: 'Pausa 1 seg arriba' },
          { name: 'Pantorrillas de pie', sets: '3 × 15–20' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha frontal con respiración controlada', sets: '3 × 40 seg' },
          { name: 'Dead bug lento', sets: '3 × 12 por lado' },
        ],
      },
    ],
  },
  {
    day: 9,
    week: 2,
    title: 'Upper + Core',
    focus: 'Pecho + hombros + estabilidad escapular',
    icon: 'flex',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '4–5 min',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Círculos de brazos', sets: '15 reps' },
          { name: 'Scapular push-ups', sets: '12 reps', note: 'Activa hombros y protege el cuello' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Press inclinado con mancuernas', sets: '4 × 10', note: 'Mayor activación del pecho superior — mejora postura' },
          { name: 'Shoulder press agarre neutro', sets: '3 × 10', note: 'Más amigable con hombros — reduce tensión cervical' },
          { name: 'Push-ups tempo lento', sets: '3 × 10', note: 'Baja en 3 seg — mayor activación muscular' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Elevaciones laterales con pausa', sets: '3 × 12–15', note: 'Pausa 1 seg arriba' },
          { name: 'Tríceps dips o extensión con mancuerna', sets: '3 × 12' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con toque de hombros lenta', sets: '3 × 24 toques' },
          { name: 'Hollow hold', sets: '3 × 30 seg' },
        ],
      },
    ],
  },
  {
    day: 10,
    week: 2,
    title: 'Power Vinyasa Flow',
    focus: 'Movilidad activa + fluidez + control corporal',
    icon: 'yoga',
    color: '#8b6914',
    duration: '30–35 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Calentamiento',
        subtitle: '4–5 min',
        exercises: [
          { name: 'Respiración profunda', sets: '1 min' },
          { name: 'Movilidad cervical y hombros', sets: '1 min' },
          { name: 'Cat–cow', sets: '12 reps' },
          { name: 'Rotaciones torácicas', sets: '8 por lado', note: 'Prepara columna y respiración' },
        ],
      },
      {
        title: 'Flow Principal',
        subtitle: 'Repetir 4–6 rondas',
        exercises: [
          { name: 'Sun Salutation A + apertura de pecho', sets: 'Fluido', note: 'Sincroniza respiración' },
          { name: 'Crescent lunge (lunge alto)', sets: '5 respiraciones por lado', note: 'Mayor activación de glúteo y core' },
          { name: 'Downward dog → pedalear pies', sets: '5 respiraciones' },
          { name: 'Warrior I → Warrior II → Reverse warrior', sets: '3–5 respiraciones cada uno' },
          { name: 'Pyramid stretch', sets: 'Mayor estiramiento femoral' },
          { name: 'Child\'s pose', sets: '5 respiraciones' },
        ],
      },
      {
        title: 'Core & Control',
        subtitle: '5 min',
        exercises: [
          { name: 'Plancha alta', sets: '35 seg' },
          { name: 'Bird dog lento', sets: '12 por lado' },
          { name: 'Dead bug', sets: '12 por lado' },
        ],
      },
    ],
  },
  {
    day: 11,
    week: 2,
    title: 'Lower + Core',
    focus: 'Glúteo + posterior + activación profunda',
    icon: 'glute',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Puente glúteo con pausa 2 seg', sets: '15 reps', note: 'Activación neuromuscular' },
          { name: 'Patadas de glúteo', sets: '15 por lado' },
          { name: 'Good mornings', sets: '15 reps' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Hip thrust con pausa arriba', sets: '4 × 10', note: 'Pausa 2 seg arriba — mayor activación del glúteo' },
          { name: 'Peso muerto rumano con mancuernas', sets: '3 × 10', note: 'Baja lento 3 seg — mayor estímulo femoral, protege zona lumbar' },
          { name: 'Curl femoral', sets: '3 × 12–15', note: 'Controla la bajada' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Step-ups controlados', sets: '3 × 10 por pierna' },
          { name: 'Abducciones con pausa', sets: '3 × 15', note: 'Pausa 1 seg afuera' },
        ],
      },
      {
        title: 'Core Posterior',
        exercises: [
          { name: 'Bird dog lento', sets: '3 × 12 por lado' },
          { name: 'Superman con pausa', sets: '3 × 12' },
        ],
      },
    ],
  },
  {
    day: 12,
    week: 2,
    title: 'Upper + Core',
    focus: 'Espalda estética + postura + brazos firmes',
    icon: 'weights',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Retracciones escapulares', sets: '12 reps' },
          { name: 'Rotaciones externas', sets: '12 reps', note: 'Mejora postura y protege hombros' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Jalón al pecho agarre amplio', sets: '3 × 10', note: 'Espalda más estética — postura elegante' },
          { name: 'Remo con mancuerna unilateral', sets: '3 × 10 por lado', note: 'Corrige desbalances — mejora conexión muscular' },
          { name: 'Face pulls con pausa', sets: '3 × 12', note: 'Pausa 1 seg atrás — hombros sanos' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Curl de bíceps controlado', sets: '3 × 12' },
          { name: 'Extensión de tríceps', sets: '3 × 12' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Bird dog lento', sets: '3 × 12 por lado' },
          { name: 'Plancha lateral', sets: '3 × 30 seg por lado' },
        ],
      },
    ],
  },
  {
    day: 13,
    week: 2,
    title: 'Power Vinyasa Profundo',
    focus: 'Apertura profunda + liberación miofascial + reset nervioso',
    icon: 'deepyoga',
    color: '#8b6914',
    duration: '35–45 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Flow Lento',
        subtitle: '15–20 min',
        exercises: [
          { name: 'Sun Salutation lento', sets: '3 rondas conscientes' },
          { name: 'Deep lizard lunge + apertura de pecho', sets: '8 respiraciones por lado' },
          { name: 'Pigeon pose (inclinación hacia delante)', sets: '10 respiraciones por lado' },
          { name: 'Downward dog profundo', sets: '6 respiraciones' },
        ],
      },
      {
        title: 'Movilidad Profunda',
        subtitle: '10–15 min',
        exercises: [
          { name: 'Wide-leg forward fold', sets: '8 respiraciones' },
          { name: 'Happy baby', sets: '6–8 respiraciones' },
          { name: 'Supine twist', sets: '8 respiraciones por lado' },
        ],
      },
      {
        title: 'Reset Nervioso',
        subtitle: '5 min',
        exercises: [
          { name: 'Respiración diafragmática', sets: 'Inhala 4s → Exhala 6–8s' },
          { name: 'Savasana', sets: '3 min' },
        ],
      },
    ],
  },
  {
    day: 14,
    week: 2,
    title: 'Descanso Activo',
    focus: 'Recuperación + caminata + movilidad opcional',
    icon: 'leaf',
    color: '#6b8e6b',
    duration: 'Opcional',
    type: 'rest',
    locked: true,
    sections: [
      {
        title: 'Opciones',
        exercises: [
          { name: 'Caminata suave al aire libre', sets: '20–30 min' },
          { name: 'Estiramientos de movilidad', sets: '10–15 min' },
          { name: 'Foam roller o masaje', sets: '10 min' },
          { name: 'Respiración y meditación', sets: '5–10 min' },
        ],
      },
    ],
  },

  /* ═══════════════════ SEMANA 3 (bloqueados) ═══════════════════ */
  {
    day: 15,
    week: 3,
    title: 'Lower + Core',
    focus: 'Fuerza + potencia controlada + estabilidad',
    icon: 'leg',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '5 min',
        exercises: [
          { name: 'Puente glúteo', sets: '15 reps' },
          { name: 'Caminata lateral con banda', sets: '15 por lado' },
          { name: 'Sentadilla pausa abajo 2 seg', sets: '10 reps', note: 'Activación neuromuscular profunda' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Sentadilla (barra o goblet pesado)', sets: '4 × 8', note: 'Aumenta peso moderadamente — pausa 1 seg abajo. Mayor fuerza y activación muscular' },
          { name: 'Bulgarian split squat', sets: '3 × 10 por pierna', note: 'Ahora con carga mayor — control total del movimiento' },
          { name: 'Prensa unilateral', sets: '3 × 10 por pierna', note: 'Empuja con control, no rebotes' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Extensión de cuádriceps', sets: '3 × 12', note: 'Últimas reps lentas' },
          { name: 'Pantorrillas', sets: '3 × 20' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con peso o elevación alterna de pies', sets: '3 × 40 seg' },
          { name: 'Dead bug con pausa', sets: '3 × 12 por lado' },
        ],
      },
    ],
  },
  {
    day: 16,
    week: 3,
    title: 'Upper + Core',
    focus: 'Fuerza + definición hombros + estabilidad escapular',
    icon: 'flex',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '5 min',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Scapular push-ups', sets: '12 reps' },
          { name: 'Rotaciones externas con banda', sets: '12 reps', note: 'Protege hombros y mejora postura' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Press inclinado con mancuernas (más peso)', sets: '4 × 8–10', note: 'Controla la bajada — aumenta peso moderadamente. Pecho firme, postura abierta' },
          { name: 'Shoulder press', sets: '4 × 8–10', note: 'Un poco más desafiante — abdomen activo. Hombros definidos' },
          { name: 'Push-ups controladas', sets: '3 × 10–12', note: 'Baja lento — core firme' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Elevaciones laterales', sets: '3 × 15', note: 'Últimas reps lentas' },
          { name: 'Extensión de tríceps sobre cabeza', sets: '3 × 12', note: 'Mayor activación del tríceps largo' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con toque de hombros', sets: '3 × 30 toques' },
          { name: 'Hollow hold', sets: '3 × 35 seg' },
        ],
      },
    ],
  },
  {
    day: 17,
    week: 3,
    title: 'Power Vinyasa Flow',
    focus: 'Fluidez avanzada + equilibrio + control corporal',
    icon: 'yoga',
    color: '#8b6914',
    duration: '30–35 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Calentamiento',
        subtitle: '5 min',
        exercises: [
          { name: 'Respiración profunda', sets: '1 min' },
          { name: 'Movilidad cervical y hombros', sets: '1 min' },
          { name: 'Cat–cow', sets: '12 reps' },
          { name: 'Rotaciones torácicas', sets: '10 por lado', note: 'Prepara columna y respiración' },
        ],
      },
      {
        title: 'Flow Principal',
        subtitle: 'Repetir 4–6 rondas',
        exercises: [
          { name: 'Sun Salutation A fluido', sets: 'Fluido', note: 'Sincroniza respiración' },
          { name: 'Crescent lunge', sets: '5 respiraciones por lado', note: 'Activa glúteo + core' },
          { name: 'Warrior I → Warrior II → Reverse warrior', sets: '3–5 respiraciones cada uno' },
          { name: 'Warrior III (equilibrio)', sets: '3 respiraciones por lado', note: 'Estabilidad y control corporal' },
          { name: 'Downward dog pedaleando pies', sets: '5 respiraciones' },
          { name: 'Child\'s pose', sets: '5 respiraciones' },
        ],
      },
      {
        title: 'Core & Control',
        subtitle: '5 min',
        exercises: [
          { name: 'Plancha alta', sets: '40 seg' },
          { name: 'Bird dog lento', sets: '12 por lado' },
          { name: 'Dead bug', sets: '12 por lado' },
        ],
      },
    ],
  },
  {
    day: 18,
    week: 3,
    title: 'Lower + Core',
    focus: 'Glúteo máximo + posterior fuerte + estabilidad pélvica',
    icon: 'glute',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Puente glúteo pausa 2 seg', sets: '15 reps' },
          { name: 'Patadas de glúteo', sets: '15 por lado' },
          { name: 'Good mornings', sets: '15 reps', note: 'Activación total de cadena posterior' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Hip thrust pesado', sets: '4 × 8–10', note: 'Pausa arriba — sube peso progresivamente. Crecimiento real del glúteo' },
          { name: 'Peso muerto rumano', sets: '4 × 8–10', note: 'Mayor carga — control total bajando. Femoral fuerte, glúteo más firme' },
          { name: 'Curl femoral', sets: '3 × 12–15', note: 'Lento y controlado' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Step-ups controlados', sets: '3 × 12 por pierna' },
          { name: 'Abducciones con pausa', sets: '3 × 15–20', note: 'Máxima activación glúteo medio' },
        ],
      },
      {
        title: 'Core Posterior',
        exercises: [
          { name: 'Bird dog lento', sets: '3 × 12 por lado' },
          { name: 'Superman con pausa', sets: '3 × 15' },
        ],
      },
    ],
  },
  {
    day: 19,
    week: 3,
    title: 'Upper + Core',
    focus: 'Espalda definida + postura elegante + brazos firmes',
    icon: 'weights',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Retracciones escapulares', sets: '12 reps' },
          { name: 'Rotaciones externas', sets: '12 reps', note: 'Activa espalda media y hombros' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Jalón al pecho', sets: '4 × 8–10', note: 'Aumenta peso progresivamente — pecho abierto al jalar. Espalda estética, postura elegante' },
          { name: 'Remo unilateral con mancuerna', sets: '3 × 10 por lado', note: 'Pausa 1 seg arriba — controla bajada. Mayor activación dorsal' },
          { name: 'Face pulls', sets: '3 × 15', note: 'Pausa atrás — hombros sanos y postura perfecta' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Curl martillo', sets: '3 × 12', note: 'Define brazo completo' },
          { name: 'Extensión tríceps', sets: '3 × 12' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Bird dog lento', sets: '3 × 12 por lado' },
          { name: 'Plancha lateral', sets: '3 × 35 seg por lado' },
        ],
      },
    ],
  },
  {
    day: 20,
    week: 3,
    title: 'Power Vinyasa Profundo',
    focus: 'Apertura profunda + liberación miofascial + relajación total',
    icon: 'deepyoga',
    color: '#8b6914',
    duration: '40–45 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Flow Lento',
        subtitle: '15–20 min',
        exercises: [
          { name: 'Sun Salutation lento y consciente', sets: '3 rondas' },
          { name: 'Deep lizard lunge + apertura torácica', sets: '10 respiraciones por lado' },
          { name: 'Pigeon pose profundo', sets: '10–12 respiraciones por lado' },
          { name: 'Downward dog profundo', sets: '6 respiraciones' },
        ],
      },
      {
        title: 'Movilidad Profunda',
        subtitle: '12–15 min',
        exercises: [
          { name: 'Wide-leg forward fold', sets: '10 respiraciones' },
          { name: 'Happy baby', sets: '8 respiraciones' },
          { name: 'Supine twist', sets: '8–10 respiraciones por lado' },
        ],
      },
      {
        title: 'Reset Nervioso',
        subtitle: '5 min',
        exercises: [
          { name: 'Respiración diafragmática', sets: 'Inhala 4s → Exhala 8s' },
          { name: 'Savasana', sets: '3–4 min' },
        ],
      },
    ],
  },
  {
    day: 21,
    week: 3,
    title: 'Descanso Activo',
    focus: 'Recuperación + caminata + movilidad opcional',
    icon: 'leaf',
    color: '#6b8e6b',
    duration: 'Opcional',
    type: 'rest',
    locked: true,
    sections: [
      {
        title: 'Opciones',
        exercises: [
          { name: 'Caminata suave al aire libre', sets: '20–30 min' },
          { name: 'Estiramientos de movilidad', sets: '10–15 min' },
          { name: 'Foam roller o masaje', sets: '10 min' },
          { name: 'Respiración y meditación', sets: '5–10 min' },
        ],
      },
    ],
  },

  /* ═══════════════════ SEMANA 4 (bloqueados) ═══════════════════ */
  {
    day: 22,
    week: 4,
    title: 'Lower + Core',
    focus: 'Definición muscular + control + tiempo bajo tensión',
    icon: 'leg',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '5 min',
        exercises: [
          { name: 'Puente glúteo', sets: '15 reps' },
          { name: 'Caminata lateral con banda', sets: '15 por lado' },
          { name: 'Sentadilla lenta', sets: '12 reps', note: 'Activación total de piernas y core' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Goblet squat controlado', sets: '3 × 12', note: 'Baja 3 seg — sube controlado. Definición muscular, protección articular' },
          { name: 'Bulgarian split squat', sets: '3 × 12 por pierna', note: 'Rango completo — control total' },
          { name: 'Prensa de piernas', sets: '3 × 15', note: 'Sin bloquear rodillas — tensión continua' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Extensión de cuádriceps', sets: '3 × 15', note: 'Última serie drop set opcional' },
          { name: 'Pantorrillas', sets: '3 × 20–25' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con elevación alterna de piernas', sets: '3 × 45 seg' },
          { name: 'Dead bug lento', sets: '3 × 15 por lado' },
        ],
      },
    ],
  },
  {
    day: 23,
    week: 4,
    title: 'Upper + Core',
    focus: 'Definición hombros + resistencia muscular + estabilidad escapular',
    icon: 'flex',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '5 min',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Rotaciones externas con banda', sets: '12 reps' },
          { name: 'Scapular push-ups', sets: '12 reps', note: 'Activa hombros y protege cuello' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Press inclinado con mancuernas', sets: '3 × 12', note: 'Baja lento — tensión constante. Firmeza del pecho, postura abierta' },
          { name: 'Shoulder press', sets: '3 × 12', note: 'Peso moderado — control total. Definición hombros' },
          { name: 'Push-ups controladas', sets: '3 × 12–15', note: 'Movimiento continuo — core firme' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Elevaciones laterales', sets: '3 × 15–18', note: 'Sin impulso — tensión continua' },
          { name: 'Extensión tríceps sobre cabeza', sets: '3 × 15', note: 'Firmeza de brazos' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con toque de hombros', sets: '3 × 40 toques' },
          { name: 'Hollow hold', sets: '3 × 40 seg' },
        ],
      },
    ],
  },
  {
    day: 24,
    week: 4,
    title: 'Power Vinyasa Flow',
    focus: 'Fluidez total + movilidad integrada + control respiratorio',
    icon: 'yoga',
    color: '#8b6914',
    duration: '30–35 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Calentamiento',
        subtitle: '5 min',
        exercises: [
          { name: 'Respiración profunda', sets: '1 min' },
          { name: 'Movilidad cervical y hombros', sets: '1 min' },
          { name: 'Cat–cow', sets: '12 reps' },
          { name: 'Rotaciones torácicas', sets: '10 por lado', note: 'Prepara columna y respiración' },
        ],
      },
      {
        title: 'Flow Principal',
        subtitle: 'Repetir 4–6 rondas',
        exercises: [
          { name: 'Sun Salutation A fluido', sets: 'Fluido', note: 'Sincroniza respiración' },
          { name: 'Crescent lunge + apertura de pecho', sets: '5 respiraciones por lado', note: 'Movilidad torácica + caderas' },
          { name: 'Warrior II → Reverse warrior', sets: '5 respiraciones cada uno' },
          { name: 'Triangle pose (trikonasana)', sets: '5 respiraciones por lado', note: 'Apertura lateral del cuerpo' },
          { name: 'Downward dog profundo', sets: '5 respiraciones' },
          { name: 'Child\'s pose', sets: '5 respiraciones' },
        ],
      },
      {
        title: 'Core & Control',
        subtitle: '5 min',
        exercises: [
          { name: 'Plancha alta', sets: '40 seg' },
          { name: 'Bird dog lento', sets: '12 por lado' },
          { name: 'Dead bug', sets: '12 por lado' },
        ],
      },
    ],
  },
  {
    day: 25,
    week: 4,
    title: 'Lower + Core',
    focus: 'Glúteo redondo + activación máxima + estabilidad',
    icon: 'glute',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Puente glúteo pausa', sets: '15 reps' },
          { name: 'Patadas de glúteo', sets: '15 por lado' },
          { name: 'Good mornings', sets: '15 reps', note: 'Activación profunda del glúteo' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Hip thrust', sets: '3 × 12', note: 'Pausa arriba — controla bajada. Forma redonda del glúteo' },
          { name: 'Peso muerto rumano', sets: '3 × 12', note: 'Tensión constante — espalda neutra' },
          { name: 'Curl femoral', sets: '3 × 15', note: 'Lento y controlado' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Step-ups', sets: '3 × 12 por pierna' },
          { name: 'Abducciones', sets: '3 × 20', note: 'Máxima activación glúteo medio' },
        ],
      },
      {
        title: 'Core Posterior',
        exercises: [
          { name: 'Bird dog', sets: '3 × 15 por lado' },
          { name: 'Superman', sets: '3 × 15' },
        ],
      },
    ],
  },
  {
    day: 26,
    week: 4,
    title: 'Upper + Core',
    focus: 'Espalda definida + postura elegante + resistencia muscular',
    icon: 'weights',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Retracciones escapulares', sets: '12 reps' },
          { name: 'Rotaciones externas', sets: '12 reps', note: 'Activa espalda media' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Jalón al pecho', sets: '3 × 12', note: 'Movimiento controlado — pecho abierto. Espalda estética, postura elegante' },
          { name: 'Remo unilateral', sets: '3 × 12 por lado', note: 'Pausa arriba — control total. Activación dorsal profunda' },
          { name: 'Face pulls', sets: '3 × 15–18', note: 'Pausa atrás — hombros saludables' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Curl martillo', sets: '3 × 12–15' },
          { name: 'Extensión tríceps', sets: '3 × 15' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Bird dog', sets: '3 × 15 por lado' },
          { name: 'Plancha lateral', sets: '3 × 40 seg por lado' },
        ],
      },
    ],
  },
  {
    day: 27,
    week: 4,
    title: 'Power Vinyasa Profundo',
    focus: 'Liberación profunda + relajación total + reset del sistema nervioso',
    icon: 'deepyoga',
    color: '#8b6914',
    duration: '40–45 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Flow Lento',
        subtitle: '15–20 min',
        exercises: [
          { name: 'Sun Salutation lento y consciente', sets: '3 rondas' },
          { name: 'Deep lizard lunge', sets: '10 respiraciones por lado' },
          { name: 'Pigeon pose profundo', sets: '12 respiraciones por lado' },
          { name: 'Downward dog profundo', sets: '6 respiraciones' },
        ],
      },
      {
        title: 'Movilidad Profunda',
        subtitle: '12–15 min',
        exercises: [
          { name: 'Seated forward fold', sets: '10 respiraciones' },
          { name: 'Happy baby', sets: '8–10 respiraciones' },
          { name: 'Supine twist', sets: '10 respiraciones por lado' },
        ],
      },
      {
        title: 'Reset Nervioso',
        subtitle: '5–7 min',
        exercises: [
          { name: 'Respiración diafragmática', sets: 'Inhala 4s → Exhala 8s' },
          { name: 'Savasana', sets: '4–5 min' },
        ],
      },
    ],
  },
  {
    day: 28,
    week: 4,
    title: 'Descanso Activo',
    focus: 'Recuperación + caminata + movilidad opcional',
    icon: 'leaf',
    color: '#6b8e6b',
    duration: 'Opcional',
    type: 'rest',
    locked: true,
    sections: [
      {
        title: 'Opciones',
        exercises: [
          { name: 'Caminata suave al aire libre', sets: '20–30 min' },
          { name: 'Estiramientos de movilidad', sets: '10–15 min' },
          { name: 'Foam roller o masaje', sets: '10 min' },
          { name: 'Respiración y meditación', sets: '5–10 min' },
        ],
      },
    ],
  },
];
