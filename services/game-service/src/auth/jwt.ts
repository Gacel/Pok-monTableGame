import jwt from 'jsonwebtoken';

/**
 * Firma y verificación de JWT de sesión.
 *
 * El secreto sale de `JWT_SECRET` (inyectado por env / .env en dev). En
 * producción debe venir de Vault (ver docs/ARCHITECTURE.md §7); nunca hardcodear
 * un secreto real. El fallback dev NO es seguro y solo evita que el arranque
 * local falle si falta la variable.
 */
const SECRET: string = process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me';
const EXPIRES_IN = '7d';

export interface SessionPayload {
  /** id de usuario (subject). */
  sub: string;
}

/** Emite un JWT firmado para el usuario indicado. */
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: EXPIRES_IN });
}

/** Verifica un JWT; devuelve el payload o `null` si es inválido/expirado. */
export function verifyToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (typeof decoded === 'object' && decoded && 'sub' in decoded && decoded.sub) {
      return { sub: String((decoded as { sub: unknown }).sub) };
    }
    return null;
  } catch {
    return null;
  }
}
