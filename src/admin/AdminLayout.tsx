import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

// Layout del panel: sidebar fijo + área de contenido con <Outlet/> (las páginas
// enrutadas se pintan ahí). El .adm-root fija el viewport y aísla los estilos.
export default function AdminLayout({ email }: { email: string | null }) {
  return (
    <div className="adm-root">
      <Sidebar email={email} />
      <main className="adm-main">
        <Outlet />
      </main>
    </div>
  );
}
