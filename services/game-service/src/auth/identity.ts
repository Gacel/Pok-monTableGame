import type { FastifyRequest } from 'fastify';
import { UserModel, UserRecord } from '../models/UserModel.js';
import { verifyToken } from './jwt.js';
import { readSessionToken } from './cookie.js';

/**
 * Resolución de identidad a partir del token de sesión.
 *
 * El token es un **JWT firmado** (ver auth/jwt.ts). Se verifica la firma y se
 * carga el usuario del `sub`. Un token forjado o expirado → `null`.
 */
export async function resolveUser(token: string | undefined | null): Promise<UserRecord | null> {
  const clean = (token ?? '').trim();
  if (!clean || clean.length > 4096) return null;
  const payload = verifyToken(clean);
  if (!payload) return null;
  const user = await UserModel.findById(payload.sub);
  return user ?? null;
}

/**
 * Extrae el token de sesión de la cookie `HttpOnly` (o, como respaldo, del header
 * `Authorization: Bearer`). Se mantiene el nombre por compatibilidad con los
 * call-sites existentes.
 */
export function bearerToken(request: FastifyRequest): string | null {
  return readSessionToken(request);
}
