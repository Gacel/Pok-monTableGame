/**
 * fetch con la identidad de la sesión y JSON.
 *
 * La sesión viaja en una cookie `HttpOnly` que el navegador adjunta
 * automáticamente (`credentials: 'include'`). Ya NO se lee el JWT desde
 * JavaScript (antes en localStorage → vulnerable a XSS). El servidor autoriza
 * las acciones a partir de esa cookie.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(path, { ...init, headers, credentials: 'include' });
}
