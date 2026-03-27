import { useEffect } from 'react';
import { Home, MessageCircle, Brain, User } from 'lucide-react';
import { useAppStore } from '../store';
import type { DashPage } from '../types';

import TabHoy from '../components/TabHoy';
import TabCoach from '../components/TabCoach';
import TabMetodo from '../components/TabMetodo';
import TabTu from '../components/TabTu';

import WeeklyNutritionPlanner from '../components/WeeklyNutritionPlanner';
import DailyTrainer from '../components/DailyTrainer';
import GrowthPlan from '../components/GrowthPlan';
import LifeSystemScreen from './LifeSystemScreen';
import { Leaf, Dumbbell } from 'lucide-react';

const TABS: { id: DashPage; icon: typeof Home; label: string }[] = [
  { id: 'hoy',    icon: Home,          label: 'Hoy' },
  { id: 'coach',  icon: MessageCircle, label: 'Coach' },
  { id: 'metodo', icon: Brain,         label: 'Método' },
  { id: 'tu',     icon: User,          label: 'Tú' },
];

export default function DashboardScreen() {
  const { dashPage, setDashPage, checkTrialExpiry } = useAppStore();

  useEffect(() => { checkTrialExpiry(); }, []);

  function navTo(page: DashPage) {
    setDashPage(page);
    window.scrollTo(0, 0);
  }

  // Is this a main tab or a sub-page?
  const isSubPage = !['hoy', 'coach', 'metodo', 'tu'].includes(dashPage);

  return (
    <div className="app-shell">
      {/* ── Main content area ── */}
      <main className="app-main">
        {/* Main tabs */}
        {dashPage === 'hoy' && <TabHoy onNav={(p) => navTo(p as DashPage)} />}
        {dashPage === 'coach' && <TabCoach />}
        {dashPage === 'metodo' && <TabMetodo onNav={navTo} />}
        {dashPage === 'tu' && <TabTu onNav={navTo} />}

        {/* Sub-pages (navigated from tabs) */}
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
        {dashPage === 'hsm' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('metodo')}>← Volver</button>
            <GrowthPlan visible={true} />
          </div>
        )}
        {dashPage === 'lifesystem' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('metodo')}>← Volver</button>
            <LifeSystemScreen inline />
          </div>
        )}
      </main>

      {/* ── Navigation (bottom on mobile, side on desktop) ── */}
      <nav className="bnav">
        <div className="bnav-brand">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="HSC" className="bnav-logo" />
        </div>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = dashPage === tab.id || (isSubPage && tab.id === 'hoy' && ['alimentacion', 'entrenamiento'].includes(dashPage));
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
