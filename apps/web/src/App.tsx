import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { AccountNames, AccountsResponse, SessionResponse } from '@brevo-miniapp/contracts';
import * as api from './api';
import { AccountCard } from './AccountCard';
import { Icon } from './icons';
import { PwaControls } from './PwaControls';
import { updatedLabel, zoneLabel } from './presentation';
import { ChangePassword } from './ChangePassword';
import { AccountSettings } from './AccountSettings';
import { RefreshAge } from './RefreshAge';

function Brand() {
  return <div className="brand"><img className="brand-symbol" src="/brand/miniapp-mark.svg" alt="" width="36" height="36"/><span className="brand-name">MiniApp<span className="brand-caption">per a Brevo</span></span></div>;
}
function Login({ configured, onLogin, message }: { configured: boolean; onLogin: () => void; message: string | null }) {
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    setPending(true); setError(null);
    const value = password; setPassword('');
    try {
      const result = await api.login(value);
      if (!result.authenticated) throw new Error();
      onLogin();
    } catch (failure) {
      setError(failure instanceof api.ApiFailure && failure.status === 401 ? 'La contrasenya no és correcta. Torna-ho a provar.' :
        failure instanceof api.ApiFailure && failure.status === 429 ? 'S’han fet massa intents. Espera uns minuts abans de tornar-ho a provar.' :
          failure instanceof api.ApiFailure && failure.status === 503 ? 'L’accés privat encara no està configurat al servidor.' : 'No s’ha pogut iniciar la sessió. Comprova la connexió.');
    } finally { setPending(false); }
  }
  return <div className="login-shell"><header><Brand/><span className="private-label"><Icon name="lock"/>Accés privat</span></header>
    <main className="login-main"><section className="login-card" aria-labelledby="login-title"><span className="login-lock"><Icon name="lock"/></span>
      <h1 id="login-title">Benvingut</h1><p>Entra per consultar els teus comptes.</p>
      {message && <p className="notice" role="status">{message}</p>}
      {!configured ? <p className="notice" role="alert">Cal configurar la contrasenya al servidor abans d’entrar.</p> :
        <form onSubmit={(event) => { void submit(event); }}>
          <label htmlFor="password">Contrasenya</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256}
            value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} aria-describedby={error ? 'login-error' : undefined}/>
          {error && <p id="login-error" className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={pending} type="submit">{pending ? 'Entrant…' : 'Entra a la MiniApp'}<Icon name="arrow"/></button>
        </form>}
      <div className="login-security"><Icon name="lock"/><span>Les dades es consulten de manera privada.<br/>La contrasenya no es desa al navegador.</span></div>
    </section></main><PwaControls/><footer>Una vista privada dels teus comptes Brevo. No és una aplicació oficial de Brevo.</footer></div>;
}

