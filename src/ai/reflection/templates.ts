// Plantillas de apertura de "Reflexión del Día" por estado (MVP: sin IA libre).
// La reflexión (HSM / "Tu Espacio") es introspección de vida — dimensiones como
// Identidad, Vocación, Propósito, Metas, Disciplina. Por eso el saludo es
// CONTEMPLATIVO (prepara para mirar hacia adentro), NO de coach de gym.
// El "estado" solo modula el tono según si vuelves tras una ausencia, etc.
// Copy real, listo para tunear. Doc: docs/reflexion-del-dia.md

import type { ReflectionState, ReflectionContext } from './state';

export type Locale = 'es' | 'en';

export interface ReflectionOpening {
  state: ReflectionState;
  message: string;   // saludo contemplativo que abre el espacio (1-2 frases)
  question: string;  // (no se muestra en la intro; reservado para futuro)
}

type Variant = { message: string; question: string };
type Templates = Record<ReflectionState, Record<Locale, Variant[]>>;

// `question` queda como string vacío: las preguntas reales viven en el banco HSM.
const Q = '';

const T: Templates = {
  // Vuelve tras ≥5 días: reencuentro con el espacio, sin culpa.
  return: {
    es: [
      { message: 'Hace tiempo que no te dabas este momento. Bienvenido de vuelta a tu espacio.', question: Q },
      { message: 'Volviste. No a recuperar lo perdido — a seguir conociéndote desde donde estás hoy.', question: Q },
    ],
    en: [
      { message: 'It’s been a while since you gave yourself this. Welcome back to your space.', question: Q },
      { message: 'You came back. Not to recover what’s lost — to keep knowing yourself from where you are today.', question: Q },
    ],
  },
  // 2-4 días sin pasar: el ritmo se rompió, se retoma con calma.
  relapse: {
    es: [
      { message: 'Unos días sin mirar hacia adentro. Está bien — el silencio también es parte. Retomemos.', question: Q },
      { message: 'La vida se interpuso. Hoy vuelves a hacerte espacio, y eso ya dice algo de ti.', question: Q },
    ],
    en: [
      { message: 'A few days without looking inward. That’s okay — the quiet is part of it too. Let’s pick it up.', question: Q },
      { message: 'Life got in the way. Today you make space again, and that already says something about you.', question: Q },
    ],
  },
  // Saltó un día: gentil, retomar el hilo.
  slip: {
    es: [
      { message: 'Ayer no pasaste por aquí. Sin reproches — hoy retomas el hilo contigo.', question: Q },
      { message: 'Un día de pausa no rompe nada. Aquí sigues, listo para mirar hacia adentro.', question: Q },
    ],
    en: [
      { message: 'You didn’t stop by yesterday. No reproach — today you pick the thread back up with yourself.', question: Q },
      { message: 'A day’s pause breaks nothing. Here you are, ready to look inward.', question: Q },
    ],
  },
  // Constante: reconoce el hábito de cuidarse, en clave introspectiva.
  momentum: {
    es: [
      { message: 'Vienes cuidando este espacio con constancia. Conocerte se está volviendo un hábito.', question: Q },
      { message: 'Día tras día eliges mirar hacia adentro. Pocos lo hacen — sigue.', question: Q },
      { message: 'La constancia con la que vuelves aquí dice mucho de quién te estás volviendo.', question: Q },
    ],
    en: [
      { message: 'You keep tending to this space. Knowing yourself is becoming a habit.', question: Q },
      { message: 'Day after day you choose to look inward. Few do — keep going.', question: Q },
      { message: 'The consistency with which you return here says a lot about who you’re becoming.', question: Q },
    ],
  },
  // (No disparan en el MVP; copy contemplativo genérico por si acaso.)
  breakthrough: {
    es: [{ message: 'Algo se movió en ti últimamente. Tómate este momento para entender qué.', question: Q }],
    en: [{ message: 'Something shifted in you lately. Take this moment to understand what.', question: Q }],
  },
  plateau: {
    es: [{ message: 'A veces parece que nada cambia, y por dentro está pasando todo. Mira con calma.', question: Q }],
    en: [{ message: 'Sometimes it feels like nothing changes, while inside everything is. Look closely.', question: Q }],
  },
  // Día normal: invitación contemplativa a pausar.
  stable: {
    es: [
      { message: 'Este es tu espacio. Un momento para mirar hacia adentro, sin prisa.', question: Q },
      { message: 'Baja el ritmo un momento. Aquí no hay nada que demostrar, solo algo que entender.', question: Q },
      { message: 'Un alto en el día para reencontrarte contigo. Respira y empieza cuando estés listo.', question: Q },
      { message: 'Los momentos de silencio contigo son los que más te enseñan. Aquí tienes uno.', question: Q },
      { message: 'Hoy no se trata de hacer, sino de notar. ¿Qué hay debajo del ruido?', question: Q },
      { message: 'Tu mente lleva todo el día hablándote. Es buen momento para escucharla.', question: Q },
      { message: 'Date permiso de parar un minuto y ser honesto contigo. Eso ya es valiente.', question: Q },
    ],
    en: [
      { message: 'This is your space. A moment to look inward, no rush.', question: Q },
      { message: 'Slow down for a moment. Nothing to prove here — just something to understand.', question: Q },
      { message: 'A pause in the day to meet yourself again. Breathe, and start when you’re ready.', question: Q },
      { message: 'The quiet moments with yourself teach you the most. Here’s one.', question: Q },
      { message: 'Today isn’t about doing — it’s about noticing. What’s beneath the noise?', question: Q },
      { message: 'Your mind has been talking to you all day. Good time to listen.', question: Q },
      { message: 'Give yourself permission to stop a minute and be honest with you. That’s already brave.', question: Q },
    ],
  },
};

/** Devuelve el copy de apertura para un estado. `seed` elige variante de forma determinista. */
export function getOpeningCopy(
  state: ReflectionState,
  _ctx: ReflectionContext,
  locale: Locale,
  seed = 0,
): ReflectionOpening {
  const variants = T[state][locale];
  const v = variants[Math.abs(seed) % variants.length];
  return { state, message: v.message, question: v.question };
}
