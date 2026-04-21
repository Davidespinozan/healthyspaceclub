import type { YogaPlan } from '../types';

export function isValidYogaPlan(plan: any): plan is YogaPlan {
  if (!plan || typeof plan !== 'object') return false;
  if (typeof plan.totalDuration !== 'number' || plan.totalDuration < 300) return false;
  if (!Array.isArray(plan.poses) || plan.poses.length < 5) return false;
  return plan.poses.every((p: any) =>
    p && typeof p.id === 'string' && typeof p.duration === 'number' && p.duration > 0
  );
}

export function isValidWorkoutPlan(plan: any): boolean {
  if (!plan || typeof plan !== 'object') return false;
  if (!Array.isArray(plan.exercises) || plan.exercises.length === 0) return false;
  return plan.exercises.every((e: any) =>
    e && typeof e.id === 'string' && (typeof e.sets === 'number' || typeof e.sets === 'string')
  );
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePowerVinyasaPlan(
  plan: YogaPlan,
  targetDurationSeconds: number,
  yogaPoseIds: Set<string>
): ValidationResult {
  const errors: string[] = [];

  if (!isValidYogaPlan(plan)) {
    errors.push('Plan no tiene estructura YogaPlan válida');
    return { valid: false, errors };
  }

  const actualDuration = plan.poses.reduce((s, p) => s + p.duration, 0);
  const tolerance = targetDurationSeconds * 0.25;
  if (Math.abs(actualDuration - targetDurationSeconds) > tolerance) {
    errors.push(`Duración ${actualDuration}s fuera de tolerancia (target ${targetDurationSeconds}s)`);
  }

  const invalidPoses = plan.poses.filter(p => !yogaPoseIds.has(p.id));
  if (invalidPoses.length > 0) {
    errors.push(`Poses no-yoga: ${invalidPoses.map(p => p.id).join(', ')}`);
  }

  const lastPose = plan.poses[plan.poses.length - 1];
  if (lastPose?.id !== 'savasana') {
    errors.push('No termina con savasana');
  }
  if (lastPose?.id === 'savasana' && lastPose.duration < 180) {
    errors.push(`Savasana muy corta (${lastPose.duration}s, mínimo 180s)`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateWorkoutPlanStrict(
  plan: any,
  validExerciseIds: Set<string>
): ValidationResult {
  const errors: string[] = [];

  if (!isValidWorkoutPlan(plan)) {
    errors.push('Plan no tiene estructura WorkoutPlan válida');
    return { valid: false, errors };
  }

  const invalidIds = plan.exercises.filter((e: any) => !validExerciseIds.has(e.id));
  if (invalidIds.length > 0) {
    errors.push(`Ejercicios inválidos: ${invalidIds.map((e: any) => e.id).join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}
