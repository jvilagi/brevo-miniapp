import type { AccountsResponse, SessionResponse } from '@brevo-miniapp/contracts';

export class ApiFailure extends Error {
  constructor(public status: number) { super('Petició no disponible.'); }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new ApiFailure(response.status);
  return await response.json() as T;
}
export const session = (signal: AbortSignal) => request<SessionResponse>('/api/auth/session', { signal });
export const accounts = (signal: AbortSignal) => request<AccountsResponse>('/api/accounts', { signal });
export const login = (password: string) => request<SessionResponse>('/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-app-request': '1' }, body: JSON.stringify({ password }),
});
export const logout = () => request<SessionResponse>('/api/auth/logout', { method: 'POST', headers: { 'x-app-request': '1' } });
