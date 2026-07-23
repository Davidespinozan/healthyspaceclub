import { useState } from 'react';
import { supabase } from '../../lib/supabase';

// Notas internas del admin sobre un socio. El socio NO las ve (viven en
// notas_socio, tabla de lectura admin). Se guardan por RPC admin_guardar_nota
// (que además deja rastro en la bitácora).
export default function NotasInternas({ socioId, inicial }: { socioId: string; inicial: string }) {
  const [nota, setNota] = useState(inicial);
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'ok' | 'error'>('idle');
  const sucio = nota !== inicial;

  async function guardar() {
    setEstado('guardando');
    const { error } = await supabase.rpc('admin_guardar_nota', { p_user_id: socioId, p_nota: nota });
    setEstado(error ? 'error' : 'ok');
    if (!error) setTimeout(() => setEstado('idle'), 2000);
  }

  return (
    <div className="adm-card" style={{ marginTop: 16 }}>
      <div className="adm-card-label">Notas internas <span className="adm-sub2">· solo tú las ves</span></div>
      <textarea
        className="adm-textarea"
        value={nota}
        placeholder="Contexto del socio, acuerdos, recordatorios…"
        onChange={(e) => { setNota(e.target.value); if (estado !== 'idle') setEstado('idle'); }}
      />
      <div className="adm-actions">
        <button className="adm-btn" disabled={!sucio || estado === 'guardando'} onClick={guardar}>
          {estado === 'guardando' ? 'Guardando…' : 'Guardar nota'}
        </button>
        {estado === 'ok' && <span className="adm-ok">Guardado ✓</span>}
        {estado === 'error' && <span className="adm-err">No se pudo guardar</span>}
      </div>
    </div>
  );
}
