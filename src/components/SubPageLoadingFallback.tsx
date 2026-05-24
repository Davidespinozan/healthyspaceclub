/**
 * Fallback de Suspense inline para sub-pages lazy-loaded (DailyTrainer,
 * WeeklyNutritionPlanner). A diferencia de PlayerLoadingFallback, NO usa
 * portal — vive dentro del sub-page, debajo del sec-hero, para que el
 * primer paint del header no se tape al cargar el componente lazy.
 */
export default function SubPageLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        minHeight: 200,
      }}
    >
      <div className="wz-spinner" />
    </div>
  );
}
