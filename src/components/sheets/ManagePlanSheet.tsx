import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store';
import { openCoachWith } from '../../utils/openCoach';
import './sheet-base.css';

interface Props {
  onClose: () => void;
}

const PLAN_BENEFITS: Record<string, string[]> = {
  pro: [
    'Coach IA personalizado todo el día',
    'Planes de nutrición y entrenamiento generados por IA',
    'Tu Espacio: reflexiones HSM diarias',
    'Acceso al Club (feed social)',
    'Historial completo de progreso',
  ],
  elite: [
    'Todo lo del plan Pro',
    'Sesiones 1:1 con coach humano (próximamente)',
    'Acceso anticipado a nuevas funciones',
    'Soporte prioritario',
  ],
  basico: [
    'Planes generados por IA',
    'Tu Espacio: reflexiones HSM diarias',
    'Acceso al Club',
  ],
  trial: [
    'Acceso completo a HSC durante 7 días',
    'Sin compromiso, cancelás cuando quieras',
    'Después del trial decidís qué plan continuar',
  ],
  none: [
    'Tu trial expiró o aún no activaste plan',
    'Hablá con el coach para reactivar tu acceso',
  ],
};

function planLabel(plan: string): string {
  switch (plan) {
    case 'pro': return 'Pro';
    case 'elite': return 'Elite';
    case 'basico': return 'Básico';
    case 'trial': return 'Prueba gratuita';
    default: return 'Sin plan activo';
  }
}

export default function ManagePlanSheet({ onClose }: Props) {
  const { userPlan, trialEndsAt } = useAppStore();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const isTrial = userPlan === 'trial' || (userPlan === 'pro' && !!trialEndsAt && new Date(trialEndsAt) > new Date());
  const trialEnds = trialEndsAt ? new Date(trialEndsAt) : null;
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000)) : null;
  const benefits = PLAN_BENEFITS[isTrial ? 'trial' : (userPlan || 'none')] ?? PLAN_BENEFITS.none;

  function handleTalkToCoach() {
    onClose();
    openCoachWith('Tengo dudas sobre mi plan actual.');
  }

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet" onClick={e => e.stopPropagation()}>
        <div className="sh-handle" />
        <button
          className="sh-close"
          onClick={onClose}
          aria-label="Cerrar"
          type="button"
        >
          ✕
        </button>

        <h1 className="sh-title">Mi Plan</h1>

        <div className="sh-plan-badge">
          <span className="sh-plan-badge-label">Plan actual</span>
          <span className="sh-plan-badge-name">{planLabel(userPlan || 'none')}</span>
        </div>

        {isTrial && daysLeft !== null && (
          <div className="sh-plan-info">
            {daysLeft > 0 ? (
              <p>Tu trial termina en <strong>{daysLeft} {daysLeft === 1 ? 'día' : 'días'}</strong>.</p>
            ) : (
              <p>Tu trial terminó. Hablá con el coach para continuar.</p>
            )}
            {trialEnds && daysLeft > 0 && (
              <p className="sh-plan-sub">
                Fecha de finalización: {trialEnds.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        )}

        <section className="sh-section">
          <h2 className="sh-heading">Detalles de tu plan</h2>
          <ul className="sh-list">
            {benefits.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
          {isTrial && (
            <p className="sh-p sh-p--muted">
              Después de tu trial podrás continuar suscribiéndote a HSC Pro.
            </p>
          )}
        </section>

        <section className="sh-section">
          <h2 className="sh-heading">¿Necesitás ayuda?</h2>
          <button
            type="button"
            className="sh-cta"
            onClick={handleTalkToCoach}
          >
            Hablar con el coach sobre mi plan →
          </button>
        </section>

        <p className="sh-disclaimer">
          Sistema de pagos en activación. Para cualquier ajuste mientras tanto, hablá con el coach.
        </p>
      </div>
    </div>,
    document.body
  );
}
