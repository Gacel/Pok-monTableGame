import { GameState } from '../models/GameState';
import { BoardView } from './BoardView';
import type { Tile } from '../models/Types';

/**
 * Minimapa: dibuja todo el tablero a escala reducida, resalta la zona que se
 * está visualizando (viewport) y permite navegar haciendo clic. Reutiliza la
 * proyección hexToPixel de BoardView, de modo que se mantiene coherente con la
 * cámara y el zoom del canvas principal.
 */
export class MinimapView {
  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null;
  private state: GameState;
  private boardView: BoardView;
  private mainCanvas: HTMLCanvasElement;

  private readonly PAD = 8;

  // Caché de los límites del mapa (en espacio de píxeles de hexToPixel).
  private boundsCache: { tiles: Tile[]; minX: number; minY: number; w: number; h: number } | null =
    null;

  private static readonly BIOME_COLORS: Record<string, string> = {
    FIRE: '#e2523f',
    WATER: '#2f6fd0',
    GRASS: '#3f9b4f',
    SAND: '#d9c27a',
    ICE: '#bfe3f5',
  };

  /** Color de cada jugador (mismos que el HUD y el banner de turno). */
  private static readonly PLAYER_COLORS: Record<string, string> = {
    player1: '#3b82f6', // Azul
    player2: '#ef4444', // Rojo
    player3: '#a855f7', // Violeta
    player4: '#eab308', // Amarillo
  };

  constructor(state: GameState, boardView: BoardView, mainCanvas: HTMLCanvasElement) {
    this.state = state;
    this.boardView = boardView;
    this.mainCanvas = mainCanvas;
    this.canvas = document.getElementById('minimap') as HTMLCanvasElement | null;
    this.ctx = this.canvas?.getContext('2d') ?? null;
    if (this.canvas) {
      this.canvas.addEventListener('click', (e) => this.onClick(e));
    }
  }

  /** Límites del tablero en espacio de píxeles, cacheados por referencia de tiles. */
  private getBounds(tiles: Tile[]): { minX: number; minY: number; w: number; h: number } {
    if (this.boundsCache && this.boundsCache.tiles === tiles) return this.boundsCache;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const t of tiles) {
      const p = this.boardView.hexToPixel(t.hex.q, t.hex.r);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    // Margen de un hexágono para que las piezas del borde no queden cortadas.
    const m = this.boardView.HEX_SIZE;
    const bounds = {
      tiles,
      minX: minX - m,
      minY: minY - m,
      w: maxX - minX + m * 2,
      h: maxY - minY + m * 2,
    };
    this.boundsCache = bounds;
    return bounds;
  }

  /** Escala y desplazamiento para encajar el mapa dentro del minimapa (centrado). */
  private fit(b: { minX: number; minY: number; w: number; h: number }): {
    scale: number;
    offX: number;
    offY: number;
  } {
    const availW = this.canvas!.width - this.PAD * 2;
    const availH = this.canvas!.height - this.PAD * 2;
    const scale = Math.min(availW / b.w, availH / b.h);
    const offX = this.PAD + (availW - b.w * scale) / 2;
    const offY = this.PAD + (availH - b.h * scale) / 2;
    return { scale, offX, offY };
  }

  render(): void {
    if (!this.canvas || !this.ctx) return;
    const tiles = this.state.currentTiles;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (tiles.length === 0) return;

    const b = this.getBounds(tiles);
    const { scale, offX, offY } = this.fit(b);

    // Tiles como celdas pequeñas coloreadas por bioma.
    const cell = Math.max(2, this.boardView.HEX_SIZE * 1.9 * scale);
    for (const t of tiles) {
      const p = this.boardView.hexToPixel(t.hex.q, t.hex.r);
      const x = offX + (p.x - b.minX) * scale;
      const y = offY + (p.y - b.minY) * scale;
      ctx.fillStyle = MinimapView.BIOME_COLORS[t.biome] ?? '#3f9b4f';
      ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell);
    }

    // Piezas: cada Pokémon con el color de SU jugador (P1..P4).
    for (const t of tiles) {
      if (!t.occupant) continue;
      const p = this.boardView.hexToPixel(t.hex.q, t.hex.r);
      const x = offX + (p.x - b.minX) * scale;
      const y = offY + (p.y - b.minY) * scale;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, cell * 0.7), 0, Math.PI * 2);
      ctx.fillStyle = MinimapView.PLAYER_COLORS[t.occupant.playerId] ?? '#e5e7eb';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.fill();
      ctx.stroke();
    }

    // Recuadro del viewport visible actualmente en el canvas principal.
    const vp = this.worldViewport();
    const rx = offX + (vp.minX - b.minX) * scale;
    const ry = offY + (vp.minY - b.minY) * scale;
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, vp.w * scale, vp.h * scale);
    ctx.fillStyle = 'rgba(255, 255, 0, 0.10)';
    ctx.fillRect(rx, ry, vp.w * scale, vp.h * scale);
  }

  /**
   * Región del mundo (en espacio de píxeles de hexToPixel) visible en el canvas
   * principal, invirtiendo la transformación cámara/zoom de BoardView.render().
   */
  private worldViewport(): { minX: number; minY: number; w: number; h: number } {
    const cx = this.boardView.CENTER_X;
    const cy = this.boardView.CENTER_Y;
    const z = this.state.zoom;
    const off = this.state.cameraOffset;
    const minX = cx * (1 - 1 / z) - off.x;
    const minY = cy * (1 - 1 / z) - off.y;
    return { minX, minY, w: this.mainCanvas.width / z, h: this.mainCanvas.height / z };
  }

  /** Clic en el minimapa → centra la cámara del canvas principal en ese punto. */
  private onClick(e: MouseEvent): void {
    if (!this.canvas) return;
    const tiles = this.state.currentTiles;
    if (tiles.length === 0) return;

    const rect = this.canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
    const my = ((e.clientY - rect.top) / rect.height) * this.canvas.height;

    const b = this.getBounds(tiles);
    const { scale, offX, offY } = this.fit(b);
    const worldX = (mx - offX) / scale + b.minX;
    const worldY = (my - offY) / scale + b.minY;

    // camOff = CENTER − P hace que P aparezca en el centro del canvas (indep. del zoom).
    this.state.setCameraOffset(this.boardView.CENTER_X - worldX, this.boardView.CENTER_Y - worldY);
  }
}
