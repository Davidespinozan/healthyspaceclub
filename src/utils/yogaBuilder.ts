// Arma una clase de Power Vinyasa por BLOQUES (flows + poses sostenidas), de forma
// DETERMINISTA (un ritual no necesita IA — la estructura es fija). Los FLOWS se
// reproducen corridos y se repiten en VUELTAS para ajustar la duración; las POSES
// sostenidas (pico, enfriamiento, savasana) llevan su tiempo.
import type { YogaPlan, YogaPose, Difficulty } from '../types';
import type { AppLanguage } from '../store';
import { YOGA_FLOWS, type YogaFlow } from '../data/yogaFlows';

const F = Object.fromEntries(YOGA_FLOWS.map((f) => [f.id, f])) as Record<string, YogaFlow>;

// Pose sostenida (id del banco de yoga) con su tiempo y si va por lado.
function hold(id: string, seconds: number, sides?: 'both'): YogaPose {
  return { id, duration: seconds, ...(sides ? { sides } : {}) };
}

// Flow → una "pose" con subtítulos y duración = roundSec × vueltas (× 2 si es por lado).
function flowPose(id: string, rounds: number, locale: AppLanguage): YogaPose {
  const f = F[id];
  const both = f.bothSides;
  return {
    id: f.id, isFlow: true,
    name: locale === 'en' ? f.nameEn : f.name,
    duration: f.roundSec * rounds * (both ? 2 : 1),
    roundSec: f.roundSec,
    ...(both ? { sides: 'both' as const } : {}),
    segments: f.segments.map((s) => ({ label: locale === 'en' ? s.labelEn : s.label, atSec: s.atSec })),
  };
}

// Pico según nivel (una pose desafiante, sostenida).
function peakPose(level: Difficulty, painArea?: string): string {
  if (painArea === 'espalda') return 'boat-pose';   // nada de rueda/camello con dolor de espalda
  if (level === 'avanzado') return 'wheel-pose';
  if (level === 'intermedio') return 'camel-pose';
  return 'side-plank-yoga';
}

/** Genera una clase de Power Vinyasa de ~targetSeconds, adaptada a nivel y molestia. */
export function buildYogaFlowPlan(
  targetSeconds: number, level: Difficulty = 'principiante',
  painArea?: string, locale: AppLanguage = 'es',
): YogaPlan {
  const savasana = Math.max(180, Math.round(targetSeconds * 0.1));

  // Bloques FIJOS (tiempos base) — centering, pico y enfriamiento.
  const centering: YogaPose[] = [hold('child-pose', 45), hold('cat-cow', 50)];
  const peak: YogaPose[] = [hold(peakPose(level, painArea), 40)];
  const cooldown: YogaPose[] = [
    hold('pigeon-pose', 60, 'both'),
    hold('seated-forward-fold', 45),
    hold('seated-twist', 50, 'both'),
    flowPose('flow-enfriamiento', 1, locale),
  ];
  const fixedSec =
    [...centering, ...peak, ...cooldown].reduce((s, p) => s + p.duration, 0) + savasana;

  // Lo que queda se reparte a los FLOWS dinámicos vía VUELTAS (Magaly/David: más
  // vueltas = clase más larga, respetando el flow). Reparto por pesos.
  const flexSec = Math.max(0, targetSeconds - fixedSec);
  const plan: Array<{ id: string; w: number }> = [
    { id: 'flow-saludo-a', w: 1.4 },   // calentar
    { id: 'flow-saludo-b', w: 1.2 },
    { id: 'flow-guerreros', w: 1.6 },  // corazón de la clase
    { id: 'flow-vinyasa', w: 0.5 },
    { id: 'flow-silla', w: 0.8 },
    { id: 'flow-zancada', w: 0.8 },
  ];
  const wsum = plan.reduce((s, x) => s + x.w, 0);
  const flows: YogaPose[] = plan.map(({ id, w }) => {
    const f = F[id];
    const perRound = f.roundSec * (f.bothSides ? 2 : 1);
    const budget = (flexSec * w) / wsum;
    const rounds = Math.max(1, Math.round(budget / perRound));
    return flowPose(id, rounds, locale);
  });

  // Orden ritual: centering → calentamiento → serie de pie (con vinyasa) → pico →
  // enfriamiento → savasana.
  const warmup = flows.filter((p) => p.id === 'flow-saludo-a' || p.id === 'flow-saludo-b');
  const standing = flows.filter((p) => p.id.startsWith('flow-') && !warmup.includes(p) && p.id !== 'flow-enfriamiento');
  // Intercala un vinyasa entre los bloques de pie (transición).
  const poses: YogaPose[] = [
    ...centering,
    ...warmup,
    ...standing,
    ...peak,
    ...cooldown,
    hold('savasana', savasana),
  ];

  const total = poses.reduce((s, p) => s + p.duration, 0);
  return {
    type: `Power Vinyasa ${Math.round(targetSeconds / 60)} min`,
    totalDuration: total,
    intensity: level === 'avanzado' ? 'alta' : level === 'intermedio' ? 'media' : 'baja',
    opening: locale === 'en'
      ? 'Arrive on your mat and take three deep breaths to center.'
      : 'Llega a tu tapete y toma tres respiraciones profundas para centrarte.',
    poses,
    closing: locale === 'en'
      ? 'Slowly return, keep the calm you built.'
      : 'Regresa despacio, conserva la calma que construiste.',
  };
}
