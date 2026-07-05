/**
 * Resolución del sprite de entrenador a partir del `avatarUrl` del usuario.
 * ÚNICA implementación (antes duplicada en 3 vistas). Sanea el id a un charset
 * seguro: evita XSS al interpolarlo en el `src` de un <img> vía innerHTML
 * (ver docs/audit/SECURITY_AUDIT.md, frontend #1).
 */
export function spriteOf(avatarUrl: string | null | undefined): string {
  const raw = avatarUrl === 'boy' ? 'red' : avatarUrl === 'girl' ? 'may' : avatarUrl || 'red';
  const safe = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return safe || 'red';
}

/** URL completa del sprite de entrenador (ya saneada). */
export function trainerSpriteUrl(avatarUrl: string | null | undefined): string {
  return `https://play.pokemonshowdown.com/sprites/trainers/${spriteOf(avatarUrl)}.png`;
}
