// Re-exports del módulo de prompts del coach IA.
// Estructura creada en Lote Coach-A (mudanza, cero cambio de contenido).

export { buildUserProfileBlock } from './profile';
export { buildHSMCoreBlock } from './hsmCore';
export { COACH_VOICE_RULES, COACH_VOICE_RULES_SHORT, COACH_VOICE_RULES_DAY1 } from './voice';

export { buildCoachSystemPrompt } from './prompts/coach';
export { buildDay1BriefingPrompt, buildDailyBriefingPrompt } from './prompts/dailyBriefing';
export { buildHSMQuestionPrompt } from './prompts/hsmQuestion';
export {
  buildHSMDailyReviewPrompt,
  buildHSM5DayMiniReviewPrompt,
  buildHSMWeeklyReviewPrompt,
} from './prompts/hsmReview';
export { buildHSMProfilePrompt } from './prompts/hsmProfile';
export {
  buildWorkoutOrchestratorPrompt,
  buildYogaOrchestratorPrompt,
} from './prompts/workoutOrchestrator';
export { buildWeeklyPlanPrompt } from './prompts/weeklyPlan';
export { buildWeeklyReviewMessagePrompt } from './prompts/weeklyReview';
