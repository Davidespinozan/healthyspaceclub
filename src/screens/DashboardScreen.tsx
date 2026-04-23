import { useEffect, useState } from 'react';
import { Home, User, MessageCircle } from 'lucide-react';
import { useAppStore } from '../store';
import type { DashPage } from '../types';

import TabHoy from '../components/TabHoy';
import TabCoach from '../components/TabCoach';
// TabMetodo removed — backed up in _hsm_backup/
// TabClub removed — stories now integrated into TabHoy
import TabTu from '../components/TabTu';
import MiHuella from '../components/MiHuella';

import WeeklyNutritionPlanner from '../components/WeeklyNutritionPlanner';
import DailyTrainer from '../components/DailyTrainer';
// GrowthPlan + LifeSystemScreen removed — backed up in _hsm_backup/
import { Leaf, Dumbbell } from 'lucide-react';

const TABS: { id: DashPage; icon: typeof Home; label: string }[] = [
  { id: 'hoy',    icon: Home,   label: 'Hoy' },
  { id: 'tu',     icon: User,   label: 'Tú' },
];

export default function DashboardScreen() {
  const { dashPage, setDashPage, checkTrialExpiry } = useAppStore();
  const [coachOpen, setCoachOpen] = useState(false);

  useEffect(() => { checkTrialExpiry(); }, []);

  function navTo(page: DashPage) {
    setDashPage(page);
    window.scrollTo(0, 0);
  }

  const isSubPage = !['hoy', 'tu'].includes(dashPage);

  return (
    <div className="app-shell">
      <main className="app-main">
        {/* Main tabs */}
        {dashPage === 'hoy' && <TabHoy onNav={(p) => navTo(p as DashPage)} />}
        {/* Club removed — stories integrated into TabHoy */}
        {/* Método tab removed — HSM questions remain in Tu Espacio */}
        {dashPage === 'tu' && <TabTu onNav={navTo} />}

        {/* Sub-pages */}
        {dashPage === 'alimentacion' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('hoy')}>← Volver</button>
            <div className="sec-hero">
              <div className="sh-icon"><Leaf size={24} strokeWidth={1.5} /></div>
              <div><h2>Nutrición</h2><p>Tu nutricionista IA genera un plan de 7 días personalizado.</p></div>
            </div>
            <WeeklyNutritionPlanner />
          </div>
        )}
        {dashPage === 'entrenamiento' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('hoy')}>← Volver</button>
            <div className="sec-hero">
              <div className="sh-icon"><Dumbbell size={24} strokeWidth={1.5} /></div>
              <div><h2>Entrenamiento</h2><p>Tu coach personal te dice qué hacer hoy.</p></div>
            </div>
            <DailyTrainer />
          </div>
        )}
        {/* hsm and lifesystem sub-pages removed */}
        {dashPage === 'huella' && (
          <div className="sub-page tab-content">
            <MiHuella onBack={() => navTo('tu')} />
          </div>
        )}
      </main>

      {/* Coach FAB */}
      <button
        className={`coach-fab${coachOpen ? ' open' : ''}`}
        onClick={() => setCoachOpen(o => !o)}
      >
        {coachOpen
          ? <span className="coach-fab-x">✕</span>
          : <MessageCircle size={22} strokeWidth={2} />
        }
      </button>

      {/* Coach overlay */}
      {coachOpen && (
        <div className="coach-overlay">
          <TabCoach />
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bnav">
        <div className="bnav-brand">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png" alt="HSC" className="bnav-logo" />
        </div>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = dashPage === tab.id
            || (isSubPage && tab.id === 'hoy' && ['alimentacion', 'entrenamiento'].includes(dashPage))
            || (isSubPage && tab.id === 'tu' && dashPage === 'huella');
          return (
            <div
              key={tab.id}
              className={`bnav-item${active ? ' active' : ''}`}
              onClick={() => navTo(tab.id)}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span className="bnav-label">{tab.label}</span>
              {active && <div className="bnav-dot" />}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
