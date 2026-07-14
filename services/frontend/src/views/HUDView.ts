import { GameState } from '../models/GameState';
import type { Tile, PlayerResources, MatchState, BallKey } from '../models/Types';
import { BALL_SPRITE, BALL_LABEL } from '@transcendence/shared';
import { authState } from '../auth/AuthState';
import { escapeHtml } from '../utils/html';

/** Sprites de bolas (bitmap PokeAPI). */
const BALL_ITEMS = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
const ballSpriteUrl = (b: BallKey): string => `${BALL_ITEMS}/${BALL_SPRITE[b]}.png`;

/**
 * Icono representativo por TIPO para los botones de ataque (barra QWER) — TA.5.
 * Provisional con emoji; el arte definitivo (iconos estilo LoL, imagen de referencia
 * aportada por el usuario) se dejará en `public/assets/icons/{tipo}.png` y sustituirá
 * a estos emojis en un follow-up.
 */
const MOVE_TYPE_EMOJI: Record<string, string> = {
  FIRE: '🔥', WATER: '💧', GRASS: '🌿', ELECTRIC: '⚡', ICE: '❄️', FIGHTING: '🥊',
  POISON: '☠️', GROUND: '⛰️', FLYING: '🪽', PSYCHIC: '🔮', BUG: '🐛', ROCK: '🪨',
  GHOST: '👻', DRAGON: '🐉', STEEL: '⚙️', FAIRY: '✨', NORMAL: '⭐',
};

