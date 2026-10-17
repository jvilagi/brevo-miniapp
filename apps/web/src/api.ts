import type { AccountNames, AccountSettings, AccountsResponse, EmailAlerts, ManagedAccount, SenderOption, SessionResponse, WorkspaceSettings } from '@brevo-miniapp/contracts';

export class ApiFailure extends Error {
  constructor(public status: number, public code?: 'CURRENT_PASSWORD_INCORRECT' | 'PASSWORD_CHANGE_UNAVAILABLE') { super('Petició no disponible.'); }
}
export const SESSION_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;
async function request<T>(path: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  if (init.signal?.aborted) throw init.signal.reason;
  const controller = new AbortController();
  let cancel = (_reason: unknown) => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    cancel = reason => { reject(reason); controller.abort(reason); };
  });
  const abort = () => cancel(init.signal?.reason ?? new DOMException('Petició cancel·lada.', 'AbortError'));
  init.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => cancel(new DOMException('El servidor no ha respost a temps.', 'TimeoutError')), timeoutMs);
  try {
    // El límit també cobreix el cos JSON. Mai es repeteix automàticament un POST.
    return await Promise.race([cancelled, (async () => {
      const response = await fetch(path, { ...init, signal: controller.signal, cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) {
        const error: unknown = await response.json().catch(() => null);
        const code = error && typeof error === 'object' && 'error' in error &&
          (error.error === 'CURRENT_PASSWORD_INCORRECT' || error.error === 'PASSWORD_CHANGE_UNAVAILABLE') ? error.error : undefined;
        throw new ApiFailure(response.status, code);
      }
      return await response.json() as T;
    })()]);
  } finally {
    clearTimeout(timer); init.signal?.removeEventListener('abort', abort);
  }
}
export async function session(signal: AbortSignal): Promise<SessionResponse> {
  const value = await request<unknown>('/api/auth/session', { signal }, SESSION_TIMEOUT_MS);
  if (!value || typeof value !== 'object' || !('authenticated' in value) || !('configured' in value) ||
    typeof value.authenticated !== 'boolean' || typeof value.configured !== 'boolean') throw new ApiFailure(502);
  return { authenticated: value.authenticated, configured: value.configured };
}
export const accounts = (signal: AbortSignal) => request<AccountsResponse>('/api/accounts', { signal });
const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-app-request': '1' }, body: JSON.stringify(body) });
export const workspace = (signal: AbortSignal) => request<WorkspaceSettings>('/api/workspace', { signal });
export const saveManagedAccount = (revision: number, id: string | null, account: Omit<ManagedAccount, 'id' | 'connected'>, credential: string, currentPassword: string) =>
  post<WorkspaceSettings>(id ? `/api/workspace/accounts/${encodeURIComponent(id)}` : '/api/workspace/accounts', { revision, account, credential, currentPassword });
export const disconnectAccount = (revision: number, id: string, currentPassword: string) => post<WorkspaceSettings>(`/api/workspace/accounts/${encodeURIComponent(id)}/disconnect`, { revision, currentPassword });
export const reorderAccounts = (revision: number, ids: string[]) => post<WorkspaceSettings>('/api/workspace/order', { revision, ids });
export const senders = (id: string, signal: AbortSignal) => request<{ senders: SenderOption[] }>(`/api/workspace/accounts/${encodeURIComponent(id)}/senders`, { signal });
export const saveAlerts = (revision: number, alerts: EmailAlerts, currentPassword: string) => post<WorkspaceSettings>('/api/workspace/alerts', { revision, alerts, currentPassword });
export const testAlerts = (revision: number, currentPassword: string) => post<{ status: string; settings: WorkspaceSettings }>('/api/workspace/alerts/test', { revision, currentPassword });
export const pushKey = () => post<{ publicKey: string }>('/api/workspace/push/key', {});
export const subscribePush = (subscription: PushSubscriptionJSON, label: string) => post<WorkspaceSettings>('/api/workspace/push/subscribe', { subscription, label });
export const unsubscribePush = (endpoint: string) => post<WorkspaceSettings>('/api/workspace/push/unsubscribe', { endpoint });
export const accountSettings = (signal: AbortSignal) => request<AccountSettings>('/api/settings/accounts', { signal });
export const saveAccountSettings = (names: AccountNames) => request<AccountSettings>('/api/settings/accounts', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-app-request': '1' }, body: JSON.stringify({ names }),
});
export const login = (password: string) => request<SessionResponse>('/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-app-request': '1' }, body: JSON.stringify({ password }),
});
export const logout = () => request<SessionResponse>('/api/auth/logout', { method: 'POST', headers: { 'x-app-request': '1' } });
export const changePassword = (currentPassword: string, newPassword: string, confirmation: string) => request<SessionResponse>('/api/auth/password', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-app-request': '1' },
  body: JSON.stringify({ currentPassword, newPassword, confirmation }),
});
