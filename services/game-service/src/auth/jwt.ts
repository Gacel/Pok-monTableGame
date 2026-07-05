import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

/**
 * Firma y verificación de JWT de sesión.
 *
 * El secreto sale de `JWT_SECRET` (en producción, inyectado desde Vault; ver
 * docs/ARCHITECTURE.md §7). Ya NO existe el antiguo fallback hardcodeado
 * (predecible → inseguro). Si falta la variable, se genera un secreto ALEATORIO
 * efímero (seguro, impredecible) y se avisa: no se aborta el arranque, pero las
 * sesiones no sobreviven a reinicios hasta configurar JWT_SECRET.
 */
const SECRET: string = resolveSecret();
const EXPIRES_IN = '7d';
const ISSUER = 'transcendence-game-service';
const AUDIENCE = 'transcendence-frontend';
const ALGORITHM = 'HS256' as const;

function resolveSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  // eslint-disable-next-line no-console
  console.warn(
    '[auth] JWT_SECRET ausente o < 16 chars: usando secreto aleatorio efímero. ' +
      'Configura JWT_SECRET (Vault en prod) para que las sesiones persistan.'
  );
  return randomBytes(48).toString('hex');
}

export interface SessionPayload {
  /** id de usuario (subject). */
  sub: string;
}

/** Emite un JWT firmado para el usuario indicado. */
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, {
    algorithm: ALGORITHM,
    expiresIn: EXPIRES_IN,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

/** Verifica un JWT; devuelve el payload o `null` si es inválido/expirado. */
export function verifyToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof decoded === 'object' && decoded && 'sub' in decoded && decoded.sub) {
      return { sub: String((decoded as { sub: unknown }).sub) };
    }
    return null;
  } catch {
    return null;
  }
}
