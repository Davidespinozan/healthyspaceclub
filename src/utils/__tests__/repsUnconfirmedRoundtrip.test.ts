import { it, expect } from 'vitest';
import { computeProgression } from '../progression';

// Reproduce el round-trip REAL: local LoggedSet → payload.exercises → Supabase JSONB (insert
// `exercises: payload.exercises`) → JSON store/fetch → hidratación App.tsx:490-498 → computeProgression.
it('round-trip: repsUnconfirmed sobrevive push+fetch y progression sigue en HOLD', () => {
  // 1. set marcado SIN confirmar (lo que hace markCurrentSet)
  const loggedSet = { reps: 10, kg: 40, repsUnconfirmed: true };

  // 2. payload.exercises tal como lo arma WorkoutPlan (performed.sets = raw LoggedSet[])
  const payloadExercises = [
    { exercise_id: 'press-horizontal', order: 0, planned: { sets: 3, reps: '8-10', rest: 90 },
      performed: { sets: [loggedSet, loggedSet, loggedSet], skipped: false, completed_at: 'x' } },
  ];

  // 3. Supabase insert `exercises: payload.exercises` → JSONB (store + fetch = JSON round-trip)
  const rowExercises = JSON.parse(JSON.stringify(payloadExercises));

  // 4. Hidratación App.tsx:490-498 (filter-passthrough, NO remap)
  const perf: Record<string, { date: string; sets: { reps: number; kg: number; rir?: number; repsUnconfirmed?: boolean }[] }> = {};
  for (const ex of rowExercises as Array<{ exercise_id?: string; performed?: { sets?: Array<{ reps: number; kg: number } | null>; skipped?: boolean } }>) {
    if (!ex || typeof ex.exercise_id !== 'string' || !ex.performed || ex.performed.skipped) continue;
    const sets = (ex.performed.sets ?? []).filter((s): s is { reps: number; kg: number } => !!s && (s.reps > 0 || s.kg > 0));
    if (sets.length === 0) continue;
    perf[ex.exercise_id] = { date: '2026-08-15', sets };
  }

  // 5. ¿sobrevive el flag al runtime?
  const rehydrated = perf['press-horizontal'].sets;
  console.log('ROUNDTRIP sets:', JSON.stringify(rehydrated));
  const flagSurvives = rehydrated.every(s => s.repsUnconfirmed === true);
  console.log('ROUNDTRIP flagSurvives=', flagSurvives);

  const prog = computeProgression(rehydrated, '8-10', 2.5, false);
  console.log('ROUNDTRIP action=', prog.action, 'kg=', prog.kg);
  expect(prog.action).toBe('hold'); // si el flag se perdió, esto sería 'add-weight' (runaway)
});
