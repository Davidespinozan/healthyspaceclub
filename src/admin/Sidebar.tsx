import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wallet, BarChart3, ScrollText, UserCog, Settings, LogOut,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Navegación del panel. Agrupada como en sala-studio, pero solo con lo del
// Club (sin reservas/clases/sucursales). Las páginas de fases futuras ya
// aparecen para que el esqueleto sea navegable de punta a punta.
const GROUPS: { title: string; items: { to: string; label: string; icon: LucideIcon; end?: boolean }[] }[] = [
  {
    title: 'Negocio',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/ingresos', label: 'Ingresos', icon: Wallet },
      { to: '/reportes', label: 'Reportes', icon: BarChart3 },
    ],
  },
  {
    title: 'Socios',
    items: [
      { to: '/socios', label: 'Socios', icon: Users },
      { to: '/bitacora', label: 'Bitácora', icon: ScrollText },
    ],
  },
  {
    title: 'Cuenta',
    items: [
      { to: '/equipo', label: 'Equipo', icon: UserCog },
      { to: '/ajustes', label: 'Ajustes', icon: Settings },
    ],
  },
];

export default function Sidebar({ email }: { email: string | null }) {
  return (
    <aside className="adm-side">
      <div className="adm-side-brand">
        Healthy Space
        <small>Club · Admin</small>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="adm-side-group">{g.title}</div>
          {g.items.map((it) => {
            const Icon = it.icon;
            return (
              <NavLink key={it.to} to={it.to} end={it.end}
                className={({ isActive }) => `adm-nav${isActive ? ' active' : ''}`}>
                <Icon size={17} strokeWidth={1.9} />
                {it.label}
              </NavLink>
            );
          })}
        </div>
      ))}

      <div className="adm-side-foot">
        <b>{email ?? '—'}</b>
        <a onClick={() => { void supabase.auth.signOut().then(() => { window.location.href = '/'; }); }}>
          <LogOut size={12} strokeWidth={2} style={{ verticalAlign: '-2px' }} /> Cerrar sesión
        </a>
      </div>
    </aside>
  );
}
