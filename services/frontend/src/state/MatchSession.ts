import type { PlayerSlot } from '@transcendence/shared';

/**
 * Sesión de partida ONLINE en curso (sobrevive a un F5 vía sessionStorage):
 * permite reconectar a la misma sala con el mismo slot.
 */
export interface OnlineSession {
  matchId: string;
  mySlot: PlayerSlot;
  /** Nombres visibles por slot (player1 → username), para el HUD. */
  playerNames: Record<string, string>;
}

const KEY = 'online-match-session';

export const MatchSession = {
  save(session: OnlineSession): void {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  },

  load(): OnlineSession | null {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as OnlineSession;
      return s.matchId && s.mySlot ? s : null;
    } catch {
      return null;
    }
  },

  clear(): void {
    sessionStorage.removeItem(KEY);
  },
};
