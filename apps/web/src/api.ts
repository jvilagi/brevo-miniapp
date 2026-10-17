import type { AccountNames, AccountSettings, AccountsResponse, EmailAlerts, ManagedAccount, SenderOption, SessionResponse, WorkspaceSettings } from '@brevo-miniapp/contracts';

export class ApiFailure extends Error {
  constructor(public status: number, public code?: 'CURRENT_PASSWORD_INCORRECT' | 'PASSWORD_CHANGE_UNAVAILABLE') { super('Petició no disponible.'); }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    const code = error && typeof error === 'object' && 'error' in error &&
      (error.error === 'CURRENT_PASSWORD_INCORRECT' || error.error === 'PASSWORD_CHANGE_UNAVAILABLE') ? error.error : undefined;
    throw new ApiFailure(response.status, code);
  }
  return await response.json() as T;
}
export const session = (signal: AbortSignal) => request<SessionResponse>('/api/auth/session', { signal });
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
