import { useState, useEffect, useMemo } from 'react';
import { Home, Leaf, Video, Dumbbell, Calendar, Sprout, BookOpen, ClipboardList, User, LogOut, ChevronUp, ChevronDown, Menu, Play, Camera } from 'lucide-react';
import { useAppStore } from '../store';
import { mealPlans, cuisineThemesMap } from '../data/mealPlan';
import { calcMealKcal, calcDayKcal, formatPortion } from '../utils/kcalCalc';
import { scalePlan } from '../utils/scalePlan';
import { recipes } from '../data/recipes';
import FoodGuide from '../components/FoodGuide';
import { FoodEquivalentsIntro, FoodEquivalentsList } from '../components/FoodEquivalents';
import SalsasAderezos from '../components/SalsasAderezos';
import { ClipboardIcon, QuestionIcon, ScaleIcon, CartIcon, JarIcon } from '../components/NutriIcons';
import Rutinas from '../components/Rutinas';
import { salsasData, type SalsaRecipe } from '../data/salsas';
import HabitTracker from '../components/HabitTracker';
import WeightTracker from '../components/WeightTracker';
import MealCheckoff from '../components/MealCheckoff';
import MacroTracker from '../components/MacroTracker';
import WorkoutLogger from '../components/WorkoutLogger';
import SwapButton from '../components/SwapButton';
import TodayStats from '../components/TodayStats';
import FoodLog from '../components/FoodLog';
import AICoach from '../components/AICoach';
import WeeklyInsight from '../components/WeeklyInsight';
import AppleHealthCard from '../components/AppleHealthCard';

// ── Mapa de palabras clave de porciones → receta del recetario ──────────────
const SALSA_REF_MAP: [string, string][] = [
  // sorted longest-first so we match the most specific pattern first
  ['salsa de tomate hecha',         'Salsa de Tomate Natural'],
  ['salsa de tomate casera',        'Salsa de Tomate Natural'],
  ['salsa de tomate natural',       'Salsa de Tomate Natural'],
  ['salsa de tomate',               'Salsa de Tomate Natural'],
  ['salsa verde hecha',             'Salsa Verde Casera'],
  ['salsa verde casera',            'Salsa Verde Casera'],
  ['salsa verde',                   'Salsa Verde Casera'],
  ['salsa ranchera',                'Salsa Ranchera'],
  ['salsa roja de chile',           'Salsa Roja de Chile de Árbol'],
  ['salsa roja',                    'Salsa Roja de Chile de Árbol'],
  ['salsa teriyaki ligera casera',  'Salsa Teriyaki'],
  ['salsa teriyaki casera',         'Salsa Teriyaki'],
  ['salsa teriyaki',                'Salsa Teriyaki'],
  ['salsa pesto',                   'Salsa Pesto'],
  ['pesto',                         'Salsa Pesto'],
  ['salsa al pastor',               'Salsa al Pastor'],
  ['salsa buffalo',                 'Salsa Buffalo'],
  ['salsa de chile guajillo',       'Salsa de Chile Guajillo'],
  ['salsa guajillo',                'Salsa de Chile Guajillo'],
  ['salsa de chile morita',         'Salsa de Chile Morita'],
  ['chile habanero y mango',        'Chile Habanero y Mango'],
  ['salsa de aguacate y cilantro',  'Salsa de Aguacate y Cilantro'],
  ['salsa de aguacate',             'Salsa de Aguacate y Cilantro'],
  ['aderezo del recetario',         'Aderezo del recetario'],
  ['aderezo chipotle',              'Chipotle Fit'],
  ['chipotle fit',                  'Chipotle Fit'],
  ['salsa chipotle',                'Chipotle Fit'],
  ['aderezo thai',                  'Aderezo Thai'],
  ['aderezo césar',                 'Aderezo César'],
  ['aderezo cesar',                 'Aderezo César'],
  ['aderezo ranch',                 'Aderezo Ranch'],
  ['aderezo parmesano',             'Aderezo de Queso Parmesano'],
  ['aderezo cremoso de cilantro',   'Aderezo Cremoso de Cilantro'],
  ['vinagreta balsámica',           'Vinagreta Balsámica'],
  ['vinagreta balsamica',           'Vinagreta Balsámica'],
  ['vinagreta',                     'Vinagreta Balsámica'],
  ['chimichurri de aguacate',       'Chimichurri de Aguacate'],
  ['chimichurri',                   'Chimichurri de Aguacate'],
  ['tzatziki',                      'Tzatziki'],
  ['salsa de tu preferencia',       'Salsa del recetario'],
];

function getSalsaRef(portionText: string): SalsaRecipe | { name: string; isFree: boolean; portionKcal: number } | null {
  const lower = portionText.toLowerCase();
  const match = SALSA_REF_MAP.find(([key]) => lower.includes(key));
  if (!match) return null;
  const recipeName = match[1];
  if (recipeName === 'Aderezo del recetario') return { name: 'Aderezo del recetario', isFree: false, portionKcal: 45 };
  if (recipeName === 'Salsa del recetario')   return { name: 'Salsa del recetario',   isFree: true,  portionKcal: 20 };
  return salsasData.find(s => s.name === recipeName) ?? null;
}

