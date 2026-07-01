import type { FastifyRequest } from 'fastify';
import { UserModel, UserRecord } from '../models/UserModel.js';

/**
 * Resolución de identidad a partir del token de sesión.
 *
 * TRANSICIÓN: con el auth mock actual el token ES el id de usuario (ver
 * AuthController). Cuando llegue el auth-service con JWT real, basta con
 * sustituir el cuerpo de `resolveUser` por la verificación de la firma.
 */
export async function resolveUser(token: string | undefined | null): Promise<UserRecord | null> {
  const clean = (token ?? '').trim();
  if (!clean || clean.length > 128) return null;
  const user = await UserModel.findById(clean);
  return user ?? null;
}

/** Extrae el token del header `Authorization: Bearer <token>`. */
export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}
