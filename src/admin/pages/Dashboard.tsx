import PagePlaceholder from './PagePlaceholder';
export default function Dashboard() {
  return <PagePlaceholder
    title="Dashboard" subtitle="El pulso del negocio de un vistazo." fase="Fase 2"
    bullets={[
      'Ingreso del mes y MRR (por moneda: MXN y USD/EUR nunca se suman juntos).',
      'Altas y bajas del mes, socios activos, MAU.',
      'Socios con pago vencido (past_due) y próximos vencimientos.',
      'Tendencia de ingresos de los últimos 30 días.',
    ]} />;
}
