import { useState } from 'react';
import {
  foodGroupSymbols,
  equivalentDefinition,
  equivalentBenefits,
  equivalentExample,
  foodGroupExchanges,
  exchangeNote,
  smeGroups,
} from '../data/foodEquivalents';

/* ── Tab 2: Qué son los Alimentos Equivalentes ── */
export function FoodEquivalentsIntro() {
  return (
    <div className="feq-wrap">
      {/* Group symbols */}
      <div className="feq-symbols">
        <h4>Grupos de Alimentos</h4>
        <div className="feq-sym-grid">
          {foodGroupSymbols.map(g => (
            <div key={g.id} className="feq-sym" style={{ borderColor: g.color }}>
              <span className="feq-sym-icon">{g.icon}</span>
              <span className="feq-sym-label">{g.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Definition */}
      <div className="feq-def">
        <h4>{equivalentDefinition.title}</h4>
        <p>{equivalentDefinition.text}</p>
        <div className="feq-example-box">
          <span className="feq-example-icon">🍎</span>
          <span>{equivalentDefinition.example}</span>
        </div>
      </div>

      {/* Benefits */}
      <div className="feq-benefits">
        <h4>¿Para qué sirve el listado de equivalentes?</h4>
        <div className="feq-ben-grid">
          {equivalentBenefits.map((b, i) => (
            <div key={i} className="feq-ben">
              <span className="feq-ben-num">{i + 1}</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Example */}
      <div className="feq-swap-example">
        <h4>{equivalentExample.title}</h4>
        <div className="feq-swap-cards">
          <div className="feq-swap-card a">
            <span className="feq-swap-label">Opción A</span>
            <span className="feq-swap-name">{equivalentExample.optionA.name}</span>
            <p>{equivalentExample.optionA.desc}</p>
          </div>
          <div className="feq-swap-vs">VS</div>
          <div className="feq-swap-card b">
            <span className="feq-swap-label">Opción B</span>
            <span className="feq-swap-name">{equivalentExample.optionB.name}</span>
            <p>{equivalentExample.optionB.desc}</p>
          </div>
        </div>
        <div className="feq-swap-eq">
          {equivalentExample.equivalences.map((e, i) => (
            <div key={i} className="feq-swap-row">{e}</div>
          ))}
        </div>
        <p className="feq-swap-note">{equivalentExample.note}</p>
      </div>
    </div>
  );
}

/* ── Tab 3: Lista de Alimentos Equivalentes ── */

/* SME accordion */
function SmeEquivalentsList() {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  return (
    <div className="sme-section">
      <h4 className="sme-title">Sistema Mexicano de Equivalentes — 4ª Edición</h4>
      <p className="sme-subtitle">
        Cada grupo muestra las calorías y macronutrimentos por <strong>1 equivalente</strong>. Toca un subgrupo para ver los alimentos con sus porciones exactas.
      </p>

      {smeGroups.map(group => {
        const single = group.subgroups.length === 1;
        return (
          <div key={group.id} className="sme-group" style={{ borderColor: group.color + '55' }}>
            {/* Group header */}
            <div className="sme-group-header" style={{ background: group.color + '18' }}>
              <span className="sme-group-icon">{group.icon}</span>
              <span className="sme-group-name" style={{ color: group.color }}>{group.label}</span>
            </div>

            {/* Note */}
            <p className="sme-group-note">{group.note}</p>

            {group.subgroups.map((sub, si) => {
              const key = `${group.id}-${si}`;
              const isOpen = open.has(key) || single;
              return (
                <div key={key} className="sme-sub">
                  {/* Subgroup header / macro row */}
                  <button
                    className="sme-sub-btn"
                    onClick={() => !single && toggle(key)}
                    style={{ cursor: single ? 'default' : 'pointer' }}
                  >
                    {!single && <span className="sme-sub-name">{sub.name}</span>}
                    <div className="sme-macros">
                      {!single && <span className="sme-sub-label">{sub.name} —</span>}
                      <span className="sme-macro kcal">{sub.kcal} kcal</span>
                      <span className="sme-macro cho">HC {sub.cho}g</span>
                      <span className="sme-macro prot">Prot {sub.prot}g</span>
                      <span className="sme-macro fat">Grasa {sub.fat}g</span>
                    </div>
                    {!single && <span className="sme-sub-toggle">{isOpen ? '▲' : '▼'}</span>}
                  </button>

                  {/* Food list */}
                  {isOpen && (
                    <div className="sme-foods">
                      {sub.foods.map(f => (
                        <div key={f.name} className="sme-food-row">
                          <span className="sme-food-name">{f.name}</span>
                          <span className="sme-food-amt">{f.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function FoodEquivalentsList() {
  return (
    <div className="feq-wrap">
      {/* Group exchanges */}
      <div className="feq-exchanges">
        <h4>Intercambio entre Grupos de Alimentos</h4>
        <p className="feq-ex-desc">Usa esta tabla para sustituir un grupo de alimento por otro con un valor calórico y nutricional aproximado.</p>
        <div className="feq-ex-grid">
          {foodGroupExchanges.map((ex, i) => (
            <div key={i} className="feq-ex-row">
              <span className="feq-ex-from">{ex.from}</span>
              <span className="feq-ex-arrow">↔</span>
              <span className="feq-ex-to">{ex.to}</span>
            </div>
          ))}
        </div>
        <p className="feq-ex-note">{exchangeNote}</p>
      </div>

      {/* Quick reference symbols */}
      <div className="feq-symbols" style={{ marginTop: 24 }}>
        <h4>Referencia rápida de grupos</h4>
        <div className="feq-sym-grid">
          {foodGroupSymbols.map(g => (
            <div key={g.id} className="feq-sym" style={{ borderColor: g.color }}>
              <span className="feq-sym-icon">{g.icon}</span>
              <span className="feq-sym-label">{g.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SME 4ª Edición full food list */}
      <SmeEquivalentsList />
    </div>
  );
}
