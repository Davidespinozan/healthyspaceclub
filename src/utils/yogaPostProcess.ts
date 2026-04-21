import type { YogaPlan } from '../types';

export function stretchToTargetDuration(plan: YogaPlan, targetSeconds: number): YogaPlan {
  const currentTotal = plan.poses.reduce((s, p) => s + p.duration, 0);
  const deficit = targetSeconds - currentTotal;

  if (deficit <= 0) return plan;
  if (deficit > targetSeconds * 0.4) return plan; // too far off, don't stretch

  const stretchableIds = ['savasana', 'pigeon-pose', 'child-pose', 'seated-forward-fold', 'happy-baby', 'supine-twist'];
  const poses = [...plan.poses.map(p => ({ ...p }))];
  let remaining = deficit;

  // First pass: stretch relaxation poses
  for (const id of stretchableIds) {
    if (remaining <= 0) break;
    const idx = poses.findIndex(p => p.id === id);
    if (idx === -1) continue;
    const toAdd = Math.min(remaining, poses[idx].duration);
    poses[idx].duration += toAdd;
    remaining -= toAdd;
  }

  // Second pass: distribute remaining evenly
  if (remaining > 0) {
    const perPose = Math.ceil(remaining / poses.length);
    for (let i = 0; i < poses.length && remaining > 0; i++) {
      const toAdd = Math.min(perPose, remaining);
      poses[i].duration += toAdd;
      remaining -= toAdd;
    }
  }

  return { ...plan, poses, totalDuration: poses.reduce((s, p) => s + p.duration, 0) };
}