export function App() {
  const [auth, setAuth] = useState<SessionResponse | null>(null);
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const lastRead = useRef(0);
  const epoch = useRef(0);
  const [retry, setRetry] = useState(0);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [lastConsult, setLastConsult] = useState<number | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController(); setSessionError(false);
    void api.session(controller.signal).then(setAuth).catch(() => { if (!controller.signal.aborted) setSessionError(true); });
    return () => controller.abort();
  }, [retry]);
  const refresh = useCallback(async (force = false) => {
    if (document.hidden || inFlight.current || (!force && Date.now() - lastRead.current < 60_000)) return;
    const controller = new AbortController(); inFlight.current = controller;
    const requestEpoch = epoch.current; setLoading(true);
    try {
      const result = await api.accounts(controller.signal);
      if (epoch.current !== requestEpoch || controller.signal.aborted) return;
      if (!Array.isArray(result.accounts) || result.accounts.length !== 2) throw new Error();
      const hasFresh = result.accounts.some((account) => [account.quota, account.smtp.today.report, account.smtp.totals, account.smtp.daily, account.marketing.campaigns]
        .some((section) => section.status === 'fresh' && section.data !== null));
      setData(result); setError(null); lastRead.current = Date.now();
      if (hasFresh) setLastConsult(Date.now());
    } catch (failure) {
      if (controller.signal.aborted || epoch.current !== requestEpoch) return;
      if (failure instanceof api.ApiFailure && failure.status === 401) {
        setData(null); setChangingPassword(false); setEditingSettings(false); setLastConsult(null); setSettingsMessage(null);
        setAuth({ authenticated: false, configured: true }); setSessionMessage('La teva sessió ha caducat. Torna a entrar.');
      } else setError(failure instanceof api.ApiFailure && failure.status === 429 ? 'Massa consultes seguides. Espera un minut i torna-ho a provar.' : 'No s’han pogut actualitzar les dades. Els valors anteriors poden haver canviat.');
    } finally {
      if (inFlight.current === controller) { inFlight.current = null; setLoading(false); }
    }
  }, []);
  useEffect(() => {
    if (!auth?.authenticated) return;
    void refresh(true);
    const resume = () => { if (!document.hidden) void refresh(); else inFlight.current?.abort(); };
    const online = () => { setOffline(false); void refresh(true); };
    const offlineEvent = () => setOffline(true);
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', online); window.addEventListener('offline', offlineEvent);
    return () => {
      epoch.current++; inFlight.current?.abort(); inFlight.current = null;
      window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', online); window.removeEventListener('offline', offlineEvent);
    };
  }, [auth?.authenticated, refresh]);
  async function signOut() {
    setLeaving(true); epoch.current++; inFlight.current?.abort(); inFlight.current = null;
    try {
      await api.logout(); setData(null); setAuth({ authenticated: false, configured: true }); setError(null); setSessionMessage(null);
      setLastConsult(null); setSettingsMessage(null); lastRead.current = 0;
    } catch { setError('No s’ha pogut tancar la sessió al servidor. Comprova la connexió i torna-ho a provar.'); }
    finally { setLeaving(false); setLoading(false); }
  }
  function endSession(message: string) {
    epoch.current++; inFlight.current?.abort(); inFlight.current = null; lastRead.current = 0;
    setData(null); setError(null); setLoading(false); setChangingPassword(false); setEditingSettings(false); setLastConsult(null); setSettingsMessage(null);
    setAuth({ authenticated: false, configured: true }); setSessionMessage(message);
  }
  const expired = useCallback(() => endSession('La teva sessió ha caducat. Torna a entrar.'), []);
  function namesSaved(names: AccountNames) {
    // Una consulta iniciada abans del desament no pot recuperar els noms anteriors.
    epoch.current++; inFlight.current?.abort(); inFlight.current = null; setLoading(false);
    setData((current) => current ? { ...current, accounts: current.accounts.map((account) => ({ ...account, name: names[account.id] })) } : current);
    setEditingSettings(false); setSettingsMessage('Noms desats. Els veuràs també als altres dispositius quan actualitzin.');
  }
  if (!auth) return <main className="connection-screen"><Brand/>{sessionError ? <><h1>No podem connectar</h1><p>Comprova la connexió amb el servidor.</p><button className="primary-button" onClick={() => setRetry(retry + 1)}>Torna-ho a provar</button></> : <p role="status">Preparant la teva MiniApp…</p>}</main>;
  if (!auth.authenticated) return <Login configured={auth.configured} message={sessionMessage} onLogin={() => { setAuth({ authenticated: true, configured: true }); setSessionMessage(null); }}/>;
  if (editingSettings) return <div className="login-shell"><header><Brand/><span className="private-label"><Icon name="lock"/>Accés privat</span></header>
    <main className="login-main"><AccountSettings onDone={namesSaved} onCancel={() => setEditingSettings(false)} onExpired={expired}/></main>
    <footer>Brevo MiniApp · Accés privat</footer></div>;
  if (changingPassword) return <div className="login-shell"><header><Brand/><span className="private-label"><Icon name="lock"/>Accés privat</span></header>
    <main className="login-main"><ChangePassword onCancel={() => setChangingPassword(false)}
      onDone={() => endSession('Contrasenya actualitzada. Totes les sessions s’han tancat. Entra amb la nova contrasenya.')}
      onExpired={() => endSession('La teva sessió ha caducat. Torna a entrar.')}/></main>
    <footer>Brevo MiniApp · Accés privat</footer></div>;
  const timezone = data?.accounts[0]?.smtp.period.timezone ?? 'Etc/GMT-2';
  const hasOld = data?.accounts.some((account) => [account.quota, account.smtp.today.report, account.smtp.totals, account.smtp.daily, account.marketing.campaigns].some((section) => section.status !== 'fresh'));
  return <div className="dashboard-shell"><a className="skip-link" href="#accounts">Ves als comptes</a>
    <header className="topbar"><Brand/><button className="quiet-button logout-button" type="button" onClick={() => { void signOut(); }} disabled={leaving} aria-label="Tanca la sessió"><Icon name="logout"/><span>{leaving ? 'Sortint…' : 'Surt'}</span></button></header>
    <main><section className="dashboard-intro"><div><span className="eyebrow">EL TEU RESUM DIARI</span><h1>Tot sota control<span className="heading-dot">.</span></h1>
      <p>Dos comptes. Una sola mirada.</p></div><div className="refresh-controls"><RefreshAge since={lastConsult}/><button type="button" className="refresh-button" disabled={loading || leaving} onClick={() => { void refresh(true); }}>
        <Icon name="refresh" className={loading ? 'spinning' : ''}/><span>{loading ? 'Actualitzant…' : 'Actualitza'}</span></button></div></section>
      <div className="dashboard-meta"><span className={`connection-dot ${error || offline ? 'warning' : ''}`}/><span role="status">{offline ? 'Sense connexió' : loading ? 'Consultant Brevo…' : error ? 'Actualització pendent' : hasOld ? 'Algunes dades no estan disponibles o són antigues' : data ? 'Dades carregades' : 'Preparant els comptes'}</span>
        {data && <span className="last-read">Consulta {updatedLabel(data.generatedAt, timezone)} · {zoneLabel(timezone)}</span>}</div>
      {(error || offline) && <p className="notice" role="alert">{offline ? 'Sense connexió. Les dades mostrades són les de l’última consulta i poden haver canviat.' : error}</p>}
      {settingsMessage && <p className="settings-notice" role="status">{settingsMessage}</p>}
      <section id="accounts" className="accounts-grid" aria-label="Els teus comptes Brevo" aria-busy={loading}>
        {data ? data.accounts.map((account) => <AccountCard key={account.id} account={account} locallyStale={Boolean(error || offline)}/>) : loading ? [1, 2].map((id) => <div key={id} className="account-card skeleton" aria-hidden="true"><div/><div/><div/></div>) :
          <div className="empty-state"><h2>No s’han carregat els comptes</h2><p>Pots tornar-ho a provar amb el botó Actualitza.</p></div>}
      </section><aside className="dashboard-footnote"><Icon name="lock"/><p>Només consulta. El saldo el proporciona Brevo; mai es calcula restant els enviaments d’avui.</p></aside>
      <div className="settings-actions"><button className="quiet-button" type="button" disabled={leaving} onClick={() => setEditingSettings(true)}><Icon name="settings"/>Configuració</button>
      <button className="quiet-button" type="button" disabled={leaving} onClick={() => setChangingPassword(true)}><Icon name="lock"/>Canvia la contrasenya</button></div>
    </main><PwaControls/><footer>Brevo MiniApp <span>·</span> La teva vista privada <span>·</span> No és una app oficial de Brevo</footer>
  </div>;
}
