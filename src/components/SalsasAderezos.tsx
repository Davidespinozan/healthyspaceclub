import { useState } from 'react';
import { salsasData, type SalsaRecipe } from '../data/salsas';

const spiceLabels = ['Sin picante', 'Suave 🌶️', 'Medio 🌶️🌶️', 'Picante 🌶️🌶️🌶️'];

export default function SalsasAderezos() {
  const [filter, setFilter] = useState<'all' | 'salsa' | 'aderezo'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = salsasData.filter(s => filter === 'all' || s.type === filter);
  const salsas = filtered.filter(s => s.type === 'salsa');
  const aderezos = filtered.filter(s => s.type === 'aderezo');

  const toggle = (name: string) => setOpenId(prev => prev === name ? null : name);

  return (
    <div className="sa-wrap">
      <div className="sa-intro">
        <h3>Salsas y Aderezos</h3>
        <p>Recetas caseras limpias para acompañar tus comidas. Sin ultraprocesados, fáciles y rápidas.</p>
      </div>

      {/* Filters */}
      <div className="sa-filters">
        {([['all', 'Todas'], ['salsa', '🫙 Salsas'], ['aderezo', '🥗 Aderezos']] as const).map(([val, lbl]) => (
          <button key={val} className={`sa-filter${filter === val ? ' active' : ''}`} onClick={() => setFilter(val)}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Salsas */}
      {salsas.length > 0 && (
        <div className="sa-section">
          {filter === 'all' && <h4 className="sa-sec-title">🫙 Salsas</h4>}
          <div className="sa-grid">
            {salsas.map(s => (
              <RecipeCard key={s.name} recipe={s} isOpen={openId === s.name} onToggle={() => toggle(s.name)} />
            ))}
          </div>
        </div>
      )}

      {/* Aderezos */}
      {aderezos.length > 0 && (
        <div className="sa-section">
          {filter === 'all' && <h4 className="sa-sec-title">🥗 Aderezos</h4>}
          <div className="sa-grid">
            {aderezos.map(s => (
              <RecipeCard key={s.name} recipe={s} isOpen={openId === s.name} onToggle={() => toggle(s.name)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, isOpen, onToggle }: { recipe: SalsaRecipe; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`sa-card${isOpen ? ' open' : ''}`}>
      <button className="sa-card-header" onClick={onToggle}>
        <div className="sa-card-left">
          <span className="sa-card-name">{recipe.name}</span>
          <div className="sa-card-meta">
            <span className="sa-spice">{spiceLabels[recipe.spiceLevel]}</span>
            {recipe.portion.includes('libre') && <span className="sa-badge-free">Libre</span>}
          </div>
        </div>
        <span className="sa-card-arrow">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="sa-card-body">
          <div className="sa-portion">
            <span className="sa-portion-icon">📏</span>
            <span>{recipe.portion}</span>
          </div>
          <div className="sa-ingredients">
            <span className="sa-sub-label">Ingredientes</span>
            <ul>
              {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
            </ul>
          </div>
          <div className="sa-steps">
            <span className="sa-sub-label">Preparación</span>
            <ol>
              {recipe.steps.map((st, i) => <li key={i}>{st}</li>)}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
