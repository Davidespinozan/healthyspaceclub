// Placeholder de una página del panel aún no construida. Deja el esqueleto
// navegable y documenta QUÉ traerá y en qué fase, para que el panel se pueda
// recorrer completo desde la Fase 1.
export default function PagePlaceholder({
  title, subtitle, fase, bullets,
}: { title: string; subtitle: string; fase: string; bullets: string[] }) {
  return (
    <>
      <div className="adm-page-head">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="adm-soon">
        <span className="adm-soon-tag">{fase}</span>
        <h2>En construcción</h2>
        <p>Esta sección se arma en {fase}. Va a incluir:</p>
        <ul>{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
      </div>
    </>
  );
}
