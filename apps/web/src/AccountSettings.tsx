import { useEffect, useState, type FormEvent } from 'react';
import type { AccountNames } from '@brevo-miniapp/contracts';
import * as api from './api';
import { Icon } from './icons';

export function AccountSettings({ onDone, onExpired, onCancel }: {
  onDone: (names: AccountNames) => void; onExpired: () => void; onCancel: () => void;
}) {
  const [names, setNames] = useState<AccountNames>({ '1': '', '2': '' });
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(null); setReady(false);
    void api.accountSettings(controller.signal).then((result) => {
      if (!controller.signal.aborted) { setNames(result.names); setReady(true); }
    }).catch((failure) => {
      if (controller.signal.aborted) return;
      if (failure instanceof api.ApiFailure && failure.status === 401) { onExpired(); return; }
      setError('No s’ha pogut carregar la configuració. Comprova la connexió.');
    });
    return () => controller.abort();
  }, [retry, onExpired]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!ready || pending) return;
    const next = { '1': names['1'].trim(), '2': names['2'].trim() };
    if (Object.values(next).some((name) => !name || name.length > 100 || /[\u0000-\u001f\u007f-\u009f]/u.test(name))) {
      setError('Escriu un nom d’entre 1 i 100 caràcters per a cada compte.'); return;
    }
    setPending(true); setError(null);
    try { onDone((await api.saveAccountSettings(next)).names); }
    catch (failure) {
      if (failure instanceof api.ApiFailure && failure.status === 401) { onExpired(); return; }
      setError(failure instanceof api.ApiFailure && failure.status === 429 ? 'Massa canvis seguits. Espera un minut i torna-ho a provar.' :
        failure instanceof api.ApiFailure && failure.status === 503 ? 'El servidor no té configurat el desament dels noms.' :
        'No s’ha pogut confirmar el desament. Comprova la connexió i torna-ho a provar.');
    } finally { setPending(false); }
  }
  return <section className="login-card settings-card" aria-labelledby="settings-title">
    <span className="login-lock"><Icon name="settings"/></span><h1 id="settings-title">Configuració</h1>
    <p>Tria com vols veure els teus comptes. Els noms es desen en aquesta MiniApp, no a Brevo, i es comparteixen entre dispositius.</p>
    {!ready && !error && <p role="status">Carregant els noms…</p>}
    <form onSubmit={(event) => { void submit(event); }}>
      {(['1', '2'] as const).map((id) => <div key={id}><label htmlFor={`account-name-${id}`}>Nom del compte {id}</label>
        <input id={`account-name-${id}`} type="text" autoComplete="off" required maxLength={100} disabled={!ready || pending}
          value={names[id]} onChange={(event) => { setNames({ ...names, [id]: event.target.value }); setError(null); }}/></div>)}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!ready && error && <button className="quiet-button" type="button" onClick={() => setRetry(retry + 1)}>Torna-ho a provar</button>}
      <button className="primary-button" type="submit" disabled={!ready || pending}>{pending ? 'Desant…' : 'Desa els noms'}<Icon name="arrow"/></button>
      <button className="quiet-button password-cancel" type="button" disabled={pending} onClick={onCancel}>Cancel·la</button>
    </form>
  </section>;
}
