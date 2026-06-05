// Fase 1B · Pantalla Compañeros — buscar @usuario, invitar, aceptar, entrenar.
//
// Hub social del modo pareja:
//   - Gate de @usuario: para buscar/conectar necesitas identidad (pre-sugerida).
//   - Buscador en vivo (mín. 2 chars) → invitar.
//   - Invitaciones recibidas → aceptar / rechazar.
//   - Tus compañeros conectados → "Entrenar" (jala su perfil real).
//   - Siempre: "Entrenar con un invitado" (modo invitado, no requiere cuenta).

import { useEffect, useState, useCallback } from 'react';
import { Search, UserPlus, Check, X, Dumbbell, AtSign, Clock, Loader2, Users } from 'lucide-react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import {
  searchUsers, sendInvite, respondInvite, listPartnerships, getPartnerTrainingProfile,
  type UserSearchResult, type Partnership,
} from '../utils/partners';
import UsernameSetupSheet from './UsernameSetupSheet';
import './companeros.css';

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) return <img className="comp-avatar" src={url} alt="" />;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return <div className="comp-avatar comp-avatar--fallback">{initial}</div>;
}

export default function CompanerosScreen() {
  const { t } = useT();
  const username = useAppStore(s => s.username);
  const setDashPage = useAppStore(s => s.setDashPage);
  const setPendingPartner = useAppStore(s => s.setPendingPartner);

  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setPartnerships(await listPartnerships());
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Búsqueda debounced (350ms).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const id = setTimeout(async () => {
      const r = await searchUsers(q);
      setResults(r);
      setSearching(false);
    }, 350);
    return () => clearTimeout(id);
  }, [query]);

  const incoming = partnerships.filter(p => p.direction === 'incoming' && p.status === 'pending');
  const accepted = partnerships.filter(p => p.status === 'accepted');
  const outgoingPending = new Set(
    partnerships.filter(p => p.direction === 'outgoing' && p.status === 'pending').map(p => p.other_id),
  );
  const connectedIds = new Set(accepted.map(p => p.other_id));

  async function handleInvite(u: UserSearchResult) {
    setInvited(prev => new Set(prev).add(u.user_id));
    const res = await sendInvite(u.user_id);
    if (res !== 'sent' && res !== 'exists') {
      setInvited(prev => { const n = new Set(prev); n.delete(u.user_id); return n; });
    }
    refresh();
  }

  async function handleRespond(p: Partnership, accept: boolean) {
    await respondInvite(p.partnership_id, accept);
    refresh();
  }

  async function trainWith(p: Partnership) {
    const prof = await getPartnerTrainingProfile(p.other_id);
    setPendingPartner({
      id: p.other_id,
      name: p.other_name || (p.other_username ? `@${p.other_username}` : t('partners.aPartner')),
      nivel: prof?.nivel,
      equipment: prof?.equipment,
    });
    setDashPage('entrenamiento-pareja');
  }

  function trainGuest() {
    setPendingPartner(null);
    setDashPage('entrenamiento-pareja');
  }

  function displayName(name: string | null, handle: string | null) {
    return name || (handle ? `@${handle}` : t('partners.aPartner'));
  }

  return (
    <div className="comp-root">
      <div className="comp-hero">
        <p className="comp-eyebrow">{t('partners.eyebrow')}</p>
        <h1 className="comp-title">{t('partners.title')}</h1>
      </div>

      {/* Gate de identidad: sin @usuario no hay búsqueda/conexión. */}
      {!username && (
        <button className="comp-identity" onClick={() => setShowUsernameSetup(true)}>
          <span className="comp-identity-icon"><AtSign size={18} strokeWidth={2} /></span>
          <div className="comp-identity-body">
            <p className="comp-identity-title">{t('partners.setUsernameTitle')}</p>
            <p className="comp-identity-sub">{t('partners.setUsernameSub')}</p>
          </div>
          <span className="comp-identity-arrow">→</span>
        </button>
      )}

      {username && (
        <>
          {/* Buscador */}
          <div className="comp-search">
            <Search size={17} className="comp-search-icon" strokeWidth={2} />
            <input
              className="comp-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('partners.searchPlaceholder')}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {searching && <Loader2 size={16} className="comp-search-spin" />}
          </div>

          {query.trim().length >= 2 && (
            <div className="comp-list">
              {results.length === 0 && !searching && (
                <p className="comp-empty">{t('partners.noResults')}</p>
              )}
              {results.map(u => {
                const connected = connectedIds.has(u.user_id);
                const pending = outgoingPending.has(u.user_id) || invited.has(u.user_id);
                return (
                  <div className="comp-row" key={u.user_id}>
                    <Avatar name={u.display_name || u.username} url={u.avatar_url} />
                    <div className="comp-row-body">
                      <span className="comp-row-name">{u.display_name || `@${u.username}`}</span>
                      <span className="comp-row-handle">@{u.username}{typeof u.streak_count === 'number' && u.streak_count > 0 ? ` · 🔥 ${u.streak_count}` : ''}</span>
                    </div>
                    {connected ? (
                      <span className="comp-row-tag comp-row-tag--ok"><Check size={13} /> {t('partners.connected')}</span>
                    ) : pending ? (
                      <span className="comp-row-tag"><Clock size={13} /> {t('partners.pending')}</span>
                    ) : (
                      <button className="comp-invite-btn" onClick={() => handleInvite(u)}>
                        <UserPlus size={14} strokeWidth={2} /> {t('partners.invite')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Invitaciones recibidas */}
          {incoming.length > 0 && (
            <div className="comp-section">
              <p className="comp-section-label">{t('partners.requests')}</p>
              <div className="comp-list">
                {incoming.map(p => (
                  <div className="comp-row" key={p.partnership_id}>
                    <Avatar name={p.other_name || p.other_username} url={p.other_avatar} />
                    <div className="comp-row-body">
                      <span className="comp-row-name">{displayName(p.other_name, p.other_username)}</span>
                      {p.other_username && <span className="comp-row-handle">@{p.other_username}</span>}
                    </div>
                    <div className="comp-row-actions">
                      <button className="comp-icon-btn comp-icon-btn--ok" onClick={() => handleRespond(p, true)} aria-label={t('partners.accept')}>
                        <Check size={16} strokeWidth={2.5} />
                      </button>
                      <button className="comp-icon-btn comp-icon-btn--no" onClick={() => handleRespond(p, false)} aria-label={t('partners.decline')}>
                        <X size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compañeros conectados */}
          <div className="comp-section">
            <p className="comp-section-label">{t('partners.yourPartners')}</p>
            {accepted.length === 0 ? (
              <p className="comp-empty">{t('partners.noPartners')}</p>
            ) : (
              <div className="comp-list">
                {accepted.map(p => (
                  <div className="comp-row" key={p.partnership_id}>
                    <Avatar name={p.other_name || p.other_username} url={p.other_avatar} />
                    <div className="comp-row-body">
                      <span className="comp-row-name">{displayName(p.other_name, p.other_username)}</span>
                      {p.other_username && <span className="comp-row-handle">@{p.other_username}</span>}
                    </div>
                    <button className="comp-train-btn" onClick={() => trainWith(p)}>
                      <Dumbbell size={14} strokeWidth={2} /> {t('partners.train')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Entrenar con invitado — siempre disponible, no requiere cuenta. */}
      <button className="comp-guest" onClick={trainGuest}>
        <span className="comp-guest-icon"><Users size={18} strokeWidth={1.8} /></span>
        <div className="comp-guest-body">
          <p className="comp-guest-title">{t('partners.guestTitle')}</p>
          <p className="comp-guest-sub">{t('partners.guestSub')}</p>
        </div>
        <span className="comp-guest-arrow">→</span>
      </button>

      {showUsernameSetup && (
        <UsernameSetupSheet
          onClose={() => setShowUsernameSetup(false)}
          onDone={() => setShowUsernameSetup(false)}
        />
      )}
    </div>
  );
}
