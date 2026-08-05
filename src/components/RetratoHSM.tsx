import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../i18n';
import { getHSMBank } from '../data/hsmBank';
import './retrato-hsm.css';

/**
 * Tu retrato (HSM) — el OUTPUT como héroe. Hace visible lo que el usuario construye
 * con cada reflexión: una constelación de sus 10 dimensiones (brillan según cuánto
 * las ha explorado) + la síntesis por IA (`hsmProfile`) de quién es. Es el "para qué"
 * de la reflexión, que antes estaba escondido en el store. Solo LEE datos existentes
 * (dailyHSMResponses + hsmProfile); no genera ni muta nada.
 */
const CX = 100, CY = 100, R = 72;

export default function RetratoHSM() {
  const { t, locale } = useT();
  const { dailyHSMResponses, hsmProfile } = useAppStore(
    useShallow((s) => ({ dailyHSMResponses: s.dailyHSMResponses, hsmProfile: s.hsmProfile })),
  );
  const bank = getHSMBank(locale);
  const [sel, setSel] = useState<number | null>(null);

  const dims = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of dailyHSMResponses) counts[r.dimension] = (counts[r.dimension] ?? 0) + 1;
    return bank.map((d, i) => {
      const count = counts[d.title] ?? 0;
      const a = (-90 + i * 36) * (Math.PI / 180);
      return {
        emoji: d.emoji, title: d.title, count,
        level: Math.min(1, count / 6),          // ~6 reflexiones = dimensión "llena"
        x: CX + R * Math.cos(a), y: CY + R * Math.sin(a),
      };
    });
  }, [dailyHSMResponses, bank]);

  const explored = dims.filter((d) => d.count > 0).length;

  return (
    <div className="rt-card">
      <div className="rt-head">
        <span className="rt-kicker">{t('retrato.kicker')}</span>
        <h3 className="rt-title">{t('retrato.title')}</h3>
      </div>

      <svg viewBox="0 0 200 200" className="rt-svg" role="img" aria-label={t('retrato.title')}>
        {dims.map((n, i) => (
          <line key={`l${i}`} x1={CX} y1={CY} x2={n.x.toFixed(1)} y2={n.y.toFixed(1)}
            stroke={`rgba(207,122,84,${(0.1 + n.level * 0.35).toFixed(2)})`} strokeWidth={1.2} />
        ))}
        <circle cx={CX} cy={CY} r={12} fill="rgba(207,122,84,.92)" />
        <text x={CX} y={CY + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#1a0f09">{t('retrato.you')}</text>
        {dims.map((n, i) => (
          <g key={i} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
            <circle cx={n.x.toFixed(1)} cy={n.y.toFixed(1)} r={(5 + n.level * 7).toFixed(1)}
              fill={`rgba(200,168,106,${(0.18 + n.level * 0.82).toFixed(2)})`}
              stroke="rgba(200,168,106,.9)" strokeWidth={sel === i ? 2 : 1} />
            <text x={n.x.toFixed(1)} y={(n.y + (n.y > CY ? 15 : -9)).toFixed(1)} textAnchor="middle"
              fontSize={7.5} fill="rgba(241,237,225,.62)">{n.title}</text>
          </g>
        ))}
      </svg>

      <p className="rt-tip">
        {sel != null
          ? `${dims[sel].emoji} ${dims[sel].title} · ${dims[sel].count} ${dims[sel].count === 1 ? t('retrato.reflectionOne') : t('retrato.reflectionMany')}`
          : t('retrato.tapHint')}
      </p>

      <div className="rt-progress-wrap"><span className="rt-progress">{t('retrato.explored', { n: explored })}</span></div>

      <div className="rt-syn">
        <div className="rt-syn-label">{t('retrato.synthesis')}</div>
        {hsmProfile?.text
          ? <p className="rt-syn-text">{hsmProfile.text}</p>
          : <p className="rt-syn-empty">{t('retrato.synthesisEmpty')}</p>}
      </div>
    </div>
  );
}
