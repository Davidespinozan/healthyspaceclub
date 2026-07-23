import PagePlaceholder from './PagePlaceholder';
export default function Socios() {
  return <PagePlaceholder
    title="Socios" subtitle="El CRM del Club: cada socio, su plan y su uso." fase="Fase 3"
    bullets={[
      'Lista con búsqueda y filtro por estado de suscripción.',
      'Ficha del socio: suscripción, LTV (suma de sus movimientos), engagement, historial de pagos y de estados, notas internas.',
      'Acciones: dar cortesía/crédito, cambiar estado, bloquear, enviar aviso (por RPC + bitácora).',
    ]} />;
}
