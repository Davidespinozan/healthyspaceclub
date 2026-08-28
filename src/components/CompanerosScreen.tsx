// Fase 1B · Pantalla Compañeros — buscar @usuario, invitar, aceptar, entrenar.
//
// PARTNER-UX-1 · P0 · Presentación state-driven (sin tocar autoridad).
// PROD-REGRESSION-1 · PARTNER HOTFIX:
//   - Los sub-componentes de presentación viven a NIVEL DE MÓDULO (identidad
//     estable). Antes se definían DENTRO de CompanerosScreen y se renderizaban
//     como <SearchBlock/>; cada setQuery les daba una identidad nueva → React
//     remontaba el <input> y el teclado móvil se cerraba. Ahora reciben props.
//   - Estado CERO invertido: BUSCAR en HSC = PRIMARIO (visible, sin toggle);
//     invitar externo (Referral) = SECUNDARIO.
// Toda la autoridad/privacidad sigue en los RPC SECURITY DEFINER (partners.ts).

import { useEffect, useState, useCallback } from 'react';
import { Search, UserPlus, Check, X, Dumbbell, AtSign, Clock, Loader2, Flame, ArrowRight, Users, Target } from 'lucide-react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { useT } from '../i18n';
import {
  searchUsers, sendInvite, respondInvite, listPartnerships, getPartnerTrainingProfile,
  countSessionsWith, removePartnership, getPartnerTodayStatus, type UserSearchResult, type Partnership,
} from '../utils/partners';
import UsernameSetupSheet from './UsernameSetupSheet';
import ShareStudio from './ShareStudio';
import { inviteLink, getMyReferrer, type ReferrerInfo } from '../utils/referral';
import { dayKey } from '../utils/localDate';
import { track } from '../utils/analytics';
import './companeros.css';

type DuoStatus = { trainedToday: boolean; streak: number; duoStreak: number };
type Tfn = ReturnType<typeof useT>['t'];   // tipo EXACTO de t (evita mismatch contravariante)

const NUDGE_KEY = 'hsc_ref_nudge_done';

function displayName(name: string | null, handle: string | null, t: Tfn): string {
  return name || (handle ? `@${handle}` : t('partners.aPartner'));
}

// ── Sub-componentes de presentación (NIVEL DE MÓDULO: identidad estable) ──────

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) return <img className="comp-avatar" src={url} alt="" />;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return <div className="comp-avatar comp-avatar--fallback">{initial}</div>;
}

function InviteButton({ variant, onClick, label }: { variant: 'primary' | 'ghost' | 'link'; onClick: () => void; label: string }) {
  const cls = variant === 'primary' ? 'comp-cta-primary' : variant === 'ghost' ? 'comp-cta-ghost' : 'comp-invite-link';
  return (
    <button className={cls} onClick={onClick} type="button">
      {variant === 'link' ? <>{label} <ArrowRight size={15} strokeWidth={2} style={{ verticalAlign: '-2px' }} aria-hidden="true" /></> : <><UserPlus size={17} strokeWidth={2} /> {label}</>}
    </button>
  );
}

