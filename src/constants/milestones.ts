export const MILESTONE_STEPS = [3, 7, 14, 30, 60, 90, 180, 365] as const;

export type MilestoneDay = typeof MILESTONE_STEPS[number];

export const MILESTONE_LABELS: Record<number, string> = {
  3: '3d',
  7: '7d',
  14: '14d',
  30: '30d',
  60: '60d',
  90: '90d',
  180: '180d',
  365: '1a',
};

export const MILESTONE_FULL_LABELS: Record<number, string> = {
  3: '3 días',
  7: 'una semana',
  14: 'dos semanas',
  30: 'un mes',
  60: 'dos meses',
  90: 'tres meses',
  180: 'seis meses',
  365: 'un año',
};

export const MILESTONE_COPY: Record<number, { emoji: string; title: string; sub: string }> = {
  3: { emoji: '🌱', title: '3 días', sub: 'Has plantado el hábito' },
  7: { emoji: '🔥', title: 'Una semana', sub: 'La constancia toma forma' },
  14: { emoji: '✨', title: 'Dos semanas', sub: 'Tu cuerpo empieza a notar el cambio' },
  30: { emoji: '🌙', title: 'Un mes', sub: 'Ya es parte de tu vida' },
  60: { emoji: '⛰️', title: 'Dos meses', sub: 'Disciplina genuina' },
  90: { emoji: '🌊', title: 'Un trimestre', sub: 'Pocas personas llegan aquí' },
  180: { emoji: '☀️', title: 'Seis meses', sub: 'Transformación profunda' },
  365: { emoji: '🏔️', title: 'Un año', sub: 'Maestría' },
};

export function getAchievementsCount(streakCount: number): number {
  return MILESTONE_STEPS.filter(m => streakCount >= m).length;
}

export function getNextMilestone(streakCount: number): number | null {
  return MILESTONE_STEPS.find(m => streakCount < m) ?? null;
}
