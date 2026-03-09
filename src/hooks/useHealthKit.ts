import { useState, useEffect } from 'react';
import { isHealthAvailable, requestHealthPermissions, getTodayHealthData, type HealthDayData } from '../utils/healthKit';
import { useAppStore } from '../store';

export interface HealthKitState {
  available: boolean;
  authorized: boolean;
  data: HealthDayData | null;
  loading: boolean;
  requestAccess: () => Promise<void>;
}

const STEPS_GOAL = 8000; // pasos para marcar hábito ejercicio
const SLEEP_GOAL_HOURS = 7; // horas para marcar hábito sueño

export function useHealthKit(): HealthKitState {
  const [available, setAvailable] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [data, setData] = useState<HealthDayData | null>(null);
  const [loading, setLoading] = useState(true);

  const { habits, toggleHabit } = useAppStore();

  useEffect(() => {
    async function init() {
      const avail = await isHealthAvailable();
      setAvailable(avail);
      if (!avail) { setLoading(false); return; }

      // Intentar leer sin pedir permisos (si ya fueron otorgados)
      const d = await getTodayHealthData();
      if (d) {
        setAuthorized(true);
        setData(d);
        autoMarkHabits(d);
      }
      setLoading(false);
    }
    init();
  }, []);

  function autoMarkHabits(d: HealthDayData) {
    // Auto-marcar hábito ejercicio si pasos > meta
    if (d.steps >= STEPS_GOAL && !habits['ejercicio']) {
      toggleHabit('ejercicio');
    }
    // Auto-marcar sueño si horas de sueño > meta
    if (d.sleepHours !== null && d.sleepHours >= SLEEP_GOAL_HOURS && !habits['sueno']) {
      toggleHabit('sueno');
    }
  }

  async function requestAccess() {
    setLoading(true);
    const ok = await requestHealthPermissions();
    if (ok) {
      const d = await getTodayHealthData();
      setAuthorized(true);
      setData(d);
      if (d) autoMarkHabits(d);
    }
    setLoading(false);
  }

  return { available, authorized, data, loading, requestAccess };
}
