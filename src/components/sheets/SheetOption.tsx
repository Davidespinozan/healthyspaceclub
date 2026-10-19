// SheetOption — opción seleccionable de ancho completo para las hojas (sheet-base).
//
// Título + descripción SIEMPRE visibles: en móvil no hay hover, así que la
// explicación no puede vivir en un `title`/tooltip. El texto se ajusta en varias
// líneas, el área táctil mide ≥ 48 px y la selección se expone con `aria-pressed`
// (sirve para elección única y múltiple).
interface Props {
  title: string;
  description?: string;
  pressed?: boolean;
  onClick: () => void;
}

export default function SheetOption({ title, description, pressed, onClick }: Props) {
  return (
    <button type="button" className="sh-option" aria-pressed={pressed ?? false} onClick={onClick}>
      <span className="sh-option-title">{title}</span>
      {description && <span className="sh-option-desc">{description}</span>}
    </button>
  );
}
