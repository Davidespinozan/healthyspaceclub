// Fase 1B · Pantalla Compañeros — buscar @usuario, invitar, aceptar, entrenar.
//
// Hub social del modo pareja:
//   - Gate de @usuario: para buscar/conectar necesitas identidad (pre-sugerida).
//   - Buscador en vivo (mín. 2 chars) → invitar.
//   - Invitaciones recibidas → aceptar / rechazar.
//   - Tus compañeros conectados → "Entrenar" (jala su perfil real).

import { useEffect, useState, useCallback } from 'react';
import { Search, UserPlus, Check, X, Dumbbell, AtSign, Clock, Loader2, Flame, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { useT } from '../i18n';
import {
  searchUsers, sendInvite, respondInvite, listPartnerships, getPartnerTrainingProfile,
  countSessionsWith, removePartnership, getPartnerTodayStatus, type UserSearchResult, type Partnership,
} from '../utils/partners';
import UsernameSetupSheet from './UsernameSetupSheet';
import ShareStatSheet from './ShareStatSheet';
import { inviteLink, getMyReferrer, type ReferrerInfo } from '../utils/referral';
import { dayKey } from '../utils/localDate';
import { track } from '../utils/analytics';
import './companeros.css';

type DuoStatus = { trainedToday: boolean; streak: number; duoStreak: number };

const NUDGE_KEY = 'hsc_ref_nudge_done';

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
  const lastActiveDate = useAppStore(s => s.lastActiveDate);
  const streakCount = useAppStore(s => s.streakCount);
  const today = dayKey(new Date());
  const iTrainedToday = lastActiveDate === today;

  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statuses, setStatuses] = useState<Record<string, DuoStatus>>({});
  const [shareDuo, setShareDuo] = useState<string | null>(null);
  // Empujón al referido: si me trajo alguien (?ref=), invitarlo a entrenar cierra
  // el handoff "invitación → togetherness" (hoy el referido entra como usuario suelto).
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);
  const [nudgeHidden, setNudgeHidden] = useState(() => {
    try { return localStorage.getItem(NUDGE_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => { getMyReferrer().then(setReferrer); }, []);
  function dismissNudge() {
    setNudgeHidden(true);
    try { localStorage.setItem(NUDGE_KEY, '1'); } catch { /* noop */ }
  }

  const refresh = useCallback(async () => {
    const parts = await listPartnerships();
    setPartnerships(parts);
    // Fase 3: cuántas veces entrené con cada compañero conectado.
    const acc = parts.filter(p => p.status === 'accepted');
    const entries = await Promise.all(
      acc.map(async p => [p.other_id, await countSessionsWith(p.other_id)] as const),
    );
    setCounts(Object.fromEntries(entries));
    // Reto del día (a distancia): ¿ya entrenó cada compañero hoy? + racha de dúo.
    const td = dayKey(new Date());
    const yd = dayKey(new Date(Date.now() - 86400000));
    const st = await Promise.all(
      acc.map(async p => [p.other_id, await getPartnerTodayStatus(p.other_id, td, yd)] as const),
    );
    setStatuses(Object.fromEntries(st.filter((e): e is [string, DuoStatus] => e[1] != null)));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: cuando alguien acepta tu invitación (o te llega una nueva), la
  // lista se actualiza al instante sin recargar — igual de rápido que el envío.
  useEffect(() => {
    const uid = useAppStore.getState().user?.id;
    if (!uid) return;
    const ch = supabase.channel(`user:${uid}`);
    ch.on('broadcast', { event: 'partner_accept' }, () => refresh());
    ch.on('broadcast', { event: 'invite' }, () => refresh());
    // El host entregó la rutina de pareja → recárgala para que esté lista en Hoy.
    ch.on('broadcast', { event: 'partner_workout' }, () => {
      useAppStore.getState().pullDailyWorkout();
    });
    ch.subscribe();
    return () => { try { supabase.removeChannel(ch); } catch { /* noop */ } };
  }, [refresh]);

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
  const outgoing = partnerships.filter(p => p.direction === 'outgoing' && p.status === 'pending');
  const outgoingPending = new Set(outgoing.map(p => p.other_id));
  const connectedIds = new Set(accepted.map(p => p.other_id));

  // Nudge del referidor: solo si me trajo alguien, aún no estamos ligados, y no lo cerré.
  const referrerName = referrer
    ? (referrer.displayName || (referrer.username ? `@${referrer.username}` : t('partners.aPartner')))
    : '';
  const alreadyLinked = referrer
    ? connectedIds.has(referrer.id) || outgoingPending.has(referrer.id) || incoming.some(p => p.other_id === referrer.id)
    : false;
  const showReferrerNudge = !!referrer && !nudgeHidden && !alreadyLinked;

  async function connectWithReferrer() {
    if (!referrer) return;
    setInvited(prev => new Set(prev).add(referrer.id));
    await sendInvite(referrer.id);
    dismissNudge();
    refresh();
  }

  async function handleInvite(u: UserSearchResult) {
    setInvited(prev => new Set(prev).add(u.user_id));
    const res = await sendInvite(u.user_id);
    if (res !== 'sent' && res !== 'exists') {
      setInvited(prev => { const n = new Set(prev); n.delete(u.user_id); return n; });
    }
    refresh();
  }

  async function handleRespond(p: Partnership, accept: boolean) {
    await respondInvite(p.partnership_id, accept, p.other_id);
    refresh();
  }

  async function cancelInvite(p: Partnership) {
    await removePartnership(p.partnership_id);
    refresh();
  }

  async function unlinkPartner(p: Partnership) {
    if (!window.confirm(t('partners.unlinkConfirm', { name: displayName(p.other_name, p.other_username) }))) return;
    await removePartnership(p.partnership_id);
    refresh();
  }

  async function trainWith(p: Partnership) {
    track('shared_workout_cta_opened'); // metadata-only (sin ids/nombres)
    const prof = await getPartnerTrainingProfile(p.other_id);
    setPendingPartner({
      id: p.other_id,
      name: p.other_name || (p.other_username ? `@${p.other_username}` : t('partners.aPartner')),
      nivel: prof?.nivel,
      equipment: prof?.equipment,
      avatarUrl: p.other_avatar,
    });
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

      {/* Qué es y qué te da: las dos formas de entrenar en pareja (marco, para que
          se ENTIENDA la feature — antes abrías a un buscador sin contexto). */}
      <p className="comp-promise">{t('partners.promise')}</p>
      <div className="comp-modes">
        <div className="comp-mode">
          <span className="comp-mode-emoji">🤝</span>
          <div className="comp-mode-t">{t('partners.mode1Title')}</div>
          <div className="comp-mode-b">{t('partners.mode1Body')}</div>
        </div>
        <div className="comp-mode">
          <span className="comp-mode-emoji">🔥</span>
          <div className="comp-mode-t">{t('partners.mode2Title')}</div>
          <div className="comp-mode-b">{t('partners.mode2Body')}</div>
        </div>
      </div>

      {/* Empujón al referido: conéctate con quien te trajo a la app. */}
      {showReferrerNudge && referrer && (
        <div className="comp-referrer">
          <button className="comp-referrer-x" onClick={dismissNudge} aria-label={t('common.close')}><X size={15} strokeWidth={2} /></button>
          <div className="comp-referrer-head">
            <Avatar name={referrer.displayName || referrer.username} url={referrer.avatarUrl} />
            <div className="comp-referrer-body">
              <p className="comp-referrer-title">{t('partners.referrerCardTitle', { name: referrerName })}</p>
              <p className="comp-referrer-sub">{t('partners.referrerCardSub')}</p>
            </div>
          </div>
          <button className="comp-referrer-cta" onClick={connectWithReferrer}>
            <Dumbbell size={15} strokeWidth={2} /> {t('partners.referrerCardCta')}
          </button>
        </div>
      )}

      {/* Gate de identidad: sin @usuario no hay búsqueda/conexión. */}
      {!username && (
        <button className="comp-identity" onClick={() => setShowUsernameSetup(true)}>
          <span className="comp-identity-icon"><AtSign size={18} strokeWidth={2} /></span>
          <div className="comp-identity-body">
            <p className="comp-identity-title">{t('partners.setUsernameTitle')}</p>
            <p className="comp-identity-sub">{t('partners.setUsernameSub')}</p>
          </div>
          <span className="comp-identity-arrow"><ArrowRight size={18} strokeWidth={2} aria-hidden="true" /></span>
        </button>
      )}

      {username && (
        <>
          {/* Invita a alguien que AÚN no está en la app (adquisición) — comparte tu link. */}
          <button className="comp-invite" onClick={async () => {
            const link = inviteLink(username);
            try {
              if (navigator.share) await navigator.share({ text: t('partners.inviteText'), url: link });
              else { await navigator.clipboard.writeText(link); }
            } catch { /* canceló el share nativo */ }
          }}>
            <UserPlus size={17} strokeWidth={2} />
            {t('partners.inviteFriend')}
          </button>

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
                      <span className="comp-row-handle">@{u.username}{typeof u.streak_count === 'number' && u.streak_count > 0 ? <> · <Flame size={13} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /> {u.streak_count}</> : ''}</span>
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
            {accepted.length === 0 && outgoing.length === 0 ? (
              <div className="comp-empty-rich">
                <p className="comp-empty-title">{t('partners.emptyTitle')}</p>
                <p className="comp-empty-body">{t('partners.emptyBody')}</p>
              </div>
            ) : (
              <div className="comp-list">
                {/* Conectados → SOLO el que invitó (requester) genera la rutina;
                    el otro la recibe (evita que ambos generen rutinas distintas). */}
                {accepted.map(p => {
                  const iHost = p.direction === 'outgoing';
                  const st = statuses[p.other_id];
                  const theirName = (p.other_name || p.other_username || '').split(' ')[0] || t('partners.aPartner');
                  const bothDone = iTrainedToday && !!st?.trainedToday;
                  return (
                    <div className="comp-duo-wrap" key={p.partnership_id}>
                      <div className="comp-row">
                        <Avatar name={p.other_name || p.other_username} url={p.other_avatar} />
                        <div className="comp-row-body">
                          <span className="comp-row-name">{displayName(p.other_name, p.other_username)}</span>
                          <span className="comp-row-handle">
                            {counts[p.other_id] > 0
                              ? t('partners.together', { n: counts[p.other_id] })
                              : (p.other_username ? `@${p.other_username}` : '')}
                          </span>
                        </div>
                        {iHost ? (
                          <button className="comp-train-btn" onClick={() => trainWith(p)}>
                            <Dumbbell size={14} strokeWidth={2} /> {t('partners.train')}
                          </button>
                        ) : (
                          <span className="comp-row-tag">{t('partners.hostsRoutine')}</span>
                        )}
                        <button className="comp-unlink" onClick={() => unlinkPartner(p)} aria-label={t('partners.unlink')} title={t('partners.unlink')}>
                          <X size={14} strokeWidth={2} />
                        </button>
                      </div>
                      {/* Reto del día (a distancia): estado de hoy de los dos + payoff. */}
                      {st && (
                        <div className="comp-duo">
                          <div className="comp-duo-top">
                            <div className="comp-duo-pills">
                              <span className={`comp-duo-pill${iTrainedToday ? ' on' : ''}`}>{iTrainedToday ? '✓' : '○'} {t('partners.duoYou')}</span>
                              <span className={`comp-duo-pill${st.trainedToday ? ' on' : ''}`}>{st.trainedToday ? '✓' : '○'} {theirName}</span>
                            </div>
                            {st.duoStreak > 0 && (
                              <span className="comp-duo-streak"><Flame size={12} strokeWidth={2.5} /> {t('partners.duoStreak', { n: st.duoStreak })}</span>
                            )}
                          </div>
                          <p className="comp-duo-line">
                            {bothDone ? t('partners.duoBoth')
                              : st.trainedToday ? t('partners.duoTheyDone', { name: theirName })
                              : iTrainedToday ? t('partners.duoYouDone', { name: theirName })
                              : t('partners.duoNeither', { name: theirName })}
                          </p>
                          {bothDone && (
                            <button className="comp-duo-share" onClick={() => setShareDuo(String(st.duoStreak > 0 ? st.duoStreak : streakCount))}>
                              <Flame size={13} strokeWidth={2} /> {t('partners.duoShare')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Invitaciones enviadas → esperando que acepten (sin entrenar aún) */}
                {outgoing.map(p => (
                  <div className="comp-row comp-row--muted" key={p.partnership_id}>
                    <Avatar name={p.other_name || p.other_username} url={p.other_avatar} />
                    <div className="comp-row-body">
                      <span className="comp-row-name">{displayName(p.other_name, p.other_username)}</span>
                      {p.other_username && <span className="comp-row-handle">@{p.other_username}</span>}
                    </div>
                    <span className="comp-row-tag"><Clock size={13} /> {t('partners.pending')}</span>
                    <button className="comp-unlink" onClick={() => cancelInvite(p)} aria-label={t('partners.cancel')} title={t('partners.cancel')}>
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showUsernameSetup && (
        <UsernameSetupSheet
          onClose={() => setShowUsernameSetup(false)}
          onDone={() => setShowUsernameSetup(false)}
        />
      )}

      {shareDuo != null && (
        <ShareStatSheet
          headline={t('partners.duoHeadline')}
          stats={[{ big: shareDuo, label: t('partners.duoStatLabel') }]}
          onClose={() => setShareDuo(null)}
        />
      )}
    </div>
  );
}
