// Badge del estado de suscripción de un socio. past_due manda sobre el status
// (un 'pro' con pago vencido se ve como vencido, no como pro).
export default function StatusBadge({ status, pastDue }: { status: string | null; pastDue?: boolean | null }) {
  const { label, cls } = resolve(status, pastDue);
  return <span className={`adm-badge ${cls}`}>{label}</span>;
}

export function resolve(status: string | null, pastDue?: boolean | null): { label: string; cls: string } {
  if (pastDue) return { label: 'Pago vencido', cls: 'warn' };
  switch (status) {
    case 'pro': return { label: 'Pro', cls: 'good' };
    case 'trial': return { label: 'Prueba', cls: 'accent' };
    case 'cancelada': return { label: 'Cancelada', cls: 'danger' };
    default: return { label: 'Sin plan', cls: 'muted' };
  }
}
