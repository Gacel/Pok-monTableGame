/**
 * Paleta de colores por jugador (P1..P4). ÚNICA fuente (antes duplicada en
 * CombatView, HUDView, MinimapView, EntityView y DraftView con matices distintos).
 * El índice 0 = player1, 1 = player2, etc.
 */
export const PLAYER_COLORS = ['#3b82f6', '#ef4444', '#a855f7', '#eab308'] as const;

/** Variantes claras (borde/acento), paralelas a PLAYER_COLORS. */
export const PLAYER_COLORS_LIGHT = ['#60a5fa', '#f87171', '#c084fc', '#facc15'] as const;

/** Color del jugador por índice (0-based), con módulo defensivo. */
export function playerColor(index: number): string {
  return PLAYER_COLORS[((index % 4) + 4) % 4]!;
}
