import { useEffect, useState, lazy, Suspense } from 'react';
import { Home, User, MessageCircle, Users, AlertCircle, X } from 'lucide-react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import type { DashPage } from '../types';
import type { TranslationKey } from '../i18n/es';

import TabHoy from '../components/TabHoy'; // default tab → estática (carga instantánea)
import SubPageLoadingFallback from '../components/SubPageLoadingFallback';

// Tabs/sheets no-default → lazy: solo cargan al entrar a ellas (aligera el chunk del dashboard).
const ManagePlanSheet = lazy(() => import('../components/sheets/ManagePlanSheet'));
const TabCoach = lazy(() => import('../components/TabCoach'));
const TabClub = lazy(() => import('../components/TabClub'));
const TabTu = lazy(() => import('../components/TabTu'));
const MiHuella = lazy(() => import('../components/MiHuella'));

// Sub-pages lazy — Split-1: las dos más pesadas salen del initial chunk.
// DailyTrainer y WeeklyNutritionPlanner solo se cargan al entrar a su
// sub-page (/entrenamiento, /alimentacion). exercises.ts y mealPlan.ts
// siguen viajando con TabHoy (eager) — eso es Split-1b futuro.
const WeeklyNutritionPlanner = lazy(() => import('../components/WeeklyNutritionPlanner'));
const DailyTrainer = lazy(() => import('../components/DailyTrainer'));
const CompanerosScreen = lazy(() => import('../components/CompanerosScreen'));
// GrowthPlan + LifeSystemScreen removed — backed up in _hsm_backup/

const TABS: { id: DashPage; icon: typeof Home; labelKey: TranslationKey }[] = [
  { id: 'hoy',    icon: Home,   labelKey: 'nav.today' },
  { id: 'club',   icon: Users,  labelKey: 'nav.club' },
  { id: 'tu',     icon: User,   labelKey: 'nav.you' },
];

export default function DashboardScreen() {
  const { dashPage, setDashPage, checkTrialExpiry, coachOpen, setCoachOpen, paymentPastDue } = useAppStore();
  const { t } = useT();
  const [showPastDuePlan, setShowPastDuePlan] = useState(false);
  // El cuestionario (Trainer/Nutrición) ya emite su propio hero forest compacto,
  // así que ya no montamos la card intro `.sec-hero` (era una segunda cabecera
  // que duplicaba contexto y robaba media pantalla). setTrainerPhase se mantiene
  // por compatibilidad con el callback de DailyTrainer.
  const [, setTrainerPhase] = useState<string>('modality');

  useEffect(() => { checkTrialExpiry(); }, []);

  // Cerrar el coach al tocar cualquier cosa que NO sea el panel del coach ni su FAB.
  // (pointerdown deja que el botón tocado igual ejecute su acción: ej. cambiar de tab
  //  navega Y cierra el coach.) Solo activo mientras el coach está abierto.
  useEffect(() => {
    if (!coachOpen) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el && !el.closest('.coach-overlay') && !el.closest('.coach-fab')) {
        setCoachOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [coachOpen, setCoachOpen]);

  function navTo(page: DashPage) {
    setDashPage(page);
    window.scrollTo(0, 0);
  }

  const isSubPage = !['hoy', 'club', 'tu'].includes(dashPage);

  return (
    <div className="app-shell">
      {/* Banner global de pago fallido (past_due). Acceso no cambia; CTA a
          actualizar tarjeta. Se carga del status; aparece en el próximo load. */}
      {paymentPastDue && (
        <div className="pastdue-banner" role="alert">
          <AlertCircle size={18} strokeWidth={2} className="pastdue-icon" />
          <div className="pastdue-text">
            <strong>{t('pastDue.title')}</strong>
            <span>{t('pastDue.body')}</span>
          </div>
          <button className="pastdue-cta" onClick={() => setShowPastDuePlan(true)}>
            {t('pastDue.cta')}
          </button>
        </div>
      )}
      {showPastDuePlan && (
        <Suspense fallback={null}>
          <ManagePlanSheet onClose={() => setShowPastDuePlan(false)} />
        </Suspense>
      )}
      <main className="app-main">
        {/* Main tabs */}
        {dashPage === 'hoy' && <TabHoy onNav={(p) => navTo(p as DashPage)} />}
        {dashPage === 'club' && (
          <Suspense fallback={<SubPageLoadingFallback />}><TabClub /></Suspense>
        )}
        {/* Método tab removed — HSM questions remain in Tu Espacio */}
        {dashPage === 'tu' && (
          <Suspense fallback={<SubPageLoadingFallback />}><TabTu onNav={navTo} /></Suspense>
        )}

        {/* Sub-pages */}
        {dashPage === 'alimentacion' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('hoy')}>← {t('common.back')}</button>
            <Suspense fallback={<SubPageLoadingFallback />}>
              <WeeklyNutritionPlanner />
            </Suspense>
          </div>
        )}
        {dashPage === 'entrenamiento' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('hoy')}>← {t('common.back')}</button>
            <Suspense fallback={<SubPageLoadingFallback />}>
              <DailyTrainer onPhaseChange={setTrainerPhase} />
            </Suspense>
          </div>
        )}
        {dashPage === 'companeros' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('hoy')}>← {t('common.back')}</button>
            <Suspense fallback={<SubPageLoadingFallback />}>
              <CompanerosScreen />
            </Suspense>
          </div>
        )}
        {dashPage === 'entrenamiento-pareja' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('companeros')}>← {t('common.back')}</button>
            <Suspense fallback={<SubPageLoadingFallback />}>
              <DailyTrainer onPhaseChange={setTrainerPhase} partnerMode />
            </Suspense>
          </div>
        )}
        {/* hsm and lifesystem sub-pages removed */}
        {dashPage === 'huella' && (
          <div className="sub-page tab-content">
            <Suspense fallback={<SubPageLoadingFallback />}>
              <MiHuella onBack={() => navTo('tu')} />
            </Suspense>
          </div>
        )}
      </main>

      {/* Coach FAB */}
      <button
        className={`coach-fab${coachOpen ? ' open' : ''}`}
        onClick={() => setCoachOpen(!coachOpen)}
      >
        {coachOpen
          ? <X size={23} strokeWidth={2.5} />
          : <MessageCircle size={23} strokeWidth={2} />
        }
      </button>

      {/* Coach overlay */}
      {coachOpen && (
        <div className="coach-overlay">
          <Suspense fallback={<SubPageLoadingFallback />}>
            <TabCoach />
          </Suspense>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bnav">
        <div className="bnav-brand">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png" alt="HSC" className="bnav-logo" />
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="Healthy Space Club" className="bnav-wordmark" />
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
              <span className="bnav-label">{t(tab.labelKey)}</span>
              {active && <div className="bnav-dot" />}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
