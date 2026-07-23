import PagePlaceholder from './PagePlaceholder';
export default function Bitacora() {
  return <PagePlaceholder
    title="Bitácora" subtitle="Quién tocó qué — trazabilidad de las acciones del admin." fase="Fase 3"
    bullets={[
      'Registro append-only de cada acción sensible (cortesías, reembolsos, cambios de estado).',
      'Filtro por entidad, socio y texto.',
      'Snapshot del actor (sobrevive aunque se borre la cuenta).',
    ]} />;
}
