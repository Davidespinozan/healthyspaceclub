import { useState, useRef } from 'react';
import { useAppStore } from '../store';
import { Camera, Plus, TrendingDown, TrendingUp, Minus } from 'lucide-react';

type PhotoEntry = { date: string; dataUrl: string };

const STORAGE_KEY = 'hsc-transform-photos';

function loadPhotos(): PhotoEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}
function savePhotos(photos: PhotoEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
}

/* ── Weight chart (SVG) ─────────────────────────────────────── */
function WeightChart({ data }: { data: { date: string; kg: number }[] }) {
  if (data.length < 1) return null;
  const W = 280; const H = 80;
  const PAD = { t: 8, b: 20, l: 28, r: 12 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const vals = data.map(d => d.kg);
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  const range = max - min || 1;

  const xOf = (i: number) => PAD.l + (i / Math.max(data.length - 1, 1)) * iW;
  const yOf = (v: number) => PAD.t + iH - ((v - min) / range) * iH;

  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.kg)}`).join(' ');
  const first = data[0].kg; const last = data[data.length - 1].kg;
  const color = last <= first ? '#2ecc71' : '#e05c2a';

  // Area fill path
  const areaPath = data.length > 1
    ? `M${xOf(0)},${yOf(data[0].kg)} ` +
      data.slice(1).map((d, i) => `L${xOf(i + 1)},${yOf(d.kg)}`).join(' ') +
      ` L${xOf(data.length - 1)},${H - PAD.b} L${xOf(0)},${H - PAD.b} Z`
    : '';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Baseline */}
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--border)" strokeWidth="1" />
      {/* Y labels */}
      {[min + 1, (min + max) / 2, max - 1].map((v, i) => (
        <text key={i} x={PAD.l - 4} y={yOf(v) + 4} fontSize="9" fill="var(--txt2)" textAnchor="end">
          {Math.round(v)}
        </text>
      ))}
      {/* Area */}
      {areaPath && <path d={areaPath} fill="url(#wGrad)" />}
      {/* Line */}
      {data.length > 1 && (
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
      )}
      {/* Dots */}
      {data.map((d, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(d.kg)} r={i === data.length - 1 ? 5 : 3}
          fill={i === data.length - 1 ? color : 'var(--surface)'}
          stroke={color} strokeWidth="2" />
      ))}
      {/* Last value label */}
      <text x={xOf(data.length - 1)} y={yOf(last) - 9} fontSize="10" fontWeight="700"
        fill={color} textAnchor="middle">{last} kg</text>
      {/* X date labels: first + last */}
      {data.length > 1 && <>
        <text x={xOf(0)} y={H - 4} fontSize="9" fill="var(--txt2)" textAnchor="start">
          {data[0].date.slice(5)}
        </text>
        <text x={xOf(data.length - 1)} y={H - 4} fontSize="9" fill="var(--txt2)" textAnchor="end">
          {data[data.length - 1].date.slice(5)}
        </text>
      </>}
    </svg>
  );
}

/* ── Main widget ─────────────────────────────────────────────── */
export default function TransformWidget() {
  const { weightLog, addWeight, obData } = useAppStore();
  const [photos, setPhotos] = useState<PhotoEntry[]>(loadPhotos);
  const [addingWeight, setAddingWeight] = useState(false);
  const [newKg, setNewKg] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const obPeso  = parseFloat(String((obData as Record<string, unknown>)?.peso ?? ''));
  const sorted  = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1]?.kg ?? (isNaN(obPeso) ? null : obPeso);
  const start   = sorted[0]?.kg ?? current;
  const diff    = current != null && start != null && sorted.length > 1
    ? +(current - start).toFixed(1) : null;
  const pct     = current != null && start != null && sorted.length > 1
    ? Math.abs(diff ?? 0) / start * 100 : 0;

  function handleAddWeight() {
    const val = parseFloat(newKg);
    if (isNaN(val) || val < 20 || val > 300) return;
    addWeight(val);
    setNewKg('');
    setAddingWeight(false);
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const entry: PhotoEntry = {
        date: new Date().toISOString().split('T')[0],
        dataUrl: ev.target?.result as string,
      };
      const updated = [entry, ...photos].slice(0, 12); // keep last 12
      setPhotos(updated);
      savePhotos(updated);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  const going = diff !== null ? (diff < 0 ? 'down' : diff > 0 ? 'up' : 'same') : null;

  return (
    <div className="tw-wrap">
      {/* Header */}
      <div className="tw-head">
        <span className="tw-title">📸 Mi Transformación</span>
        <button className="tw-add-w" onClick={() => setAddingWeight(a => !a)}>
          {addingWeight ? '✕' : '+ Registrar peso'}
        </button>
      </div>

      {/* Weight input */}
      {addingWeight && (
        <div className="tw-input-row">
          <input
            className="tw-kg-input"
            type="number"
            placeholder="ej. 74.5"
            value={newKg}
            onChange={e => setNewKg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddWeight()}
            autoFocus
          />
          <span className="tw-kg-unit">kg</span>
          <button className="tw-kg-confirm" onClick={handleAddWeight}>Guardar</button>
        </div>
      )}

      {/* Empty state — day 1 prompt */}
      {current == null && !addingWeight && (
        <div className="tw-day1">
          <div className="tw-day1-icon">📍</div>
          <div className="tw-day1-text">
            <strong>Día 1 — registra tu punto de partida</strong>
            <span>Necesitas al menos un registro para ver tu transformación.</span>
          </div>
          <button className="tw-day1-btn" onClick={() => setAddingWeight(true)}>
            Registrar peso inicial
          </button>
        </div>
      )}

      {/* Stats row */}
      {current != null && (
        <div className="tw-stats">
          <div className="tw-stat-main">
            <div className="tw-stat-label">Peso actual</div>
            <div className="tw-stat-val">
              {current}<span> kg</span>
            </div>
          </div>

          {diff !== null && (
            <div className={`tw-stat-diff tw-diff-${going}`}>
              {going === 'down' && <TrendingDown size={18} />}
              {going === 'up'   && <TrendingUp size={18} />}
              {going === 'same' && <Minus size={18} />}
              <div>
                <div className="tw-diff-val">{diff > 0 ? '+' : ''}{diff} kg</div>
                <div className="tw-diff-pct">{pct.toFixed(1)}% {going === 'down' ? 'menos' : 'más'}</div>
              </div>
            </div>
          )}

          {diff === null && (
            <div className="tw-stat-hint">Registra más pesos para ver tu progreso</div>
          )}
        </div>
      )}

      {/* Chart */}
      {sorted.length >= 2 && (
        <div className="tw-chart">
          <WeightChart data={sorted} />
        </div>
      )}

      {/* Photos section */}
      <div className="tw-photos-head">
        <span className="tw-photos-label">Fotos de progreso</span>
        <button className="tw-cam-btn" onClick={() => fileRef.current?.click()}>
          <Camera size={14} /> <span>Esta semana</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
      </div>

      <div className="tw-photos-grid">
        {/* Add button */}
        <button className="tw-photo-add" onClick={() => fileRef.current?.click()}>
          <Plus size={20} strokeWidth={1.5} />
          <span>Subir foto</span>
        </button>
        {/* Photos */}
        {photos.map((p, i) => (
          <div key={i} className="tw-photo-item" onClick={() => setLightbox(p.dataUrl)}>
            <img src={p.dataUrl} alt={p.date} />
            <div className="tw-photo-date">{p.date.slice(5)}</div>
            {i === 0 && <div className="tw-photo-badge">Reciente</div>}
          </div>
        ))}
      </div>

      {/* Motivational message when there's progress */}
      {diff !== null && diff < -2 && (
        <div className="tw-motivation">
          🎯 Llevas <strong>{Math.abs(diff)} kg menos</strong> desde que empezaste. ¡Tu cuerpo está respondiendo!
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="tw-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Progreso" />
          <div className="tw-lb-close">✕</div>
        </div>
      )}
    </div>
  );
}
