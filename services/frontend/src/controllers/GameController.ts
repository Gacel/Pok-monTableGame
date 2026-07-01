import { GameState } from '../models/GameState';
import { BoardView } from '../views/BoardView';
import { HUDView } from '../views/HUDView';
import { EntityView } from '../views/EntityView';
import { CombatView } from '../views/CombatView';
import { WsClient } from '../net/WsClient';
import type { WsMessage } from '../net/WsClient';
import type { Hex, MatchState, CombatAction } from '../models/Types';

/**
 * Capa CONTROLADOR (frontend): traduce input del usuario a peticiones al servidor
 * autoritativo y orquesta las vistas. No calcula reglas de juego.
 */
export class GameController {
  private state: GameState;
  private boardView: BoardView;
  private hudView: HUDView;
  private entityView: EntityView;
  private combatView: CombatView;
  private canvas: HTMLCanvasElement;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialCameraOffsetX = 0;
  private initialCameraOffsetY = 0;
  private hasDragged = false;
  private busy = false;
  private wsClient: WsClient | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = new GameState();
    this.boardView = new BoardView(this.canvas, this.state);
    this.hudView = new HUDView(this.state);
    this.entityView = new EntityView(this.state, this.boardView);
    this.combatView = new CombatView(this.state, (a) => this.sendCombatAction(a));

    this.state.subscribe(() => this.renderAll());
    this.setupEvents();
  }

  public async start(): Promise<void> {
    try {
      await this.boardView.preloadImages();
      const state = await this.fetchState();
      if (!state) throw new Error('No se pudo cargar el estado de la partida');

      this.centerCamera(state);
      await this.preloadSprites(state);
      this.state.setMatch(state);
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
    this.wsClient.connect();
  }

  private async onRealtimeMessage(msg: WsMessage): Promise<void> {
    if (msg.type === 'state' && msg.state) {
      const state = msg.state as MatchState;
      await this.preloadSprites(state);
      // No pisamos una selección local en curso si el estado no cambió de turno.
      this.state.setMatch(state);
      if (msg.combat) {
        const c = msg.combat as { winnerId?: string };
        this.hudView.flashToast(`Combate: gana ${String(c.winnerId ?? '').toUpperCase()}`, '#7c3aed');
      }
    } else if (msg.type === 'chat' && msg.text) {
      this.hudView.flashToast(`💬 ${msg.text}`, '#1d4ed8');
    }
  }

  private async fetchState(): Promise<MatchState | null> {
    const res = await fetch(`/api/game/state?t=${Date.now()}`);
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

  private async preloadSprites(state: MatchState): Promise<void> {
    const names = new Set<string>();
    for (const t of state.tiles) if (t.occupant?.name) names.add(t.occupant.name);
    await Promise.all(Array.from(names).map((n) => this.loadPokeSprite(n)));
  }

  private async loadPokeSprite(name: string): Promise<string | null> {
    if (this.state.pokeGifs[name]) return this.state.pokeGifs[name] ?? null;
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
      if (!res.ok) return null;
      const data = await res.json();
      const gifUrl =
        data.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default ||
        data.sprites?.front_default;
      const staticUrl = data.sprites?.front_default || gifUrl;
      if (!gifUrl) return null;
      this.state.pokeGifs[name] = gifUrl;
      this.state.pokeStatic[name] = staticUrl;
      return gifUrl;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  private renderAll(): void {
    this.boardView.render();
    this.entityView.render();
    this.hudView.render();
    this.combatView.render();
  }

  private async sendCombatAction(action: CombatAction): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await fetch('/api/game/combat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.state.setMatch(data.state as MatchState);
      } else {
        this.hudView.flashToast(data.error ?? 'Acción no válida');
      }
    } catch (err) {
      console.error(err);
      this.hudView.flashToast('Error de red');
    } finally {
      this.busy = false;
    }
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
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this.hasDragged = true;
        this.canvas.style.cursor = 'grabbing';
      }
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.state.setCameraOffset(
        this.initialCameraOffsetX + dx * scaleX,
        this.initialCameraOffsetY + dy * scaleY
      );
    };

    this.canvas.onmouseup = async (e) => {
      this.isDragging = false;
      this.canvas.style.cursor = 'default';
      if (!this.hasDragged) await this.handleCanvasClick(e);
    };

    this.canvas.onmouseleave = () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'default';
    };

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
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
  }

  private async handleCanvasClick(e: MouseEvent): Promise<void> {
    const match = this.state.match;
    // Durante el combate el tablero no acepta clics (se usa el menú de combate).
    if (!match || match.status !== 'active' || this.busy) return;

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

    // Si hay una pieza seleccionada y el destino está resaltado → ejecutar jugada.
    if (this.state.selectedHex && (this.state.isMoveTarget(hex) || this.state.isAttackTarget(hex))) {
      await this.performMove(this.state.selectedHex, hex);
      return;
    }

    // Selección: solo piezas del jugador de turno.
    if (clickedTile.occupant) {
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
      const res = await fetch(`/api/game/moves?q=${hex.q}&r=${hex.r}`);
      if (res.ok) this.state.moveOptions = await res.json();
    } catch (err) {
      console.error(err);
    }
  }

  private async performMove(from: Hex, to: Hex): Promise<void> {
    this.busy = true;
    try {
      const res = await fetch('/api/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.state.selectedHex = null;
        if (data.combat) {
          const c = data.combat;
          this.hudView.flashToast(`Combate: gana ${String(c.winnerId).toUpperCase()}`, '#7c3aed');
        }
        this.state.setMatch(data.state as MatchState);
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

  private async resetGame(): Promise<void> {
    this.busy = true;
    try {
      const res = await fetch('/api/game/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        this.state.selectedHex = null;
        await this.preloadSprites(data.state as MatchState);
        this.state.setMatch(data.state as MatchState);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.busy = false;
    }
  }
}
