import { authState } from '../auth/AuthState';

/**
 * fetch con la identidad de la sesión (Authorization: Bearer) y JSON.
 * Las acciones online se autorizan en el servidor con este token.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (authState.sessionToken) {
    headers.set('Authorization', `Bearer ${authState.sessionToken}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(path, { ...init, headers });
}
