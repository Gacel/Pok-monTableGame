import type { GameMode, LobbySummary, RoomInfo } from '@transcendence/shared';
import { apiFetch } from '../../net/api';
import { WsClient } from '../../net/WsClient';
import type { WsMessage } from '../../net/WsClient';

export interface LobbyCallbacks {
  onBack: () => void;
  /** Abre el draft online para elegir tu equipo en esta sala. */
  onDraft: (room: RoomInfo) => void;
  /** La sala está completa y con equipos: entrar a la partida. */
  onGameStart: (room: RoomInfo) => void;
}

const FONT = "font-family:'Press Start 2P',monospace;";
const POLL_MS = 3000;

/**
 * Capa VISTA: lobby ONLINE. Crear partida con nombre (anfitrión) o buscar
 * partida (lista de salas abiertas) y unirse. Tras crear/unirse pasa a la
 * sala de espera, sincronizada por WSS hasta que la partida arranca.
 */
export class LobbyView {
  private container: HTMLElement;
  private cb: LobbyCallbacks;

  private screen: 'browse' | 'waiting' = 'browse';
  private matches: LobbySummary[] = [];
  private room: RoomInfo | null = null;
  private capacity = 2;
  private gameMode: GameMode = 'ffa';
  private nameDraft = '';
  private errorMsg = '';

  private pollTimer: number | null = null;
  private ws: WsClient | null = null;
  private finished = false;

  constructor(container: HTMLElement, callbacks: LobbyCallbacks) {
    this.container = container;
    this.cb = callbacks;
  }

  public async render(): Promise<void> {
    await this.refreshList();
    this.draw();
    this.pollTimer = window.setInterval(async () => {
      if (this.screen === 'browse') {
        await this.refreshList();
        if (this.screen === 'browse') this.drawList();
      } else if (this.screen === 'waiting' && this.room) {
        // Respaldo del WS: aunque el socket falle, la sala avanza igualmente.
        await this.refreshRoom(this.room.id);
      }
    }, POLL_MS);
  }

  /** Limpieza al salir de la vista (cierra WS y detiene el polling). */
  public destroy(): void {
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.ws?.close();
    this.ws = null;
  }

  /** El draft confirmó equipo: refresca la sala de espera. */
  public setRoom(room: RoomInfo): void {
    this.applyRoom(room);
  }

  /**
   * Estado nuevo de la sala (WS, respuesta REST o polling): única puerta de
   * entrada. Si la partida ya está activa, se entra al tablero desde aquí.
   */
  private applyRoom(room: RoomInfo): void {
    if (this.finished) return;
    const mine = this.room?.youAre ?? null;
    this.room = { ...room, youAre: mine ?? room.youAre };
    if (this.room.status === 'active' || this.room.status === 'combat') {
      this.finished = true;
      this.destroy();
      this.cb.onGameStart(this.room);
      return;
    }
    if (this.screen === 'waiting') this.draw();
  }

