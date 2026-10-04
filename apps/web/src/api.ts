import type { AccountNames, AccountSettings, AccountsResponse, SessionResponse } from '@brevo-miniapp/contracts';

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
