import { useState } from 'react';
import { findSwaps, type SwapOption } from '../utils/ingredientSwap';

/**
 * Botón inline "🔄" que muestra alternativas equivalentes del mismo
 * grupo alimenticio (mismos macros) al hacer click.
 */
export default function SwapButton({ portionText }: { portionText: string }) {
  const [open, setOpen] = useState(false);
  const [swaps, setSwaps] = useState<SwapOption[]>([]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const result = findSwaps(portionText);
    setSwaps(result);
    setOpen(true);
  }

  if (!portionText || portionText.length < 5) return null;

  return (
    <span className="swap-wrapper">
      <button className="swap-btn" onClick={handleClick} title="Ver alternativas equivalentes">🔄</button>
      {open && (
        <div className="swap-popup">
          <div className="swap-popup-head">
            <span>Puedes cambiar por:</span>
            <button className="swap-popup-close" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>✕</button>
          </div>
          {swaps.length === 0 ? (
            <div className="swap-popup-empty">No hay alternativas en este grupo.</div>
          ) : (
            <div className="swap-popup-list">
              {swaps.map((s, i) => (
                <div key={i} className="swap-popup-item">
                  <div className="swap-item-name">{s.name}</div>
                  <div className="swap-item-amount">{s.amount}</div>
                </div>
              ))}
              <div className="swap-popup-note">Mismo grupo: {swaps[0].group} — {swaps[0].subgroup}</div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
