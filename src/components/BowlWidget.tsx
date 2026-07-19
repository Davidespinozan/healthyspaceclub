import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { fetchBowlsDisponibles, FLAMA_URL, linkPedido, type BowlClub } from '../data/bowlsClub';
import type { PlanTarget } from '../utils/planEngine';

/**
 * Widget "hoy no cocino" dentro de la pestaña Hoy.
 *
 * No es una promo: es la respuesta a un problema real del socio. La gente rompe el
 * plan cuando no quiere cocinar, y hoy eso significa fallar. Esto lo convierte en un
 * día que SÍ cuenta — pide el bowl y el plan se reacomoda.
 *
 * Si el socio no es de una ciudad con cobertura, el servidor devuelve cero bowls y el
 * widget no se pinta. No hay condicional de ciudad en el cliente porque un `if` se
 * puede saltar; aquí simplemente no hay datos que mostrar.
 */
export function BowlWidget({ target, onElegir }: {
  target: PlanTarget | null;
  /** Se dispara al confirmar: el plan del día debe rearmarse alrededor del bowl. */
  onElegir?: (bowl: BowlClub) => void;
}) {
  const [bowls, setBowls] = useState<BowlClub[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [sel, setSel] = useState<BowlClub | null>(null);

  useEffect(() => { void fetchBowlsDisponibles().then(setBowls); }, []);

  // Orden por ENCAJE, no por precio: el club recomienda, no vende. El que menos
  // descuadra el día va primero.
  const ordenados = useMemo(() => {
    if (!target) return bowls;
    const comidaKcal = target.kcal * 0.35;         // reparto de Magaly
    const comidaProt = target.protG * 0.32;
    return [...bowls].sort((a, b) => desvio(a) - desvio(b));
    function desvio(x: BowlClub) {
      return Math.abs(x.kcal - comidaKcal) / comidaKcal + Math.abs(x.prot - comidaProt) / comidaProt;
    }
  }, [bowls, target]);

  if (!bowls.length) return null;   // sin cobertura → el widget no existe

  return (
    <>
      {/* Mismo TAMAÑO que "Entrenar en pareja" y "Reflexión del día" (168 px de alto,
          mismo padding, radio y margen) para que Hoy quede alineado — pero con su
          propia identidad: la flama del food truck y las fotos reales de los bowls. */}
      <button type="button" className="th3-bowl" onClick={() => setAbierto(true)}>
        <span className="th3-bowl-head">
          <img className="th3-bowl-flama" src={FLAMA_URL} alt="" />
          <span className="th3-bowl-txt">
            <span className="th3-bowl-eyebrow">Healthy Space · Culiacán</span>
            <span className="th3-bowl-title">¿Hoy no quieres cocinar?</span>
          </span>
          <ArrowRight size={18} strokeWidth={2} className="th3-bowl-arrow" />
        </span>
        <span className="th3-bowl-rail">
          {ordenados.slice(0, 5).map((b) => (
            <span key={b.id} className="th3-bowl-thumb">
              {b.img ? <img src={b.img} alt={b.name} loading="lazy" /> : <i />}
              <em>{b.name}</em>
            </span>
          ))}
        </span>
      </button>

      {abierto && (
        <div className="bw-sheet-bg" onClick={() => { setAbierto(false); setSel(null); }}>
          <div className="bw-sheet" onClick={(e) => e.stopPropagation()}>
            <header className="bw-sheet-head">
              <img className="bw-logo" src={FLAMA_URL} alt="" />
              <h3>Elige tu bowl</h3>
              <button className="bw-x" onClick={() => { setAbierto(false); setSel(null); }} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>

            <div className="bw-list">
              {ordenados.map((b, i) => (
                <button key={b.id}
                  className={`bw-item${sel?.id === b.id ? ' on' : ''}${i === 0 ? ' best' : ''}`}
                  onClick={() => setSel(b)}>
                  {b.img && <img className="bw-item-img" src={b.img} alt="" loading="lazy" />}
                  <span className="bw-item-body">
                    <span className="bw-item-top">
                      <b>{b.name}</b>
                      {i === 0 && <span className="bw-tag">El que mejor te queda</span>}
                    </span>
                    <span className="bw-item-macros">
                      {Math.round(b.kcal)} kcal · {Math.round(b.prot)} P · {Math.round(b.carb)} C · {Math.round(b.fat)} G
                    </span>
                    {b.tagline && <span className="bw-item-tag">{b.tagline}</span>}
                  </span>
                  <span className="bw-item-price">${Math.round(b.price)}</span>
                </button>
              ))}
            </div>

            {sel && (
              <footer className="bw-foot">
                <p className="bw-foot-note">
                  Tu plan de hoy se va a reacomodar alrededor del <b>{sel.name}</b>.
                  Puedes deshacerlo cuando quieras.
                </p>
                <a className="bw-cta" href={linkPedido(sel.id)} target="_blank" rel="noopener noreferrer"
                  onClick={() => { onElegir?.(sel); setAbierto(false); }}>
                  Pedirlo — ${Math.round(sel.price)}
                </a>
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
}