  /** Pide la sala por REST (respaldo cuando el WS no entrega eventos). */
  private async refreshRoom(id: string): Promise<void> {
    try {
      const res = await apiFetch(`/api/lobby/matches/${id}`);
      if (res.status === 404) {
        // La sala ya no existe (anfitrión la cerró o caducó).
        this.onRoomMessage({ type: 'room_closed', matchId: id });
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.room) this.applyRoom(data.room as RoomInfo);
      }
    } catch {
      /* red caída: se reintenta en el siguiente tick */
    }
  }

  private async refreshList(): Promise<void> {
    try {
      const res = await fetch('/api/lobby/matches');
      if (res.ok) {
        const data = await res.json();
        this.matches = (data.matches ?? []) as LobbySummary[];
      }
    } catch {
      /* red caída: se reintenta en el siguiente tick */
    }
  }

  // ------------------------------------------------------------- acciones

  private async createRoom(): Promise<void> {
    this.errorMsg = '';
    const name = this.nameDraft.trim();
    if (!name) {
      this.errorMsg = 'Ponle un nombre a la partida';
      this.draw();
      return;
    }
    try {
      const res = await apiFetch('/api/lobby/matches', {
        method: 'POST',
        body: JSON.stringify({ name, capacity: this.capacity, gameMode: this.gameMode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        this.errorMsg = data.error ?? 'No se pudo crear la partida';
        this.draw();
        return;
      }
      this.enterRoom(data.room as RoomInfo);
    } catch {
      this.errorMsg = 'Error de red al crear la partida';
      this.draw();
    }
  }

  private async joinRoom(id: string): Promise<void> {
    this.errorMsg = '';
    try {
      const res = await apiFetch(`/api/lobby/matches/${id}/join`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        this.errorMsg = data.error ?? 'No se pudo entrar en la partida';
        await this.refreshList();
        this.draw();
        return;
      }
      this.enterRoom(data.room as RoomInfo);
    } catch {
      this.errorMsg = 'Error de red al unirse';
      this.draw();
    }
  }

  /** Crea el canal WSS de la sala y pasa a la pantalla de espera. */
  private enterRoom(room: RoomInfo): void {
    this.room = room;
    this.screen = 'waiting';
    this.ws?.close();
    this.ws = new WsClient((msg) => this.onRoomMessage(msg));
    this.ws.connect(room.id);
    this.draw();
    // Ambos (anfitrión e invitados) eligen equipo nada más entrar.
    this.cb.onDraft(room);
  }

  private onRoomMessage(msg: WsMessage): void {
    if (this.finished) return;
    if (msg.type === 'room' && msg.room) {
      this.applyRoom(msg.room);
    } else if (msg.type === 'room_closed') {
      this.room = null;
      this.screen = 'browse';
      this.errorMsg = 'El anfitrión ha cerrado la sala';
      this.ws?.close();
      this.ws = null;
      void this.refreshList().then(() => this.draw());
    }
  }

  private async cancelRoom(): Promise<void> {
    if (!this.room) return;
    try {
      await apiFetch(`/api/lobby/matches/${this.room.id}`, { method: 'DELETE' });
    } catch {
      /* la sala caducará sola */
    }
    this.leaveToBrowse();
  }

  private leaveToBrowse(): void {
    this.ws?.close();
    this.ws = null;
    this.room = null;
    this.screen = 'browse';
    void this.refreshList().then(() => this.draw());
  }

  // --------------------------------------------------------------- render

  private draw(): void {
    if (this.screen === 'waiting' && this.room) {
      this.drawWaiting(this.room);
    } else {
      this.drawBrowse();
    }
  }

  private frame(inner: string): string {
    return `
      <div class="transform scale-110 lg:scale-125 origin-center transition-transform">
        <div class="relative w-full max-w-2xl mx-auto p-1 bg-gray-900" style="border: 4px solid #fff; border-radius: 8px; box-shadow: 0 0 0 4px #000, 0 0 20px rgba(0,0,0,0.8);">
          <div class="bg-blue-900 border-4 border-black p-4 flex flex-col items-center min-h-[420px] relative" style="border-radius: 4px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
            ${inner}
          </div>
        </div>
      </div>`;
  }

  private modeLabel(mode: GameMode): string {
    return mode === 'teams' ? '2 VS 2' : 'FFA';
  }

  private drawBrowse(): void {
    if (this.capacity !== 4 && this.gameMode === 'teams') this.gameMode = 'ffa';

    const capBtn = (n: number) => `
      <button data-cap="${n}" class="cap-opt flex-1 py-2 text-[9px] rounded border-2 transition-all ${
        this.capacity === n
          ? 'bg-yellow-400 border-yellow-600 text-black font-bold'
          : 'bg-gray-100 border-gray-400 text-gray-700 hover:bg-gray-200'
      }" style="${FONT}">${n}</button>`;

    const modeBtn = (mode: GameMode, label: string, disabled: boolean) => `
      <button data-mode="${mode}" ${disabled ? 'disabled' : ''} class="mode-opt flex-1 py-2 text-[8px] rounded border-2 transition-all ${
        disabled
          ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
          : this.gameMode === mode
            ? 'bg-yellow-400 border-yellow-600 text-black font-bold'
            : 'bg-gray-100 border-gray-400 text-gray-700 hover:bg-gray-200'
      }" style="${FONT}">${label}</button>`;

    this.container.innerHTML = this.frame(`
      <div class="w-full max-w-lg flex flex-col gap-3 mt-2">
        <!-- Crear partida (anfitrión) -->
        <div class="bg-white border-4 border-gray-800 p-3 shadow-[4px_4px_0_#000] rounded-lg w-full">
          <h3 class="text-black text-[10px] mb-3 text-center border-b-2 border-gray-300 pb-2" style="${FONT}">CREAR PARTIDA · ANFITRIÓN</h3>
          <input id="room-name" maxlength="32" value="${this.escape(this.nameDraft)}" placeholder="Nombre de la partida…"
            class="w-full bg-gray-100 text-black text-[9px] px-3 py-2 rounded border-2 border-gray-400 focus:outline-none focus:border-yellow-500 mb-3" style="${FONT}" />
          <div class="flex gap-2 items-center mb-2">
            <span class="text-black text-[8px] w-24" style="${FONT}">JUGADORES</span>
            ${[2, 3, 4].map(capBtn).join('')}
          </div>
          <div class="flex gap-2 items-center mb-3">
            <span class="text-black text-[8px] w-24" style="${FONT}">MODO</span>
            ${modeBtn('ffa', '⚔️ TODOS CONTRA TODOS', false)}
            ${modeBtn('teams', '🤝 2 VS 2', this.capacity !== 4)}
          </div>
          <button id="btn-create" class="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-[10px] border-b-4 border-red-800 active:border-b-0 active:mt-1 transition-all rounded" style="${FONT} box-shadow: 0 4px 0 #000;">
            ▶ CREAR PARTIDA
          </button>
        </div>

        <!-- Buscar partida -->
        <div class="bg-white border-4 border-gray-800 p-3 shadow-[4px_4px_0_#000] rounded-lg w-full">
          <h3 class="text-black text-[10px] mb-2 text-center border-b-2 border-gray-300 pb-2" style="${FONT}">BUSCAR PARTIDA</h3>
          <div id="lobby-list" class="flex flex-col gap-2 max-h-40 overflow-y-auto"></div>
        </div>

        ${this.errorMsg ? `<p class="text-red-300 text-[8px] text-center" style="${FONT}">⚠ ${this.escape(this.errorMsg)}</p>` : ''}

        <button id="btn-back" class="text-white text-[9px] hover:text-yellow-300 underline self-start" style="${FONT}">◀ VOLVER</button>
      </div>
    `);

    this.drawList();

    const nameInput = document.getElementById('room-name') as HTMLInputElement | null;
    nameInput?.addEventListener('input', () => (this.nameDraft = nameInput.value));
    this.container.querySelectorAll<HTMLButtonElement>('.cap-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.capacity = Number(btn.dataset.cap);
        this.draw();
      });
    });
    this.container.querySelectorAll<HTMLButtonElement>('.mode-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.gameMode = (btn.dataset.mode === 'teams' ? 'teams' : 'ffa') as GameMode;
        this.draw();
      });
    });
    document.getElementById('btn-create')?.addEventListener('click', () => void this.createRoom());
    document.getElementById('btn-back')?.addEventListener('click', () => {
      this.destroy();
      this.cb.onBack();
    });
  }

  /** Repinta SOLO la lista (para el polling, sin perder el input del nombre). */
  private drawList(): void {
    const listEl = document.getElementById('lobby-list');
    if (!listEl) return;
    if (this.matches.length === 0) {
      listEl.innerHTML = `<p class="text-gray-500 text-[8px] text-center py-3" style="${FONT}">No hay partidas abiertas. ¡Crea la tuya!</p>`;
      return;
    }
    listEl.innerHTML = this.matches
      .map(
        (m) => `
        <div class="flex items-center justify-between gap-2 bg-gray-100 border-2 border-gray-400 rounded px-2 py-1.5">
          <div class="flex flex-col min-w-0">
            <span class="text-black text-[9px] font-bold truncate" style="${FONT}">${this.escape(m.name)}</span>
            <span class="text-gray-600 text-[7px] mt-0.5" style="${FONT}">👤 ${this.escape(m.hostName)} · ${this.modeLabel(m.gameMode)} · ${m.playerCount}/${m.capacity}</span>
          </div>
          <button data-join="${m.id}" class="join-btn flex-shrink-0 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-[8px] rounded border-b-2 border-green-800 active:border-b-0" style="${FONT}">
            UNIRSE ▶
          </button>
        </div>`
      )
      .join('');
    listEl.querySelectorAll<HTMLButtonElement>('.join-btn').forEach((btn) => {
      btn.addEventListener('click', () => void this.joinRoom(btn.dataset.join ?? ''));
    });
  }

  private drawWaiting(room: RoomInfo): void {
    const isHost = room.youAre === 'player1';
    const me = room.players.find((p) => p.slot === room.youAre);
    const rows = Array.from({ length: room.capacity }, (_, i) => {
      const slot = `player${i + 1}`;
      const p = room.players.find((x) => x.slot === slot);
      const you = room.youAre === slot ? ' (TÚ)' : '';
      const host = i === 0 ? ' 👑' : '';
      if (!p) {
        return `<div class="flex justify-between items-center bg-gray-100 border-2 border-dashed border-gray-400 rounded px-2 py-2">
          <span class="text-gray-400 text-[8px]" style="${FONT}">Esperando jugador…</span>
        </div>`;
      }
      return `<div class="flex justify-between items-center bg-gray-100 border-2 border-gray-400 rounded px-2 py-2">
        <span class="text-black text-[8px]" style="${FONT}">${this.escape(p.username)}${host}${you}</span>
        <span class="text-[8px] ${p.ready ? 'text-green-700' : 'text-yellow-600'}" style="${FONT}">${p.ready ? '✔ EQUIPO LISTO' : '… ELIGIENDO'}</span>
      </div>`;
    }).join('');

    this.container.innerHTML = this.frame(`
      <div class="w-full max-w-md flex flex-col gap-3 mt-4">
        <div class="bg-white border-4 border-gray-800 p-4 shadow-[4px_4px_0_#000] rounded-lg w-full">
          <h3 class="text-black text-[11px] mb-1 text-center" style="${FONT}">${this.escape(room.name)}</h3>
          <p class="text-gray-600 text-[7px] mb-3 text-center border-b-2 border-gray-300 pb-2" style="${FONT}">
            ${this.modeLabel(room.gameMode)} · ${room.players.length}/${room.capacity} jugadores
          </p>
          <div class="flex flex-col gap-2 mb-3">${rows}</div>
          <p class="text-black text-[7px] text-center bg-yellow-100 border border-yellow-400 rounded p-2 animate-pulse" style="${FONT}">
            ⏳ La partida empezará cuando todos tengan equipo
          </p>
        </div>

        <div class="flex gap-2">
          ${me && !me.ready ? `<button id="btn-pick-team" class="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white text-[9px] rounded border-b-4 border-green-800 active:border-b-0" style="${FONT}">🎒 ELEGIR EQUIPO</button>` : ''}
          ${
            isHost
              ? `<button id="btn-cancel-room" class="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white text-[9px] rounded border-b-4 border-red-900 active:border-b-0" style="${FONT}">✖ CERRAR SALA</button>`
              : `<button id="btn-leave-room" class="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-[9px] rounded border-b-4 border-gray-900 active:border-b-0" style="${FONT}">◀ SALIR</button>`
          }
        </div>
      </div>
    `);

    document.getElementById('btn-pick-team')?.addEventListener('click', () => {
      if (this.room) this.cb.onDraft(this.room);
    });
    document.getElementById('btn-cancel-room')?.addEventListener('click', () => void this.cancelRoom());
    document.getElementById('btn-leave-room')?.addEventListener('click', () => this.leaveToBrowse());
  }

  private escape(s: string): string {
    return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] ?? c);
  }
}
