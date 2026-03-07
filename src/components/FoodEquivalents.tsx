import {
  foodGroupSymbols,
  equivalentDefinition,
  equivalentBenefits,
  equivalentExample,
  foodGroupExchanges,
  exchangeNote,
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
    </div>
  );
}
