import PagePlaceholder from './PagePlaceholder';
export default function Equipo() {
  return <PagePlaceholder
    title="Equipo" subtitle="Quién puede entrar al panel." fase="Fase 5"
    bullets={[
      'Dar o quitar acceso admin (user_profiles.is_admin) por Netlify function con service_role.',
      'Reset de contraseña.',
      'Backstop: nunca dejar el Club sin ningún admin.',
    ]} />;
}
