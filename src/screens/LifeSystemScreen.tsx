import { useState } from 'react';
import { useAppStore } from '../store';
import { useLifeSystemStore, calKey } from '../store/lifeSystemStore';
import type { LSPanel } from '../types/lifeSystem';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const PROMPTS = [
  '¿Estoy siendo consistente con lo que digo que quiero?',
  '¿Me estoy convirtiendo en la persona que quiero ser?',
  '¿Qué patrón sigue repitiéndose que no estoy corrigiendo?',
  '¿Estoy eligiendo desde el miedo o desde la convicción?',
  '¿Estoy construyendo la vida que quiero o solo reaccionando?',
  '¿Qué versión de mí está tomando mis decisiones?',
  '¿Estoy protegiendo mi energía o regalándola?',
  '¿Mis hábitos reflejan mis metas reales?',
  '¿Estoy siendo disciplinado donde importa?',
  '¿Qué estoy tolerando que no debería?',
  '¿Qué conversación conmigo mismo he estado evitando?',
  '¿Qué haría diferente si nadie estuviera mirando?',
  '¿Qué me está costando más energía de la que me da?',
  '¿Soy la persona que quiero ser en mis relaciones?',
  '¿Qué parte de mi vida estoy descuidando?',
  '¿Qué pequeña victoria de hoy merece reconocimiento?',
  '¿Estoy avanzando o solo sintiéndome ocupado?',
  '¿Qué necesito soltar para seguir creciendo?',
];

const STATUS_MAP = {
  active:    { label: 'Activo',   cls: 'ls-pill-doing', next: 'paused'    },
  paused:    { label: 'Pausado',  cls: 'ls-pill-paused', next: 'completed'},
  completed: { label: 'Hecho',    cls: 'ls-pill-done',  next: 'active'    },
} as const;

const PRIORITY_CYCLE = ['p1','p2','p3'] as const;

function formatDateKey(key: string) {
  const [y, m, d] = key.split('-');
  const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return `${DAY_NAMES[dt.getDay()]} ${parseInt(d)} ${MONTHS_ES[parseInt(m)-1]}, ${y}`;
}

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    dashboard: '⊞', calendar: '📅', 'check-square': '✓', sun: '☀',
    activity: '📊', wallet: '💰', compass: '🧭', refresh: '↻', feather: '✦',
    target: '◎', zap: '⚡', inbox: '📥', folder: '📁', sunrise: '🌅',
    moon: '🌙', award: '📈', receipt: '🧾', plus: '+',
  };
  return <span style={{ fontSize: '14px', lineHeight: '1' }}>{icons[name] || '·'}</span>;
}

/* ── NAV STRUCTURE ─────────────────────────────────────────────── */
const NAV_ITEMS: { id: LSPanel; label: string; num?: string; group?: string }[] = [
  { id: 'dash',      label: 'Dashboard',      group: 'Inicio'   },
  { id: 'time',      label: 'Tiempo',         num: '01', group: 'Sistema' },
  { id: 'exec',      label: 'Ejecución',      num: '02' },
  { id: 'daily',     label: 'Sistema Diario', num: '03' },
  { id: 'measure',   label: 'Medir',          num: '04' },
  { id: 'money',     label: 'Dinero',         num: '05' },
  { id: 'decisions', label: 'Decisiones',     num: '06' },
  { id: 'review',    label: 'Revisión',       num: '07' },
  { id: 'journal',   label: 'Journal',        num: '08' },
];

const ICON_MAP: Record<LSPanel, string> = {
  dash: 'dashboard', time: 'calendar', exec: 'check-square',
  daily: 'sun', measure: 'activity', money: 'wallet',
  decisions: 'compass', review: 'refresh', journal: 'feather',
};

