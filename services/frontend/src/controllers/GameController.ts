import { GameState } from '../models/GameState';
import { BoardView } from '../views/BoardView';
import { HUDView } from '../views/HUDView';
import { EntityView } from '../views/EntityView';

export class GameController {
  private state: GameState;
  private boardView: BoardView;
  private hudView: HUDView;
  private entityView: EntityView;
  private canvas: HTMLCanvasElement;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialCameraOffsetX = 0;
  private initialCameraOffsetY = 0;
  private hasDragged = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = new GameState();
    this.boardView = new BoardView(this.canvas, this.state);
    this.hudView = new HUDView(this.state);
    this.entityView = new EntityView(this.state, this.boardView);

    this.state.subscribe(() => this.renderAll());
    this.setupEvents();
  }

  public async start() {
    try {
      await this.boardView.preloadImages();

      const res = await fetch(`/api/game/board?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const initialTiles = await res.json();
      
      this.state.currentTiles = initialTiles;
      
      // Center camera
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const tile of initialTiles) {
        const p = this.boardView.hexToPixel(tile.hex.q, tile.hex.r);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const boardWidth = maxX - minX;
      const boardHeight = maxY - minY;
      
      const cx = (this.canvas.width / 2 - (minX + boardWidth / 2)) - 30;
      const cy = (this.canvas.height / 2 - (minY + boardHeight / 2)) + 40;
      this.state.setCameraOffset(cx, cy);

      // Preload pokemon images
      const pokeNames = new Set<string>();
      for (const t of initialTiles) {
         if (t.occupant?.name) pokeNames.add(t.occupant.name);
      }
      await Promise.all(Array.from(pokeNames).map(name => this.loadPokeSprite(name)));
      
      this.renderAll();

      const p = document.querySelector('p');
      if (p) {
          p.textContent = `Tablero RPG interactivo (${initialTiles.length} zonas).`;
          p.classList.remove('text-gray-300');
          p.classList.add('text-green-400');
      }
    } catch (e) {
      console.error(e);
    }
  }

  private async loadPokeSprite(name: string): Promise<string | null> {
    if (this.state.pokeGifs[name]) return this.state.pokeGifs[name];
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
      if (!res.ok) return null;
      const data = await res.json();
      
      const gifUrl = data.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default 
        || data.sprites?.front_default;
        
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

  private renderAll() {
    this.boardView.render();
    this.entityView.render();
    this.hudView.render();
  }

  private setupEvents() {
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
         this.initialCameraOffsetX + (dx * scaleX),
         this.initialCameraOffsetY + (dy * scaleY)
       );
    };

    this.canvas.onmouseup = async (e) => {
       this.isDragging = false;
       this.canvas.style.cursor = 'default';
       if (!this.hasDragged) {
           await this.handleCanvasClick(e);
       }
    };

    this.canvas.onmouseleave = () => {
       this.isDragging = false;
       this.canvas.style.cursor = 'default';
    };

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      let newZoom = this.state.zoom + delta;
      if (newZoom < 0.3) newZoom = 0.3;
      if (newZoom > 2.5) newZoom = 2.5;
      this.state.setZoom(newZoom);
    }, { passive: false });
  }

  private async handleCanvasClick(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    const hex = this.boardView.pixelToHex(mouseX, mouseY, this.state.cameraOffset.x, this.state.cameraOffset.y);
    const clickedTile = this.state.currentTiles.find(t => t.hex.q === hex.q && t.hex.r === hex.r);
    
    if (!clickedTile) {
      this.state.selectedHex = null;
      return;
    }
    
    if (this.state.selectedHex) {
      const selectedTile = this.state.currentTiles.find(t => t.hex.q === this.state.selectedHex!.q && t.hex.r === this.state.selectedHex!.r);
      if (selectedTile && selectedTile.occupant && !clickedTile.occupant) {
         const moveRes = await fetch('/api/game/move', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ from: this.state.selectedHex, to: hex })
         });
         if (moveRes.ok) {
           const data = await moveRes.json();
           this.state.selectedHex = null;
           this.state.currentTiles = data.board; 
         }
         return;
      }
    }
    
    if (clickedTile.occupant) {
      this.state.selectedHex = hex;
    } else {
      this.state.selectedHex = null;
    }
  }
}
