import { useState, useEffect } from 'react';
import { useAppStore } from '../store';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

function getWeekKey() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split('T')[0];
}

async function generateInsight(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error('api');
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

export default function WeeklyInsight() {
  const { userName, planGoal, foodLog, habitHistory, workoutLog, habits } = useAppStore();
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  if (!API_KEY) return null;

  const weekKey = getWeekKey();
  const storageKey = `hsc-insight-${weekKey}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) { setInsight(saved); setGenerated(true); }
  }, [storageKey]);

  async function generate() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Últimos 7 días de food log
      const last7 = [...Array(7)].map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      });
      const weekFood = foodLog.filter(e => last7.includes(e.date));
      const avgKcal = weekFood.length
        ? Math.round(weekFood.reduce((s, e) => s + e.kcal, 0) / Math.max(new Set(weekFood.map(e => e.date)).size, 1))
        : 0;

      // Hábitos esta semana
      const habitDays = last7.filter(d => {
        const h = d === today ? habits : habitHistory[d];
        return h && Object.values(h).filter(Boolean).length >= 3;
      }).length;

      // Entrenamientos esta semana
      const gymDays = new Set(workoutLog.filter(e => last7.includes(e.date)).map(e => e.date)).size;

      const prompt = `Eres coach de salud mexicano. Analiza la semana de ${userName || 'el usuario'} y da un resumen motivador en 3-4 oraciones en español casual mexicano.

DATOS DE LA SEMANA:
- Meta calórica: ${planGoal} kcal/día, Promedio registrado: ${avgKcal} kcal/día
- Días con 3+ hábitos completados: ${habitDays}/7
- Días de entrenamiento: ${gymDays}/7

Incluye: 1 punto positivo específico, 1 área de mejora concreta, 1 motivación para la próxima semana. Sin bullets, párrafo fluido.`;

      const text = await generateInsight(prompt);
      setInsight(text);
      setGenerated(true);
      localStorage.setItem(storageKey, text);
    } catch {
      setInsight('No se pudo generar el análisis. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wi-card">
      <div className="wi-head">
        <div>
          <div className="wi-title">📊 Análisis semanal IA</div>
          <div className="wi-sub">Semana del {weekKey}</div>
        </div>
        {generated && (
          <button className="wi-refresh" onClick={() => { setGenerated(false); setInsight(''); localStorage.removeItem(storageKey); }}>
            ↺
          </button>
        )}
      </div>

      {!generated && !loading && (
        <button className="wi-generate-btn" onClick={generate}>
          ✨ Generar análisis de mi semana
        </button>
      )}

      {loading && (
        <div className="wi-loading">
          <div className="wi-dots"><span /><span /><span /></div>
          <div className="wi-loading-txt">Analizando tu semana...</div>
        </div>
      )}

      {generated && insight && (
        <div className="wi-insight">{insight}</div>
      )}
    </div>
  );
}
