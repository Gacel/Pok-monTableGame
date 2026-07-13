import { GameState } from '../models/GameState';
import { getSpritePair } from '../net/PokeSprites';
import { BoardView } from '../views/BoardView';
import { HUDView } from '../views/HUDView';
import { EntityView } from '../views/EntityView';
import { MinimapView } from '../views/MinimapView';
import { FxLayer } from '../utils/fx';
import { WsClient } from '../net/WsClient';
import type { WsMessage } from '../net/WsClient';
import { apiFetch } from '../net/api';
import { MatchSession } from '../state/MatchSession';
import type { OnlineSession } from '../state/MatchSession';
import type { Hex, MatchState, Pokemon, BallKey } from '../models/Types';
import { BALL_SPRITE, BALL_LABEL } from '@transcendence/shared';
import { authState } from '../auth/AuthState';
import { decideBotAction } from './botStrategy';
import type { BotLevel, BotPieceOptions, EnemyPiece } from './botStrategy';

/**
 * Capa CONTROLADOR (frontend): traduce input del usuario a peticiones al servidor
 * autoritativo y orquesta las vistas. No calcula reglas de juego.
 */
export class GameController {
  private state: GameState;
  private boardView: BoardView;
  private hudView: HUDView;
  private entityView: EntityView;
  private minimapView: MinimapView;
  private fxLayer: FxLayer;
  private canvas: HTMLCanvasElement;
  /** Firma del último lote de eventos despachado (dedup HTTP resp + eco WS). */
  private lastEventsSig = '';

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialCameraOffsetX = 0;
  private initialCameraOffsetY = 0;
  private hasDragged = false;
  private busy = false;
  private wsClient: WsClient | null = null;
  private cameraAnimId: number | null = null;
  /** Direcciones de paneo de cámara activas (teclas mantenidas: flechas / WASD). */
  private panKeys = new Set<string>();
  private panAnimId: number | null = null;
  /** Sesión de partida ONLINE (matchId + slot propio); null en local hot-seat. */
  private session: OnlineSession | null = null;
  /** Slots controlados por la IA (solo local): slot → nivel (1/2/3). */
  private bots: Record<string, BotLevel> = {};
  private botTimer: number | null = null;
  private botActionCount = 0;
  private botTurnKey = '';
  /** Coalescido de render: varias mutaciones en un frame → un solo repintado. */
  private renderScheduled = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = new GameState();
    this.boardView = new BoardView(this.canvas, this.state);
    this.hudView = new HUDView(this.state);
    this.entityView = new EntityView(this.state, this.boardView);
    this.minimapView = new MinimapView(this.state, this.boardView, this.canvas);
    this.fxLayer = new FxLayer(this.state, this.boardView);

