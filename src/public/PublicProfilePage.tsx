import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import './public-profile-page.css';

// Página PÚBLICA de un perfil (/u/<usuario>). Árbol separado del member app: se
// monta desde main.tsx SIN el gate de sesión, para que un extraño (no logueado)
// aterrice en el perfil real de quien lo invitó — prueba social + CTA de registro.
// Reconciliación: si YA hay sesión, redirige a la app y abre el perfil ahí (fase 1).

interface Prof {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  streak_count: number | null;
  created_at: string | null;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function usernameFromPath(): string | null {
  const m = window.location.pathname.match(/^\/u\/([a-z0-9_.]{2,30})$/i);
  return m ? m[1] : null;
}

export default function PublicProfilePage() {
  const uname = usernameFromPath();
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [prof, setProf] = useState<Prof | null>(null);
  const [posts, setPosts] = useState<string[]>([]);
  const [mileCount, setMileCount] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Reconciliación: si ya eres usuario, ábrelo DENTRO de la app (fase 1) — no
      // el preview de venta. Se pasa el usuario por sessionStorage y recarga a /.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (uname) { try { sessionStorage.setItem('hsc_open_profile', uname); } catch { /* noop */ } }
          window.location.replace('/');
          return;
        }
      } catch { /* sin sesión → seguimos al preview público */ }

      if (!uname) { if (alive) setState('notfound'); return; }

      const { data: p } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, username, avatar_url, bio, streak_count, created_at')
        .ilike('username', uname)
        .maybeSingle();
      if (!alive) return;
      if (!p) { setState('notfound'); return; }
      const prof = p as Prof;
      setProf(prof);
      document.title = `${prof.display_name || '@' + (prof.username || uname)} · Healthy Space Club`;

      const { data: ps } = await supabase
        .from('club_posts')
        .select('photo_url')
        .eq('user_id', prof.user_id)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(6);
      if (alive && ps) setPosts((ps as { photo_url: string }[]).map(x => x.photo_url).filter(Boolean));

      try {
        const { count } = await supabase
          .from('user_milestones')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', prof.user_id);
        if (alive && count != null) setMileCount(count);
      } catch { /* logros no legibles anónimo → sin badges, no pasa nada */ }

      if (alive) setState('ready');
    })();
    return () => { alive = false; };
  }, []);

  function join() {
    // Al registro con ?ref= → atribución. Al entrar, la tarjeta "X te trajo" cierra el loop.
    window.location.href = uname ? `/?ref=${encodeURIComponent(uname)}` : '/';
  }

  const name = prof?.display_name || (prof?.username ? `@${prof.username}` : '');
  const firstName = (prof?.display_name || '').split(' ')[0] || (prof?.username || '');
  const since = (() => {
    if (!prof?.created_at) return '';
    const d = new Date(prof.created_at);
    if (Number.isNaN(d.getTime())) return '';
    return `desde ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  })();

  return (
    <div className="pub">
      <div className="pub-brand"><span className="pub-flame">✦</span><span>Healthy Space Club</span></div>

      {state === 'loading' && (
        <div className="pub-center"><div className="pub-spin" /></div>
      )}

      {state === 'notfound' && (
        <div className="pub-center pub-notfound">
          <h1>Este perfil no está disponible</h1>
          <p>Puede ser privado o el enlace cambió. Pero puedes empezar el tuyo.</p>
          <button className="pub-cta" onClick={() => { window.location.href = '/'; }}>Conocer Healthy Space Club</button>
        </div>
      )}

      {state === 'ready' && prof && (
        <>
          <div className="pub-hero">
            <div className="pub-av">
              {prof.avatar_url ? <img src={prof.avatar_url} alt="" /> : <span>{(firstName || '?')[0]?.toUpperCase()}</span>}
            </div>
            <h1 className="pub-name">{name}</h1>
            <p className="pub-handle">{prof.username ? `@${prof.username}` : ''}{since ? ` · ${since}` : ''}</p>
            {prof.bio && <p className="pub-bio">{prof.bio}</p>}
            <div className="pub-stats">
              <div className="pub-stat"><div className="b"><span className="fire">🔥</span> {prof.streak_count ?? 0}</div><div className="l">Racha</div></div>
              {mileCount > 0 && <div className="pub-stat"><div className="b">{mileCount}</div><div className="l">Logros</div></div>}
            </div>
          </div>

          {posts.length > 0 && (
            <div className="pub-grid">
              {posts.map((src, i) => (
                <div className="pub-post" key={i}><img src={src} alt="" loading="lazy" /></div>
              ))}
            </div>
          )}
          <p className="pub-lock">Únete para ver todo y reaccionar</p>

          <div className="pub-cta-bar">
            <button className="pub-cta" onClick={join}>{firstName ? `Únete y entrena con ${firstName}` : 'Únete a Healthy Space Club'}</button>
            <p className="pub-cta-sub">Gratis para empezar · te conectas al entrar</p>
          </div>
        </>
      )}
    </div>
  );
}
