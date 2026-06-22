// Plantillas de apertura de "Reflexión del Día" por estado (MVP: sin IA libre).
// Cada estado activa un mecanismo conductual distinto (ver docs/reflexion-del-dia.md, Parte 2/5).
// Copy real, listo para tunear. Interpolación: {name}, {streak}.

import type { ReflectionState, ReflectionContext } from './state';

export type Locale = 'es' | 'en';

export interface ReflectionOpening {
  state: ReflectionState;
  message: string;   // lo que dice el coach (1-2 frases)
  question: string;  // 1 pregunta para responder
}

type Variant = { message: string; question: string };
type Templates = Record<ReflectionState, Record<Locale, Variant[]>>;

const T: Templates = {
  breakthrough: {
    es: [{
      message: 'Hoy tu cuerpo respondió. Esto es exactamente lo que se siente progresar — recuérdalo.',
      question: '¿Cómo se siente ser quien eres hoy comparado con cuando empezaste?',
    }],
    en: [{
      message: 'Your body answered today. This is exactly what progress feels like — remember it.',
      question: 'How does it feel to be who you are today versus when you started?',
    }],
  },
  momentum: {
    es: [
      { message: '{streak} días seguidos. Eso ya no es motivación, es identidad.', question: '¿Qué parte de ti cambió que la gente todavía no nota?' },
      { message: 'Llevas {streak} días. La constancia dejó de ser esfuerzo y empezó a ser quién eres.', question: 'Si tu yo de hace un mes te viera hoy, ¿qué pensaría?' },
      { message: '{streak} días. La mayoría se rinde antes de llegar aquí — tú no.', question: '¿Qué te dirías a ti mismo del día 1 si pudieras?' },
      { message: 'La racha de {streak} no es suerte. Es un montón de decisiones pequeñas que sí tomaste.', question: '¿Cuál fue la decisión más difícil de sostener esta semana?' },
      { message: '{streak} días construyendo a la persona que querías ser. Sigue.', question: '¿Qué hábito ya te sale en automático que antes te costaba?' },
    ],
    en: [
      { message: '{streak} days in a row. That isn’t motivation anymore — it’s identity.', question: 'What part of you changed that people haven’t noticed yet?' },
      { message: '{streak} days strong. Consistency stopped being effort and became who you are.', question: 'If you from a month ago saw you today, what would they think?' },
      { message: '{streak} days. Most people quit before getting here — you didn’t.', question: 'What would you tell your day-1 self if you could?' },
      { message: 'A {streak}-day streak isn’t luck. It’s a pile of small decisions you actually made.', question: 'What was the hardest one to hold this week?' },
      { message: '{streak} days building the person you wanted to be. Keep going.', question: 'What habit is now automatic that used to be hard?' },
    ],
  },
  plateau: {
    es: [{
      message: 'El número no se movió, pero tu trabajo sí. La báscula es un solo testigo, y miente a corto plazo.',
      question: 'Además del número, ¿en qué notas que estás distinto?',
    }],
    en: [{
      message: 'The number didn’t move, but your work did. The scale is one witness, and it lies short-term.',
      question: 'Beyond the number, where do you notice you’re different?',
    }],
  },
  slip: {
    es: [{
      message: 'Ayer no entrenaste. Un día no borra lo que construiste — esto no es romper la racha, es ser humano.',
      question: '¿Qué es lo MÍNIMO que sí puedes hacer hoy para seguir siendo esa persona?',
    }],
    en: [{
      message: 'You missed yesterday. One day doesn’t erase what you built — this isn’t breaking the streak, it’s being human.',
      question: 'What’s the SMALLEST thing you can do today to stay that person?',
    }],
  },
  relapse: {
    es: [{
      message: 'Unos días fuera no borran tu progreso. Lo que define no es la caída, es volver — y aquí estás.',
      question: '¿Qué se interpuso estos días? Sin juicio, solo para verlo claro.',
    }],
    en: [{
      message: 'A few days off don’t erase your progress. What defines you isn’t the fall, it’s the return — and here you are.',
      question: 'What got in the way these days? No judgment, just to see it clearly.',
    }],
  },
  return: {
    es: [{
      message: 'Volviste. Eso ya dice más de ti que cualquier racha. No vamos a recuperar lo perdido, vamos a empezar desde donde estás.',
      question: '¿Qué te trajo de vuelta hoy?',
    }],
    en: [{
      message: 'You came back. That says more about you than any streak. We won’t recover what’s lost — we start from where you are.',
      question: 'What brought you back today?',
    }],
  },
  stable: {
    es: [
      { message: 'Un momento para ti. Sin prisa.', question: '¿Cómo llegas hoy, en una frase?' },
      { message: 'Los días normales son los que construyen. Aquí estás, otra vez.', question: '¿Qué es una cosa que hoy sí está bajo tu control?' },
      { message: 'No todo tiene que ser épico. Hoy basta con presentarte.', question: '¿Qué pequeña cosa te haría sentir bien contigo al final del día?' },
      { message: 'Respira. Estás en el lugar correcto haciendo el trabajo correcto.', question: '¿Qué es lo que más te pesa hoy, y qué tan real es?' },
      { message: 'El progreso casi nunca se siente como progreso. Se siente como hoy.', question: '¿En qué eres un poco mejor que hace un mes?' },
      { message: 'Cerrar el día con honestidad ya es un avance.', question: '¿Qué hiciste hoy que tu yo del futuro te agradecería?' },
      { message: 'No vienes a ser perfecto. Vienes a ser constante.', question: 'Si hoy solo pudieras ganar una cosa, ¿cuál elegirías?' },
    ],
    en: [
      { message: 'A moment for you. No rush.', question: 'How are you arriving today, in one line?' },
      { message: 'Ordinary days are the ones that build. Here you are, again.', question: 'What’s one thing that’s within your control today?' },
      { message: 'Not everything has to be epic. Today, just showing up is enough.', question: 'What small thing would make you feel good about yourself by tonight?' },
      { message: 'Breathe. You’re in the right place doing the right work.', question: 'What’s weighing on you today — and how real is it?' },
      { message: 'Progress rarely feels like progress. It feels like today.', question: 'Where are you a little better than a month ago?' },
      { message: 'Closing the day with honesty is already a step forward.', question: 'What did you do today that your future self would thank you for?' },
      { message: 'You’re not here to be perfect. You’re here to be consistent.', question: 'If you could win just one thing today, which would it be?' },
    ],
  },
};

function interpolate(s: string, ctx: ReflectionContext): string {
  return s
    .replace(/\{streak\}/g, String(ctx.streakCount))
    .replace(/\{name\}/g, '');
}

/** Devuelve el copy de apertura para un estado. `seed` elige variante de forma determinista. */
export function getOpeningCopy(
  state: ReflectionState,
  ctx: ReflectionContext,
  locale: Locale,
  seed = 0,
): ReflectionOpening {
  const variants = T[state][locale];
  const v = variants[Math.abs(seed) % variants.length];
  return {
    state,
    message: interpolate(v.message, ctx),
    question: interpolate(v.question, ctx),
  };
}