export default function DashboardScreen() {
  const {
    dashPage, setDashPage, userName, logout,
    mobileSidebarOpen, setMobileSidebarOpen,
    openVideo,
    goTo, obData, startDate, mealPlanKey, tdee, planGoal,
  } = useAppStore();

  const pageTitles: Record<string, string> = {
    bienvenida: 'Mi Espacio', alimentacion: 'Plan de Alimentación',
    recetas: 'Recetas en Video', entrenamiento: 'Plan de Entrenamiento',
    rutinas: 'Rutinas Semanales', crecimiento: 'Plan de Crecimiento',
    'plan-crecimiento': 'Plan de Crecimiento',
  };

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nutriTab, setNutriTab] = useState<'menu' | 'plan' | 'que-equiv' | 'lista-equiv' | 'guia' | 'salsas'>('menu');

  function navTo(page: string) {
    setDashPage(page as any);
    setMobileSidebarOpen(false);
    if (page === 'alimentacion') setNutriTab('menu');
  }

  // ── Week progression ──
  const currentWeek = (() => {
    if (!startDate) return 1;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return 1;
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.min(Math.max(1, Math.floor(diff / 7) + 1), 12);
  })();

  // Calculate streak from startDate
  const streakDays = (() => {
    if (!startDate) return 1;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return 1;
    const now = new Date();
    return Math.max(1, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  })();

  const userPlan = mealPlans[mealPlanKey] ?? mealPlans['planA'];

  // Escala las porciones al objetivo calórico exacto del usuario
  const scaledPlan = useMemo(
    () => planGoal > 0 ? scalePlan(userPlan, planGoal) : userPlan,
    [userPlan, planGoal],
  );

  const activeThemes = cuisineThemesMap[mealPlanKey] ?? cuisineThemesMap['planA'];
  const dayPlan = selectedDay != null ? scaledPlan[selectedDay] : null;
  const activeCuisine = activeThemes[selectedCuisine];
  const filteredDays = scaledPlan.filter(d => d.day >= activeCuisine.days[0] && d.day <= activeCuisine.days[1]);

  return (
    <>
      {/* Mobile sidebar overlay */}
      <div className={`mob-sidebar-ov${mobileSidebarOpen ? ' open' : ''}`} onClick={() => setMobileSidebarOpen(false)} />

      {/* SIDEBAR */}
      <aside className={`sidebar${mobileSidebarOpen ? ' mob-open' : ''}`}>
        <div className="sb-logo">
          <div className="sb-logo-t">
            <img src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1771971266/logo_ohaica.png" alt="Healthy Space Club" style={{ height: '60px', width: 'auto' }} />
          </div>
          <div className="sb-logo-s">Mi Espacio</div>
        </div>
        <div className={`user-pill${profileOpen ? ' open' : ''}`} onClick={() => setProfileOpen(o => !o)}>
          <div className="ava"><User size={16} strokeWidth={1.8} /></div>
          <div style={{ flex: 1 }}>
            <div className="u-name">{userName || 'Bienvenid@'}</div>
            <div className="u-sub">Semana {currentWeek} · Miembro</div>
          </div>
          <div className="u-chevron">{profileOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</div>
        </div>
        {profileOpen && (
          <div className="profile-panel">
            <div className="pp-section">
              <div className="pp-row"><span className="pp-lbl">Nombre</span><span className="pp-val">{String(obData.name || userName || '—')}</span></div>
              <div className="pp-row"><span className="pp-lbl">Email</span><span className="pp-val pp-val-sm">{String(obData.email || '—')}</span></div>
              <div className="pp-row"><span className="pp-lbl">Sexo</span><span className="pp-val">{String(obData.sex || '—')}</span></div>
              <div className="pp-row"><span className="pp-lbl">Edad</span><span className="pp-val">{obData.edad ? `${obData.edad} años` : '—'}</span></div>
              <div className="pp-row"><span className="pp-lbl">Peso</span><span className="pp-val">{obData.peso ? `${obData.peso} kg` : '—'}</span></div>
              <div className="pp-row"><span className="pp-lbl">Estatura</span><span className="pp-val">{obData.estatura ? `${obData.estatura} cm` : '—'}</span></div>
              <div className="pp-row"><span className="pp-lbl">Actividad</span><span className="pp-val">{String(obData.activity || '—')}</span></div>
              <div className="pp-row"><span className="pp-lbl">Objetivo</span><span className="pp-val">{String(obData.goal || '—')}</span></div>
              {planGoal > 0 && <div className="pp-row"><span className="pp-lbl">🔥 Meta calórica</span><span className="pp-val pp-kcal">{planGoal.toLocaleString()} kcal/día</span></div>}
              {tdee > 0 && <div className="pp-row"><span className="pp-lbl">TDEE</span><span className="pp-val pp-val-sm">{tdee.toLocaleString()} kcal mantenimiento</span></div>}
            </div>
          </div>
        )}
        <div className="sb-nav">
          <div className="sb-sec">Principal</div>
          <div className={`sb-item${dashPage === 'bienvenida' ? ' on' : ''}`} onClick={() => navTo('bienvenida')}>
            <span className="sb-icon"><Home size={16} strokeWidth={1.8} /></span><span className="sb-label">Mi Espacio</span>
          </div>
          <div className="sb-sec">Nutrición</div>
          <div className={`sb-item${dashPage === 'alimentacion' ? ' on' : ''}`} onClick={() => navTo('alimentacion')}>
            <span className="sb-icon"><Leaf size={16} strokeWidth={1.8} /></span><span className="sb-label">Plan de Alimentación</span>
          </div>
          <div className={`sb-item${dashPage === 'recetas' ? ' on' : ''}`} onClick={() => navTo('recetas')}>
            <span className="sb-icon"><Video size={16} strokeWidth={1.8} /></span><span className="sb-label">Recetas en Video</span>
          </div>
          <div className="sb-sec">Movimiento</div>
          <div className={`sb-item${dashPage === 'entrenamiento' ? ' on' : ''}`} onClick={() => navTo('entrenamiento')}>
            <span className="sb-icon"><Dumbbell size={16} strokeWidth={1.8} /></span><span className="sb-label">Plan de Entrenamiento</span>
          </div>
          <div className={`sb-item${dashPage === 'rutinas' ? ' on' : ''}`} onClick={() => navTo('rutinas')}>
            <span className="sb-icon"><Calendar size={16} strokeWidth={1.8} /></span><span className="sb-label">Rutinas Semanales</span>
          </div>
          <div className="sb-sec">Crecimiento</div>
          <div className={`sb-item${dashPage === 'plan-crecimiento' ? ' on' : ''}`} onClick={() => navTo('plan-crecimiento')}>
            <span className="sb-icon"><Sprout size={16} strokeWidth={1.8} /></span><span className="sb-label">Plan de Crecimiento</span>
          </div>
          <div className={`sb-item${dashPage === 'crecimiento' ? ' on' : ''}`} onClick={() => navTo('crecimiento')}>
            <span className="sb-icon"><BookOpen size={16} strokeWidth={1.8} /></span><span className="sb-label">Healthy Space Method</span>
          </div>
          <div className="sb-item" onClick={() => { setMobileSidebarOpen(false); goTo('lifesystem'); }}>
            <span className="sb-icon"><ClipboardList size={16} strokeWidth={1.8} /></span><span className="sb-label">Control de Vida</span>
          </div>
        </div>
        <div className="sb-bottom">
          <div className="streak-card">
            <div className="streak-n">🔥 {streakDays}</div>
            <div className="streak-s">{streakDays === 1 ? 'día' : 'días'} de racha · ¡sigue así!</div>
          </div>
          <div className="sb-logout" onClick={logout}>
            <LogOut size={15} /><span>Cerrar sesión</span>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="dash-main">
        <div className="topbar">
          <button className="mob-menu-btn" onClick={() => setMobileSidebarOpen(true)}><Menu size={18} /></button>
          <div className="topbar-title">{pageTitles[dashPage] || 'Mi Espacio'}</div>
          <div className="week-chip">Semana {currentWeek}</div>
        </div>

        {/* ── BIENVENIDA ── */}
        <div className={`page${dashPage === 'bienvenida' ? ' on' : ''}`}>

          {/* Saludo contextual */}
          <DailyGreeting userName={userName} streakDays={streakDays} currentWeek={currentWeek} />

          {/* Apple Health */}
          <AppleHealthCard />

          {/* Resumen del día */}
          <TodayStats />

          {/* Hábitos diarios */}
          <HabitTracker />

          {/* Log de comida */}
          <FoodLog />

          {/* Progreso de peso */}
          <WeightTracker />

          {/* Análisis semanal IA */}
          <WeeklyInsight />

          {/* Fotos de progreso */}
          <ProgressPhotos />
        </div>

        {/* ── ALIMENTACIÓN ── */}
        <div className={`page${dashPage === 'alimentacion' ? ' on' : ''}`}>

          {/* Section Menu */}
          {nutriTab === 'menu' && (
            <>
              <div className="sec-hero">
                <div className="sh-icon"><Leaf size={24} strokeWidth={1.5} /></div>
                <div><h2>Nutrición</h2><p>Tu plan nutricional, guía de alimentos y equivalentes — todo en un solo lugar.</p></div>
              </div>
              <div className="nutri-menu">
                {([
                  { id: 'plan' as const, icon: <ClipboardIcon />, title: 'Plan Alimenticio', desc: 'Tu plan diario personalizado con porciones y tiempos.' },
                  { id: 'que-equiv' as const, icon: <QuestionIcon />, title: '¿Qué son los Equivalentes?', desc: 'Aprende a intercambiar alimentos sin perder balance.' },
                  { id: 'lista-equiv' as const, icon: <ScaleIcon />, title: 'Lista de Equivalentes', desc: 'Tabla de intercambio entre grupos de alimentos.' },
                  { id: 'guia' as const, icon: <CartIcon />, title: 'Guía de Alimentos', desc: 'Cómo elegir los mejores productos en el supermercado.' },
                  { id: 'salsas' as const, icon: <JarIcon />, title: 'Salsas y Aderezos', desc: '21 recetas caseras limpias para acompañar tus comidas.' },
                ]).map(item => (
                  <button key={item.id} className="nutri-card" onClick={() => setNutriTab(item.id)}>
                    <span className="nc-icon">{item.icon}</span>
                    <div className="nc-text">
                      <span className="nc-title">{item.title}</span>
                      <span className="nc-desc">{item.desc}</span>
                    </div>
                    <span className="nc-arrow">›</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Back button when inside a sub-section */}
          {nutriTab !== 'menu' && (
            <button className="nutri-back" onClick={() => setNutriTab('menu')}>← Volver a Nutrición</button>
          )}

          {/* Sub-section: Plan de Alimentación */}
          {nutriTab === 'plan' && (
            <>
              <SecVid title="Cómo usar tu plan de alimentación" sub="Aprende a leer porciones, tiempos y variantes" duration="2:15" />
              {/* Objetivo calórico personalizado */}
              {planGoal > 0 && (
                <div className="plan-goal-banner">
                  <span className="pgb-icon">🔥</span>
                  <div>
                    <div className="pgb-title">Tu plan personalizado: <strong>{planGoal.toLocaleString()} kcal/día</strong></div>
                    <div className="pgb-sub">TDEE {tdee.toLocaleString()} kcal · Porciones ajustadas automáticamente a tu objetivo</div>
                  </div>
                </div>
              )}
              <MacroTracker />
              {selectedDay == null ? (
                <div className="day-selector">
                  <div className="day-selector-header">
                    <h3>Elige tu día</h3>
                    <span className="day-selector-count">Días {activeCuisine.days[0]}–{activeCuisine.days[1]}</span>
                  </div>
                  <div className="cuisine-tabs">
                    {activeThemes.map((c, i) => (
                      <div
                        key={i}
                        className={`cuisine-tab${selectedCuisine === i ? ' active' : ''}`}
                        onClick={() => { setSelectedCuisine(i); setSelectedDay(null); }}
                      >
                        <img src={c.flag} alt={c.label} />
                        <span>{c.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="cuisine-days">
                    {filteredDays.map((d) => (
                      <button
                        key={d.day}
                        className="day-btn"
                        onClick={() => setSelectedDay(scaledPlan.findIndex(x => x.day === d.day))}
                      >
                        Opción {d.day}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="day-detail">
                  <div className="day-detail-header">
                    <button className="day-back" onClick={() => setSelectedDay(null)}>← Volver</button>
                    <div className="day-detail-title">
                      <h3>Opción {dayPlan?.day} — {activeCuisine.label}</h3>
                      {dayPlan && (
                        <span className="day-kcal-badge">
                          {calcDayKcal(dayPlan.meals)} kcal totales
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="meals">
                    {dayPlan?.meals.map((meal, i) => {
                      const mealKcal = calcMealKcal(meal.portions);
                      const mealDayKey = `${new Date().toISOString().split('T')[0]}-${mealPlanKey}-${dayPlan.day}`;
                      const renderPortion = (p: string, _j: number) => {
                        const sRef = getSalsaRef(p);
                        return (
                          <>
                            {formatPortion(p)}
                            {sRef && (
                              <button
                                className="portion-salsa-link"
                                onClick={() => setNutriTab('salsas')}
                                title={sRef.isFree ? 'Receta libre — sin costo calórico' : `~${sRef.portionKcal} kcal por porción`}
                              >
                                🫙 Ver receta
                              </button>
                            )}
                            <SwapButton portionText={p} />
                          </>
                        );
                      };
                      return meal.img ? (
                        <div key={i} className="meal meal-has-img">
                          <div className="meal-img"><img src={meal.img} alt={meal.name} /></div>
                          <div className="meal-body">
                            <div className="meal-time-row">
                              <span className="meal-time">{meal.time}</span>
                              {mealKcal > 0 && <span className="meal-kcal">{mealKcal} kcal</span>}
                            </div>
                            <div className="meal-name">{meal.name}</div>
                            <div className="meal-desc">{meal.desc}</div>
                            <MealCheckoff dayKey={mealDayKey} portions={meal.portions} mealIndex={i} renderPortion={renderPortion} />
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="meal">
                          <div className="meal-time-row">
                            <span className="meal-time">{meal.time}</span>
                            {mealKcal > 0 && <span className="meal-kcal">{mealKcal} kcal</span>}
                          </div>
                          <div className="meal-name">{meal.name}</div>
                          <div className="meal-desc">{meal.desc}</div>
                          <MealCheckoff dayKey={mealDayKey} portions={meal.portions} mealIndex={i} renderPortion={renderPortion} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Sub-section: Guía de Alimentos */}
          {nutriTab === 'guia' && <FoodGuide />}

          {/* Sub-section: Qué son los Equivalentes */}
          {nutriTab === 'que-equiv' && <FoodEquivalentsIntro />}

          {/* Sub-section: Lista de Equivalentes */}
          {nutriTab === 'lista-equiv' && <FoodEquivalentsList />}

          {/* Sub-section: Salsas y Aderezos */}
          {nutriTab === 'salsas' && <SalsasAderezos />}
        </div>

        {/* ── RECETAS ── */}
        <div className={`page${dashPage === 'recetas' ? ' on' : ''}`}>
          <div className="sec-hero">
            <div className="sh-icon"><Video size={24} strokeWidth={1.5} /></div>
            <div><h2>Recetas en Video</h2><p>Subimos nuevas recetas 3 veces por semana. Cada una con su video dividido en pasos para seguirla fácil desde tu celular.</p></div>
          </div>
          <div className="recipes">
            {recipes.map((r, i) => (
              <div
                key={i} className="rcard"
                onClick={() => openVideo('recipe', r.name, r.desc, r.emoji, r.steps)}
              >
                <div className="ri" style={{ background: r.bg }}>
                  {r.emoji}
                  <div className="ri-play">▶</div>
                  <div className="ri-tag">{r.tag}</div>
                </div>
                <div className="rb">
                  <div className="rb-name">{r.name}</div>
                  <div className="rb-desc">{r.desc}</div>
                  <div className="rb-meta">
                    <span>⏱ {r.time}</span>
                    <span>🔥 {r.kcal}</span>
                    <span>💪 {r.protein}</span>
                  </div>
                  <div className="rb-steps">🎬 {r.steps.length} pasos en video</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ENTRENAMIENTO ── */}
        <div className={`page${dashPage === 'entrenamiento' ? ' on' : ''}`}>
          <div className="sec-hero">
            <div className="sh-icon"><Dumbbell size={24} strokeWidth={1.5} /></div>
            <div>
              <h2>Plan de Entrenamiento</h2>
              <p>La ruta oficial del Club: 6 sesiones semanales + 1 día de descanso. Estructura progresiva para mejorar semana a semana.</p>
            </div>
          </div>
          <SecVid title="Cómo funciona tu plan de entrenamiento" sub="La ruta oficial, etiquetas y reglas explicadas" duration="3:00" />

          {/* Workout Logger */}
          <WorkoutLogger />

          {/* How it works: video + pdf */}
          <div className="ep-how">
            <div className="ep-how-item ep-how-video">
              <div className="ep-how-icon">🎬</div>
              <div>
                <div className="ep-how-title">Video del plan</div>
                <div className="ep-how-sub">Explicación completa de la ruta y cómo usarla</div>
              </div>
              <div className="ep-how-arrow">▶</div>
            </div>
            <div className="ep-how-item ep-how-pdf">
              <div className="ep-how-icon">📄</div>
              <div>
                <div className="ep-how-title">Reglas del plan (PDF)</div>
                <div className="ep-how-sub">Descarga las reglas de entrenamiento</div>
              </div>
              <div className="ep-how-arrow">↓</div>
            </div>
          </div>

          {/* 7-day route */}
          <div className="ep-section-lbl">Ruta oficial — 7 días</div>
          <div className="ep-days">
            {[
              { n: 1, tipo: 'Lower + Core', desc: 'Cuádricep, femoral, glúteo y pantorrilla', tags: ['lower', '45 min', 'base / pro', 'ligas / gym'], emoji: '🦵', color: 'var(--forest)' },
              { n: 2, tipo: 'Upper + Core', desc: 'Espalda, pecho, hombros + brazos', tags: ['upper', '45 min', 'base / pro', 'ligas / gym'], emoji: '💪', color: 'var(--moss)' },
              { n: 3, tipo: 'Condición + Movilidad', desc: 'Cardio HIIT moderado o yoga fuerte', tags: ['condición', '30 min', 'base / pro', 'cuerpo'], emoji: '⚡', color: 'var(--terra)' },
              { n: 4, tipo: 'Lower + Core', desc: 'Variación de pierna — énfasis distinto al Día 1', tags: ['lower', '45 min', 'base / pro', 'ligas / gym'], emoji: '🦵', color: 'var(--forest)' },
              { n: 5, tipo: 'Upper + Core', desc: 'Variación de upper — énfasis distinto al Día 2', tags: ['upper', '45 min', 'base / pro', 'ligas / gym'], emoji: '💪', color: 'var(--moss)' },
              { n: 6, tipo: 'Condición + Movilidad', desc: 'Segunda sesión semanal de condición', tags: ['condición', '30 min', 'base / pro', 'cuerpo'], emoji: '⚡', color: 'var(--terra)' },
              { n: 7, tipo: 'Descanso', desc: 'Opcional: caminata suave + movilidad', tags: ['descanso', 'opcional', '—', 'cuerpo'], emoji: '🌿', color: 'var(--sage)', rest: true },
            ].map(d => (
              <div key={d.n} className={`ep-day${d.rest ? ' ep-day-rest' : ''}`}>
                <div className="ep-day-num" style={{ background: d.color }}>Día {d.n}</div>
                <div className="ep-day-body">
                  <div className="ep-day-emoji">{d.emoji}</div>
                  <div className="ep-day-info">
                    <div className="ep-day-tipo">{d.tipo}</div>
                    <div className="ep-day-desc">{d.desc}</div>
                    <div className="ep-day-tags">
                      {d.tags.map((t, i) => <span key={i} className="ep-tag">{t}</span>)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Etiquetas info */}
          <div className="ep-section-lbl" style={{ marginTop: '28px' }}>Etiquetas de sesión</div>
          <div className="ep-labels">
            <div className="ep-label-group">
              <div className="ep-label-title">Tipo de sesión</div>
              <div className="ep-label-chips">
                <span className="ep-lchip ep-lchip-upper">Upper</span>
                <span className="ep-lchip ep-lchip-lower">Lower</span>
                <span className="ep-lchip ep-lchip-cond">Condición + Movilidad</span>
              </div>
            </div>
            <div className="ep-label-group">
              <div className="ep-label-title">Duración</div>
              <div className="ep-label-chips">
                <span className="ep-lchip">30 min</span>
                <span className="ep-lchip">45 min</span>
                <span className="ep-lchip">60 min</span>
              </div>
            </div>
            <div className="ep-label-group">
              <div className="ep-label-title">Nivel</div>
              <div className="ep-label-chips">
                <span className="ep-lchip">Base</span>
                <span className="ep-lchip">Pro</span>
              </div>
            </div>
            <div className="ep-label-group">
              <div className="ep-label-title">Equipo</div>
              <div className="ep-label-chips">
                <span className="ep-lchip">Cuerpo</span>
                <span className="ep-lchip">Ligas</span>
                <span className="ep-lchip">Equipo de gym</span>
              </div>
            </div>
          </div>

          {/* Rules PDF section */}
          <div className="ep-section-lbl" style={{ marginTop: '28px' }}>Reglas del plan</div>
          <div className="ep-rules">
            <div className="ep-rule">
              <div className="ep-rule-num">#1</div>
              <div className="ep-rule-body">
                <div className="ep-rule-title">Prioriza movimiento sobre peso</div>
                <div className="ep-rule-desc">La técnica siempre primero. El peso viene solo cuando el movimiento es sólido.</div>
              </div>
            </div>
            <div className="ep-rule">
              <div className="ep-rule-num">#2</div>
              <div className="ep-rule-body">
                <div className="ep-rule-title">Sobrecarga progresiva</div>
                <div className="ep-rule-desc">Tu cuerpo cambia cuando haces un poco más con el tiempo. Puedes progresar así:</div>
                <ul className="ep-rule-list">
                  <li>Más reps con el mismo peso</li>
                  <li>Más peso con misma técnica</li>
                  <li>Más series</li>
                  <li>Mejor control — más lento, más rango, más pausa</li>
                  <li>Menos descanso entre series</li>
                </ul>
                <div className="ep-rule-highlight">Más simple: mejora cada semana aunque sea mínimo.</div>
              </div>
            </div>
            <div className="ep-rule">
              <div className="ep-rule-num">#3</div>
              <div className="ep-rule-body">
                <div className="ep-rule-title">Dolor no es igual a progreso</div>
                <div className="ep-rule-desc">
                  <span className="ep-rule-ok">✓ Ardor muscular</span> — normal, es parte del proceso.<br />
                  <span className="ep-rule-warn">✗ Dolor articular o raro</span> — anormal. Ajusta, baja intensidad o cambia el ejercicio.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RUTINAS ── */}
        <div className={`page${dashPage === 'rutinas' ? ' on' : ''}`}>
          <div className="sec-hero">
            <div className="sh-icon"><Calendar size={24} strokeWidth={1.5} /></div>
            <div><h2>Rutinas Semanales</h2><p>Tu programa de 7 días: Lower, Upper, Power Vinyasa y descanso activo. Cada día con ejercicios, series y notas detalladas.</p></div>
          </div>
          <Rutinas />
        </div>

        {/* ── CRECIMIENTO ── */}
        <PlanCrecimientoPage />
        <CrecimientoPage />

      </main>

      {/* BOTTOM NAV (mobile) */}
      <nav className="bottom-nav">
        <div className="bn-inner">
          {[
            { id: 'bienvenida',    icon: '🏠', lbl: 'Inicio' },
            { id: 'alimentacion',  icon: '🥗', lbl: 'Nutrición' },
            { id: 'entrenamiento', icon: '💪', lbl: 'Entreno' },
            { id: 'plan-crecimiento', icon: '🌱', lbl: 'Crecer' },
          ].map(item => (
            <div key={item.id} className={`bn-item${dashPage === item.id ? ' on' : ''}`} onClick={() => navTo(item.id)}>
              <div className="bn-icon">{item.icon}</div>
              <div className="bn-lbl">{item.lbl}</div>
            </div>
          ))}
        </div>
      </nav>

      <AICoach />
    </>
  );
}

/* ─────────────────────── Section Video Card ─────────────────────── */
/* ─────────────────────── Progress Photos ─────────────────────── */
type PhotoEntry = { id: string; date: string; dataUrl: string };

function ProgressPhotos() {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hsc-progress-photos');
    if (saved) setPhotos(JSON.parse(saved));
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const entry: PhotoEntry = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], dataUrl };
      setPhotos(prev => {
        const updated = [entry, ...prev];
        localStorage.setItem('hsc-progress-photos', JSON.stringify(updated));
        return updated;
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function deletePhoto(id: string) {
    setPhotos(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem('hsc-progress-photos', JSON.stringify(updated));
      return updated;
    });
    if (compareA === id) setCompareA(null);
    if (compareB === id) setCompareB(null);
  }

  function handleSelect(id: string) {
    if (!compareMode) { setLightbox(photos.find(p => p.id === id)?.dataUrl ?? null); return; }
    if (!compareA) { setCompareA(id); return; }
    if (compareA === id) { setCompareA(null); return; }
    if (!compareB) { setCompareB(id); return; }
    if (compareB === id) { setCompareB(null); return; }
    // Both set, replace B
    setCompareB(id);
  }

  function exitCompare() {
    setCompareMode(false); setCompareA(null); setCompareB(null);
  }

  const photoA = photos.find(p => p.id === compareA);
  const photoB = photos.find(p => p.id === compareB);

  return (
    <div className="prog-photos">
      <div className="prog-head">
        <div className="prog-title"><Camera size={15} strokeWidth={2} /> Fotos de progreso</div>
        <div className="prog-head-actions">
          {photos.length >= 2 && (
            <button className={`prog-compare-btn${compareMode ? ' active' : ''}`} onClick={() => compareMode ? exitCompare() : setCompareMode(true)}>
              {compareMode ? '✕ Salir' : '⚖️ Comparar'}
            </button>
          )}
          <label className="prog-add-btn">
            + Agregar
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </label>
        </div>
      </div>

      {/* Compare view */}
      {compareMode && (photoA || photoB) && (
        <div className="prog-compare">
          <div className="prog-compare-slot">
            {photoA ? (
              <>
                <img src={photoA.dataUrl} alt="Antes" className="prog-compare-img" />
                <div className="prog-compare-date">{photoA.date}</div>
              </>
            ) : <div className="prog-compare-placeholder">Elige foto 1</div>}
          </div>
          <div className="prog-compare-vs">VS</div>
          <div className="prog-compare-slot">
            {photoB ? (
              <>
                <img src={photoB.dataUrl} alt="Después" className="prog-compare-img" />
                <div className="prog-compare-date">{photoB.date}</div>
              </>
            ) : <div className="prog-compare-placeholder">Elige foto 2</div>}
          </div>
        </div>
      )}

      {compareMode && !photoA && !photoB && (
        <div className="prog-compare-hint">Toca 2 fotos para compararlas lado a lado.</div>
      )}

      {photos.length === 0 ? (
        <div className="prog-empty">
          <div className="prog-empty-icon">📷</div>
          <div>Registra tu primera foto de progreso.</div>
          <div className="prog-empty-hint">Las fotos se guardan en tu dispositivo.</div>
        </div>
      ) : (
        <div className="prog-grid">
          {photos.map(p => (
            <div
              key={p.id}
              className={`prog-item${compareMode && (compareA === p.id || compareB === p.id) ? ' prog-selected' : ''}`}
              onClick={() => handleSelect(p.id)}
            >
              <img src={p.dataUrl} alt={p.date} className="prog-img" />
              <div className="prog-date">{p.date}</div>
              {!compareMode && <button className="prog-del" onClick={(e) => { e.stopPropagation(); deletePhoto(p.id); }}>✕</button>}
              {compareMode && (compareA === p.id || compareB === p.id) && (
                <div className="prog-check">✓</div>
              )}
            </div>
          ))}
        </div>
      )}
      {lightbox && (
        <div className="prog-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Progreso" />
        </div>
      )}
    </div>
  );
}

function SecVid({ title, sub, duration, videoId }: { title: string; sub: string; duration: string; videoId?: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="sec-vid">
      <div className="sec-vid-header">
        <span className="sec-vid-icon"><Play size={15} strokeWidth={2} /></span>
        <div>
          <div className="sec-vid-title">{title}</div>
          <div className="sec-vid-sub">{sub}</div>
        </div>
      </div>
      <div className="sec-vid-player" onClick={() => videoId && setPlaying(true)} style={!videoId ? { cursor: 'default' } : {}}>
        {playing && videoId ? (
          <div className="sec-vid-iframe">
            <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} allow="autoplay; fullscreen" allowFullScreen title={title} />
          </div>
        ) : (
          <div className="sec-vid-thumb">
            <div className="sec-vid-overlay" />
            <div className="sec-vid-play" style={!videoId ? { opacity: 0.4 } : {}}>{videoId ? '▶' : '🔒'}</div>
            <div className="sec-vid-duration">{videoId ? duration : 'Próximamente'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── Plan de Crecimiento intro Page ─────────────────────── */
function PlanCrecimientoPage() {
  const dashPage = useAppStore(s => s.dashPage);
  const setDashPage = useAppStore(s => s.setDashPage);
  const goTo = useAppStore(s => s.goTo);

  return (
    <div className={`page${dashPage === 'plan-crecimiento' ? ' on' : ''}`}>
      <div className="sec-hero">
        <div className="sh-icon"><Sprout size={24} strokeWidth={1.5} /></div>
        <div>
          <h2>Plan de Crecimiento</h2>
          <p>Tu crecimiento personal dentro del Club se divide en dos pilares: el método que transforma tu mentalidad y el sistema que organiza tu vida.</p>
        </div>
      </div>
      <SecVid title="Qué es el Plan de Crecimiento" sub="Cómo los dos pilares trabajan juntos para transformarte" duration="2:45" />
      <div className="pcr-grid">
        <div className="pcr-card" onClick={() => setDashPage('crecimiento')}>
          <div className="pcr-icon"><BookOpen size={28} strokeWidth={1.5} /></div>
          <div className="pcr-title">Healthy Space Method</div>
          <div className="pcr-desc">El libro y metodología del Club. Mentalidad, hábitos, nutrición y movimiento — los principios que hacen que el cambio sea permanente.</div>
          <div className="pcr-link">Explorar →</div>
        </div>
        <div className="pcr-card" onClick={() => goTo('lifesystem')}>
          <div className="pcr-icon"><ClipboardList size={28} strokeWidth={1.5} /></div>
          <div className="pcr-title">Control de Vida</div>
          <div className="pcr-desc">Tu sistema de seguimiento semanal: hábitos, metas, reflexiones y progreso. La herramienta para que nada se te escape.</div>
          <div className="pcr-link">Abrir →</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Crecimiento Page ─────────────────────── */
function CrecimientoPage() {
  const dashPage = useAppStore(s => s.dashPage);

  return (
    <div className={`page${dashPage === 'crecimiento' ? ' on' : ''}`}>
      <div className="sec-hero">
        <div className="sh-icon"><BookOpen size={24} strokeWidth={1.5} /></div>
        <div>
          <h2>Healthy Space Method</h2>
          <p>El libro y metodología del Club: los principios de alimentación, movimiento y mentalidad para crear hábitos que duran toda la vida.</p>
        </div>
      </div>
      {/* HSM VIEW */}
      <>
          <div className="growth">
            <div className="gcard book">
              <div className="gi">
                <div className="g-icon"><BookOpen size={28} strokeWidth={1.5} /></div>
                <div className="g-lbl">Libro Exclusivo del Club</div>
                <div className="g-title">Healthy Space Method</div>
                <div className="g-desc">Los principios de alimentación, movimiento y mentalidad para crear hábitos que duran toda la vida — no solo 30 días.</div>
                <button className="g-btn">Leer el libro →</button>
              </div>
              <div className="g-deco"><BookOpen size={48} strokeWidth={1} /></div>
            </div>
          </div>
          <div className="chapters">
            <div className="ch-head">
              <h3>Healthy Space Method — Capítulos</h3>
              <span style={{ fontSize: '.73rem', color: 'var(--sage)', fontWeight: 700 }}>0 / 8 completados</span>
            </div>
            {[
              { n: 1, t: 'La raíz del hábito: por qué seguimos fallando', s: 'Introducción · 18 min de lectura', ico: '→' },
              { n: 2, t: 'El sistema sobre la fuerza de voluntad', s: 'Mentalidad · 22 min', ico: '🔒' },
              { n: 3, t: 'Comer bien sin obsesionarse: el enfoque HSM', s: 'Nutrición · 25 min', ico: '🔒' },
              { n: 4, t: 'Movimiento como medicina: el mínimo efectivo', s: 'Entrenamiento · 20 min', ico: '🔒' },
              { n: 5, t: 'Sueño, estrés y recuperación', s: 'Bienestar · 19 min', ico: '🔒' },
              { n: 6, t: 'El entorno que te hace triunfar o fallar', s: 'Diseño de vida · 21 min', ico: '🔒' },
              { n: 7, t: 'Relaciones, identidad y cambio sostenible', s: 'Psicología · 24 min', ico: '🔒' },
              { n: 8, t: 'Tu versión 2.0: el plan de los próximos 90 días', s: 'Plan de acción · 30 min', ico: '🔒' },
            ].map(ch => (
              <div key={ch.n} className="ch-item">
                <div className="ch-num">{ch.n}</div>
                <div><div className="ch-title">{ch.t}</div><div className="ch-sub">{ch.s}</div></div>
                <div className="ch-ico">{ch.ico}</div>
              </div>
            ))}
          </div>
        </>
    </div>
  );
}

/* ─────────────────────── Daily Greeting ─────────────────────── */
function DailyGreeting({ userName, streakDays, currentWeek }: { userName: string; streakDays: number; currentWeek: number }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const emoji = hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙';

  const today = new Date();
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const dateStr = `${dayNames[today.getDay()]} ${today.getDate()} de ${monthNames[today.getMonth()]}`;

  const motivations = [
    'Cada día que actúas, te acercas más a tu mejor versión.',
    'La constancia gana. Hoy cuenta.',
    'No necesitas ser perfecto, solo consistente.',
    'Un hábito a la vez. Un día a la vez.',
    'Tu cuerpo recuerda lo que tu mente olvida.',
  ];
  const motivation = motivations[today.getDate() % motivations.length];

  return (
    <div className="daily-greeting">
      <div className="dg-top">
        <div className="dg-date">{emoji} {dateStr}</div>
        <div className="dg-chips">
          <span className="dg-chip">Semana {currentWeek}</span>
          {streakDays > 0 && <span className="dg-chip dg-chip-fire">🔥 {streakDays} días</span>}
        </div>
      </div>
      <h2 className="dg-hello">{greeting}, <strong>{userName || 'campeón/a'}</strong></h2>
      <p className="dg-motivation">{motivation}</p>
    </div>
  );
}
