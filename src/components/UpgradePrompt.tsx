import { useAppStore } from '../store';

interface Props {
  requiredPlan: 'pro' | 'elite';
  featureName: string;
  children: React.ReactNode;
}

const PLAN_RANK: Record<string, number> = {
  none: 0,
  trial: 1,
  basico: 2,
  pro: 3,
  elite: 4,
};

const PLAN_PRICE: Record<'pro' | 'elite', string> = {
  pro: '$199',
  elite: '$299',
};

export default function UpgradePrompt({ requiredPlan, featureName, children }: Props) {
  const { userPlan, openPay } = useAppStore();

  const hasAccess = PLAN_RANK[userPlan] >= PLAN_RANK[requiredPlan];

  if (hasAccess) return <>{children}</>;

  const planLabel = requiredPlan === 'pro' ? 'Pro' : 'Elite';

  return (
    <div className="up-wrap">
      <div className="up-children-blur">{children}</div>
      <div className="up-blur">
        <div className="up-lock">
          <div className="up-lock-icon">🔒</div>
          <div className="up-lock-name">{featureName}</div>
          <div className="up-lock-sub">Desbloquea con Plan {planLabel}</div>
          <button
            className="up-lock-btn"
            onClick={() => openPay(
              `Plan ${planLabel} Mensual`,
              PLAN_PRICE[requiredPlan],
              `Membresía mensual · Plan ${planLabel}`
            )}
          >
            Ver Plan {planLabel} →
          </button>
        </div>
      </div>
    </div>
  );
}
