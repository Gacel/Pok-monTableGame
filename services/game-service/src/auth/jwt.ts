import jwt from 'jsonwebtoken';

/**
 * Firma y verificación de JWT de sesión.
 *
 * El secreto sale de `JWT_SECRET` (en producción, inyectado desde Vault; ver
 * docs/ARCHITECTURE.md §7). NO hay fallback: si falta la variable, el arranque
 * aborta. Nunca hardcodear un secreto.
 */
const SECRET: string = requireSecret();
const EXPIRES_IN = '7d';
const ISSUER = 'transcendence-game-service';
const AUDIENCE = 'transcendence-frontend';
const ALGORITHM = 'HS256' as const;

function requireSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      'JWT_SECRET ausente o demasiado corto (min. 16 chars). Configúralo (Vault en prod) antes de arrancar.'
    );
  }
  return s;
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
