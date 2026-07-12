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

    // Durante el combate (escena de lucha) y al finalizar la partida (overlay de
    // VICTORIA) ocultamos los sprites del tablero: su z-index dinámico es alto
    // (basado en la Y de pantalla) y si no se colarían por encima del overlay.
    const status = this.state.match?.status;
    if (status === 'finished') {
      this.entitiesLayer.style.display = 'none';
      return;
    }
    this.entitiesLayer.style.display = '';

    // No hace falta ordenar por Y: el apilamiento lo da el z-index dinámico que se
    // fija por sprite (según su Y de pantalla). Ordenar las ~5400 casillas de ARENA
    // en cada frame (con 2 hexToPixel por comparación) era puro desperdicio.
    const currentOccupantIds = new Set<string>();

    for (const tile of this.state.currentTiles) {
      if (tile.occupant && tile.occupant.name && this.state.pokeGifs[tile.occupant.name]) {
          const occupantId = tile.occupant.id;
          currentOccupantIds.add(occupantId);
          
          const { x: screenX, y: screenY } = this.boardView.hexToScreen(tile.hex);

          const sSize = this.boardView.HEX_SIZE * 1.5 * this.state.zoom;

          let base = document.getElementById(`base-${occupantId}`) as HTMLDivElement;
          if (!base) {
            base = document.createElement('div');
            base.id = `base-${occupantId}`;
            base.className = 'absolute rounded-full pointer-events-none';
            base.style.transition = 'left 0.1s linear, top 0.1s linear, width 0.1s linear, height 0.1s linear';
            base.style.boxShadow = '0 0 12px currentColor';
            this.entitiesLayer.appendChild(base);
          }

          const baseColors: Record<string, string> = {
            player1: 'rgba(59, 130, 246, 0.45)', // Azul
            player2: 'rgba(239, 68, 68, 0.45)',  // Rojo
            player3: 'rgba(168, 85, 247, 0.45)', // Violeta
            player4: 'rgba(234, 179, 8, 0.45)',  // Amarillo
          };
          const borderColors: Record<string, string> = {
            player1: '#60a5fa',
            player2: '#f87171',
            player3: '#c084fc',
            player4: '#facc15',
          };
          const pId = tile.occupant.playerId || 'player1';
          base.style.backgroundColor = baseColors[pId] || 'rgba(255, 255, 255, 0.3)';
          base.style.border = `2px solid ${borderColors[pId] || '#fff'}`;
          base.style.color = borderColors[pId] || '#fff';

          const baseW = sSize * 0.85;
          const baseH = sSize * 0.38;
          base.style.width = `${baseW}px`;
          base.style.height = `${baseH}px`;
          base.style.left = `${screenX - baseW / 2}px`;
          base.style.top = `${screenY - baseH / 2}px`;
          base.style.zIndex = Math.floor(screenY - 1).toString();
          
          let img = document.getElementById(`img-${occupantId}`) as HTMLImageElement;
          if (!img) {
            img = document.createElement('img');
            img.id = `img-${occupantId}`;
            img.src = this.state.pokeGifs[tile.occupant.name];
            img.className = 'absolute';
            img.style.imageRendering = 'pixelated';
            img.style.transition = 'left 0.1s linear, top 0.1s linear, transform 0.15s ease-in-out';
            this.entitiesLayer.appendChild(img);
          }
          
          img.style.width = `${sSize}px`;
          img.style.height = `${sSize}px`;
          img.style.left = `${screenX - sSize/2}px`;
          img.style.top = `${screenY - sSize/1.1}px`;
          img.style.zIndex = Math.floor(screenY).toString();

          const facing = tile.occupant.facing ?? ((tile.hex.q + tile.hex.r / 2 < 0) ? 'right' : 'left');
          img.style.transform = facing === 'right' ? 'scaleX(-1)' : 'scaleX(1)';
          
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

          const opacity = tile.occupant.isHidden ? '0.4' : '1';
          img.style.opacity = opacity;
          base.style.opacity = opacity;
          label.style.opacity = opacity;
      }
    }
    
    Array.from(this.entitiesLayer.children).forEach(child => {
       const id = child.id.replace('img-', '').replace('lbl-', '').replace('base-', '');
       if (!currentOccupantIds.has(id)) {
           child.remove();
       }
    });
  }
}