    // Coalescido: el estado notifica en cada mutación (incluida la cámara en cada
    // mousemove del pan). En vez de repintar de forma síncrona por cada notify,
    // agrupamos en un único render por frame → sin tirones al arrastrar/zoom.
    this.state.subscribe(() => this.scheduleRender());
    this.setupEvents();
    this.setupKeyboardShortcuts();
    this.setupHUDListeners();
    this.setupActionPanelListeners();
  }

  /**
   * Configura la partida a controlar: null = local hot-seat (rutas clásicas);
   * OnlineSession = partida de sala con identidad y turno propio.
   */
  public setSession(session: OnlineSession | null): void {
    this.session = session;
    this.state.mySlot = session?.mySlot ?? null;
    // Los jugadores se nombran por su login, no como "PlayerX". Online: el
    // username de cada slot. Local (hot-seat): P1 es el usuario logueado y el
    // resto "Jugador N" (no hay más logins en una sola máquina).
    if (session) {
      this.state.playerNames = session.playerNames ?? {};
    } else {
      const me = authState.user?.username;
      this.state.playerNames = {
        player1: me && me.trim() ? me : 'Jugador 1',
        player2: 'Jugador 2',
        player3: 'Jugador 3',
        player4: 'Jugador 4',
      };
    }
    // El socket anterior apuntaba a otra sala: se reconecta al entrar.
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    // Online no hay reinicio manual; la revancha vuelve al menú.
    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) resetBtn.style.display = session ? 'none' : '';
    const rematchBtn = document.getElementById('btn-rematch');
    if (rematchBtn) rematchBtn.textContent = session ? 'VOLVER AL MENÚ' : 'REVANCHA';
    // Online: la "revancha" ya lleva al menú → sobra el botón MENÚ extra.
    const winMenuBtn = document.getElementById('btn-win-menu');
    if (winMenuBtn) winMenuBtn.style.display = session ? 'none' : '';
  }

  /** Configura los slots controlados por la IA (solo local). */
  public setBots(bots: Record<string, BotLevel> | null): void {
    this.bots = bots ?? {};
    // Bautiza a los slots de IA (se llama tras setSession, que fija los nombres por
    // defecto). El nombre representa que el oponente NO es humano; el número
    // desambigua cuando hay varias IAs (FFA).
    const slots = Object.keys(this.bots);
    for (const slot of slots) {
      const n = slot.replace('player', '');
      this.state.playerNames[slot] = slots.length > 1 ? `IA ${n}` : 'IA';
    }
  }

  private isBotSlot(slot: string): boolean {
    return !this.session && !!this.bots[slot];
  }

  private isEnemySlot(a: string, b: string): boolean {
    if (a === b) return false;
    const alliances = this.state.match?.alliances;
    if (alliances) return !alliances.some((team) => team.includes(a) && team.includes(b));
    return true;
  }

  /**
   * Si es el turno (o el turno de combate) de un bot, programa su acción con una
   * pequeña pausa para que se vea el juego. Se re-invoca tras cada cambio de estado.
   */
  private maybeRunBot(): void {
    // OJO: NO se comprueba `this.busy` aquí. maybeRunBot se invoca desde
    // applyMatchState, que corre DENTRO de la ventana busy=true (el finally que
    // libera busy va después). El retardo de scheduleBot (650ms) garantiza que
    // busy ya esté libre cuando se ejecute la acción; el guard botTimer evita
    // dobles programaciones.
    if (this.session || this.botTimer !== null) return;
    const m = this.state.match;
    if (!m) return;

    if (m.status === 'active' && this.isBotSlot(m.currentPlayer)) {
      this.scheduleBot(() => this.runBotTurn());
    }
  }

  private scheduleBot(fn: () => void | Promise<void>): void {
    if (this.botTimer !== null) return;
    this.botTimer = window.setTimeout(() => {
      this.botTimer = null;
      void fn();
    }, 650);
  }

  /** Ejecuta UNA acción de tablero del bot de turno (mover, atacar o pasar). */
  private async runBotTurn(): Promise<void> {
    const m = this.state.match;
    if (!m || m.status !== 'active') return;
    const slot = m.currentPlayer;
    if (!this.isBotSlot(slot)) return;

    // Tope de seguridad: evita bucles si una acción no consume la pieza.
    const ownPieces = m.tiles.filter((t) => t.occupant && t.occupant.playerId === slot);
    if (this.botActionCount > ownPieces.length + 2) {
      await this.endTurn(true);
      return;
    }
    this.botActionCount++;

    const enemies: EnemyPiece[] = m.tiles
      .filter((t) => t.occupant && this.isEnemySlot(slot, t.occupant.playerId))
      .map((t) => ({ hex: t.hex, pokemon: t.occupant as Pokemon }));

    // Opciones por pieza que aún puede actuar.
    const pieces: BotPieceOptions[] = [];
    for (const t of ownPieces) {
      const occ = t.occupant as Pokemon;
      if (occ.hasActed) continue;
      const opts = await this.fetchOptions(t.hex);
      const attacks = opts.attacks
        .map((h) => {
          const tile = m.tiles.find((x) => x.hex.q === h.q && x.hex.r === h.r);
          return tile?.occupant ? { hex: h, target: tile.occupant as Pokemon } : null;
        })
        .filter((a): a is { hex: Hex; target: Pokemon } => a !== null);
      pieces.push({ from: t.hex, pokemon: occ, moves: opts.moves, attacks });
    }

    if (!pieces.length) {
      await this.endTurn(true);
      return;
    }

    // Lookup de bioma por hex (para que DIFÍCIL evite terreno malo / se retire).
    const biomeOf = (h: Hex) => m.tiles.find((t) => t.hex.q === h.q && t.hex.r === h.r)?.biome;
    const decision = decideBotAction(pieces, enemies, this.bots[slot] ?? 2, Math.random, biomeOf);
    if (decision.type === 'end') {
      await this.endTurn(true);
    } else {
      await this.performMove(decision.from, decision.to);
    }
  }

  /** Opciones de movimiento/ataque de una pieza SIN tocar el estado de la UI. */
  private async fetchOptions(hex: Hex): Promise<{ moves: Hex[]; attacks: Hex[] }> {
    try {
      const res = await apiFetch(this.apiPath(`/moves?q=${hex.q}&r=${hex.r}`));
      if (res.ok) return (await res.json()) as { moves: Hex[]; attacks: Hex[] };
    } catch {
      /* sin opciones */
    }
    return { moves: [], attacks: [] };
  }

  /** Prefijo REST según el modo: /api/game (local) o /api/game/<matchId>. */
  private apiPath(path: string): string {
    return this.session ? `/api/game/${this.session.matchId}${path}` : `/api/game${path}`;
  }

  /** ¿Puede este cliente actuar ahora? (online: solo en tu turno). */
  private isMyTurn(): boolean {
    const match = this.state.match;
    if (!match) return false;
    // Local: el turno se comparte en pantalla (hot-seat), PERO en el turno de un slot
    // controlado por la IA el humano no debe poder actuar ni pasar turno.
    if (!this.session) return !this.isBotSlot(match.currentPlayer);
    return match.currentPlayer === this.session.mySlot;
  }

  /**
   * Perspectiva de ocultación en LOCAL. Online (server censura) y hot-seat (pantalla
   * compartida) → null (sin ocultación en cliente). vs-IA → equipo humano: los
   * ocultos de la IA no se muestran; los del humano sí (translúcidos).
   */
  private updateStealthPerspective(): void {
    const match = this.state.match;
    if (this.session || !match || Object.keys(this.bots).length === 0) {
      this.state.hiddenAllySlots = null;
      return;
    }
    const humans = match.players.filter((p) => !this.bots[p]);
    this.state.hiddenAllySlots = match.players.filter((p) =>
      humans.some((h) => !this.isEnemySlot(h, p))
    );
  }

  private turnOwnerLabel(): string {
    const current = this.state.match?.currentPlayer ?? '';
    return this.state.labelFor(current).toUpperCase();
  }

  public async start(): Promise<void> {
    try {
      await this.boardView.preloadImages();
      const state = await this.fetchState();
      if (!state) throw new Error('No se pudo cargar el estado de la partida');

      this.centerCamera(state);
      await this.preloadSprites(state);
      this.applyMatchState(state, false);
      this.renderAll();
      this.connectRealtime();
    } catch (e) {
      console.error(e);
      this.hudView.flashToast('Error al cargar la partida');
    }
  }

  /** Sincronización en vivo: aplica el estado difundido por el servidor (WSS). */
  private connectRealtime(): void {
    if (this.wsClient) return;
    this.wsClient = new WsClient((msg: WsMessage) => this.onRealtimeMessage(msg));
    this.wsClient.connect(this.session?.matchId);
  }

  private async onRealtimeMessage(msg: WsMessage): Promise<void> {
    if (msg.type === 'state' && msg.state) {
      const state = msg.state as MatchState;
      await this.preloadSprites(state);
      // No pisamos una selección local en curso si el estado no cambió de turno.
      this.applyMatchState(state);
      if (msg.combat) {
        const c = msg.combat as { winnerId?: string };
        this.hudView.flashToast(`Combate: gana ${String(c.winnerId ?? '').toUpperCase()}`, '#7c3aed');
      }
    } else if (msg.type === 'chat' && msg.text) {
      this.hudView.flashToast(`💬 ${msg.text}`, '#1d4ed8');
      this.hudView.appendChat(msg.text);
    }
  }

  private async fetchState(): Promise<MatchState | null> {
    const res = await apiFetch(this.apiPath(`/state?t=${Date.now()}`));
    if (!res.ok) return null;
    return (await res.json()) as MatchState;
  }

  private centerCamera(state: MatchState): void {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const tile of state.tiles) {
      const p = this.boardView.hexToPixel(tile.hex.q, tile.hex.r);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const boardWidth = maxX - minX;
    const boardHeight = maxY - minY;
    const cx = this.canvas.width / 2 - (minX + boardWidth / 2) - 30;
    const cy = this.canvas.height / 2 - (minY + boardHeight / 2) + 40;
    this.state.setCameraOffset(cx, cy);
  }

  public centerOnTile(tile: { hex: Hex } | undefined, animate = true): void {
    if (this.cameraAnimId !== null) {
      cancelAnimationFrame(this.cameraAnimId);
      this.cameraAnimId = null;
    }

    if (!tile) {
      if (this.state.match) this.centerCamera(this.state.match);
      return;
    }
    const p = this.boardView.hexToPixel(tile.hex.q, tile.hex.r);
    const targetX = this.canvas.width / 2 - p.x - 30;
    const targetY = this.canvas.height / 2 - p.y + 40;

    if (!animate) {
      this.state.setCameraOffset(targetX, targetY);
      return;
    }

    const startX = this.state.cameraOffset.x;
    const startY = this.state.cameraOffset.y;
    const duration = 800;
    const startTime = performance.now();
    this.state.cameraMoving = true; // sprites sin transición mientras dura el centrado

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeInOutCubic: progress < 0.5 ? 4 * p^3 : 1 - (-2p + 2)^3 / 2
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const curX = startX + (targetX - startX) * ease;
      const curY = startY + (targetY - startY) * ease;
      // setCameraOffset ya programa el render (coalescido); no repintamos aquí
      // para no hacer doble trabajo por frame.
      this.state.setCameraOffset(curX, curY);
      if (progress < 1) {
        this.cameraAnimId = requestAnimationFrame(step);
      } else {
        this.cameraAnimId = null;
        this.state.cameraMoving = false;
      }
    };
    this.cameraAnimId = requestAnimationFrame(step);
  }

  private applyMatchState(newState: MatchState, animateCamera = true): void {
    const oldTurn = this.state.match?.turn;
    const oldPlayer = this.state.match?.currentPlayer;

    this.state.setMatch(newState);
    this.updateStealthPerspective();

    // Feedback visual: reproducir los eventos de la acción (T0.1). Se omite en la
    // carga inicial (sin `oldPlayer`) para no reproducir eventos viejos al entrar,
    // y se deduplica por firma: online, la respuesta HTTP y el eco WS difunden el
    // mismo estado (broadcastPersonalized incluye al actor).
    if (oldPlayer) this.dispatchEvents(newState);

    // Partida online terminada: la sesión ya no debe reanudarse tras un F5.
    if (this.session && newState.status === 'finished') {
      MatchSession.clear();
    }

    if (!oldPlayer || oldPlayer !== newState.currentPlayer || oldTurn !== newState.turn) {
      if (newState.status === 'deployment' && newState.deploymentZones) {
        const zones = newState.deploymentZones[newState.currentPlayer];
        if (zones && zones.length > 0) {
           let sumQ = 0, sumR = 0;
           for (const z of zones) { sumQ += z.q; sumR += z.r; }
           const centerQ = Math.round(sumQ / zones.length);
           const centerR = Math.round(sumR / zones.length);
           const centerTile = newState.tiles.find(t => t.hex.q === centerQ && t.hex.r === centerR) || newState.tiles.find(t => t.hex.q === zones[0].q && t.hex.r === zones[0].r);
           this.centerOnTile(centerTile, animateCamera && !!oldPlayer);
        }
      } else {
        const targetTile = this.state.getLastInteractedTile(newState.currentPlayer);
        this.centerOnTile(targetTile, animateCamera && !!oldPlayer);
      }
    }

    // Nuevo turno de partida → reinicia el tope de acciones del bot.
    const turnKey = `${newState.turn}:${newState.currentPlayer}`;
    if (turnKey !== this.botTurnKey) {
      this.botTurnKey = turnKey;
      this.botActionCount = 0;
    }
    this.maybeRunBot();
  }

  /**
   * Reproduce los eventos de feedback visual del DTO (T0.1) sobre el tablero. La
   * guarda por firma evita el doble disparo cuando el mismo estado llega dos veces
   * (respuesta HTTP + eco WS de `broadcastPersonalized`). Cada ticket de mecánica
   * añade su `case`; T0.4 solo cablea `damage` (prueba del pipeline).
   */
  private dispatchEvents(state: MatchState): void {
    const events = state.events;
    if (!events || events.length === 0) return;
    const sig = `${state.turn}|${state.currentPlayer}|${JSON.stringify(events)}`;
    if (sig === this.lastEventsSig) return;
    this.lastEventsSig = sig;

    for (const ev of events) {
      if (!ev.hex) continue;
      switch (ev.kind) {
        case 'damage':
          this.fxLayer.floatingNumber(ev.hex, String(ev.delta ?? 0), 'damage');
          break;
        // heal, reveal, knockback, dash, capture → sus tickets (T2.3, T1.2, T3.x, T8.5).
        default:
          break;
      }
    }
  }

  private async preloadSprites(state: MatchState): Promise<void> {
    const names = new Set<string>();
    for (const t of state.tiles) if (t.occupant?.name) names.add(t.occupant.name);
    if (state.reserve) {
      for (const playerReserve of Object.values(state.reserve)) {
        for (const p of playerReserve) if (p.name) names.add(p.name);
      }
    }
    await Promise.all(Array.from(names).map((n) => this.loadPokeSprite(n)));
  }

  private async loadPokeSprite(name: string): Promise<string | null> {
    if (this.state.pokeGifs[name]) return this.state.pokeGifs[name] ?? null;
    const { gif, static: staticUrl } = await getSpritePair(name);
    if (!gif) return null;
    this.state.pokeGifs[name] = gif;
    this.state.pokeStatic[name] = staticUrl;
    return gif;
  }

  /** Programa un repintado para el próximo frame (coalesce múltiples notify). */
  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      this.renderAll();
    });
  }

  private renderAll(): void {
    this.boardView.render();
    this.entityView.render();
    this.hudView.render();
    this.minimapView.render();
    this.updateTurnControls();
  }

  /**
   * Adapta los controles al jugador: "Finalizar turno" solo tiene sentido para
   * el jugador de turno. En online se OCULTA a los demás (no deben ver ni pulsar
   * el botón cuando no les toca); en local hot-seat se comparte pantalla, así
   * que permanece visible salvo durante el combate o al terminar la partida.
   */
  private updateTurnControls(): void {
    const btn = document.getElementById('btn-end-turn') as HTMLButtonElement | null;
    if (!btn) return;
    const match = this.state.match;
    const inMatch = match?.status === 'active';
    // Solo cuando este cliente puede actuar: online fuera de tu turno, y en local
    // durante el turno de la IA, el botón se oculta (isMyTurn ya lo distingue).
    btn.style.display = inMatch && this.isMyTurn() ? '' : 'none';
  }


  private setupEvents(): void {
    this.canvas.onmousedown = (e) => {
      this.isDragging = true;
      this.hasDragged = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.initialCameraOffsetX = this.state.cameraOffset.x;
      this.initialCameraOffsetY = this.state.cameraOffset.y;
    };

    this.canvas.onmousemove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      const hex = this.boardView.pixelToHex(
        mouseX,
        mouseY,
        this.state.cameraOffset.x,
        this.state.cameraOffset.y
      );
      
      if (!this.state.hoverHex || this.state.hoverHex.q !== hex.q || this.state.hoverHex.r !== hex.r) {
        this.state.hoverHex = hex;
        this.renderAll();
      }

      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this.hasDragged = true;
        this.canvas.style.cursor = 'grabbing';
      }

      // Arrastre de cámara: sprites sin transición para que no "bailen" (igual que el
      // paneo con teclado).
      this.state.cameraMoving = true;
      this.state.setCameraOffset(
        this.initialCameraOffsetX + dx * scaleX,
        this.initialCameraOffsetY + dy * scaleY
      );
    };

    this.canvas.onmouseup = async (e) => {
      this.isDragging = false;
      this.state.cameraMoving = false;
      this.canvas.style.cursor = 'default';
      if (!this.hasDragged) await this.handleCanvasClick(e);
    };

    this.canvas.onmouseleave = () => {
      this.isDragging = false;
      this.state.cameraMoving = false;
      this.canvas.style.cursor = 'default';
    };

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        // Al TERMINAR la partida el tablero queda bajo el overlay de victoria: el zoom
        // se bloquea para que no se "asome" el mapa. En despliegue y juego sí se permite.
        if (this.state.match && this.state.match.status === 'finished') return;
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        let newZoom = this.state.zoom + delta;
        if (newZoom < 0.3) newZoom = 0.3;
        if (newZoom > 2.5) newZoom = 2.5;
        this.state.setZoom(newZoom);
      },
      { passive: false }
    );

    document.getElementById('btn-reset')?.addEventListener('click', () => this.resetGame());
    document.getElementById('btn-rematch')?.addEventListener('click', () => this.resetGame());
    // "◀ MENÚ" en el overlay de victoria: aceptar y volver al menú (no forzar revancha).
    document.getElementById('btn-win-menu')?.addEventListener('click', () => this.exitToMenu());
    document.getElementById('btn-end-turn')?.addEventListener('click', () => this.endTurn());
    document.getElementById('btn-abandon')?.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que quieres abandonar la partida? (Esto equivaldrá a una derrota)')) {
        this.abandonGame();
      }
    });

    document.getElementById('chat-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input') as HTMLInputElement | null;
      if (input && input.value.trim() && this.wsClient) {
        this.wsClient.sendChat(input.value.trim());
        input.value = '';
      }
    });
  }

  private async handleCanvasClick(e: MouseEvent): Promise<void> {
    const match = this.state.match;
    // Durante el combate el tablero no acepta clics (se usa el menú de combate).
    if (!match || (match.status !== 'active' && match.status !== 'deployment') || this.busy) return;

    // Online: fuera de tu turno el tablero es de solo lectura.
    if (!this.isMyTurn() && match.status !== 'deployment') {
      this.hudView.flashToast(`Turno de ${this.turnOwnerLabel()}`);
      return;
    }
    
    // En fase de despliegue, también debes ser el jugador de turno o es local (todos los turnos permitidos al ser compartidos, pero el match.currentPlayer dicta quién despliega ahora)
    if (match.status === 'deployment') {
      const isMe = this.state.mySlot === null || this.state.mySlot === match.currentPlayer;
      if (!isMe) {
        this.hudView.flashToast(`Turno de despliegue de ${this.turnOwnerLabel()}`);
        return;
      }
    }

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const hex = this.boardView.pixelToHex(
      mouseX,
      mouseY,
      this.state.cameraOffset.x,
      this.state.cameraOffset.y
    );
    const clickedTile = this.state.currentTiles.find((t) => t.hex.q === hex.q && t.hex.r === hex.r);
    if (!clickedTile) {
      this.state.selectedHex = null;
      return;
    }

    if (match.status === 'deployment') {
      if (this.state.selectedReserveId) {
        const zones = match.deploymentZones?.[match.currentPlayer] ?? [];
        const valid = zones.some(z => z.q === hex.q && z.r === hex.r);
        if (valid) {
          await this.performDeploy(this.state.selectedReserveId, hex);
        } else {
          this.hudView.flashToast('Casilla fuera de tu zona de despliegue');
        }
      } else {
        this.hudView.flashToast('Selecciona un Pokémon de tu reserva abajo');
      }
      return;
    }

    // Si hay una pieza seleccionada y un movimiento activo (QWER), intentamos castear allí
    if (this.state.selectedHex && this.state.activeMoveIndex !== null) {
      await this.performCast(this.state.selectedHex, hex, this.state.activeMoveIndex);
      return;
    }

    // Si hay una pieza seleccionada y el destino está resaltado → ejecutar jugada normal.
    if (this.state.selectedHex && (this.state.isMoveTarget(hex) || this.state.isAttackTarget(hex))) {
      await this.performMove(this.state.selectedHex, hex);
      return;
    }

    // Selección: solo piezas del jugador de turno.
    if (clickedTile.occupant) {
      this.state.setLastInteractedPokemon(clickedTile.occupant.playerId, clickedTile.occupant.id);
      if (clickedTile.occupant.playerId === match.currentPlayer) {
        this.state.selectedHex = hex;
        await this.loadMoveOptions(hex);
      } else {
        this.hudView.flashToast('No es el turno de esa pieza');
        this.state.selectedHex = null;
      }
    } else {
      this.state.selectedHex = null;
    }
  }

  private async loadMoveOptions(hex: Hex): Promise<void> {
    try {
      const res = await apiFetch(this.apiPath(`/moves?q=${hex.q}&r=${hex.r}`));
      if (res.ok) this.state.moveOptions = await res.json();
    } catch (err) {
      console.error(err);
    }
  }

  private async performMove(from: Hex, to: Hex): Promise<void> {
    const movingOcc = this.state.currentTiles.find((t) => t.hex.q === from.q && t.hex.r === from.r)?.occupant;
    if (movingOcc) {
      this.state.setLastInteractedPokemon(movingOcc.playerId, movingOcc.id);
    }
    this.busy = true;
    try {
      const res = await apiFetch(this.apiPath('/move'), {
        method: 'POST',
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.state.selectedHex = null;
        if (data.combat) {
          const c = data.combat;
          this.hudView.flashToast(`Combate: gana ${String(c.winnerId).toUpperCase()}`, '#7c3aed');
        }
        this.applyMatchState(data.state as MatchState);
      } else {
        this.hudView.flashToast(data.error ?? 'Jugada inválida');
        this.state.selectedHex = null;
      }
    } catch (err) {
      console.error(err);
      this.hudView.flashToast('Error de red');
    } finally {
      this.busy = false;
    }
  }

  private async performForceStart(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await apiFetch(this.apiPath('/force-start'), {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.applyMatchState(data.state as MatchState);
      } else {
        this.hudView.flashToast(data.error ?? 'No se pudo iniciar la partida');
      }
    } catch (err) {
      console.error(err);
      this.hudView.flashToast('Error de red');
    } finally {
      this.busy = false;
    }
  }

  private async performDeploy(pokemonId: string, hex: Hex): Promise<void> {
    this.busy = true;
    try {
      const res = await apiFetch(this.apiPath('/deploy'), {
        method: 'POST',
        body: JSON.stringify({ pokemonId, hex }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.state.selectedReserveId = null;
        this.applyMatchState(data.state as MatchState, false); // no animar cámara en cada despliegue
      } else {
        this.hudView.flashToast(data.error ?? 'Error al desplegar');
      }
    } catch (err) {
      console.error(err);
      this.hudView.flashToast('Error de red');
    } finally {
      this.busy = false;
    }
  }

  private async performCast(from: Hex, to: Hex, moveIndex: number): Promise<void> {
    const movingOcc = this.state.currentTiles.find((t) => t.hex.q === from.q && t.hex.r === from.r)?.occupant;
    if (movingOcc) {
      this.state.setLastInteractedPokemon(movingOcc.playerId, movingOcc.id);
    }
    this.busy = true;
    try {
      const res = await apiFetch(this.apiPath('/cast'), {
        method: 'POST',
        body: JSON.stringify({ from, target: to, moveIndex }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.state.selectedHex = null;
        this.state.activeMoveIndex = null;
        this.applyMatchState(data.state as MatchState);
      } else {
        this.hudView.flashToast(data.error ?? 'Jugada inválida');
      }
    } catch (err) {
      console.error(err);
      this.hudView.flashToast('Error de red');
    } finally {
      this.busy = false;
    }
  }

  private async resetGame(): Promise<void> {
    // Online no hay revancha in situ: se limpia la sesión y se vuelve al menú.
    if (this.session) {
      MatchSession.clear();
      location.reload();
      return;
    }
    this.busy = true;
    try {
      const res = await apiFetch('/api/game/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        this.state.selectedHex = null;
        await this.preloadSprites(data.state as MatchState);
        this.applyMatchState(data.state as MatchState, false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.busy = false;
    }
  }

  private async endTurn(fromBot = false): Promise<void> {
    if (this.busy) return;
    // El bot pasa su propio turno (isMyTurn es falso en turno de IA); el humano no.
    if (!fromBot && !this.isMyTurn()) {
      this.hudView.flashToast(`Turno de ${this.turnOwnerLabel()}`);
      return;
    }
    this.busy = true;
    try {
      const res = await apiFetch(this.apiPath('/end-turn'), { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        this.state.selectedHex = null;
        this.applyMatchState(data.state as MatchState);
      } else {
        this.hudView.flashToast(data.error ?? 'Error al finalizar turno');
      }
    } catch (err) {
      console.error(err);
      this.hudView.flashToast('Error de red al pasar turno');
    } finally {
      this.busy = false;
    }
  }

  private async abandonGame(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await apiFetch(this.apiPath('/abandon'), { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        this.state.selectedHex = null;
        const state = data.state as MatchState;
        this.applyMatchState(state);
        // ARENA: si te llevas bolas al abandonar, muéstralas antes de salir.
        const slot = this.session?.mySlot ?? 'player1';
        const balls = state.rewards?.find((r) => r.slot === slot)?.balls ?? [];
        // Quien abandona sale SIEMPRE al menú principal (la partida sigue para
        // el resto en online; en local se cierra al volver al menú).
        if (balls.length) {
          this.showAbandonRewards(balls, () => this.exitToMenu());
        } else {
          this.exitToMenu();
        }
      } else {
        this.hudView.flashToast(data.error ?? 'Error al abandonar partida');
      }
    } catch (err) {
      console.error(err);
      this.hudView.flashToast('Error de red al abandonar');
    } finally {
      this.busy = false;
    }
  }

  /** Modal-resumen retro: bolas que te llevas al abandonar la ARENA. Al cerrar, `onClose`. */
  private showAbandonRewards(balls: BallKey[], onClose: () => void): void {
    const F = "font-family:'Press Start 2P',monospace;";
    const base = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
    const ballsHtml = balls
      .map(
        (b) =>
          `<img src="${base}/${BALL_SPRITE[b]}.png" title="${BALL_LABEL[b]}" class="w-10 h-10 object-contain" style="image-rendering:pixelated;" />`
      )
      .join('');
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[220] flex items-center justify-center p-4';
    overlay.style.background = 'rgba(0,0,0,0.75)';
    overlay.innerHTML = `
      <div class="relative bg-gray-900 w-full text-center" style="max-width:min(340px,94vw); border:6px solid #fff; border-radius:12px; box-shadow:0 0 0 6px #000, 0 0 40px rgba(0,0,0,0.85);">
        <div class="bg-blue-900 border-4 border-black" style="border-radius:6px; box-shadow:inset 0 0 30px rgba(0,0,0,0.6); padding:22px;">
          <h3 class="text-yellow-400 uppercase mb-3" style="${F} font-size:13px; text-shadow:2px 2px 0 #000;">TE LLEVAS</h3>
          <div class="flex items-center justify-center gap-2 flex-wrap mb-4">${ballsHtml}</div>
          <button id="ar-reward-ok" class="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded border-b-4 border-green-800 active:border-b-0" style="${F} font-size:11px;">RECOGER</button>
        </div>
      </div>`;
    const close = (): void => {
      overlay.remove();
      onClose();
    };
    overlay.querySelector('#ar-reward-ok')?.addEventListener('click', close);
    document.body.appendChild(overlay);
  }

  /** Cierra el socket, limpia la sesión y avisa a la SPA para volver al menú. */
  private exitToMenu(): void {
    MatchSession.clear();
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    document.dispatchEvent(new CustomEvent('return-to-menu'));
  }

  /** Mapea una tecla a una dirección de paneo de cámara (flechas / WASD), o null. */
  private panDirForKey(key: string): 'up' | 'down' | 'left' | 'right' | null {
    switch (key) {
      case 'ArrowUp': case 'w': case 'W': return 'up';
      case 'ArrowDown': case 's': case 'S': return 'down';
      case 'ArrowLeft': case 'a': case 'A': return 'left';
      case 'ArrowRight': case 'd': case 'D': return 'right';
      default: return null;
    }
  }

  /** Aplica un paso de paneo según las teclas mantenidas. */
  private panStep(): void {
    if (this.panKeys.size === 0) return;
    // Velocidad constante en pantalla: el offset se aplica en el espacio escalado,
    // así que se divide por el zoom (px/frame de pantalla ≈ constante).
    const step = 34 / this.state.zoom;
    let dx = 0;
    let dy = 0;
    if (this.panKeys.has('left')) dx += step;
    if (this.panKeys.has('right')) dx -= step;
    if (this.panKeys.has('up')) dy += step;
    if (this.panKeys.has('down')) dy -= step;
    this.state.setCameraOffset(this.state.cameraOffset.x + dx, this.state.cameraOffset.y + dy);
  }

  /** Bucle de paneo mientras haya teclas de dirección mantenidas. */
  private startPanLoop(): void {
    if (this.panAnimId !== null) return;
    // Cancela cualquier centrado animado en curso (el paneo manual manda).
    if (this.cameraAnimId !== null) {
      cancelAnimationFrame(this.cameraAnimId);
      this.cameraAnimId = null;
    }
    this.state.cameraMoving = true;
    // Primer paso inmediato: respuesta instantánea al pulsar (no espera al 1er frame).
    this.panStep();
    const loop = () => {
      if (this.panKeys.size === 0) {
        this.panAnimId = null;
        this.state.cameraMoving = false;
        return;
      }
      this.panStep();
      this.panAnimId = requestAnimationFrame(loop);
    };
    this.panAnimId = requestAnimationFrame(loop);
  }

  private setupKeyboardShortcuts(): void {
    let lastKey = '';
    let lastKeyTime = 0;

    // Soltar tecla / perder foco: liberar direcciones de paneo (evita que se queden pegadas).
    window.addEventListener('keyup', (e) => {
      const dir = this.panDirForKey(e.key);
      if (dir) this.panKeys.delete(dir);
    });
    window.addEventListener('blur', () => this.panKeys.clear());

    window.addEventListener('keydown', (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Paneo de cámara. Las flechas SIEMPRE panean. WASD panea solo cuando NO hay
      // pieza seleccionada: con pieza, Q/W/E/R son los hotkeys de movimiento, así que
      // WASD queda inhabilitado como bloque (coherente: si W no panea, A/S/D tampoco).
      const dir = this.panDirForKey(e.key);
      const isWasd = /^[wasd]$/i.test(e.key);
      if (dir && !(isWasd && this.state.selectedHex)) {
        e.preventDefault();
        this.panKeys.add(dir);
        this.startPanLoop();
        return;
      }

      const now = Date.now();
      if (e.key === lastKey && now - lastKeyTime < 400) {
        const match = this.state.match;
        if (match) {
          const tile = this.state.getLastInteractedTile(match.currentPlayer);
          this.centerOnTile(tile, true);
        }
        lastKey = '';
        lastKeyTime = 0;
      } else {
        const key = e.key.toUpperCase();
        if (['Q', 'W', 'E', 'R'].includes(key) && this.state.selectedHex) {
          const map: Record<string, number> = { Q: 0, W: 1, E: 2, R: 3 };
          this.state.activeMoveIndex = map[key];
        } else if (key === 'ESCAPE') {
          this.state.activeMoveIndex = null;
        }
        
        lastKey = e.key;
        lastKeyTime = now;
      }
    });
  }

  private setupHUDListeners(): void {
    const slots = ['p1', 'p2', 'p3', 'p4'] as const;
    slots.forEach((slot, i) => {
      const el = document.getElementById(`hud-${slot}`);
      if (el) {
        el.style.cursor = 'pointer';
        // Delegación: el HUD se repinta con innerHTML, así que en vez de atar un
        // listener por miniatura (que se perdería), se escucha en el contenedor y
        // se resuelve QUÉ Pokémon se clicó mirando su data-poke-id. Antes solo
        // funcionaba el Pokémon "resaltado" (activo); ahora responde cualquiera.
        el.addEventListener('click', (e) => {
          const match = this.state.match;
          const playerId = match?.players[i];
          if (!match || !playerId) return;
          const pill = (e.target as HTMLElement | null)?.closest('[data-poke-id]') as
            | HTMLElement
            | null;
          const pokeId = pill?.dataset.pokeId;
          if (pokeId) {
            const tile = this.state.currentTiles.find(
              (t) => t.occupant?.id === pokeId && t.occupant?.playerId === playerId
            );
            if (tile) {
              this.state.setLastInteractedPokemon(playerId, pokeId);
              this.centerOnTile(tile, true);
              return;
            }
          }
          this.centerOnTile(this.state.getLastInteractedTile(playerId), true);
        });
      }
    });
  }

  private setupActionPanelListeners(): void {
    const panel = document.getElementById('action-panel');
    if (panel) {
      panel.addEventListener('click', (e) => {
        const moveBtn = (e.target as HTMLElement).closest('.move-btn') as HTMLElement | null;
        if (moveBtn) {
          const idx = parseInt(moveBtn.dataset.moveIdx ?? '-1', 10);
          if (idx >= 0 && idx < 4) {
            this.state.activeMoveIndex = idx;
          }
          return;
        }
        
        const reserveBtn = (e.target as HTMLElement).closest('.reserve-btn') as HTMLElement | null;
        if (reserveBtn) {
          const resId = reserveBtn.dataset.reserveId;
          if (resId) {
            this.state.selectedReserveId = resId;
            this.renderAll(); // Fuerza a repintar el HUDView para mostrar la selección
          }
          return;
        }

        const readyBtn = (e.target as HTMLElement).closest('#ready-btn') as HTMLElement | null;
        if (readyBtn) {
          this.performForceStart();
          return;
        }
      });
    }
  }
}
