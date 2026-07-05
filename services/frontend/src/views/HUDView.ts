import { GameState } from '../models/GameState';
import type { Tile, PlayerResources } from '../models/Types';
import { authState } from '../auth/AuthState';
import { escapeHtml } from '../utils/html';

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

    const slots: ('p1' | 'p2' | 'p3' | 'p4')[] = ['p1', 'p2', 'p3', 'p4'];
    slots.forEach((slot, i) => {
      const playerId = match.players[i];
      const tile = this.state.getLastInteractedTile(playerId);
      this.updatePlayerHUD(slot, tile, playerId, match.resources[playerId ?? '']);
    });

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

    const colorMap: Record<string, string> = {
      player1: '#3b82f6', // Azul
      player2: '#ef4444', // Rojo
      player3: '#a855f7', // Violeta
      player4: '#eab308', // Amarillo
    };
    const color = colorMap[match.currentPlayer] || '#facc15';

    const label = this.state.labelFor(match.currentPlayer).toUpperCase();
    const isMe = this.state.mySlot !== null && this.state.mySlot === match.currentPlayer;
    playerEl.textContent = isMe ? `TU TURNO · ${label}` : `TURNO: ${label}`;
    playerEl.style.color = color;
    banner.style.borderColor = color;
    numberEl.textContent = `Turno ${match.turn}`;
  }

  private updatePlayerHUD(
    slot: 'p1' | 'p2' | 'p3' | 'p4',
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
      if (nameEl)
        nameEl.textContent = occ.name
          ? occ.name.toUpperCase()
          : this.state.labelFor(playerId).toUpperCase() || slot.toUpperCase();

      const avatarEl = document.getElementById(`hud-${slot}-avatar`) as HTMLImageElement | null;
      if (avatarEl && occ.name) avatarEl.src = this.state.pokeGifs[occ.name] ?? '';

      const trainerEl = document.getElementById(`hud-${slot}-trainer`) as HTMLImageElement | null;
      if (trainerEl) {
        let sprite = 'red';
        if (slot === 'p1') {
          const u = authState.user;
          sprite = u?.avatarUrl === 'boy' ? 'red' : u?.avatarUrl === 'girl' ? 'may' : (u?.avatarUrl || 'red');
        } else if (slot === 'p2') sprite = 'blue';
        else if (slot === 'p3') sprite = 'cynthia';
        else if (slot === 'p4') sprite = 'ethan';
        trainerEl.src = `https://play.pokemonshowdown.com/sprites/trainers/${sprite}.png`;
      }

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

      const teamEl = document.getElementById(`hud-${slot}-team`);
      if (teamEl && playerId) {
        const rightSide = slot === 'p2' || slot === 'p4';
        const team = this.state.match?.tiles
          .map((t) => t.occupant)
          .filter((p): p is NonNullable<typeof p> => !!p && p.playerId === playerId && p.id !== occ.id) ?? [];
        if (team.length === 0) {
          teamEl.innerHTML = '';
          teamEl.classList.add('hidden');
        } else {
          teamEl.classList.remove('hidden');
          // Píldoras horizontales que crecen (flex-1) para llenar el marco sin
          // dejar hueco. En P2/P4 se reflejan (sprite hacia el borde de pantalla).
          teamEl.innerHTML = team.map((p) => {
            const pPct = Math.max(0, Math.min(100, (p.hp / (p.maxHp || 1)) * 100));
            const barBg = pPct > 50 ? 'bg-green-500' : pPct > 20 ? 'bg-yellow-500' : 'bg-red-500';
            const spriteUrl = this.state.pokeGifs[p.name ?? ''] ?? '';
            return `
              <div data-poke-id="${p.id}" class="flex items-center gap-1.5 flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded px-1.5 py-1 shadow transition-transform hover:scale-105 cursor-pointer ${rightSide ? 'flex-row-reverse' : ''}" title="${p.name ?? 'Pokémon'} (${p.hp}/${p.maxHp})">
                <img src="${spriteUrl}" class="w-8 h-8 object-contain flex-shrink-0" style="image-rendering: pixelated;" />
                <div class="flex-1 min-w-0 h-2 bg-gray-900 rounded overflow-hidden border border-gray-700 flex ${rightSide ? 'justify-end' : ''}">
                  <div class="h-full ${barBg}" style="width: ${pPct}%;"></div>
                </div>
              </div>
            `;
          }).join('');
        }
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
      // El ganador puede ser un equipo ("player2 & player4") → nombres visibles.
      const label = match.winner
        .split(' & ')
        .map((p) => this.state.labelFor(p).toUpperCase())
        .join(' & ');
      text.textContent = `${label} gana la partida`;
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

  public appendChat(message: string): void {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'break-words leading-tight py-0.5 border-b border-gray-800 text-gray-200';
    div.innerHTML = `› ${this.escape(message)}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  private escape(s: string): string {
    return escapeHtml(s);
  }
}
