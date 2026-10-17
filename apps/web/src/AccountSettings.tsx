import { useEffect, useState, type FormEvent } from 'react';
import { accountColors, accountIcons, type EmailAlerts, type ManagedAccount, type SenderOption, type WorkspaceSettings } from '@brevo-miniapp/contracts';
import * as api from './api';
import { Icon } from './icons';
import { number, updatedLabel } from './presentation';

const iconLabels = { mail: 'Correu', home: 'Personal', work: 'Feina', school: 'Escola', heart: 'Projecte', globe: 'Web' };
const colorLabels = { green: 'Verd', purple: 'Violeta', blue: 'Blau', teal: 'Turquesa', amber: 'Ambre', rose: 'Rosa' };
const emptyAccount = (): Omit<ManagedAccount, 'id' | 'connected'> => ({ name: '', appearance: { icon: 'mail', color: 'green' },
  reference: { kind: 'auto', allowance: null, renewalDay: null }, lowBalance: null, lowPercent: null });
const numeric = (value: string) => value === '' ? null : Number(value);

export function AccountSettings({ onChanged, onExpired, onCancel }: {
  onChanged: (accounts: ManagedAccount[]) => void; onExpired: () => void; onCancel: () => void;
}) {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [tab, setTab] = useState<'accounts' | 'alerts'>('accounts');
  const [editor, setEditor] = useState<{ id: string | null; account: ReturnType<typeof emptyAccount> } | null>(null);
  const [alerts, setAlerts] = useState<EmailAlerts | null>(null);
  const [senders, setSenders] = useState<SenderOption[]>([]);
  const [sendersLoading, setSendersLoading] = useState(false);
  const [credential, setCredential] = useState(''), [password, setPassword] = useState('');
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState(0), [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setError(null);
    void api.workspace(controller.signal).then(result => { if (!controller.signal.aborted) { setSettings(result); setAlerts(current => current ?? result.alerts); } }).catch(failure => {
      if (!controller.signal.aborted) failed(failure);
    });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const controller = new AbortController(); setSenders([]);
    if (tab === 'alerts' && alerts?.senderAccountId) {
      setSendersLoading(true);
      void api.senders(alerts.senderAccountId, controller.signal).then(result => { if (!controller.signal.aborted) setSenders(result.senders); }).catch(failure => {
        if (!controller.signal.aborted) failed(failure);
      }).finally(() => { if (!controller.signal.aborted) setSendersLoading(false); });
    } else setSendersLoading(false);
    return () => controller.abort();
  }, [tab, alerts?.senderAccountId]);
  useEffect(() => {
    let active = true;
    if ('serviceWorker' in navigator && 'PushManager' in window) void navigator.serviceWorker.getRegistration().then(async registration => {
      const subscription = await registration?.pushManager.getSubscription(); if (active) setSubscribed(Boolean(subscription));
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  function failed(failure: unknown) {
    if (failure instanceof api.ApiFailure && failure.status === 401) { onExpired(); return; }
    setError(failure instanceof api.ApiFailure && failure.code === 'CURRENT_PASSWORD_INCORRECT' ? 'La contrasenya actual no és correcta.' :
      failure instanceof api.ApiFailure && failure.status === 409 ? 'La configuració ha canviat en una altra operació. Recarrega-la abans de desar; la teva edició encara és aquí.' :
      failure instanceof api.ApiFailure && failure.status === 422 ? 'Brevo no ha pogut validar la clau o el remitent. Revisa’ls i torna-ho a provar.' :
      failure instanceof api.ApiFailure && failure.status === 429 ? 'Massa operacions seguides. Espera uns minuts.' :
      failure instanceof api.ApiFailure && failure.status === 503 ? 'Els enviaments o el desament no estan habilitats al servidor.' :
      'No s’ha pogut confirmar l’operació. Comprova la connexió; no enganxis cap clau al xat.');
  }
  function accept(result: WorkspaceSettings, replaceAlerts = true) { setSettings(result); if (replaceAlerts) setAlerts(result.alerts); onChanged(result.accounts); }
  async function operation(run: () => Promise<WorkspaceSettings>, success: string) {
    if (pending) return; setPending(true); setError(null); setMessage(null);
    try { accept(await run()); setMessage(success); return true; } catch (failure) { failed(failure); return false; } finally { setPending(false); }
  }
  function edit(account: ManagedAccount | null) {
    setCredential(''); setPassword(''); setError(null); setMessage(null);
    if (account) { const { id, connected: _, ...metadata } = account; setEditor({ id, account: metadata }); }
    else setEditor({ id: null, account: emptyAccount() });
  }
  async function saveAccount(event: FormEvent) {
    event.preventDefault(); if (!editor || !settings) return;
    if (!editor.account.name.trim()) { setError('Escriu un nom d’entre 1 i 100 caràcters.'); return; }
    if (editor.account.lowPercent !== null && !editor.account.reference.allowance) { setError('Per al llindar percentual, indica un volum de referència superior a zero.'); return; }
    const current = editor, key = credential, confirmation = password;
    setCredential(''); setPassword('');
    if (await operation(() => api.saveManagedAccount(settings.revision, current.id, current.account, key, confirmation), 'Compte desat.')) setEditor(null);
  }
  async function disconnect() {
    if (!editor?.id || !settings || !password) { setError('Introdueix la contrasenya de la MiniApp per desconnectar el compte.'); return; }
    if (!confirm(`Vols desconnectar «${editor.account.name}» d’aquesta MiniApp? No s’elimina el compte a Brevo. Si envia els avisos per correu, aquests es desactivaran.`)) return;
    const id = editor.id, confirmation = password; setPassword(''); setCredential('');
    if (await operation(() => api.disconnectAccount(settings.revision, id, confirmation), 'Compte desconnectat de la MiniApp.')) setEditor(null);
  }
  async function move(index: number, offset: number) {
    if (!settings) return; const ids = settings.accounts.map(a => a.id); [ids[index], ids[index + offset]] = [ids[index + offset]!, ids[index]!];
    await operation(() => api.reorderAccounts(settings.revision, ids), 'Ordre desat.');
  }
  async function saveNotifications(event: FormEvent) {
    event.preventDefault(); if (!settings || !alerts) return;
    const confirmation = password; setPassword('');
    await operation(() => api.saveAlerts(settings.revision, alerts, confirmation), 'Configuració dels avisos desada.');
  }
  async function testNotifications() {
    if (!settings || !password) { setError('Introdueix la contrasenya de la MiniApp per enviar una prova.'); return; }
    if (!confirm(`S’enviarà una prova als canals desats i actius.${settings.alerts.enabled ? ' El correu es carregarà al compte emissor seleccionat.' : ''} Vols continuar?`)) return;
    const confirmation = password; setPassword('');
    await operation(async () => {
      const result = await api.testAlerts(settings.revision, confirmation);
      return result.settings;
    }, 'Prova processada. Revisa l’historial per veure si cada canal l’ha acceptada; acceptació no vol dir entrega confirmada.');
  }
  async function pushToggle() {
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) { setError('Aquest navegador no ofereix push. A l’iPhone, afegeix l’app a la pantalla d’inici i obre-la des d’allà.'); return; }
    setPending(true); setError(null);
    try {
      if (!subscribed) {
        // Ha de començar directament amb el gest de l'usuari, abans de cap consulta de xarxa.
        if (await Notification.requestPermission() !== 'granted') { setError('No s’ha donat permís per rebre notificacions. Pots revisar-lo als ajustos del dispositiu.'); return; }
        const registration = await navigator.serviceWorker.ready, { publicKey } = await api.pushKey();
        const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        const existing = await registration.pushManager.getSubscription();
        const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes.buffer });
        try { accept(await api.subscribePush(subscription.toJSON(), 'Dispositiu personal'), false); setSubscribed(true); setMessage('Dispositiu registrat per als avisos push.'); }
        catch (failure) { if (!existing) await subscription.unsubscribe(); throw failure; }
      } else {
        const registration = await navigator.serviceWorker.ready, subscription = await registration.pushManager.getSubscription();
        if (subscription) { accept(await api.unsubscribePush(subscription.endpoint), false); await subscription.unsubscribe(); }
        setSubscribed(false); setMessage('Avisos push desactivats en aquest dispositiu.');
      }
    } catch (failure) { failed(failure); } finally { setPending(false); }
  }
  const updateEditor = (change: Partial<ReturnType<typeof emptyAccount>>) => { if (editor) setEditor({ ...editor, account: { ...editor.account, ...change } }); };
  return <section className="settings-page" aria-labelledby="settings-title">
    <div className="settings-title"><h1 id="settings-title">Configuració</h1><button className="quiet-button" disabled={pending} onClick={onCancel}>Torna als comptes</button></div>
    <div className="period-switch" role="group" aria-label="Seccions de configuració">
      <button type="button" disabled={pending} aria-pressed={tab === 'accounts'} onClick={() => { setTab('accounts'); setEditor(null); setPassword(''); setCredential(''); setError(null); }}>Comptes</button>
      <button type="button" disabled={pending} aria-pressed={tab === 'alerts'} onClick={() => { setTab('alerts'); setEditor(null); setPassword(''); setCredential(''); setError(null); }}>Avisos</button>
    </div>
    {error && <p className="notice" role="alert">{error} <button className="text-button" disabled={pending} onClick={() => setRetry(retry + 1)}>Recarrega configuració</button></p>}
    {message && <p className="settings-notice" role="status">{message}</p>}
    {!settings ? <p role="status">Carregant la configuració…</p> : tab === 'accounts' ? <>
      {!editor ? <><p className="settings-help">Els canvis només afecten aquesta MiniApp. Màxim 25 comptes.</p>
        <div className="managed-accounts">{settings.accounts.map((account, index) => <article className={`managed-account color-${account.appearance.color}`} key={account.id}>
          <span className="account-icon"><Icon name={account.appearance.icon}/></span><div><h2>{account.name}</h2><p>{account.connected ? 'Clau connectada · no es torna a mostrar' : 'Sense clau connectada'}</p></div>
          <div className="account-actions"><button className="quiet-button" disabled={pending} onClick={() => edit(account)} aria-label={`Edita ${account.name}`}>Edita</button>
            <button className="quiet-button" disabled={pending || index === 0} aria-label={`Puja ${account.name}`} onClick={() => { void move(index, -1); }}>↑</button>
            <button className="quiet-button" disabled={pending || index === settings.accounts.length - 1} aria-label={`Baixa ${account.name}`} onClick={() => { void move(index, 1); }}>↓</button></div>
        </article>)}</div><button className="primary-button" disabled={pending || settings.accounts.length >= 25} onClick={() => edit(null)}>Afegeix un compte<Icon name="arrow"/></button></> :
      <form className="login-card account-editor" onSubmit={event => { void saveAccount(event); }}>
        <h2>{editor.id ? 'Edita el compte' : 'Connecta un compte Brevo'}</h2>
        <fieldset disabled={pending}><label htmlFor="managed-name">Nom del compte</label><input id="managed-name" required maxLength={100} value={editor.account.name} onChange={event => updateEditor({ name: event.target.value })}/>
        <div className="settings-columns"><div><label htmlFor="account-icon">Icona</label><select id="account-icon" value={editor.account.appearance.icon} onChange={event => updateEditor({ appearance: { ...editor.account.appearance, icon: event.target.value as ManagedAccount['appearance']['icon'] } })}>{accountIcons.map(icon => <option key={icon} value={icon}>{iconLabels[icon]}</option>)}</select></div>
        <div><label htmlFor="account-color">Color</label><select id="account-color" value={editor.account.appearance.color} onChange={event => updateEditor({ appearance: { ...editor.account.appearance, color: event.target.value as ManagedAccount['appearance']['color'] } })}>{accountColors.map(color => <option key={color} value={color}>{colorLabels[color]}</option>)}</select></div></div>
        <label htmlFor="plan-kind">Pla contractat (referència)</label><select id="plan-kind" value={editor.account.reference.kind} onChange={event => updateEditor({ reference: { ...editor.account.reference, kind: event.target.value as ManagedAccount['reference']['kind'] } })}><option value="auto">Detecta’l amb Brevo</option><option value="free">Free</option><option value="prepaid">Prepagament</option><option value="subscription">Subscripció mensual</option></select>
        <div className="settings-columns"><div><label htmlFor="plan-allowance">Emails o crèdits contractats</label><input id="plan-allowance" type="number" min="0" max="1000000000" step="1" value={editor.account.reference.allowance ?? ''} onChange={event => updateEditor({ reference: { ...editor.account.reference, allowance: numeric(event.target.value) } })}/></div>
        <div><label htmlFor="renewal-day">Dia de renovació (mensual)</label><input id="renewal-day" type="number" min="1" max="31" step="1" value={editor.account.reference.renewalDay ?? ''} onChange={event => updateEditor({ reference: { ...editor.account.reference, renewalDay: numeric(event.target.value) } })}/></div></div>
        <p className="helper">El pla i el volum manuals són una referència; no compren crèdits ni modifiquen el saldo real de Brevo. Les estadístiques SMTP no equivalen a tot el consum.</p>
        <div className="settings-columns"><div><label htmlFor="low-balance">Avisa si el saldo és ≤</label><input id="low-balance" type="number" min="0" max="1000000000" step="1" placeholder="Sense llindar" value={editor.account.lowBalance ?? ''} onChange={event => updateEditor({ lowBalance: numeric(event.target.value) })}/></div>
        <div><label htmlFor="low-percent">O queda ≤ % del volum de referència</label><input id="low-percent" type="number" min="0" max="100" step="1" placeholder="Sense llindar" value={editor.account.lowPercent ?? ''} onChange={event => updateEditor({ lowPercent: numeric(event.target.value) })}/></div></div>
        <label htmlFor="brevo-credential">{editor.id ? 'Substitueix la clau Brevo (opcional)' : 'Clau API de Brevo'}</label><input id="brevo-credential" type="password" autoComplete="off" spellCheck={false} required={!editor.id} minLength={16} maxLength={512} value={credential} onChange={event => setCredential(event.target.value)}/>
        <p className="helper">S’envia una vegada per HTTPS al servidor. L’app no la desa al navegador ni la torna a mostrar. No l’enganxis al xat.</p>
        <label htmlFor="settings-password">Contrasenya actual de la MiniApp</label><input id="settings-password" type="password" autoComplete="current-password" required={!editor.id || Boolean(credential)} maxLength={256} value={password} onChange={event => setPassword(event.target.value)}/>
        <p className="helper">Necessària per connectar, substituir una clau o desconnectar un compte.</p>
        <button className="primary-button" type="submit">{pending ? 'Desant…' : 'Desa el compte'}<Icon name="arrow"/></button>
        <button className="quiet-button password-cancel" type="button" onClick={() => { setEditor(null); setCredential(''); setPassword(''); setError(null); }}>Cancel·la</button>
        {editor.id && <button className="quiet-button danger-button" type="button" onClick={() => { void disconnect(); }}>Desconnecta de la MiniApp</button>}
        </fieldset>
      </form>}
    </> : alerts && <>
      {!settings.deliveryEnabled && <p className="notice">Els enviaments estan desactivats al servidor. Pots preparar la configuració; no s’enviaran avisos fins que s’habilitin.</p>}
      <form className="login-card alert-editor" onSubmit={event => { void saveNotifications(event); }}><h2>Avisos per correu</h2><fieldset disabled={pending}>
        <label className="check-label"><input type="checkbox" checked={alerts.enabled} onChange={event => setAlerts({ ...alerts, enabled: event.target.checked })}/>Activa els avisos per correu</label>
        <label htmlFor="alert-recipient">Correu destinatari</label><input id="alert-recipient" type="email" autoComplete="email" maxLength={254} required={alerts.enabled} value={alerts.recipient} onChange={event => setAlerts({ ...alerts, recipient: event.target.value })}/>
        <label htmlFor="alert-account">Compte Brevo que paga els avisos</label><select id="alert-account" required={alerts.enabled} value={alerts.senderAccountId} onChange={event => setAlerts({ ...alerts, senderAccountId: event.target.value, senderId: null })}><option value="">Tria un compte</option>{settings.accounts.filter(a => a.connected).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
        <label htmlFor="alert-sender">Remitent actiu d’aquest compte</label><select id="alert-sender" required={alerts.enabled} disabled={pending || sendersLoading} value={alerts.senderId ?? ''} onChange={event => setAlerts({ ...alerts, senderId: numeric(event.target.value) })}><option value="">{sendersLoading ? 'Consultant remitents…' : 'Tria un remitent verificat'}</option>{senders.map(sender => <option key={sender.id} value={sender.id}>{sender.name} · {sender.email}</option>)}</select>
        <p className="helper">Cada correu acceptat s’envia des d’aquest compte i consumeix el seu saldo. Ja s’inclourà en les dades Brevo; la MiniApp no el resta de nou. Sense saldo o remitent vàlid, el correu pot fallar; les push són independents.</p>
        <label className="check-label"><input type="checkbox" checked={alerts.connectionErrors} onChange={event => setAlerts({ ...alerts, connectionErrors: event.target.checked })}/>Avisa si falten dades fresques durant 15 minuts</label>
        <label htmlFor="alert-repeat">Repeteix un avís pendent cada</label><select id="alert-repeat" value={alerts.repeatMinutes} onChange={event => setAlerts({ ...alerts, repeatMinutes: Number(event.target.value) })}><option value="60">Hora</option><option value="360">6 hores</option><option value="1440">24 hores</option><option value="10080">7 dies</option></select>
        <p className="helper">El servidor comprova els llindars cada 5 minuts, encara que tanquis l’app. Els llindars de saldo es configuren a cada compte. Màxim 20 intents de correu per dia UTC.</p>
        <label htmlFor="alert-password">Contrasenya de la MiniApp per desar o provar</label><input id="alert-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)}/>
        <button className="primary-button" type="submit">Desa els avisos<Icon name="arrow"/></button>
        <button className="quiet-button password-cancel" type="button" disabled={!settings.deliveryEnabled || !settings.alerts.enabled && !settings.pushEnabled} onClick={() => { void testNotifications(); }}>Envia una prova als canals actius</button>
        </fieldset></form>
      <section className="login-card push-editor"><h2>Notificacions push</h2><p className="settings-help">Funcionen amb l’app tancada. A l’iPhone: afegeix la MiniApp a la pantalla d’inici, obre-la des d’allà i dona permís. Els avisos no mostren saldos ni noms privats a la pantalla bloquejada.</p>
        <button className="quiet-button" disabled={pending} type="button" onClick={() => { void pushToggle(); }}>{subscribed ? 'Desactiva en aquest dispositiu' : 'Activa en aquest dispositiu'}</button>
        <p className="helper">{settings.pushDevices.length} dispositius registrats. Sense consum de crèdits Brevo. El sistema pot retardar o silenciar les notificacions.</p>
      </section>
      <section className="login-card delivery-history"><h2>Historial d’avisos</h2><p className="settings-help">Acceptat vol dir que el servei ha acceptat l’enviament, no que s’hagi llegit o entregat. Pendent o incert no es reenvia immediatament.</p>
        {!settings.deliveries.length ? <p className="helper">Encara no hi ha intents registrats.</p> : <ul>{[...settings.deliveries].reverse().slice(0, 20).map(delivery => <li key={delivery.id}>
          <span>{updatedLabel(delivery.at, 'UTC')} UTC · {delivery.channel === 'email' ? `Correu · ${settings.accounts.find(a => a.id === delivery.accountId)?.name ?? 'Compte desconnectat'}` : 'Push · sense crèdits'}</span>
          <strong>{({ pending: 'Pendent de confirmar', accepted: 'Acceptat', rejected: 'Rebutjat', uncertain: 'Incert' })[delivery.status]}</strong>
        </li>)}</ul>}
        <p className="helper">Correus acceptats en aquest registre: {number(settings.deliveries.filter(row => row.channel === 'email' && row.status === 'accepted').length)}. Es conserven els últims 100 intents.</p>
      </section>
    </>}
  </section>;
}
