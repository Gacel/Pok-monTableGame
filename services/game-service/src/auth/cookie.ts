import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Gestión de la cookie de sesión (JWT).
 *
 * El JWT viaja en una cookie `HttpOnly` (inaccesible a JavaScript → inmune a robo
 * por XSS) `SameSite=Lax` + `Secure`. Antes viajaba en `localStorage` y en la
 * query string; ver docs/audit/SECURITY_AUDIT.md (frontend #2/#3).
 *
 * `Secure` se puede desactivar con `COOKIE_SECURE=false` SOLO para dev por http
 * (localhost:5173 sin gateway). En producción (tras el gateway HTTPS) debe ir a true.
 */
export const SESSION_COOKIE = 'session';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 días, en segundos
const SECURE = process.env.COOKIE_SECURE !== 'false';

export function setSessionCookie(reply: FastifyReply, token: string): void {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${MAX_AGE}`,
  ];
  if (SECURE) attrs.push('Secure');
  reply.header('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(reply: FastifyReply): void {
  const attrs = [`${SESSION_COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (SECURE) attrs.push('Secure');
  reply.header('Set-Cookie', attrs.join('; '));
}

/** Lee el token de sesión de la cookie (o, como respaldo, del header Bearer). */
export function readSessionToken(request: FastifyRequest): string | null {
  const cookie = request.headers.cookie;
  if (cookie) {
    for (const part of cookie.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === SESSION_COOKIE) return v.join('=') || null;
    }
  }
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim() || null;
  return null;
}
