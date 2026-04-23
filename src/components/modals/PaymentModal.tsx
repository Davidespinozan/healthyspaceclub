import { useState, useMemo } from 'react';
import { useAppStore } from '../../store';

const DEMO_MODE = true;

function formatBillDate(date: Date): string {
  // Spanish date format: "26 de abril"
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
}

export default function PaymentModal() {
  const { payInfo, closeModal, openModal } = useAppStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const currency = payInfo.currency ?? '';
  const amount = payInfo.amount ?? 0;
  const displayPrice = payInfo.price; // already formatted by caller (e.g. "$1,499 MXN")

  const billDateLabel = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return formatBillDate(d);
  }, []);

  function handlePay() {
    if (DEMO_MODE) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        closeModal();
        openModal('signup');
      }, 1800);
    }
  }

  return (
    <div className="ov open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="pay-box">
        <div className="pay-head">
          <div>
            <div className="pay-plan-lbl">Plan seleccionado</div>
            <div className="pay-plan-name">{payInfo.plan}</div>
            <div className="pay-plan-price">{displayPrice}</div>
            <div className="pay-plan-period">{payInfo.period}</div>
          </div>
          <button className="pay-x" onClick={closeModal}>✕</button>
        </div>

        {/* Trial billing summary — clear, no surprises */}
        <div className="pay-trial">
          <div className="pay-trial-row">
            <span className="pay-trial-lbl">Hoy pagas</span>
            <span className="pay-trial-val pay-trial-val-free">{currency ? `${currency.slice(0,1) === 'E' ? '€' : '$'}0` : '$0'}</span>
          </div>
          <div className="pay-trial-row">
            <span className="pay-trial-lbl">El {billDateLabel} se cobrará</span>
            <span className="pay-trial-val">{amount ? displayPrice : '—'}</span>
          </div>
          <ul className="pay-trial-notes">
            <li>Te enviaremos recordatorio 24h antes del cobro</li>
            <li>Cancela en 1 click desde tu perfil</li>
          </ul>
        </div>

        <div className="pay-body">
          <div className="pay-secure">Pago 100% seguro con Stripe</div>
          <div className="pay-lbl">Correo electrónico</div>
          <input
            className="pay-inp"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="pay-lbl">Número de tarjeta</div>
          <div className="pay-inp stripe-element" style={{ color: 'rgba(30,51,48,.35)', fontSize: '0.87rem' }}>
            4242 4242 4242 4242 (demo)
          </div>
          <div className="pay-row">
            <div>
              <div className="pay-lbl">Vencimiento</div>
              <div className="pay-inp stripe-element" style={{ color: 'rgba(30,51,48,.35)', fontSize: '0.87rem' }}>12/27</div>
            </div>
            <div>
              <div className="pay-lbl">CVC</div>
              <div className="pay-inp stripe-element" style={{ color: 'rgba(30,51,48,.35)', fontSize: '0.87rem' }}>123</div>
            </div>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div className="spinner" />
              <div style={{ fontSize: '.8rem', color: 'var(--txt2)' }}>Procesando pago seguro…</div>
            </div>
          ) : (
            <button className="btn-pay" onClick={handlePay}>
              🔒 Empezar trial gratis · {displayPrice}/después
            </button>
          )}
          <div className="pay-demo">Modo demo · no se realizan cobros reales</div>
        </div>
      </div>
    </div>
  );
}
