import PagePlaceholder from './PagePlaceholder';
export default function Reportes() {
  return <PagePlaceholder
    title="Reportes" subtitle="Retención, economía y engagement — lo que dice si el negocio funciona." fase="Fase 4"
    bullets={[
      'Economía: MRR, ARR, ARPU, LTV.',
      'Churn, retención por cohorte y conversión de prueba (desde eventos_estado).',
      'Engagement: MAU, stickiness, activación — con señal de uso de la app (entreno, comida, racha).',
    ]} />;
}
