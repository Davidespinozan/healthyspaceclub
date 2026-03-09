import { useState } from 'react';
import { useAppStore } from '../../store';

const DEMO_MODE = true;

export default function PaymentModal() {
  const { payInfo, closeModal, openModal } = useAppStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

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
            <div className="pay-plan-price">{payInfo.price} MXN</div>
            <div className="pay-plan-period">{payInfo.period}</div>
            <div className="pay-feats">
              {payInfo.plan.includes('Elite') && <span className="pf">🤖 AI Coach</span>}
              {(payInfo.plan.includes('Pro') || payInfo.plan.includes('Elite')) && <span className="pf">📊 Macros</span>}
              <span className="pf">🎬 Videos</span>
              <span className="pf">🥗 28 Días</span>
              <span className="pf">💪 Rutinas</span>
            </div>
          </div>
          <button className="pay-x" onClick={closeModal}>✕</button>
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
              🔒 Comenzar ahora — {payInfo.price}
            </button>
          )}
          <div className="pay-demo">Modo demo · no se realizan cobros reales</div>
        </div>
      </div>
    </div>
  );
}
