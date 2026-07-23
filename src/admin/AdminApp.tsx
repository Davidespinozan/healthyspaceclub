import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './admin.css';
import { useAdminGuard } from './useAdminGuard';
import AdminLayout from './AdminLayout';
import Dashboard from './pages/Dashboard';
import Ingresos from './pages/Ingresos';
import Reportes from './pages/Reportes';
import Socios from './pages/Socios';
import Bitacora from './pages/Bitacora';
import Equipo from './pages/Equipo';
import Ajustes from './pages/Ajustes';

// Raíz del panel admin de HSC. Se monta SOLO cuando la URL empieza con /admin
// (branch en main.tsx), como un bundle aparte: la PWA del socio no carga nada
// de esto. Router propio con basename="/admin".
//
// El guard decide qué se pinta. No es seguridad —eso es la RLS— sino UX: si no
// eres admin, ni siquiera podrías LEER las tablas del negocio.
export default function AdminApp() {
  const { state, email } = useAdminGuard();

  if (state === 'loading') {
    return <div className="adm-root adm-boot"><p>Cargando…</p></div>;
  }
  if (state === 'no-auth') {
    return (
      <div className="adm-root adm-boot">
        <h1>Panel del Club</h1>
        <p>Necesitas iniciar sesión con tu cuenta de administrador.</p>
        <button onClick={() => { window.location.href = '/'; }}>Ir a iniciar sesión</button>
      </div>
    );
  }
  if (state === 'not-admin') {
    return (
      <div className="adm-root adm-boot">
        <h1>Sin acceso</h1>
        <p>Esta cuenta no es administradora del Club. Si crees que es un error, contacta al dueño.</p>
        <button onClick={() => { window.location.href = '/'; }}>Volver a la app</button>
      </div>
    );
  }

  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route element={<AdminLayout email={email} />}>
          <Route index element={<Dashboard />} />
          <Route path="ingresos" element={<Ingresos />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="socios" element={<Socios />} />
          <Route path="bitacora" element={<Bitacora />} />
          <Route path="equipo" element={<Equipo />} />
          <Route path="ajustes" element={<Ajustes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
