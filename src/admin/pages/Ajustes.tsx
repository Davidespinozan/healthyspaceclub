import PagePlaceholder from './PagePlaceholder';
export default function Ajustes() {
  return <PagePlaceholder
    title="Ajustes" subtitle="Configuración del negocio." fase="Fase 5"
    bullets={[
      'Precios de plan y ciclos de cobro.',
      'Cupones / cortesías / meses gratis (tarjeta siempre conectada).',
      'Datos del negocio y notificaciones.',
    ]} />;
}
