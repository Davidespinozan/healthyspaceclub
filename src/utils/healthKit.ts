/**
 * Wrapper de Apple HealthKit via @capgo/capacitor-health.
 * En web (PWA), todas las funciones retornan null de forma silenciosa.
 */

async function getPlugin() {
  try {
    const { Health } = await import('@capgo/capacitor-health');
    return Health;
  } catch {
    return null;
  }
}

export interface HealthDayData {
  steps: number;
  caloriesBurned: number;
  weightKg: number | null;
  sleepHours: number | null;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: now.toISOString() };
}

export async function isHealthAvailable(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.isAvailable();
    return res.available ?? false;
  } catch {
    return false;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    await plugin.requestAuthorization({
      read: ['steps', 'calories', 'weight', 'sleep'],
      write: [],
    });
    return true;
  } catch {
    return false;
  }
}

export async function getTodayHealthData(): Promise<HealthDayData | null> {
  const plugin = await getPlugin();
  if (!plugin) return null;

  const { startDate, endDate } = todayRange();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [stepsRes, calRes, weightRes, sleepRes] = await Promise.allSettled([
      plugin.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' }),
      plugin.queryAggregated({ dataType: 'calories', startDate, endDate, bucket: 'day', aggregation: 'sum' }),
      plugin.readSamples({ dataType: 'weight', startDate: weekAgo, endDate, limit: 1 }),
      plugin.readSamples({ dataType: 'sleep', startDate, endDate, limit: 50 }),
    ]);

    const steps = stepsRes.status === 'fulfilled'
      ? Math.round(stepsRes.value.samples[0]?.value ?? 0)
      : 0;

    const caloriesBurned = calRes.status === 'fulfilled'
      ? Math.round(calRes.value.samples[0]?.value ?? 0)
      : 0;

    const weightKg = weightRes.status === 'fulfilled' && weightRes.value.samples.length > 0
      ? weightRes.value.samples[0].value
      : null;

    // Sumar minutos de sueño (excluye "awake")
    let sleepHours: number | null = null;
    if (sleepRes.status === 'fulfilled' && sleepRes.value.samples.length > 0) {
      const sleepMinutes = sleepRes.value.samples
        .filter(s => s.sleepState !== 'awake')
        .reduce((sum, s) => {
          const dur = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000;
          return sum + dur;
        }, 0);
      sleepHours = Math.round((sleepMinutes / 60) * 10) / 10;
    }

    return { steps, caloriesBurned, weightKg, sleepHours };
  } catch {
    return null;
  }
}