/** Capa VISTA (frontend): pinta el HUD a partir del estado del servidor. */
export class HUDView {
  private state: GameState;
  private toastTimer: number | null = null;
  private deploymentTimerId: number | null = null;

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
    this.updateActionPanel();
  }

  private updateActionPanel(): void {
    const panel = document.getElementById('action-panel');
    if (!panel) return;

    const match = this.state.match;
    const selectedHex = this.state.selectedHex;
    
    if (!match) {
      panel.classList.add('hidden');
      return;
    }

    if (match.status === 'deployment') {
      this.renderDeploymentPanel(panel, match);
      return;
    }

    if (!selectedHex) {
      panel.classList.add('hidden');
      return;
    }

    const tile = match.tiles.find((t) => t.hex.q === selectedHex.q && t.hex.r === selectedHex.r);
    const occ = tile?.occupant;

    // Solo mostramos si es del jugador actual y es su turno
    if (!occ || occ.playerId !== match.currentPlayer) {
      panel.classList.add('hidden');
      return;
    }

    const isMe = this.state.mySlot === null || this.state.mySlot === match.currentPlayer;
    if (!isMe) {
      panel.classList.add('hidden');
      return;
    }

    const moves = occ.moves ?? [];
    if (moves.length === 0) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    
    const keys = ['Q', 'W', 'E', 'R'];
    panel.innerHTML = moves.slice(0, 4).map((m, i) => {
      const typeColor = this.getTypeColor(m.type);
      const isActive = this.state.activeMoveIndex === i;
      const borderStyle = isActive ? `border-color: #fff; box-shadow: 0 0 10px ${typeColor}; scale: 1.1;` : `border-color: ${typeColor};`;
      
      // Icono principal: representativo del TIPO; badge secundario: clase (físico/especial/estado).
      const typeEmoji = MOVE_TYPE_EMOJI[m.type] ?? '⭐';
      const classIcon = m.damageClass === 'special' ? '🔮' : m.damageClass === 'status' ? '🛡️' : '⚔️';
      const moveName = m.displayName ? m.displayName.toUpperCase() : m.name.toUpperCase();
      
      const typeTranslations: Record<string, string> = {
        FIRE: 'FUEGO', WATER: 'AGUA', GRASS: 'PLANTA', ELECTRIC: 'ELÉCTRICO',
        ICE: 'HIELO', FIGHTING: 'LUCHA', POISON: 'VENENO', GROUND: 'TIERRA',
        FLYING: 'VOLADOR', PSYCHIC: 'PSÍQUICO', BUG: 'BICHO', ROCK: 'ROCA',
        GHOST: 'FANTASMA', DRAGON: 'DRAGÓN', STEEL: 'ACERO', FAIRY: 'HADA', NORMAL: 'NORMAL'
      };
      const translatedType = typeTranslations[m.type] || m.type;

      return `
        <div class="move-btn flex flex-col items-center justify-center p-2 rounded cursor-pointer border-2 transition-transform hover:scale-105 active:scale-95 w-28 h-28" style="background-color: ${typeColor}40; ${borderStyle}" data-move-idx="${i}" title="Power: ${m.power || '-'} | Acc: ${m.accuracy || '-'} | Range: ${m.range || 1} | AoE: ${m.aoe || 'single'}">
          <span class="text-white text-[8px] font-bold mb-1" style="font-family: 'Press Start 2P', monospace;">[${keys[i]}]</span>
          <div class="relative text-3xl leading-none mb-1">${typeEmoji}<span class="absolute -bottom-1 -right-2 text-[11px]">${classIcon}</span></div>
          <span class="text-white text-[10px] font-bold text-center leading-tight overflow-hidden text-ellipsis" style="font-family: 'Press Start 2P', monospace; max-width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${moveName}</span>
          <span class="text-gray-300 text-[8px] mt-1 text-center">${translatedType}</span>
        </div>
      `;
    }).join('');
  }

  private renderDeploymentPanel(panel: HTMLElement, match: NonNullable<GameState['match']>): void {
    const isMe = this.state.mySlot === null || this.state.mySlot === match.currentPlayer;
    if (!isMe) {
      panel.classList.add('hidden');
      return;
    }

    const myReserve = match.reserve?.[match.currentPlayer] ?? [];
    if (myReserve.length === 0) {
      panel.classList.remove('hidden');
      panel.innerHTML = `
        <button id="ready-btn" class="px-6 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg border-2 border-green-400 transition-transform hover:scale-105 active:scale-95" style="font-family: 'Press Start 2P', monospace;">
          ¡LISTO!
        </button>
      `;
      return;
    }

    panel.classList.remove('hidden');
    
    panel.innerHTML = myReserve.map((p) => {
      const typeColor = this.getTypeColor(p.type);
      const isActive = this.state.selectedReserveId === p.id;
      const borderStyle = isActive ? `border-color: #fff; box-shadow: 0 0 10px ${typeColor}; scale: 1.1;` : `border-color: ${typeColor};`;
      const spriteUrl = this.state.pokeGifs[p.name ?? ''] ?? '';
      
      return `
        <div class="reserve-btn flex flex-col items-center justify-center p-2 rounded cursor-pointer border-2 transition-transform hover:scale-105 active:scale-95 min-w-[120px] h-28" style="background-color: ${typeColor}40; ${borderStyle}" data-reserve-id="${p.id}" title="Desplegar a ${p.name}">
          <img src="${spriteUrl}" class="w-12 h-12 object-contain mb-1" style="image-rendering: pixelated;" />
          <span class="text-white text-[8px] font-bold text-center w-full break-words" style="font-family: 'Press Start 2P', monospace; line-height: 1.2;">${(p.name??'').toUpperCase()}</span>
          <span class="text-gray-300 text-[8px] mt-1 text-center">${p.type.toUpperCase()}</span>
        </div>
      `;
    }).join('');

    // Attach event listeners manually (since it's dynamically rendered, we let GameController handle clicks, or we dispatch an event here)
    // GameController listens to clicks on the document, but it's better if HUDView dispatches a custom event for reserve selection.
    // Wait, GameController.ts uses data-move-idx, we can use a similar approach in GameController.ts to listen to data-reserve-id clicks.
  }

  private getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
      grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
      ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
      rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705898',
      steel: '#B7B7CE', fairy: '#D685AD'
    };
    return colors[type.toLowerCase()] || '#A8A77A';
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
    
    if (match.status === 'deployment') {
      playerEl.textContent = isMe ? `TU TURNO · FASE DE DESPLIEGUE` : `FASE DE DESPLIEGUE`;
      playerEl.style.color = '#fff';
      banner.style.borderColor = '#fff';
      this.startDeploymentTimer(numberEl, match.deploymentDeadline);
    } else {
      this.stopDeploymentTimer();
      playerEl.textContent = isMe ? `TU TURNO · ${label}` : `TURNO: ${label}`;
      playerEl.style.color = color;
      banner.style.borderColor = color;
      numberEl.textContent = `Turno ${match.turn}`;
    }
  }

  private startDeploymentTimer(el: HTMLElement, deadline: number | undefined): void {
    if (this.deploymentTimerId !== null) window.clearInterval(this.deploymentTimerId);
    if (!deadline) {
      el.textContent = '42s';
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      el.textContent = `Tiempo: ${remaining}s`;
      if (remaining === 0) this.stopDeploymentTimer();
    };
    update();
    this.deploymentTimerId = window.setInterval(update, 1000);
  }

  private stopDeploymentTimer(): void {
    if (this.deploymentTimerId !== null) {
      window.clearInterval(this.deploymentTimerId);
      this.deploymentTimerId = null;
    }
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
    logEl.innerHTML = lines
      .map((l) => `<div>› ${this.escape(this.prettifyPlayers(l))}</div>`)
      .join('');
  }

  /** Sustituye los identificadores de slot (player1..4) por el nombre/login visible. */
  private prettifyPlayers(line: string): string {
    return line.replace(/player[1-4]/g, (slot) => this.state.labelFor(slot));
  }

  private updateWinOverlay(): void {
    const match = this.state.match;
    const overlay = document.getElementById('win-overlay');
    const text = document.getElementById('win-text');
    if (!match || !overlay || !text) return;
    const rewardsEl = document.getElementById('win-rewards');
    if (match.status === 'finished' && match.winner) {
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
      // El ganador puede ser un equipo ("player2 & player4") → nombres visibles.
      const winners = match.winner.split(' & ');
      const label = winners.map((p) => this.state.labelFor(p).toUpperCase()).join(' & ');
      text.textContent = `${label} gana la partida`;
      if (rewardsEl) rewardsEl.innerHTML = this.rewardSummaryHtml(match, winners);
    } else {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
      if (rewardsEl) rewardsEl.innerHTML = '';
    }
  }

  /** Resumen "lo que TE llevas" para el jugador local, si está entre los ganadores. */
  private rewardSummaryHtml(match: MatchState, winners: string[]): string {
    const slot = this.state.mySlot ?? 'player1'; // local hot-seat / vs IA: el usuario es P1
    if (!winners.includes(slot)) return '';
    const kos = match.kos?.[slot] ?? 0;
    const losers = Math.max(0, match.players.length - winners.length);
    const winShare = winners.length > 0 ? Math.floor((1000 * losers) / winners.length) : 0;
    const koCoins = 500 * kos;
    const balls = match.rewards?.find((r) => r.slot === slot)?.balls ?? [];
    const ballsHtml = balls.length
      ? balls
          .map(
            (b) =>
              `<img src="${ballSpriteUrl(b)}" title="${BALL_LABEL[b]}" class="w-7 h-7 object-contain" style="image-rendering:pixelated;" />`
          )
          .join('')
      : `<span class="text-gray-400" style="font-size:9px;">—</span>`;
    const F = "font-family:'Press Start 2P',monospace;";
    return `
      <div class="text-left mx-auto bg-black/30 rounded p-3" style="width:min(360px,86vw);">
        <div class="text-yellow-300 mb-2 text-center" style="${F} font-size:9px;">TE LLEVAS</div>
        <div class="flex justify-between items-center gap-4 text-white" style="font-size:11px; white-space:nowrap;"><span>500 × ${kos} KO</span><span class="flex-shrink-0">🪙 ${koCoins}</span></div>
        <div class="flex justify-between items-center gap-4 text-white mt-1" style="font-size:11px; white-space:nowrap;"><span>Botín de victoria</span><span class="flex-shrink-0">🪙 ${winShare}</span></div>
        <div class="flex items-center gap-1.5 mt-2 flex-wrap"><span class="text-white" style="font-size:11px;">Bolas:</span>${ballsHtml}</div>
      </div>`;
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
