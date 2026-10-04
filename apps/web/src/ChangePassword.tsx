import { useState, type FormEvent } from 'react';
import * as api from './api';
import { Icon } from './icons';

export function ChangePassword({ onDone, onExpired, onCancel }: { onDone: () => void; onExpired: () => void; onCancel: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    setError(null);
    if (next !== confirmation) { setError('Les contrasenyes noves no coincideixen.'); return; }
    if (next.length < 12 || next.length > 256) { setError('Utilitza entre 12 i 256 caràcters.'); return; }
    if (next === current) { setError('La contrasenya nova ha de ser diferent de l’actual.'); return; }
    const values = [current, next, confirmation] as const;
    setCurrent(''); setNext(''); setConfirmation(''); setPending(true);
    try { await api.changePassword(...values); onDone(); }
    catch (failure) {
      if (failure instanceof api.ApiFailure && failure.status === 401) { onExpired(); return; }
      setError(failure instanceof api.ApiFailure && failure.code === 'CURRENT_PASSWORD_INCORRECT' ? 'La contrasenya actual no és correcta.' :
        failure instanceof api.ApiFailure && failure.status === 429 ? 'Massa intents. Espera uns minuts abans de tornar-ho a provar.' :
        failure instanceof api.ApiFailure && failure.status === 503 ? 'El servidor no té configurat el canvi de contrasenya.' :
        'No s’ha pogut confirmar el canvi. Comprova la connexió; si s’ha tallat després de desar-lo, entra amb la contrasenya nova.');
    } finally { setPending(false); }
  }
  return <section className="login-card password-card" aria-labelledby="change-password-title">
    <span className="login-lock"><Icon name="lock"/></span><h1 id="change-password-title">Canvia la contrasenya</h1>
    <p>Després de desar-la es tancaran totes les sessions. Hauràs de tornar a entrar amb la nova.</p>
    <form onSubmit={(event) => { void submit(event); }}>
      <label htmlFor="current-password">Contrasenya actual</label>
      <input id="current-password" type="password" autoComplete="current-password" autoFocus required maxLength={256} disabled={pending}
        value={current} onChange={(event) => setCurrent(event.target.value)}/>
      <label htmlFor="new-password">Contrasenya nova</label>
      <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} disabled={pending}
        aria-describedby="password-guidance" value={next} onChange={(event) => setNext(event.target.value)}/>
      <p id="password-guidance" className="helper">Entre 12 i 256 caràcters. Pots utilitzar una frase llarga.</p>
      <label htmlFor="confirm-password">Confirma la contrasenya nova</label>
      <input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} disabled={pending}
        value={confirmation} onChange={(event) => setConfirmation(event.target.value)}/>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Desant…' : 'Desa la contrasenya'}<Icon name="arrow"/></button>
      <button className="quiet-button password-cancel" type="button" disabled={pending} onClick={onCancel}>Cancel·la</button>
    </form>
  </section>;
}
