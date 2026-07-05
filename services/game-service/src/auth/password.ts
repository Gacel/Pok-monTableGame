import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';

/**
 * Hash y verificación de contraseñas con scrypt (node:crypto, sin dependencias
 * externas). Formato almacenado: `scrypt$<saltHex>$<hashHex>`.
 *
 * scrypt es resistente a fuerza bruta por hardware; los parámetros por defecto
 * (N=16384) son adecuados para un login interactivo.
 */
const KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1]!, 'hex');
  const expected = Buffer.from(parts[2]!, 'hex');
  const actual = scryptSync(plain, salt, expected.length);
  // timingSafeEqual exige longitudes iguales.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Genera un id de usuario aleatorio e imposible de predecir desde el email. */
export function newUserId(): string {
  return `usr_${randomUUID().replace(/-/g, '')}`;
}
