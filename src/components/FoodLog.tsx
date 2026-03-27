import { useState } from 'react';
import { useAppStore } from '../store';
import { calcPortionKcal, calcPortionMacros } from '../utils/kcalCalc';
import { analyzeFoodAI } from '../utils/aiFood';

const hasAI = !!import.meta.env.VITE_CLAUDE_API_KEY;

export default function FoodLog() {
  const { foodLog, addFoodLog, removeFoodLog, planGoal } = useAppStore();
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = foodLog.filter(e => e.date === today);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const totals = todayEntries.reduce(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, prot: acc.prot + e.prot, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat }),
    { kcal: 0, prot: 0, carbs: 0, fat: 0 },
  );

  const pct = planGoal > 0 ? Math.min(Math.round((totals.kcal / planGoal) * 100), 100) : 0;

  async function handleSubmit() {
    const desc = input.trim();
    if (!desc) return;
    setLoading(true);

    if (hasAI) {
      const result = await analyzeFoodAI(desc);
      if (result) {
        addFoodLog({ desc: result.items.join(', ') || desc, kcal: result.kcal, prot: result.prot, carbs: result.carbs, fat: result.fat, source: 'ai' });
        setInput(''); setShowForm(false); setLoading(false); return;
      }
    }

    // Fallback: base de datos SME
    const kcal = calcPortionKcal(desc);
    const macros = calcPortionMacros(desc);
    addFoodLog({ desc, kcal: kcal || macros.prot * 4 + macros.carbs * 4 + macros.fat * 9, prot: macros.prot, carbs: macros.carbs, fat: macros.fat, source: 'manual' });
    setInput(''); setShowForm(false); setLoading(false);
  }

  return (
    <div className="food-log">
      <div className="fl-head">
        <div>
          <div className="fl-title">🍽️ Lo que comí hoy</div>
          {planGoal > 0 && (
            <div className="fl-subtitle">{totals.kcal} / {planGoal.toLocaleString()} kcal · {pct}%</div>
          )}
        </div>
        <button className="fl-add-btn" onClick={() => setShowForm(s => !s)}>
          {showForm ? '✕' : '+ Agregar'}
        </button>
      </div>

      {/* Barra progreso */}
      {planGoal > 0 && (
        <div className="fl-progress-track">
          <div className="fl-progress-fill" style={{
            width: `${pct}%`,
            background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e',
          }} />
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="fl-form">
          <textarea
            className="fl-textarea"
            placeholder={hasAI
              ? '"2 tacos de pollo con arroz y frijoles", "1 bowl de avena con plátano"...'
              : '"2 pz pollo", "1 tz arroz cocido", "1 manzana"...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={2}
            autoFocus
          />
          <button
            className="fl-btn-submit"
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
          >
            {loading ? '⏳ Analizando...' : hasAI ? '✨ Registrar con IA' : 'Registrar'}
          </button>
        </div>
      )}

      {/* Entries */}
      {todayEntries.length === 0 && !showForm ? (
        <div className="fl-empty">
          <div className="fl-empty-icon">🍽️</div>
          <div className="fl-empty-title">Sin registros hoy</div>
          <div className="fl-empty-hint">Lleva la cuenta de lo que comes y mantén el control de tus calorías sin adivinar.</div>
          <button className="fl-empty-cta" onClick={() => setShowForm(true)}>+ Agregar comida</button>
        </div>
      ) : (
        <div className="fl-entries">
          {todayEntries.map(e => (
            <div key={e.id} className="fl-entry">
              <div className="fl-entry-left">
                <span className="fl-entry-source">{e.source === 'ai' ? '✨' : '📝'}</span>
                <div>
                  <div className="fl-entry-desc">{e.desc}</div>
                  <div className="fl-entry-macros">{e.kcal} kcal · {Math.round(e.prot)}g P · {Math.round(e.carbs)}g C · {Math.round(e.fat)}g G</div>
                </div>
              </div>
              <button className="fl-entry-del" onClick={() => removeFoodLog(e.id)}>✕</button>
            </div>
          ))}
          {todayEntries.length > 0 && (
            <div className="fl-macros-total">
              <span>💪 {Math.round(totals.prot)}g</span>
              <span>🍞 {Math.round(totals.carbs)}g</span>
              <span>🥑 {Math.round(totals.fat)}g</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
