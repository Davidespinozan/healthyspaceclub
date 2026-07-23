import PagePlaceholder from './PagePlaceholder';
export default function Ingresos() {
  return <PagePlaceholder
    title="Ingresos" subtitle="El libro contable del Club (movimientos_dinero)." fase="Fase 2"
    bullets={[
      'Cobrado por método (Stripe, efectivo, transferencia, cortesía) y por concepto.',
      'Reembolsos y ticket promedio.',
      'Separado por moneda — MXN de Culiacán vs USD/EUR de Valencia.',
      'Lista de movimientos con socio, monto, fecha y referencia de Stripe.',
    ]} />;
}
