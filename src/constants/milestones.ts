import { Sprout, Flame, Sparkles, Moon, Mountain, Waves, Sun, MountainSnow, type LucideIcon } from 'lucide-react';
import type { AppLanguage } from '../store';
import type { TranslationKey } from '../i18n/es';

export const MILESTONE_STEPS = [3, 7, 14, 30, 60, 90, 180, 365] as const;

export type MilestoneDay = typeof MILESTONE_STEPS[number];

// Labels universales (no varían por locale). '3d', '7d', etc. son sufijos
// neutrales internacionales. Solo '1a' (1 año) cambia a '1y' en EN — para
// eso usar getMilestoneLabel(days, locale).
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

// DEPRECATED: dead code post TabTu v5 refactor. Mantener para no romper
// si algún componente lo importa silenciosamente; cleanup en lote futuro.
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

// Emojis universales — no se traducen. (DEPRECATED para UI: usar MILESTONE_ICON.)
export const MILESTONE_EMOJI: Record<number, string> = {
  3: '🌱',
  7: '🔥',
  14: '✨',
  30: '🌙',
  60: '⛰️',
  90: '🌊',
  180: '☀️',
  365: '🏔️',
};

// Íconos Lucide por hito — mapean la progresión (brote → fuego → cima nevada).
// Reemplazan los emojis en la UI (regla: SVG, no emojis).
export const MILESTONE_ICON: Record<number, LucideIcon> = {
  3: Sprout,
  7: Flame,
  14: Sparkles,
  30: Moon,
  60: Mountain,
  90: Waves,
  180: Sun,
  365: MountainSnow,
};

// Type del t() function de useT(). Loose para no forzar al caller a importar
// TranslationKey si no quiere. Internamente casteamos las keys construidas
// con template strings.
type TFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

// Locale-aware copy de un milestone. Devuelve el shape legacy
// { emoji, title, sub } para que los consumidores no tengan que cambiar
// destructures existentes. Uso: const copy = getMilestoneCopy(days, t);
export function getMilestoneCopy(
  days: number,
  t: TFn,
): { emoji: string; title: string; sub: string } {
  return {
    emoji: MILESTONE_EMOJI[days] ?? '',
    title: t(`milestones.d${days}.title` as TranslationKey),
    sub:   t(`milestones.d${days}.sub`   as TranslationKey),
  };
}

// Label corto del chip ('3d', '7d', ..., '1a' / '1y'). Solo d365 varía por
// locale; el resto se lee del const universal.
export function getMilestoneLabel(days: number, locale: AppLanguage): string {
  if (days === 365) return locale === 'en' ? '1y' : '1a';
  return MILESTONE_LABELS[days] ?? '';
}

export function getAchievementsCount(streakCount: number): number {
  return MILESTONE_STEPS.filter(m => streakCount >= m).length;
}

export function getNextMilestone(streakCount: number): number | null {
  return MILESTONE_STEPS.find(m => streakCount < m) ?? null;
}
