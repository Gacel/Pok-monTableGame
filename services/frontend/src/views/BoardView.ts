import { GameState } from '../models/GameState';
import type { Hex, Tile } from '../models/Types';

export class BoardView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;

  public readonly HEX_SIZE = 45;
  public readonly CENTER_X: number;
  public readonly CENTER_Y: number;

  private textures = {
    FIRE: new Image(),
    WATER: new Image(),
    GRASS: new Image(),
    SAND: new Image(),
    ICE: new Image()
  };

  private EDGE_DIRS: Hex[] = [
    { q: 1, r: 0 },   // right
    { q: 0, r: 1 },   // bottom-right
    { q: -1, r: 1 },  // bottom-left
    { q: -1, r: 0 },  // left
    { q: 0, r: -1 },  // top-left
    { q: 1, r: -1 },  // top-right
  ];

  /**
   * Geometría cacheada por REFERENCIA del array de tiles: orden de pintado (por Y,
   * painter's algorithm) con sus coordenadas de píxel precalculadas, y el mapa de
   * vecindad. Antes se reordenaba y remapeaba TODO en cada frame (con 2 hexToPixel
   * por comparación); ahora solo se recalcula cuando cambia el estado del tablero.
   */
  private geomCache: {
    tiles: Tile[];
    order: { tile: Tile; x: number; y: number }[];
    tileMap: Map<string, Tile>;
  } | null = null;

  private getGeom(): { order: { tile: Tile; x: number; y: number }[]; tileMap: Map<string, Tile> } {
    const tiles = this.state.currentTiles;
    if (this.geomCache && this.geomCache.tiles === tiles) return this.geomCache;
    const order = tiles.map((t) => {
      const p = this.hexToPixel(t.hex.q, t.hex.r);
      return { tile: t, x: p.x, y: p.y };
    });
    order.sort((a, b) => a.y - b.y);
    const tileMap = new Map<string, Tile>();
    for (const t of tiles) tileMap.set(`${t.hex.q},${t.hex.r}`, t);
    this.geomCache = { tiles, order, tileMap };
    return this.geomCache;
  }

  constructor(canvas: HTMLCanvasElement, state: GameState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.state = state;

    this.ctx.imageSmoothingEnabled = false;
    this.CENTER_X = canvas.width / 2;
    this.CENTER_Y = canvas.height / 2;

    this.textures.FIRE.src = '/assets/fire.png';
    this.textures.WATER.src = '/assets/water.png';
    this.textures.GRASS.src = '/assets/grass.png';
    this.textures.SAND.src = '/assets/sand.png';
    this.textures.ICE.src = '/assets/ice.png';
  }

  public async preloadImages() {
    const promises = Object.values(this.textures).map(img => {
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve; 
      });
    });
    await Promise.all(promises);
  }

  private getBiomeTexture(biome: string) {
    switch(biome) {
      case 'FIRE': return this.textures.FIRE;
      case 'WATER': return this.textures.WATER;
      case 'GRASS': return this.textures.GRASS;
      case 'SAND': return this.textures.SAND;
      case 'ICE': return this.textures.ICE;
      default: return this.textures.GRASS;
    }
  }

  public hexToPixel(q: number, r: number) {
    const isoScale = 0.55;
    const x = this.HEX_SIZE * Math.sqrt(3) * (q + r / 2);
    const y = this.HEX_SIZE * 3 / 2 * r * isoScale;
    return { x: x + this.CENTER_X, y: y + this.CENTER_Y };
  }

  public pixelToHex(x: number, y: number, offsetX: number, offsetY: number) {
    const isoScale = 0.55;
    const pX = (x - this.CENTER_X) / this.state.zoom - offsetX;
    const pY = (y - this.CENTER_Y) / this.state.zoom - offsetY;
    const unscaledY = pY / isoScale;
    const r = (unscaledY * 2) / (3 * this.HEX_SIZE);
    const q = pX / (this.HEX_SIZE * Math.sqrt(3)) - r / 2;
    return this.axialRound(q, r);
  }

  private axialRound(x: number, y: number) {
    const z = -x - y;
    let rx = Math.round(x);
    let ry = Math.round(y);
    const rz = Math.round(z);
    const xDiff = Math.abs(rx - x);
    const yDiff = Math.abs(ry - y);
    const zDiff = Math.abs(rz - z);
    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    } else if (yDiff > zDiff) {
      ry = -rx - rz;
    }
    return { q: rx, r: ry };
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  private drawBiomeTransitions(tile: Tile, cx: number, cy: number, tileMap: Map<string, Tile>) {
    const isoScale = 0.55;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const angle_rad = (Math.PI / 180) * (60 * i - 30);
      points.push({
        x: cx + this.HEX_SIZE * Math.cos(angle_rad),
        y: cy + this.HEX_SIZE * Math.sin(angle_rad) * isoScale,
      });
    }

    let needsDraw = false;
    for (let i = 0; i < 6; i++) {
      const d = this.EDGE_DIRS[i];
      const n = tileMap.get(`${tile.hex.q + d.q},${tile.hex.r + d.r}`);
      if (!n) continue;
      if (
        (tile.biome === 'WATER' && n.biome !== 'WATER') ||
        (tile.biome !== 'WATER' && n.biome === 'WATER')
      ) {
        needsDraw = true;
        break;
      }
    }
    if (!needsDraw) return;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < 6; i++) this.ctx.lineTo(points[i].x, points[i].y);
    this.ctx.closePath();
    this.ctx.clip();

    const fadeDepth = this.HEX_SIZE * 0.35;

    for (let edgeIdx = 0; edgeIdx < 6; edgeIdx++) {
      const d = this.EDGE_DIRS[edgeIdx];
      const neighbor = tileMap.get(`${tile.hex.q + d.q},${tile.hex.r + d.r}`);
      if (!neighbor) continue;

      const isWaterToLand = tile.biome === 'WATER' && neighbor.biome !== 'WATER';
      const isLandToWater = tile.biome !== 'WATER' && neighbor.biome === 'WATER';
      if (!isWaterToLand && !isLandToWater) continue;

      const v1 = points[edgeIdx];
      const v2 = points[(edgeIdx + 1) % 6];
      const edgeMidX = (v1.x + v2.x) / 2;
      const edgeMidY = (v1.y + v2.y) / 2;

      const toCX = cx - edgeMidX;
      const toCY = cy - edgeMidY;
      const dist = Math.sqrt(toCX * toCX + toCY * toCY);
      const nx = toCX / dist;
      const ny = toCY / dist;

      const grad = this.ctx.createLinearGradient(
        edgeMidX, edgeMidY,
        edgeMidX + nx * fadeDepth, edgeMidY + ny * fadeDepth
      );

      if (isWaterToLand) {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.50)');
        grad.addColorStop(0.35, 'rgba(200, 230, 255, 0.22)');
        grad.addColorStop(1, 'rgba(200, 230, 255, 0)');
      } else {
        grad.addColorStop(0, 'rgba(210, 180, 140, 0.50)');
        grad.addColorStop(0.30, 'rgba(194, 178, 128, 0.25)');
        grad.addColorStop(1, 'rgba(194, 178, 128, 0)');
      }

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.moveTo(v1.x, v1.y);
      this.ctx.lineTo(v2.x, v2.y);
      this.ctx.lineTo(v2.x + nx * fadeDepth, v2.y + ny * fadeDepth);
      this.ctx.lineTo(v1.x + nx * fadeDepth, v1.y + ny * fadeDepth);
      this.ctx.closePath();
      this.ctx.fill();

      const baseSeed = tile.hex.q * 1000 + tile.hex.r * 100 + edgeIdx;
      const count = isWaterToLand ? 6 : 8;

      for (let p = 0; p < count; p++) {
        const s = baseSeed + p * 7;
        const t = this.seededRandom(s) * 0.85 + 0.075;
        const inward = this.seededRandom(s + 13) * fadeDepth * 0.55;
        const px = v1.x + (v2.x - v1.x) * t + nx * inward;
        const py = v1.y + (v2.y - v1.y) * t + ny * inward;
        const r = isWaterToLand
          ? 1.2 + this.seededRandom(s + 19) * 2.2
          : 0.6 + this.seededRandom(s + 19) * 1.4;
        const alpha = 0.25 + this.seededRandom(s + 23) * 0.35;

        this.ctx.beginPath();
        this.ctx.arc(px, py, r, 0, Math.PI * 2);
        this.ctx.fillStyle = isWaterToLand
          ? `rgba(255, 255, 255, ${alpha})`
          : `rgba(194, 164, 108, ${alpha})`;
        this.ctx.fill();
      }
    }
    this.ctx.restore();
  }

  private drawHex(x: number, y: number, img?: HTMLImageElement) {
    const points = [];
    const isoScale = 0.55;
    for (let i = 0; i < 6; i++) {
      const angle_deg = 60 * i - 30;
      const angle_rad = Math.PI / 180 * angle_deg;
      points.push({ x: this.HEX_SIZE * Math.cos(angle_rad), y: this.HEX_SIZE * Math.sin(angle_rad) * isoScale });
    }

    const depth = 12; 
    this.ctx.beginPath();
    this.ctx.moveTo(x + points[1].x, y + points[1].y);
    this.ctx.lineTo(x + points[2].x, y + points[2].y);
    this.ctx.lineTo(x + points[3].x, y + points[3].y);
    this.ctx.lineTo(x + points[4].x, y + points[4].y);
    this.ctx.lineTo(x + points[4].x, y + points[4].y + depth);
    this.ctx.lineTo(x + points[3].x, y + points[3].y + depth);
    this.ctx.lineTo(x + points[2].x, y + points[2].y + depth);
    this.ctx.lineTo(x + points[1].x, y + points[1].y + depth);
    this.ctx.closePath();
    this.ctx.fillStyle = '#654321';
    this.ctx.fill();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = '#3e2723';
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(x + points[0].x, y + points[0].y);
    for (let i = 1; i < 6; i++) {
      this.ctx.lineTo(x + points[i].x, y + points[i].y);
    }
    this.ctx.closePath();

    if (img && img.complete && img.naturalHeight !== 0) {
      this.ctx.save();
      this.ctx.clip();
      const imgSize = this.HEX_SIZE * 2.5; 
      this.ctx.scale(1, isoScale);
      this.ctx.drawImage(img, x - imgSize / 2, y / isoScale - imgSize / 2, imgSize, imgSize);
      this.ctx.restore();
    } else {
      const fallback = img === this.textures.FIRE ? '#ef4444' : 
                       img === this.textures.WATER ? '#3b82f6' : 
                       img === this.textures.SAND ? '#eab308' : 
                       img === this.textures.ICE ? '#93c5fd' : '#22c55e';
      this.ctx.fillStyle = fallback;
      this.ctx.fill();
    }
    
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    this.ctx.stroke();
  }

  public render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const { order, tileMap } = this.getGeom();

    this.ctx.save();
    this.ctx.translate(this.CENTER_X, this.CENTER_Y);
    this.ctx.scale(this.state.zoom, this.state.zoom);
    this.ctx.translate(-this.CENTER_X, -this.CENTER_Y);
    this.ctx.translate(this.state.cameraOffset.x, this.state.cameraOffset.y);

    // Culling de viewport: solo dibujamos las casillas cuyo píxel cae dentro del
    // canvas (con margen para el alto del hex y su relieve). En ARENA (~5400
    // casillas) esto reduce los dibujados a las ~pocas cientos visibles.
    const z = this.state.zoom;
    const { x: offX, y: offY } = this.state.cameraOffset;
    const m = this.HEX_SIZE * 2;
    const minX = (0 - this.CENTER_X) / z + this.CENTER_X - offX - m;
    const maxX = (this.canvas.width - this.CENTER_X) / z + this.CENTER_X - offX + m;
    const minY = (0 - this.CENTER_Y) / z + this.CENTER_Y - offY - m;
    const maxY = (this.canvas.height - this.CENTER_Y) / z + this.CENTER_Y - offY + m;

    for (const { tile, x, y } of order) {
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      this.drawHex(x, y, this.getBiomeTexture(tile.biome));
      this.drawBiomeTransitions(tile, x, y, tileMap);

      const isSelected =
        this.state.selectedHex &&
        this.state.selectedHex.q === tile.hex.q &&
        this.state.selectedHex.r === tile.hex.r;

      if (isSelected) {
        this.drawTileOverlay(x, y, 'rgba(255, 255, 0, 0.4)', '#fff', 3);
      } else if (this.state.isAttackTarget(tile.hex)) {
        this.drawTileOverlay(x, y, 'rgba(239, 68, 68, 0.45)', '#fca5a5', 2, true);
      } else if (this.state.isMoveTarget(tile.hex)) {
        this.drawTileOverlay(x, y, 'rgba(34, 197, 94, 0.35)', '#86efac', 2, true);
      }
    }
    this.ctx.restore();
  }

  /** Dibuja un overlay hexagonal (selección / movimiento / ataque). */
  private drawTileOverlay(
    x: number,
    y: number,
    fill: string,
    stroke: string,
    lineWidth: number,
    dot = false
  ): void {
    const isoScale = 0.55;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const angle_rad = (Math.PI / 180) * (60 * i - 30);
      points.push({
        x: this.HEX_SIZE * Math.cos(angle_rad),
        y: this.HEX_SIZE * Math.sin(angle_rad) * isoScale,
      });
    }
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(x + points[0].x, y + points[0].y);
    for (let i = 1; i < 6; i++) this.ctx.lineTo(x + points[i].x, y + points[i].y);
    this.ctx.closePath();
    this.ctx.fillStyle = fill;
    this.ctx.fill();
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeStyle = stroke;
    this.ctx.stroke();
    if (dot) {
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, Math.PI * 2);
      this.ctx.fillStyle = stroke;
      this.ctx.fill();
    }
    this.ctx.restore();
  }
}
