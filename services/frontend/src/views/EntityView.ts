import { GameState } from '../models/GameState';
import { BoardView } from './BoardView';


export class EntityView {
  private state: GameState;
  private boardView: BoardView;
  private entitiesLayer: HTMLElement | null;

  constructor(state: GameState, boardView: BoardView) {
    this.state = state;
    this.boardView = boardView;
    this.entitiesLayer = document.getElementById('entities-layer');
  }

  public render() {
    if (!this.entitiesLayer) return;

    // Durante el combate se muestra la escena de lucha (overlay): ocultamos los
    // sprites del tablero, que si no se colarían por encima (z-index dinámico alto).
    if (this.state.match?.status === 'combat') {
      this.entitiesLayer.style.display = 'none';
      return;
    }
    this.entitiesLayer.style.display = '';

    const sortedTiles = [...this.state.currentTiles].sort((a, b) => {
      const pA = this.boardView.hexToPixel(a.hex.q, a.hex.r);
      const pB = this.boardView.hexToPixel(b.hex.q, b.hex.r);
      return pA.y - pB.y;
    });

    const currentOccupantIds = new Set<string>();

    for (const tile of sortedTiles) {
      if (tile.occupant && tile.occupant.name && this.state.pokeGifs[tile.occupant.name]) {
          const occupantId = tile.occupant.id;
          currentOccupantIds.add(occupantId);
          
          const { x, y } = this.boardView.hexToPixel(tile.hex.q, tile.hex.r);
          let screenX = x + this.state.cameraOffset.x;
          let screenY = y + this.state.cameraOffset.y;
          
          // Apply zoom around center (same as Canvas)
          const cx = this.boardView.CENTER_X;
          const cy = this.boardView.CENTER_Y;
          screenX = (screenX - cx) * this.state.zoom + cx;
          screenY = (screenY - cy) * this.state.zoom + cy;

          const sSize = this.boardView.HEX_SIZE * 1.5 * this.state.zoom; 
          
          let img = document.getElementById(`img-${occupantId}`) as HTMLImageElement;
          if (!img) {
            img = document.createElement('img');
            img.id = `img-${occupantId}`;
            img.src = this.state.pokeGifs[tile.occupant.name];
            img.className = 'absolute';
            img.style.imageRendering = 'pixelated';
            img.style.transition = 'left 0.1s linear, top 0.1s linear';
            this.entitiesLayer.appendChild(img);
          }
          
          img.style.width = `${sSize}px`;
          img.style.height = `${sSize}px`;
          img.style.left = `${screenX - sSize/2}px`;
          img.style.top = `${screenY - sSize/1.1}px`;
          img.style.zIndex = Math.floor(screenY).toString();
          
          let label = document.getElementById(`lbl-${occupantId}`) as HTMLDivElement;
          if (!label) {
            label = document.createElement('div');
            label.id = `lbl-${occupantId}`;
            label.textContent = tile.occupant.playerId;
            label.className = 'absolute text-white font-bold drop-shadow-md';
            label.style.fontFamily = '"Press Start 2P", monospace';
            label.style.transform = 'translate(-50%, -100%)';
            label.style.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
            label.style.transition = 'left 0.1s linear, top 0.1s linear';
            this.entitiesLayer.appendChild(label);
          }
          
          label.style.fontSize = `${8 * this.state.zoom}px`;
          label.style.left = `${screenX}px`;
          label.style.top = `${screenY - sSize/1.1 - (10 * this.state.zoom)}px`;
          label.style.zIndex = Math.floor(screenY + 1).toString();
      }
    }
    
    Array.from(this.entitiesLayer.children).forEach(child => {
       const id = child.id.replace('img-', '').replace('lbl-', '');
       if (!currentOccupantIds.has(id)) {
           child.remove();
       }
    });
  }
}
