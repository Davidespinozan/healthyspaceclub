import { useState } from 'react';
import { Truck, Power } from 'lucide-react';
import { useFoodTrucksFlag } from '../hooks/useFoodTrucksFlag';

export default function Ajustes() {
  const { enabled, loading, error, guardar } = useFoodTrucksFlag();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    if (enabled === null) return;
    setBusy(true); setMsg(null);
    const err = await guardar(!enabled);
    setBusy(false);
    if (err) setMsg(`No se pudo: ${err}`);
  }

  return (
    <>
      <div className="adm-page-head">
        <h1>Ajustes</h1>
        <p>Configuración del negocio.</p>
      </div>

      {error && <div className="adm-alert">No se pudo cargar: {error}</div>}
      {msg && <div className="adm-alert">{msg}</div>}

      <div className="adm-section">
        <div className="adm-section-title">Food trucks (bowls)</div>
        <div className="adm-card">
          {loading ? (
            <div className="adm-muted">Cargando…</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <Truck size={20} strokeWidth={2} style={{ color: 'var(--adm-accent)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Widget de food trucks
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: enabled ? 'rgba(45,122,79,0.14)' : 'rgba(120,120,120,0.16)',
                    color: enabled ? '#2d7a4f' : '#777',
                  }}>
                    {enabled ? 'ENCENDIDO' : 'APAGADO'}
                  </span>
                </div>
                <div className="adm-muted" style={{ marginTop: 4, fontSize: '0.85rem' }}>
                  {enabled
                    ? 'Los socios con cobertura (Culiacán) ven el widget para pedir bowls. Apágalo mientras los remolques no abran.'
                    : 'Oculto para todos. Ningún socio ve el widget de bowls, aunque tenga cobertura. Enciéndelo cuando abran los remolques.'}
                </div>
              </div>
              <button
                className="adm-btn-ghost"
                disabled={busy}
                onClick={toggle}
                style={{ flexShrink: 0 }}
              >
                <Power size={14} strokeWidth={2} /> {busy ? 'Guardando…' : enabled ? 'Apagar' : 'Encender'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="adm-section">
        <div className="adm-section-title">Próximamente</div>
        <div className="adm-card">
          <ul className="adm-muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Precios de plan y ciclos de cobro.</li>
            <li>Cupones / cortesías / meses gratis (tarjeta siempre conectada).</li>
            <li>Datos del negocio y notificaciones.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
