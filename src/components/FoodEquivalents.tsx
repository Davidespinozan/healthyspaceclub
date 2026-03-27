import { useState } from 'react';
import { smeGroups, foodGroupExchanges } from '../data/foodEquivalents';

export function FoodEquivalentsIntro() { return null; }

export function FoodEquivalentsList() {
  const [activeGroup, setActiveGroup] = useState(smeGroups[0].id);
  const group = smeGroups.find(g => g.id === activeGroup)!;

  return (
    <div className="sub-wrap">

      {/* Hero */}
      <div className="sub-hero">
        <div className="sub-hero-icon">🔄</div>
        <div>
          <div className="sub-hero-title">Guía de sustituciones</div>
          <div className="sub-hero-desc">
            Si tu plan incluye un alimento que no tienes o no te gusta, cámbialo por cualquier opción del mismo grupo — el balance nutricional se mantiene igual.
          </div>
        </div>
      </div>

      {/* Group selector */}
      <div className="sub-groups">
        {smeGroups.map(g => (
          <button
            key={g.id}
            className={`sub-group-btn${activeGroup === g.id ? ' active' : ''}`}
            style={activeGroup === g.id ? { borderColor: g.color, background: g.color + '18', color: g.color } : {}}
            onClick={() => setActiveGroup(g.id)}
          >
            <span className="sub-group-icon">{g.icon}</span>
            <span className="sub-group-label">{g.label}</span>
          </button>
        ))}
      </div>

      {/* Selected group */}
      <div className="sub-panel" style={{ borderColor: group.color + '44' }}>
        <div className="sub-panel-head" style={{ background: group.color + '14' }}>
          <span className="sub-panel-icon">{group.icon}</span>
          <div>
            <div className="sub-panel-title" style={{ color: group.color }}>{group.label}</div>
            <div className="sub-panel-note">{group.note}</div>
          </div>
        </div>

        <div className="sub-foods">
          {group.subgroups.map((sub, si) => (
            <div key={si}>
              {group.subgroups.length > 1 && (
                <div className="sub-sub-label">{sub.name}</div>
              )}
              <div className="sub-food-grid">
                {sub.foods.map(f => (
                  <div key={f.name} className="sub-food-item">
                    <span className="sub-food-name">{f.name}</span>
                    <span className="sub-food-amount">{f.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Intercambios entre grupos — colapsable al fondo */}
      <details className="sub-advanced">
        <summary className="sub-advanced-toggle">
          Ver intercambios entre grupos distintos
        </summary>
        <div className="sub-advanced-body">
          <p className="sub-advanced-note">En ocasiones especiales puedes cambiar un grupo por otro con valor nutricional similar. No se recomienda hacerlo diario.</p>
          <div className="feq-ex-grid">
            {foodGroupExchanges.map((ex, i) => (
              <div key={i} className="feq-ex-row">
                <span className="feq-ex-from">{ex.from}</span>
                <span className="feq-ex-arrow">↔</span>
                <span className="feq-ex-to">{ex.to}</span>
              </div>
            ))}
          </div>
        </div>
      </details>

    </div>
  );
}