/* ══════════════════════════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════════════════════════ */
export default function LifeSystemScreen() {
  const goTo = useAppStore(s => s.goTo);
  const { activePanel, setActivePanel } = useLifeSystemStore();

  const groups: Record<string, typeof NAV_ITEMS> = {};
  for (const item of NAV_ITEMS) {
    const g = item.group ?? '__'; 
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  }

  return (
    <>
      {/* Sidebar */}
      <div className="ls-sidebar">
        <div className="ls-sb-brand">
          <div className="ls-sb-logo">Healthy Space Club</div>
          <div className="ls-sb-title">Life<br /><em>System</em></div>
        </div>
        <div style={{ padding: '0 22px 12px' }}>
          <button className="ls-back" onClick={() => goTo('dashboard')}>← Volver</button>
        </div>
        <nav className="ls-sb-nav">
          {NAV_ITEMS.map((item, i) => {
            const showGroup = item.group && (i === 0 || NAV_ITEMS[i-1].group !== item.group);
            return (
              <div key={item.id}>
                {showGroup && item.group !== '__' && (
                  <div className="ls-sb-group">{item.group}</div>
                )}
                <button
                  className={`ls-nav-item${activePanel === item.id ? ' on' : ''}`}
                  onClick={() => setActivePanel(item.id)}
                >
                  <Icon name={ICON_MAP[item.id]} />
                  {item.label}
                  {item.num && <span className="ls-nav-num">{item.num}</span>}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="ls-sb-footer">
          <div className="ls-sb-dot" />
          Auto guardado
        </div>
      </div>

      {/* Main */}
      <div className="ls-main">
        <PanelDash    active={activePanel === 'dash'}      onNav={setActivePanel} />
        <PanelTiempo  active={activePanel === 'time'}      />
        <PanelExec    active={activePanel === 'exec'}      />
        <PanelDiario  active={activePanel === 'daily'}     />
        <PanelMedir   active={activePanel === 'measure'}   />
        <PanelDinero  active={activePanel === 'money'}     />
        <PanelDecisiones active={activePanel === 'decisions'} />
        <PanelReview  active={activePanel === 'review'}    />
        <PanelJournal active={activePanel === 'journal'}   />
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL: DASHBOARD
══════════════════════════════════════════════════════════════════ */
function PanelDash({ active, onNav }: { active: boolean; onNav: (p: LSPanel) => void }) {
  const {
    dailyFocus, setDailyFocus,
    nextActions, updateNextAction,
    habitos, habitChecks, toggleHabit,
    proyectos, dinero,
  } = useLifeSystemStore();

  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));

  const activeProjects = proyectos.filter(p => p.estado === 'active').length;
  const tasksDone = nextActions.filter(t => t.done).length;
  let inc = 0, exp = 0;
  dinero.forEach(d => {
    if (d.tipo === 'income') inc += parseFloat(d.monto) || 0;
    else exp += parseFloat(d.monto) || 0;
  });
  const bal = inc - exp;
  const todayDow = (now.getDay() + 6) % 7; // Mon=0

  return (
    <div className={`ls-panel${active ? ' active' : ''}`}>
      <div className="ls-page-header">
        <div className="ls-page-label">Centro de Comando</div>
        <h1 className="ls-page-title">Tu <em>Día</em></h1>
        <p className="ls-page-desc">Lo que importa hoy. Una vista. Claridad total.</p>
      </div>
      <div className="ls-content">
        {/* Hero date */}
        <div className="ls-dash-hero">
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="ls-dash-date">{MONTHS_ES[now.getMonth()]} <em>{now.getDate()}</em></div>
              <div className="ls-dash-sub">{DAY_NAMES[now.getDay()]} — {now.getFullYear()}</div>
            </div>
            <button className="ls-btn-primary" onClick={() => onNav('time')}>Ver Calendario →</button>
          </div>
          {/* Week strip */}
          <div className="ls-week-strip">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(monday);
              d.setDate(monday.getDate() + i);
              const isToday = d.toDateString() === now.toDateString();
              return (
                <div key={i} className={`ls-wd${isToday ? ' today' : ''}`} onClick={() => onNav('time')}>
                  <div className="ls-wd-name">{DAYS_ES[d.getDay()]}</div>
                  <div className="ls-wd-num">{d.getDate()}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Focus input */}
        <div className="ls-card" style={{ marginBottom: 18 }}>
          <div className="ls-card-head">
            <div className="ls-card-title"><Icon name="target" /> Foco del Día</div>
          </div>
          <input
            className="ls-focus-input"
            placeholder="¿Cuál es la prioridad de hoy?"
            value={dailyFocus}
            onChange={e => setDailyFocus(e.target.value)}
          />
        </div>

        {/* Top 3 + Hábitos */}
        <div className="ls-grid-2" style={{ marginBottom: 18 }}>
          <div className="ls-card" style={{ margin: 0 }}>
            <div className="ls-card-head">
              <div className="ls-card-title"><Icon name="zap" /> Top 3 de Hoy</div>
            </div>
            {nextActions.length === 0
              ? <div style={{ fontSize: '.78rem', color: 'var(--txt2)' }}>Agrega tareas en Ejecución</div>
              : nextActions.slice(0, 3).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--bdr)' }}>
                  <input
                    type="checkbox"
                    className="ls-check-row"
                    style={{ appearance: 'none', width: 18, height: 18, borderRadius: 6, border: '1.5px solid var(--bdr)', flexShrink: 0, cursor: 'pointer', position: 'relative', background: t.done ? 'var(--amber)' : 'transparent', borderColor: t.done ? 'var(--amber)' : undefined }}
                    checked={t.done}
                    onChange={e => updateNextAction(t.id, 'done', e.target.checked)}
                  />
                  <span style={{ flex: 1, fontSize: '.83rem', color: 'var(--forest)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? .55 : 1 }}>{t.text || 'Sin título'}</span>
                  <span className={`ls-pill ls-pill-${t.priority}`}>{t.priority.toUpperCase()}</span>
                </div>
              ))
            }
          </div>
          <div className="ls-card" style={{ margin: 0 }}>
            <div className="ls-card-head">
              <div className="ls-card-title"><Icon name="award" /> Hábitos de Hoy</div>
            </div>
            {habitos.map((h, hi) => {
              const key = `${hi}-${todayDow}`;
              const done = habitChecks[key];
              return (
                <div key={hi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--bdr)' }}>
                  <input
                    type="checkbox"
                    style={{ appearance: 'none', width: 18, height: 18, borderRadius: 6, border: '1.5px solid var(--bdr)', flexShrink: 0, cursor: 'pointer', background: done ? 'var(--amber)' : 'transparent', borderColor: done ? 'var(--amber)' : undefined }}
                    checked={!!done}
                    onChange={() => toggleHabit(key)}
                  />
                  <span style={{ fontSize: '.83rem', color: 'var(--forest)', textDecoration: done ? 'line-through' : 'none', opacity: done ? .55 : 1 }}>{h}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="ls-stat-grid">
          <div className="ls-stat-card">
            <div className="ls-stat-label">Proyectos Activos</div>
            <div className="ls-stat-value">{activeProjects}</div>
          </div>
          <div className="ls-stat-card">
            <div className="ls-stat-label">Tareas Hechas</div>
            <div className="ls-stat-value">{tasksDone}</div>
          </div>
          <div className="ls-stat-card">
            <div className="ls-stat-label">Balance del Mes</div>
            <div className={`ls-stat-value ${bal >= 0 ? 'income' : 'expense'}`}>${Math.round(bal).toLocaleString('es-MX')}</div>
          </div>
        </div>

        <div className="ls-divider" />

        {/* Navigation cards */}
        <div className="ls-dash-grid">
          {([
            { id: 'time',      title: 'Tiempo',         desc: 'Calendario y agenda',         num: '01' },
            { id: 'exec',      title: 'Ejecución',      desc: 'Tareas y proyectos',           num: '02' },
            { id: 'daily',     title: 'Sistema Diario', desc: 'Rituales AM / PM',             num: '03' },
            { id: 'measure',   title: 'Medir',          desc: 'Hábitos y métricas',           num: '04' },
            { id: 'money',     title: 'Dinero',         desc: 'Claridad financiera',          num: '05' },
            { id: 'decisions', title: 'Decisiones',     desc: 'Diario de decisiones',         num: '06' },
            { id: 'review',    title: 'Revisión',       desc: 'Check-in semanal',             num: '07' },
            { id: 'journal',   title: 'Journal',        desc: 'Espacio de reflexión',         num: '08' },
          ] as const).map(c => (
            <div key={c.id} className="ls-dash-card" onClick={() => onNav(c.id as LSPanel)}>
              <span className="ls-dash-card-num">{c.num}</span>
              <div className="ls-dash-card-icon"><Icon name={ICON_MAP[c.id as LSPanel]} /></div>
              <div className="ls-dash-card-title">{c.title}</div>
              <div className="ls-dash-card-desc">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL: TIEMPO
══════════════════════════════════════════════════════════════════ */
function PanelTiempo({ active }: { active: boolean }) {
  const { bloques, variables, calEvents, addBloqueFijo, addBloqueVar, updateBloque, deleteBloque, addCalEvent, deleteCalEvent } = useLifeSystemStore();

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newType, setNewType] = useState<'evento' | 'tarea' | 'personal' | 'meta'>('evento');
  const [varForm, setVarForm] = useState({ ora: '', actividad: '', lugar: '' });
  const [showVarForm, setShowVarForm] = useState(false);

  const toMin = (h: string) => { const p = (h + ':00').split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); };
  const allBlocks = [
    ...bloques.map(b => ({ ...b, _t: 'fixed' as const })),
    ...variables.map(b => ({ ...b, _t: 'var' as const })),
  ].sort((a, b) => toMin(a.hora || '00:00') - toMin(b.hora || '00:00'));

  // Calendar
  const now = new Date();
  const first = new Date(calYear, calMonth, 1);
  const last = new Date(calYear, calMonth + 1, 0);
  let startDow = first.getDay(); startDow = startDow === 0 ? 6 : startDow - 1;
  const prevLast = new Date(calYear, calMonth, 0);
  const cells: { num: number; other?: boolean; today?: boolean; key: string }[] = [];
  for (let i = startDow - 1; i >= 0; i--) { const d = prevLast.getDate() - i; cells.push({ num: d, other: true, key: calKey(calYear, calMonth - 1, d) }); }
  for (let d = 1; d <= last.getDate(); d++) { const key = calKey(calYear, calMonth, d); const isToday = d === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear(); cells.push({ num: d, today: isToday, key }); }
  const rem = 7 - cells.length % 7; if (rem < 7) for (let d = 1; d <= rem; d++) cells.push({ num: d, other: true, key: calKey(calYear, calMonth + 1, d) });

  const getEvs = (key: string) => calEvents.filter(e => e.date === key);

  const saveCalEvent = (key: string) => {
    if (!newTitle.trim()) return;
    addCalEvent(key, newTitle.trim(), newTime, newType);
    setNewTitle(''); setNewTime(''); setNewType('evento'); setModalDate(null);
  };

  return (
    <div className={`ls-panel${active ? ' active' : ''}`}>
      <div className="ls-page-header">
        <div className="ls-page-label">01 — Tiempo</div>
        <h1 className="ls-page-title">Calendario &<br /><em>Agenda</em></h1>
        <p className="ls-page-desc">Planifica con intención. Bloquea tu tiempo. Adueñate de tu día.</p>
      </div>
      <div className="ls-content">
        {/* Bloques */}
        <div className="ls-card">
          <div className="ls-card-head">
            <div className="ls-card-title"><Icon name="zap" /> Bloques de Tiempo</div>
          </div>
          <div className="ls-table-wrap">
            <table className="ls-table">
              <thead><tr><th>Tipo</th><th>Hora</th><th>Actividad</th><th>Lugar</th><th></th></tr></thead>
              <tbody>
                {allBlocks.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--txt2)', padding: '20px' }}>Agrega bloques para planificar tu día</td></tr>
                )}
                {allBlocks.map(b => (
                  <tr key={b.id}>
                    <td><span className={`ls-pill ${b._t === 'fixed' ? 'ls-pill-doing' : 'ls-pill-todo'}`}>{b._t === 'fixed' ? 'Fijo' : 'Variable'}</span></td>
                    <td><span className="ls-edit" contentEditable suppressContentEditableWarning onBlur={e => updateBloque(b._t === 'fixed' ? 'fixed' : 'var', b.id, 'hora', e.currentTarget.textContent || '')}>{b.hora}</span></td>
                    <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ fontWeight: 600 }} onBlur={e => updateBloque(b._t === 'fixed' ? 'fixed' : 'var', b.id, 'actividad', e.currentTarget.textContent || '')}>{b.actividad}</span></td>
                    <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ color: 'var(--txt2)' }} onBlur={e => updateBloque(b._t === 'fixed' ? 'fixed' : 'var', b.id, 'lugar', e.currentTarget.textContent || '')}>{b.lugar}</span></td>
                    <td><button className="ls-btn-del" onClick={() => deleteBloque(b._t === 'fixed' ? 'fixed' : 'var', b.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="ls-btn-add" onClick={addBloqueFijo}>+ Bloque fijo</button>
            <button className="ls-btn-add" onClick={() => setShowVarForm(true)}>+ Bloque variable</button>
          </div>
          {showVarForm && (
            <div style={{ marginTop: 14, padding: 16, background: 'var(--warm)', borderRadius: 12, border: '1px solid var(--bdr)' }}>
              <div className="ls-grid-2" style={{ marginBottom: 10 }}>
                <div><label className="ls-field-label">Actividad</label><input className="ls-input" placeholder="¿Qué vas a hacer?" value={varForm.actividad} onChange={e => setVarForm(f => ({ ...f, actividad: e.target.value }))} /></div>
                <div><label className="ls-field-label">Hora</label><input className="ls-input" type="time" value={varForm.ora} onChange={e => setVarForm(f => ({ ...f, ora: e.target.value }))} /></div>
              </div>
              <div className="ls-field"><label className="ls-field-label">Lugar (opcional)</label><input className="ls-input" placeholder="Lugar" value={varForm.lugar} onChange={e => setVarForm(f => ({ ...f, lugar: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ls-btn-primary" onClick={() => { if (varForm.actividad.trim()) { addBloqueVar(varForm.ora, varForm.actividad.trim(), varForm.lugar); setVarForm({ ora: '', actividad: '', lugar: '' }); setShowVarForm(false); } }}>Agregar</button>
                <button className="ls-btn-ghost" onClick={() => setShowVarForm(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="ls-card">
          <div className="ls-cal-nav">
            <button className="ls-cal-btn" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}>← Anterior</button>
            <div className="ls-cal-title">{MONTHS_ES[calMonth]} <em>{calYear}</em></div>
            <button className="ls-cal-btn" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}>Siguiente →</button>
          </div>
          <div className="ls-cal-head">
            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="ls-cal-grid">
            {cells.map((c, i) => {
              const evs = getEvs(c.key);
              return (
                <div key={i} className={`ls-cal-cell${c.other ? ' other' : ''}${c.today ? ' today' : ''}`} onClick={() => !c.other && setModalDate(c.key)}>
                  <div className="ls-cal-cell-num">{c.num}</div>
                  {evs.map(e => <div key={e.id} className={`ls-cal-ev t-${e.type}`}>{e.title}</div>)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cal modal */}
        {modalDate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,36,33,.65)', backdropFilter: 'blur(12px)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => e.target === e.currentTarget && setModalDate(null)}>
            <div style={{ background: 'var(--white)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-lg)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--forest)', marginBottom: 16 }}>Día <em style={{ color: 'var(--amber)' }}>{parseInt(modalDate.split('-')[2])}</em></h3>
              {getEvs(modalDate).map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--bdr)' }}>
                  <span style={{ fontSize: '.84rem', color: 'var(--forest)' }}><span className={`ls-pill ls-pill-todo`} style={{ marginRight: 6 }}>{e.type}</span>{e.title}</span>
                  <button className="ls-btn-del" onClick={() => deleteCalEvent(e.id)}>✕</button>
                </div>
              ))}
              <div style={{ marginTop: 14 }}>
                <div className="ls-field"><label className="ls-field-label">Título</label><input className="ls-input" placeholder="Título del evento" value={newTitle} onChange={e => setNewTitle(e.target.value)} /></div>
                <div className="ls-grid-2">
                  <div className="ls-field"><label className="ls-field-label">Hora</label><input className="ls-input" type="time" value={newTime} onChange={e => setNewTime(e.target.value)} /></div>
                  <div className="ls-field"><label className="ls-field-label">Tipo</label>
                    <select className="ls-select" value={newType} onChange={e => setNewType(e.target.value as typeof newType)}>
                      <option value="evento">Evento</option><option value="tarea">Tarea</option><option value="personal">Personal</option><option value="meta">Meta</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="ls-btn-primary" onClick={() => saveCalEvent(modalDate)}>Guardar</button>
                  <button className="ls-btn-ghost" onClick={() => setModalDate(null)}>Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL: EJECUCIÓN
══════════════════════════════════════════════════════════════════ */
function PanelExec({ active }: { active: boolean }) {
  const {
    inbox, addInbox, updateInbox, deleteInbox,
    nextActions, addNextAction, updateNextAction, deleteNextAction,
    proyectos, addProject, updateProject, deleteProject,
  } = useLifeSystemStore();

  const cyclePriority = (id: string, cur: string) => {
    const idx = PRIORITY_CYCLE.indexOf(cur as typeof PRIORITY_CYCLE[number]);
    updateNextAction(id, 'priority', PRIORITY_CYCLE[(idx + 1) % 3]);
  };
  const cycleStatus = (id: string, cur: string) => {
    const next = STATUS_MAP[cur as keyof typeof STATUS_MAP]?.next ?? 'active';
    updateProject(id, 'estado', next);
  };
  const cycleProjPriority = (id: string, cur: string) => {
    const idx = PRIORITY_CYCLE.indexOf(cur as typeof PRIORITY_CYCLE[number]);
    updateProject(id, 'priority', PRIORITY_CYCLE[(idx + 1) % 3]);
  };

  const total = proyectos.length;
  const done = proyectos.filter(p => p.estado === 'completed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={`ls-panel${active ? ' active' : ''}`}>
      <div className="ls-page-header">
        <div className="ls-page-label">02 — Ejecución</div>
        <h1 className="ls-page-title">Tareas &<br /><em>Proyectos</em></h1>
        <p className="ls-page-desc">Captura. Organiza. Ejecuta. Una acción clara a la vez.</p>
      </div>
      <div className="ls-content">
        {/* Inbox */}
        <div className="ls-card">
          <div className="ls-card-head">
            <div><div className="ls-card-title"><Icon name="inbox" /> Bandeja de Entrada</div><div className="ls-card-sub">Captura rápida — sácalo de tu cabeza</div></div>
          </div>
          {inbox.map(item => (
            <div key={item.id} className="ls-check-row">
              <input type="checkbox" checked={item.done} onChange={e => updateInbox(item.id, 'done', e.target.checked)} />
              <label contentEditable suppressContentEditableWarning onBlur={e => updateInbox(item.id, 'text', e.currentTarget.textContent || '')}>{item.text}</label>
              <button className="ls-btn-del" onClick={() => deleteInbox(item.id)}>✕</button>
            </div>
          ))}
          <button className="ls-btn-add" style={{ marginTop: 8 }} onClick={addInbox}>+ Capturar tarea</button>
        </div>

        {/* Next Actions */}
        <div className="ls-card">
          <div className="ls-card-head">
            <div><div className="ls-card-title"><Icon name="zap" /> Próximas Acciones</div><div className="ls-card-sub">Tareas que puedes ejecutar ahora mismo</div></div>
          </div>
          {nextActions.map(t => (
            <div key={t.id} className="ls-check-row">
              <input type="checkbox" checked={t.done} onChange={e => updateNextAction(t.id, 'done', e.target.checked)} />
              <label contentEditable suppressContentEditableWarning onBlur={e => updateNextAction(t.id, 'text', e.currentTarget.textContent || '')}>{t.text}</label>
              <button className={`ls-pill ls-pill-${t.priority}`} onClick={() => cyclePriority(t.id, t.priority)} style={{ flexShrink: 0 }}>{t.priority.toUpperCase()}</button>
              <button className="ls-btn-del" onClick={() => deleteNextAction(t.id)}>✕</button>
            </div>
          ))}
          <button className="ls-btn-add" style={{ marginTop: 8 }} onClick={addNextAction}>+ Agregar acción</button>
        </div>

        {/* Projects */}
        <div className="ls-card">
          <div className="ls-card-head">
            <div><div className="ls-card-title"><Icon name="folder" /> Proyectos</div><div className="ls-card-sub">Proyectos activos con próximos pasos claros</div></div>
          </div>
          {total > 0 && (
            <div className="ls-prog-row" style={{ marginBottom: 16 }}>
              <div className="ls-prog-label"><span>Progreso de proyectos</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{done}/{total} completados</span></div>
              <div className="ls-prog-bar"><div className="ls-prog-fill" style={{ width: `${pct}%` }} /></div>
            </div>
          )}
          <div className="ls-table-wrap">
            <table className="ls-table">
              <thead><tr><th>Proyecto</th><th>Próxima Acción</th><th>Fecha</th><th>Estado</th><th>Prior.</th><th></th></tr></thead>
              <tbody>
                {proyectos.map(p => {
                  const s = STATUS_MAP[p.estado] ?? STATUS_MAP.active;
                  return (
                    <tr key={p.id}>
                      <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ fontWeight: 600 }} onBlur={e => updateProject(p.id, 'nombre', e.currentTarget.textContent || '')}>{p.nombre}</span></td>
                      <td><span className="ls-edit" contentEditable suppressContentEditableWarning onBlur={e => updateProject(p.id, 'accion', e.currentTarget.textContent || '')}>{p.accion}</span></td>
                      <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ fontSize: '.75rem', color: 'var(--txt2)' }} onBlur={e => updateProject(p.id, 'deadline', e.currentTarget.textContent || '')}>{p.deadline}</span></td>
                      <td><button className={`ls-pill ${s.cls}`} onClick={() => cycleStatus(p.id, p.estado)}>{s.label}</button></td>
                      <td><button className={`ls-pill ls-pill-${p.priority}`} onClick={() => cycleProjPriority(p.id, p.priority)}>{p.priority.toUpperCase()}</button></td>
                      <td><button className="ls-btn-del" onClick={() => deleteProject(p.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="ls-btn-add" style={{ marginTop: 10 }} onClick={addProject}>+ Agregar proyecto</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL: SISTEMA DIARIO
══════════════════════════════════════════════════════════════════ */
function PanelDiario({ active }: { active: boolean }) {
  const { ritualAm, ritualPm, notasAm, notasPm, addRitual, updateRitual, deleteRitual, setNotasAm, setNotasPm } = useLifeSystemStore();

  return (
    <div className={`ls-panel${active ? ' active' : ''}`}>
      <div className="ls-page-header">
        <div className="ls-page-label">03 — Sistema Diario</div>
        <h1 className="ls-page-title">Rituales<br /><em>AM / PM</em></h1>
        <p className="ls-page-desc">Dos momentos que sostienen todo. Empieza y cierra tu día con intención.</p>
      </div>
      <div className="ls-content">
        <div className="ls-ritual-grid">
          {/* Mañana */}
          <div className="ls-ritual-block">
            <div className="ls-ritual-label"><Icon name="sunrise" /> Ritual Mañana</div>
            {ritualAm.map(r => (
              <div key={r.id} className="ls-check-row">
                <input type="checkbox" checked={r.done} onChange={e => updateRitual('am', r.id, 'done', e.target.checked)} />
                <label contentEditable suppressContentEditableWarning onBlur={e => updateRitual('am', r.id, 'text', e.currentTarget.textContent || '')}>{r.text}</label>
                <button className="ls-btn-del" onClick={() => deleteRitual('am', r.id)}>✕</button>
              </div>
            ))}
            <button className="ls-btn-add" style={{ marginTop: 10 }} onClick={() => addRitual('am')}>+ Agregar paso</button>
            <div style={{ marginTop: 16 }}>
              <label className="ls-field-label">Intención del día</label>
              <textarea className="ls-textarea" placeholder="¿Qué es lo único que importa hoy?" value={notasAm} onChange={e => setNotasAm(e.target.value)} style={{ minHeight: 60 }} />
            </div>
          </div>
          {/* Noche */}
          <div className="ls-ritual-block pm">
            <div className="ls-ritual-label"><Icon name="moon" /> Ritual Noche</div>
            {ritualPm.map(r => (
              <div key={r.id} className="ls-check-row">
                <input type="checkbox" checked={r.done} onChange={e => updateRitual('pm', r.id, 'done', e.target.checked)} />
                <label contentEditable suppressContentEditableWarning onBlur={e => updateRitual('pm', r.id, 'text', e.currentTarget.textContent || '')}>{r.text}</label>
                <button className="ls-btn-del" onClick={() => deleteRitual('pm', r.id)}>✕</button>
              </div>
            ))}
            <button className="ls-btn-add" style={{ marginTop: 10 }} onClick={() => addRitual('pm')}>+ Agregar paso</button>
            <div style={{ marginTop: 16 }}>
              <label className="ls-field-label">Reflexión del día</label>
              <textarea className="ls-textarea" placeholder="¿Qué salió bien? ¿Qué mejorar?" value={notasPm} onChange={e => setNotasPm(e.target.value)} style={{ minHeight: 60 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL: MEDIR
══════════════════════════════════════════════════════════════════ */
function PanelMedir({ active }: { active: boolean }) {
  const { habitos, habitChecks, metricas, addHabito, updateHabito, deleteHabito, toggleHabit, addMetrica, updateMetrica, deleteMetrica } = useLifeSystemStore();

  const totalCells = habitos.length * 7;
  let checked = 0;
  habitos.forEach((_, hi) => { for (let d = 0; d < 7; d++) { if (habitChecks[`${hi}-${d}`]) checked++; } });
  const pct = totalCells > 0 ? Math.round((checked / totalCells) * 100) : 0;

  return (
    <div className={`ls-panel${active ? ' active' : ''}`}>
      <div className="ls-page-header">
        <div className="ls-page-label">04 — Medir</div>
        <h1 className="ls-page-title">Hábitos &<br /><em>Métricas</em></h1>
        <p className="ls-page-desc">Lo que se mide se gestiona. Mantenlo minimal.</p>
      </div>
      <div className="ls-content">
        {/* Hábitos */}
        <div className="ls-card">
          <div className="ls-card-head">
            <div className="ls-card-title"><Icon name="award" /> Hábitos Semanales</div>
          </div>
          {/* Progress summary */}
          <div className="ls-prog-row" style={{ marginBottom: 20 }}>
            <div className="ls-prog-label">
              <span>Progreso semanal</span>
              <span style={{ fontWeight: 700 }}>{pct}%</span>
            </div>
            <div className="ls-prog-bar"><div className="ls-prog-fill" style={{ width: `${pct}%` }} /></div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ls-habit-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Hábito</th>
                  {['L','M','X','J','V','S','D'].map(d => <th key={d}>{d}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {habitos.map((h, hi) => (
                  <tr key={hi}>
                    <td>
                      <span className="ls-edit" contentEditable suppressContentEditableWarning onBlur={e => updateHabito(hi, e.currentTarget.textContent || '')}>{h}</span>
                    </td>
                    {Array.from({ length: 7 }, (_, d) => {
                      const key = `${hi}-${d}`;
                      const on = habitChecks[key];
                      return (
                        <td key={d}>
                          <button className={`ls-habit-btn${on ? ' on' : ''}`} onClick={() => toggleHabit(key)}>{on ? '✓' : ''}</button>
                        </td>
                      );
                    })}
                    <td><button className="ls-btn-del" onClick={() => deleteHabito(hi)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="ls-btn-add" style={{ marginTop: 10 }} onClick={addHabito}>+ Agregar hábito</button>
        </div>

        {/* Métricas */}
        <div className="ls-card">
          <div className="ls-card-head">
            <div className="ls-card-title"><Icon name="activity" /> Métricas Clave</div>
          </div>
          {metricas.map(m => (
            <div key={m.id} className="ls-prog-row">
              <div className="ls-prog-label">
                <span contentEditable suppressContentEditableWarning className="ls-edit" onBlur={e => updateMetrica(m.id, 'label', e.currentTarget.textContent || '')}>{m.label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" min={0} max={10} value={m.val} className="ls-input" style={{ width: 52, padding: '3px 6px', fontSize: '.78rem', textAlign: 'center' }} onChange={e => updateMetrica(m.id, 'val', parseFloat(e.target.value) || 0)} />
                  <span style={{ fontSize: '.68rem', color: 'var(--txt2)' }}>/ 10</span>
                  <button className="ls-btn-del" onClick={() => deleteMetrica(m.id)}>✕</button>
                </span>
              </div>
              <div className="ls-prog-bar"><div className="ls-prog-fill" style={{ width: `${m.val * 10}%` }} /></div>
            </div>
          ))}
          <button className="ls-btn-add" onClick={addMetrica}>+ Agregar métrica</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL: DINERO
══════════════════════════════════════════════════════════════════ */
function PanelDinero({ active }: { active: boolean }) {
  const { dinero, deudas, addTransaction, updateTransaction, deleteTransaction, addDebt, updateDebt, deleteDebt } = useLifeSystemStore();

  let inc = 0, exp = 0;
  dinero.forEach(d => { if (d.tipo === 'income') inc += parseFloat(d.monto) || 0; else exp += parseFloat(d.monto) || 0; });
  const bal = inc - exp;
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

  return (
    <div className={`ls-panel${active ? ' active' : ''}`}>
      <div className="ls-page-header">
        <div className="ls-page-label">05 — Dinero</div>
        <h1 className="ls-page-title">Conciencia<br /><em>Financiera</em></h1>
        <p className="ls-page-desc">Claridad sobre complejidad. Observa a dónde fluye tu dinero.</p>
      </div>
      <div className="ls-content">
        {/* Stats */}
        <div className="ls-stat-grid">
          <div className="ls-stat-card"><div className="ls-stat-label">Ingresos</div><div className="ls-stat-value income">{fmt(inc)}</div></div>
          <div className="ls-stat-card"><div className="ls-stat-label">Gastos</div><div className="ls-stat-value expense">{fmt(exp)}</div></div>
          <div className="ls-stat-card"><div className="ls-stat-label">Balance</div><div className={`ls-stat-value ${bal >= 0 ? 'income' : 'expense'}`}>{fmt(bal)}</div></div>
        </div>

        {/* Transactions */}
        <div className="ls-card">
          <div className="ls-card-head">
            <div className="ls-card-title"><Icon name="receipt" /> Transacciones</div>
          </div>
          <div className="ls-table-wrap">
            <table className="ls-table">
              <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tipo</th><th>Monto</th><th></th></tr></thead>
              <tbody>
                {dinero.map(t => (
                  <tr key={t.id}>
                    <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ fontSize: '.75rem', color: 'var(--txt2)' }} onBlur={e => updateTransaction(t.id, 'fecha', e.currentTarget.textContent || '')}>{t.fecha}</span></td>
                    <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ fontWeight: 600 }} onBlur={e => updateTransaction(t.id, 'concepto', e.currentTarget.textContent || '')}>{t.concepto}</span></td>
                    <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ fontSize: '.75rem', color: 'var(--txt2)' }} onBlur={e => updateTransaction(t.id, 'category', e.currentTarget.textContent || '')}>{t.category}</span></td>
                    <td><button className={`ls-pill ${t.tipo === 'income' ? 'ls-pill-done' : 'ls-pill-p1'}`} onClick={() => updateTransaction(t.id, 'tipo', t.tipo === 'income' ? 'expense' : 'income')}>{t.tipo === 'income' ? 'Ingreso' : 'Gasto'}</button></td>
                    <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ fontWeight: 700 }} onBlur={e => updateTransaction(t.id, 'monto', (e.currentTarget.textContent || '').replace(/[^0-9.]/g, ''))}>${t.monto}</span></td>
                    <td><button className="ls-btn-del" onClick={() => deleteTransaction(t.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="ls-btn-add" style={{ marginTop: 10 }} onClick={addTransaction}>+ Agregar transacción</button>
        </div>

        {/* Metas / Deudas */}
        <div className="ls-card">
          <div className="ls-card-head">
            <div className="ls-card-title"><Icon name="target" /> Metas y Deudas</div>
          </div>
          <div className="ls-table-wrap">
            <table className="ls-table">
              <thead><tr><th>Concepto</th><th>Total</th><th>Pagado</th><th>Restante</th><th></th></tr></thead>
              <tbody>
                {deudas.map(d => {
                  const rem = (parseFloat(d.total) || 0) - (parseFloat(d.pagado) || 0);
                  return (
                    <tr key={d.id}>
                      <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ fontWeight: 600 }} onBlur={e => updateDebt(d.id, 'concepto', e.currentTarget.textContent || '')}>{d.concepto}</span></td>
                      <td><span className="ls-edit" contentEditable suppressContentEditableWarning onBlur={e => updateDebt(d.id, 'total', (e.currentTarget.textContent || '').replace(/[^0-9.]/g, ''))}>${d.total}</span></td>
                      <td><span className="ls-edit" contentEditable suppressContentEditableWarning onBlur={e => updateDebt(d.id, 'pagado', (e.currentTarget.textContent || '').replace(/[^0-9.]/g, ''))}>${d.pagado}</span></td>
                      <td style={{ color: rem > 0 ? 'var(--terra)' : '#3d9a6e', fontWeight: 700 }}>${Math.max(0, rem).toLocaleString('es-MX')}</td>
                      <td><button className="ls-btn-del" onClick={() => deleteDebt(d.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="ls-btn-add" style={{ marginTop: 10 }} onClick={addDebt}>+ Agregar meta</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL: DECISIONES
══════════════════════════════════════════════════════════════════ */
function PanelDecisiones({ active }: { active: boolean }) {
  const { decisiones, addDecision, updateDecision, deleteDecision } = useLifeSystemStore();

  return (
    <div className={`ls-panel${active ? ' active' : ''}`}>
      <div className="ls-page-header">
        <div className="ls-page-label">06 — Decisiones</div>
        <h1 className="ls-page-title">Diario de<br /><em>Decisiones</em></h1>
        <p className="ls-page-desc">Registra tu pensamiento. Mejora tu juicio con el tiempo.</p>
      </div>
      <div className="ls-content">
        <button className="ls-btn-add" style={{ width: '100%', justifyContent: 'center', marginBottom: 18 }} onClick={addDecision}>+ Nueva decisión</button>
        {decisiones.length === 0 && <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--txt2)' }}>Aún no hay decisiones registradas.</div>}
        {decisiones.map(d => (
          <div key={d.id} className="ls-decision-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: '.72rem', color: 'var(--txt2)' }} contentEditable suppressContentEditableWarning className="ls-edit" onBlur={e => updateDecision(d.id, 'fecha', e.currentTarget.textContent || '')}>{d.fecha}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`ls-pill ${d.repetiria ? 'ls-pill-done' : 'ls-pill-paused'}`} onClick={() => updateDecision(d.id, 'repetiria', !d.repetiria)}>{d.repetiria ? 'Repetiría' : 'No repetiría'}</button>
                <button className="ls-btn-del" onClick={() => deleteDecision(d.id)}>✕</button>
              </div>
            </div>
            {[
              { key: 'problem',    label: 'Problema o Situación' },
              { key: 'options',    label: 'Opciones Consideradas' },
              { key: 'decision',   label: 'Decisión Tomada' },
              { key: 'porQue',     label: 'Razonamiento' },
              { key: 'reflection', label: 'Reflexión / Resultado' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div className="ls-field-label">{f.label}</div>
                <div className="ls-edit" contentEditable suppressContentEditableWarning style={{ fontSize: '.83rem', color: 'var(--forest)', minHeight: 24, padding: '4px 6px', borderRadius: 6 }}
                  onBlur={e => updateDecision(d.id, f.key, e.currentTarget.textContent || '')}>{(d as unknown as Record<string, string>)[f.key]}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL: REVISIÓN
══════════════════════════════════════════════════════════════════ */
function ToggleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="ls-toggle-wrap">
      <div className="ls-toggle-head" onClick={() => setOpen(o => !o)}>
        <span className="ls-toggle-title">{title}</span>
        <span className={`ls-toggle-arrow${open ? ' open' : ''}`}>▼</span>
      </div>
      <div className={`ls-toggle-body${open ? ' open' : ''}`}>{children}</div>
    </div>
  );
}

function PanelReview({ active }: { active: boolean }) {
  const { worked, failed, adjustments, prioridades, addReviewItem, updateReviewItem, deleteReviewItem, addPriority, updatePriority, deletePriority } = useLifeSystemStore();

  const now = new Date();
  const mon = new Date(now);
  const dow = now.getDay();
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  const weekLabel = `Semana del ${fmt(mon)} — ${fmt(sun)}, ${now.getFullYear()}`;

  type ReviewType = 'worked' | 'failed' | 'adjustments';
  const lists: { key: ReviewType; store: typeof worked; title: string }[] = [
    { key: 'worked',      store: worked,      title: '✓ Qué funcionó' },
    { key: 'failed',      store: failed,       title: '✗ Qué no funcionó' },
    { key: 'adjustments', store: adjustments,  title: '⟳ Ajustes' },
  ];

  return (
    <div className={`ls-panel${active ? ' active' : ''}`}>
      <div className="ls-page-header">
        <div className="ls-page-label">07 — Revisión</div>
        <h1 className="ls-page-title">Revisión<br /><em>Semanal</em></h1>
        <p className="ls-page-desc">15 minutos. Una vez por semana. Mantiene todo vivo.</p>
      </div>
      <div className="ls-content">
        <div className="ls-card">
          <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--amber)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 18 }}>{weekLabel}</div>
          {lists.map(l => (
            <ToggleSection key={l.key} title={l.title}>
              {l.store.map(r => (
                <div key={r.id} className="ls-check-row">
                  <input type="checkbox" checked={r.done} onChange={e => updateReviewItem(l.key, r.id, 'done', e.target.checked)} />
                  <label contentEditable suppressContentEditableWarning onBlur={e => updateReviewItem(l.key, r.id, 'text', e.currentTarget.textContent || '')}>{r.text}</label>
                  <button className="ls-btn-del" onClick={() => deleteReviewItem(l.key, r.id)}>✕</button>
                </div>
              ))}
              <button className="ls-btn-add" style={{ marginTop: 6 }} onClick={() => addReviewItem(l.key)}>+ Agregar</button>
            </ToggleSection>
          ))}
          <ToggleSection title="◎ Prioridades próxima semana">
            <div className="ls-table-wrap">
              <table className="ls-table">
                <thead><tr><th>#</th><th>Prioridad</th><th>Bloque de Tiempo</th><th></th></tr></thead>
                <tbody>
                  {prioridades.map(p => (
                    <tr key={p.id}>
                      <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ fontSize: '.75rem', fontWeight: 700 }} onBlur={e => updatePriority(p.id, 'num', e.currentTarget.textContent || '')}>{p.num}</span></td>
                      <td><span className="ls-edit" contentEditable suppressContentEditableWarning onBlur={e => updatePriority(p.id, 'item', e.currentTarget.textContent || '')}>{p.item}</span></td>
                      <td><span className="ls-edit" contentEditable suppressContentEditableWarning style={{ color: 'var(--txt2)' }} onBlur={e => updatePriority(p.id, 'bloque', e.currentTarget.textContent || '')}>{p.bloque}</span></td>
                      <td><button className="ls-btn-del" onClick={() => deletePriority(p.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="ls-btn-add" style={{ marginTop: 8 }} onClick={addPriority}>+ Agregar</button>
          </ToggleSection>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PANEL: JOURNAL
══════════════════════════════════════════════════════════════════ */
function PanelJournal({ active }: { active: boolean }) {
  const { jornal, addJournalEntry, updateJournalEntry, deleteJournalEntry } = useLifeSystemStore();

  const navPrompt = (key: string, dir: number) => {
    const entry = jornal.find(e => e.key === key);
    if (!entry) return;
    const next = ((entry.preguntaIdx || 0) + dir + PROMPTS.length) % PROMPTS.length;
    updateJournalEntry(key, 'preguntaIdx', String(next));
  };
  const randPrompt = (key: string) => {
    const entry = jornal.find(e => e.key === key);
    let n: number;
    do { n = Math.floor(Math.random() * PROMPTS.length); } while (n === (entry?.preguntaIdx ?? -1));
    updateJournalEntry(key, 'preguntaIdx', String(n));
  };

  return (
    <div className={`ls-panel${active ? ' active' : ''}`}>
      <div className="ls-page-header">
        <div className="ls-page-label">08 — Journal</div>
        <h1 className="ls-page-title">Espacio de<br /><em>Reflexión</em></h1>
        <p className="ls-page-desc">Gratitud, honestidad y claridad. Esta es tu auditoría interna.</p>
      </div>
      <div className="ls-content">
        <button className="ls-journal-new-btn" onClick={addJournalEntry}>+ Nueva entrada de hoy</button>
        {jornal.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--txt2)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12, opacity: .25 }}>✦</div>
            <div style={{ fontFamily: 'Montserrat', fontSize: '1.1rem', fontWeight: 700, color: 'var(--forest)', marginBottom: 8 }}>Aún no hay entradas.</div>
            <div style={{ fontSize: '.82rem', lineHeight: 1.7 }}>Haz clic en "+ Nueva entrada de hoy" para comenzar.</div>
          </div>
        )}
        {jornal.map((entry) => {
          const p = PROMPTS[entry.preguntaIdx || 0];
          return (
            <div key={entry.key} className="ls-journal-entry">
              <div className="ls-journal-head">
                <div className="ls-journal-date">{formatDateKey(entry.key)} <span>{entry.key}</span></div>
                <button className="ls-btn-ghost" style={{ fontSize: '.72rem', padding: '5px 12px' }} onClick={() => { if (confirm('¿Eliminar esta entrada?')) deleteJournalEntry(entry.key); }}>Eliminar</button>
              </div>
              <div className="ls-journal-body">
                {/* Gratitud */}
                <div className="ls-journal-section">
                  <div className="ls-js-label">Gratitud</div>
                  <div className="ls-js-hint">Tres cosas específicas por las que estás agradecido hoy.</div>
                  {[0,1,2].map(g => (
                    <div key={g} className="ls-gratitud-row">
                      <span className="ls-gratitud-num">{g+1}</span>
                      <input
                        className="ls-input"
                        placeholder="Hoy agradezco..."
                        value={entry.gratitud[g] || ''}
                        onChange={e => {
                          const arr = [...entry.gratitud] as [string, string, string];
                          arr[g] = e.target.value;
                          updateJournalEntry(entry.key, 'gratitud', arr);
                        }}
                      />
                    </div>
                  ))}
                </div>
                {/* Pregunta */}
                <div className="ls-journal-section">
                  <div className="ls-js-label">Pregunta del Día</div>
                  <div className="ls-js-hint">Una pregunta para tu auditoría personal.</div>
                  <div className="ls-prompt-card">
                    <div style={{ fontSize: '.62rem', color: 'var(--txt2)', marginBottom: 8, fontWeight: 700, letterSpacing: '.05em' }}>PREGUNTA {(entry.preguntaIdx || 0)+1} / {PROMPTS.length}</div>
                    <div className="ls-prompt-text">{p}</div>
                    <div className="ls-prompt-nav">
                      <button className="ls-prompt-btn" onClick={() => navPrompt(entry.key, -1)}>← Anterior</button>
                      <button className="ls-prompt-btn act" onClick={() => randPrompt(entry.key)}>Aleatoria</button>
                      <button className="ls-prompt-btn" onClick={() => navPrompt(entry.key, 1)}>Siguiente →</button>
                    </div>
                    <textarea className="ls-textarea" placeholder="Escribe tu respuesta con honestidad..." value={entry.preguntaResp || ''} onChange={e => updateJournalEntry(entry.key, 'preguntaResp', e.target.value)} style={{ minHeight: 80 }} />
                  </div>
                </div>
                {/* Descarga */}
                <div className="ls-journal-section">
                  <div className="ls-js-label">Descarga Mental</div>
                  <div className="ls-js-hint">Vacía lo que ocupe espacio en tu mente.</div>
                  <textarea className="ls-textarea" placeholder="Sin estructura. Sin filtro. Solo escribe..." value={entry.descarga || ''} onChange={e => updateJournalEntry(entry.key, 'descarga', e.target.value)} style={{ minHeight: 80 }} />
                </div>
                {/* Aprendizaje */}
                <div className="ls-journal-section">
                  <div className="ls-js-label">Lección del Día</div>
                  <div className="ls-js-hint">¿Qué te enseñó este día?</div>
                  <input className="ls-input" placeholder="Hoy aprendí que..." value={entry.aprendizaje || ''} onChange={e => updateJournalEntry(entry.key, 'aprendizaje', e.target.value)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
