import { GameState } from '../models/GameState';
import type { Tile, PlayerResources } from '../models/Types';

/** Capa VISTA (frontend): pinta el HUD a partir del estado del servidor. */
export class HUDView {
  private state: GameState;
  private toastTimer: number | null = null;

  constructor(state: GameState) {
    this.state = state;
  }

  public render(): void {
    const match = this.state.match;
    if (!match) return;

    const [p1Id, p2Id] = match.players;
    const p1Tile = match.tiles.find((t) => t.occupant?.playerId === p1Id);
    const p2Tile = match.tiles.find((t) => t.occupant?.playerId === p2Id);

    this.updatePlayerHUD('p1', p1Tile, p1Id, match.resources[p1Id ?? '']);
    this.updatePlayerHUD('p2', p2Tile, p2Id, match.resources[p2Id ?? '']);
    this.updateTurnBanner();
    this.updateLog();
    this.updateWinOverlay();
  }

  private updateTurnBanner(): void {
    const match = this.state.match;
    const banner = document.getElementById('turn-banner');
    const playerEl = document.getElementById('turn-player');
    const numberEl = document.getElementById('turn-number');
    if (!match || !banner || !playerEl || !numberEl) return;

    banner.classList.remove('hidden');
    if (match.status === 'finished') {
      playerEl.textContent = 'FIN';
      numberEl.textContent = `Turno ${match.turn}`;
      return;
    }
    const isP1 = match.currentPlayer === match.players[0];
    playerEl.textContent = `TURNO: ${(match.currentPlayer || '').toUpperCase()}`;
    playerEl.style.color = isP1 ? '#f87171' : '#60a5fa';
    banner.style.borderColor = isP1 ? '#f87171' : '#60a5fa';
    numberEl.textContent = `Turno ${match.turn}`;
  }

  private updatePlayerHUD(
    slot: 'p1' | 'p2',
    tile: Tile | undefined,
    playerId: string | undefined,
    res: PlayerResources | undefined
  ): void {
    const el = document.getElementById(`hud-${slot}`);
    if (!el) return;

    if (tile && tile.occupant) {
      el.classList.remove('hidden');
      const occ = tile.occupant;

      const nameEl = document.getElementById(`hud-${slot}-name`);
      if (nameEl) nameEl.textContent = occ.name ? occ.name.toUpperCase() : (playerId ?? slot).toUpperCase();

      const avatarEl = document.getElementById(`hud-${slot}-avatar`) as HTMLImageElement | null;
      if (avatarEl && occ.name) avatarEl.src = this.state.pokeGifs[occ.name] ?? '';

      const hp = occ.hp;
      const maxHp = occ.maxHp || 1;
      const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));

      const barEl = document.getElementById(`hud-${slot}-hp-bar`);
      if (barEl) {
        barEl.style.width = `${pct}%`;
        barEl.className = `h-full transition-all duration-300 ${
          pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500'
        }`;
      }
      const textEl = document.getElementById(`hud-${slot}-hp-text`);
      if (textEl) textEl.textContent = `${hp}/${maxHp}`;

      const resEl = document.getElementById(`hud-${slot}-res`);
      if (resEl && res) {
        resEl.innerHTML =
          `<span title="Fire candy">🔥${res.FIRE_CANDY}</span>` +
          `<span title="Water candy">💧${res.WATER_CANDY}</span>` +
          `<span title="Grass candy">🌿${res.GRASS_CANDY}</span>`;
      }
    } else {
      el.classList.add('hidden');
    }
  }

  private updateLog(): void {
    const match = this.state.match;
    const logEl = document.getElementById('event-log');
    if (!match || !logEl) return;
    const lines = match.log.slice(-6);
    logEl.innerHTML = lines.map((l) => `<div>› ${this.escape(l)}</div>`).join('');
  }

  private updateWinOverlay(): void {
    const match = this.state.match;
    const overlay = document.getElementById('win-overlay');
    const text = document.getElementById('win-text');
    if (!match || !overlay || !text) return;
    if (match.status === 'finished' && match.winner) {
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
      text.textContent = `${match.winner.toUpperCase()} gana la partida`;
    } else {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
    }
  }

  /** Muestra un mensaje efímero (errores de jugada, avisos). */
  public flashToast(message: string, color = '#b91c1c'): void {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.backgroundColor = color;
    toast.classList.remove('hidden');
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.classList.add('hidden'), 2200);
  }

  private escape(s: string): string {
    return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c);
  }
}