function SearchBlock({
  t, query, setQuery, searching, results, connectedIds, outgoingPending, invited, onInvite,
}: {
  t: Tfn;
  query: string;
  setQuery: (v: string) => void;
  searching: boolean;
  results: UserSearchResult[];
  connectedIds: Set<string>;
  outgoingPending: Set<string>;
  invited: Set<string>;
  onInvite: (u: UserSearchResult) => void;
}) {
  return (
    <>
      <div className="comp-search">
        <Search size={17} className="comp-search-icon" strokeWidth={2} aria-hidden="true" />
        <input
          className="comp-search-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('partners.searchPlaceholder')}
          aria-label={t('partners.searchLabel')}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {searching && <Loader2 size={16} className="comp-search-spin" aria-label={t('partners.searching')} />}
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
                  <button className="comp-invite-btn" onClick={() => onInvite(u)} type="button">
                    <UserPlus size={14} strokeWidth={2} /> {t('partners.connect')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ModePreview({ t }: { t: Tfn }) {
  // NO interactivos: explican qué se desbloquea. <div> (no focusables) + aria para lectura.
  return (
    <div className="comp-modes" role="group" aria-label={t('partners.modesIntro')}>
      <p className="comp-modes-intro">{t('partners.modesIntro')}</p>
      <div className="comp-mode">
        <span className="comp-mode-icon"><Users size={18} strokeWidth={2} aria-hidden="true" /></span>
        <div className="comp-mode-t">{t('partners.mode1Title')}</div>
        <div className="comp-mode-b">{t('partners.mode1Body')}</div>
      </div>
      <div className="comp-mode">
        <span className="comp-mode-icon"><Target size={18} strokeWidth={2} aria-hidden="true" /></span>
        <div className="comp-mode-t">{t('partners.mode2Title')}</div>
        <div className="comp-mode-b">{t('partners.mode2Body')}</div>
      </div>
    </div>
  );
}

function ReferrerNudge({ referrer, referrerName, t, onDismiss, onConnect }: {
  referrer: ReferrerInfo; referrerName: string; t: Tfn; onDismiss: () => void; onConnect: () => void;
}) {
  return (
    <div className="comp-referrer">
      <button className="comp-referrer-x" onClick={onDismiss} aria-label={t('common.close')} type="button"><X size={15} strokeWidth={2} /></button>
      <div className="comp-referrer-head">
        <Avatar name={referrer.displayName || referrer.username} url={referrer.avatarUrl} />
        <div className="comp-referrer-body">
          <p className="comp-referrer-title">{t('partners.referrerCardTitle', { name: referrerName })}</p>
          <p className="comp-referrer-sub">{t('partners.referrerCardSub')}</p>
        </div>
      </div>
      <button className="comp-referrer-cta" onClick={onConnect} type="button">
        <Dumbbell size={15} strokeWidth={2} /> {t('partners.referrerCardCta')}
      </button>
    </div>
  );
}

function IdentityGate({ t, onOpen }: { t: Tfn; onOpen: () => void }) {
  return (
    <button className="comp-identity" onClick={onOpen} type="button">
      <span className="comp-identity-icon"><AtSign size={18} strokeWidth={2} /></span>
      <div className="comp-identity-body">
        <p className="comp-identity-title">{t('partners.setUsernameTitle')}</p>
        <p className="comp-identity-sub">{t('partners.setUsernameSub')}</p>
      </div>
      <span className="comp-identity-arrow"><ArrowRight size={18} strokeWidth={2} aria-hidden="true" /></span>
    </button>
  );
}

function ErrorBanner({ message, t, onClose }: { message: string; t: Tfn; onClose: () => void }) {
  return (
    <div className="comp-error" role="alert">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label={t('common.close')}><X size={13} strokeWidth={2.5} /></button>
    </div>
  );
}

function PartnerCard({ p, st, sessions, iTrainedToday, streakCount, t, onTrain, onUnlink, onShare }: {
  p: Partnership; st: DuoStatus | undefined; sessions: number; iTrainedToday: boolean; streakCount: number;
  t: Tfn; onTrain: (p: Partnership) => void; onUnlink: (p: Partnership) => void; onShare: (streak: string) => void;
}) {
  const theirName = (p.other_name || p.other_username || '').split(' ')[0] || t('partners.aPartner');
  const bothDone = iTrainedToday && !!st?.trainedToday;
  return (
    <div className="comp-card">
      <div className="comp-card-head">
        <Avatar name={p.other_name || p.other_username} url={p.other_avatar} />
        <div className="comp-card-id">
          <span className="comp-card-name">{displayName(p.other_name, p.other_username, t)}</span>
          {p.other_username && <span className="comp-card-handle">@{p.other_username}</span>}
        </div>
        {st && st.duoStreak > 0 && (
          <div className="comp-card-duo" aria-label={t('partners.duoDaysAria', { n: st.duoStreak })}>
            <Flame size={13} strokeWidth={2.5} aria-hidden="true" />
            <span className="comp-card-duo-n">{st.duoStreak}</span>
            <span className="comp-card-duo-l">{t('partners.duoDaysLabel')}</span>
          </div>
        )}
        <button className="comp-unlink" onClick={() => onUnlink(p)} aria-label={t('partners.unlink')} title={t('partners.unlink')} type="button">
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {st && (
        <div className="comp-card-status">
          <span className="comp-card-today">{t('partners.todayLabel')}</span>
          <span className={`comp-card-pill${st.trainedToday ? ' on' : ''}`}>
            {st.trainedToday ? <><Check size={12} strokeWidth={3} aria-hidden="true" /> {t('partners.trainedYes')}</> : t('partners.trainedNo')}
          </span>
          {sessions > 0 && <span className="comp-card-sessions">{t('partners.together', { n: sessions })}</span>}
        </div>
      )}

      {st && (
        <p className="comp-card-line">
          {bothDone ? t('partners.duoBoth')
            : st.trainedToday ? t('partners.duoTheyDone', { name: theirName })
            : iTrainedToday ? t('partners.duoYouDone', { name: theirName })
            : t('partners.duoNeither', { name: theirName })}
        </p>
      )}

      <div className="comp-card-actions">
        <button className="comp-train-btn" onClick={() => onTrain(p)} type="button">
          <Dumbbell size={14} strokeWidth={2} /> {t('partners.createTogether')}
        </button>
        {bothDone && (
          <button className="comp-duo-share" onClick={() => onShare(String(st && st.duoStreak > 0 ? st.duoStreak : streakCount))} type="button">
            <Flame size={13} strokeWidth={2} /> {t('partners.duoShare')}
          </button>
        )}
      </div>
    </div>
  );
}

function Requests({ incoming, t, onRespond }: { incoming: Partnership[]; t: Tfn; onRespond: (p: Partnership, accept: boolean) => void }) {
  if (incoming.length === 0) return null;
  return (
    <section className="comp-section comp-requests">
      <h2 className="comp-section-label">{t('partners.requests')}</h2>
      <div className="comp-list">
        {incoming.map(p => (
          <div className="comp-row" key={p.partnership_id}>
            <Avatar name={p.other_name || p.other_username} url={p.other_avatar} />
            <div className="comp-row-body">
              <span className="comp-row-name">{displayName(p.other_name, p.other_username, t)}</span>
              {p.other_username && <span className="comp-row-handle">@{p.other_username}</span>}
            </div>
            <div className="comp-row-actions">
              <button className="comp-icon-btn comp-icon-btn--ok" onClick={() => onRespond(p, true)} aria-label={t('partners.accept')} type="button">
                <Check size={16} strokeWidth={2.5} />
              </button>
              <button className="comp-icon-btn comp-icon-btn--no" onClick={() => onRespond(p, false)} aria-label={t('partners.decline')} type="button">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
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
  const [loaded, setLoaded] = useState(false);            // ¿ya resolvió la autoridad? (evita flashear el estado cero)
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statuses, setStatuses] = useState<Record<string, DuoStatus>>({});
  const [shareDuo, setShareDuo] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);          // estado CONECTADO: adquirir se revela con "＋ Añadir"
  const [actionError, setActionError] = useState<string | null>(null); // feedback inline recuperable
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
    setLoaded(true);
    const acc = parts.filter(p => p.status === 'accepted');
    const entries = await Promise.all(
      acc.map(async p => [p.other_id, await countSessionsWith(p.other_id)] as const),
    );
    setCounts(Object.fromEntries(entries));
    const td = dayKey(new Date());
    const yd = dayKey(new Date(Date.now() - 86400000));
    const st = await Promise.all(
      acc.map(async p => [p.other_id, await getPartnerTodayStatus(p.other_id, td, yd)] as const),
    );
    setStatuses(Object.fromEntries(st.filter((e): e is [string, DuoStatus] => e[1] != null)));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: aceptación/invitación → refresca al instante; rutina de pareja → recarga Hoy.
  useEffect(() => {
    const uid = useAppStore.getState().user?.id;
    if (!uid) return;
    const ch = supabase.channel(`user:${uid}`);
    ch.on('broadcast', { event: 'partner_accept' }, () => refresh());
    ch.on('broadcast', { event: 'invite' }, () => refresh());
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
  const isZero = loaded && accepted.length === 0 && outgoing.length === 0;

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
    setActionError(null);
    setInvited(prev => new Set(prev).add(u.user_id));
    const res = await sendInvite(u.user_id);
    if (res !== 'sent' && res !== 'exists') {
      setInvited(prev => { const n = new Set(prev); n.delete(u.user_id); return n; });
      setActionError(res === 'blocked' ? t('partners.inviteBlocked') : t('partners.actionError'));
    }
    refresh();
  }

  async function handleRespond(p: Partnership, accept: boolean) {
    setActionError(null);
    const res = await respondInvite(p.partnership_id, accept, p.other_id);
    if (res === 'error') setActionError(t('partners.actionError'));
    refresh();
  }

  async function cancelInvite(p: Partnership) {
    setActionError(null);
    const ok = await removePartnership(p.partnership_id);
    if (!ok) setActionError(t('partners.actionError'));
    refresh();
  }

  async function unlinkPartner(p: Partnership) {
    if (!window.confirm(t('partners.unlinkConfirm', { name: displayName(p.other_name, p.other_username, t) }))) return;
    setActionError(null);
    const ok = await removePartnership(p.partnership_id);
    if (!ok) setActionError(t('partners.actionError'));
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

  // ADQUISICIÓN externa = Referral (link), NUNCA la autoridad de pareja (sendInvite).
  async function doInviteShare() {
    if (!username) return;
    const link = inviteLink(username);
    try {
      if (navigator.share) await navigator.share({ text: t('partners.inviteText'), url: link });
      else { await navigator.clipboard.writeText(link); }
    } catch { /* canceló el share nativo */ }
  }

  // Props compartidas del buscador (para no repetir).
  const searchProps = { t, query, setQuery, searching, results, connectedIds, outgoingPending, invited, onInvite: handleInvite };

  return (
    <div className="comp-root">
      <div className="comp-hero-head">
        <p className="comp-eyebrow">{t('partners.eyebrow')}</p>
        <h1 className="comp-title">{isZero ? t('partners.whoTitle') : t('partners.title')}</h1>
      </div>

      {actionError && <ErrorBanner message={actionError} t={t} onClose={() => setActionError(null)} />}
      {showReferrerNudge && referrer && (
        <ReferrerNudge referrer={referrer} referrerName={referrerName} t={t} onDismiss={dismissNudge} onConnect={connectWithReferrer} />
      )}

      {!username && <IdentityGate t={t} onOpen={() => setShowUsernameSetup(true)} />}

      {username && !loaded && (
        <div className="comp-loading" aria-live="polite" aria-busy="true">
          <Loader2 size={22} className="comp-search-spin" aria-hidden="true" />
          <span>{t('partners.loading')}</span>
        </div>
      )}

      {username && loaded && (
        <>
          <Requests incoming={incoming} t={t} onRespond={handleRespond} />

          {isZero ? (
            /* ── ZERO: BUSCAR primero (primario, visible). Invitar externo = secundario. ── */
            <div className="comp-zero">
              <div className="comp-zero-value">
                <p className="comp-zero-line">{t('partners.heroLine')}</p>
                <SearchBlock {...searchProps} />
                {/* Secundario: si no está en HSC, invítalo (Referral). */}
                <div className="comp-invite-secondary">
                  <p className="comp-invite-sub">{t('partners.notHereTitle')}</p>
                  <InviteButton variant="link" onClick={doInviteShare} label={t('partners.inviteToJoin')} />
                </div>
              </div>
              <div className="comp-zero-modes">
                <ModePreview t={t} />
              </div>
            </div>
          ) : (
            /* ── CONNECTED: las tarjetas son el héroe; adquirir recede a "＋ Añadir". ── */
            <>
              <section className="comp-section">
                <h2 className="comp-section-label">{t('partners.yourPartners')}</h2>
                <div className="comp-cards">
                  {accepted.map(p => (
                    <PartnerCard
                      key={p.partnership_id} p={p} st={statuses[p.other_id]} sessions={counts[p.other_id] ?? 0}
                      iTrainedToday={iTrainedToday} streakCount={streakCount} t={t}
                      onTrain={trainWith} onUnlink={unlinkPartner} onShare={setShareDuo}
                    />
                  ))}
                  {outgoing.map(p => (
                    <div className="comp-row comp-row--muted" key={p.partnership_id}>
                      <Avatar name={p.other_name || p.other_username} url={p.other_avatar} />
                      <div className="comp-row-body">
                        <span className="comp-row-name">{displayName(p.other_name, p.other_username, t)}</span>
                        {p.other_username && <span className="comp-row-handle">@{p.other_username}</span>}
                      </div>
                      <span className="comp-row-tag"><Clock size={13} /> {t('partners.pending')}</span>
                      <button className="comp-unlink" onClick={() => cancelInvite(p)} aria-label={t('partners.cancel')} title={t('partners.cancel')} type="button">
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="comp-section comp-add">
                {!showAdd ? (
                  <button className="comp-add-toggle" onClick={() => setShowAdd(true)} type="button">
                    <UserPlus size={16} strokeWidth={2.5} /> {t('partners.addPartner')}
                  </button>
                ) : (
                  <div className="comp-add-panel">
                    <SearchBlock {...searchProps} />
                    <div className="comp-invite-secondary">
                      <p className="comp-invite-sub">{t('partners.notHereTitle')}</p>
                      <InviteButton variant="link" onClick={doInviteShare} label={t('partners.inviteToJoin')} />
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {showUsernameSetup && (
        <UsernameSetupSheet
          onClose={() => setShowUsernameSetup(false)}
          onDone={() => setShowUsernameSetup(false)}
        />
      )}

      {shareDuo != null && (
        // SHARE-2 · Share Studio · dúo — SOLO el número de racha, jamás identidad de pareja.
        <ShareStudio
          input={{ streakCount, duo: { days: Number(shareDuo) || 0 } }}
          preferredKind="duo"
          onClose={() => setShareDuo(null)}
        />
      )}
    </div>
  );
}
