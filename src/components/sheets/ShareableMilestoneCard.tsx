import { MILESTONE_COPY } from '../../constants/milestones';
import './shareable-milestone-card.css';

interface Props {
  milestoneDay: number;
  unlockedAt: string;
  userName: string;
  startDate?: string;
  format: 'square' | 'story';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysSinceStart(startDate: string | undefined): { year: number; day: number } {
  if (!startDate) return { year: 1, day: 1 };
  const start = new Date(startDate).getTime();
  const total = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  return { year: Math.floor(total / 365) + 1, day: (total % 365) + 1 };
}

export default function ShareableMilestoneCard({
  milestoneDay,
  unlockedAt,
  userName,
  startDate,
  format,
}: Props) {
  const copy = MILESTONE_COPY[milestoneDay];
  const { year, day } = daysSinceStart(startDate);

  return (
    <div className={`smc smc--${format}`}>
      <div className="smc-logo" aria-hidden="true">H</div>

      <div className="smc-body">
        <div className="smc-emoji" aria-hidden="true">{copy.emoji}</div>
        <h1 className="smc-title">{copy.title}</h1>
        <p className="smc-sub">{copy.sub}</p>
        <div className="smc-badge">{milestoneDay} {milestoneDay === 1 ? 'día' : 'días'}</div>
      </div>

      <div className="smc-footer">
        <div className="smc-footer-brand">Healthy Space Club</div>
        <div className="smc-footer-meta">
          {userName ? `${userName} · ` : ''}Año {year} · día {day}
        </div>
        <div className="smc-footer-date">Desbloqueado el {formatDate(unlockedAt)}</div>
      </div>
    </div>
  );
}
