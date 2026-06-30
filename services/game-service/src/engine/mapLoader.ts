import { Board, Biome } from './board.js';

export interface TiledMapData {
  width: number;
  height: number;
  layers: {
    data: number[];
    type: string;
    width: number;
    height: number;
  }[];
  staggeraxis?: string;
  staggerindex?: string;
}

export class MapLoader {
  /**
   * Carga un JSON de Tiled (Pointy-Top / staggered Y odd) a un objeto Board
   */
  public static loadTiledMap(data: TiledMapData): Board {
    const board = new Board();

    if (!data.layers || data.layers.length === 0) {
      return board;
    }

    // Usaremos la primera capa de tipo tilelayer
    const layer = data.layers.find(l => l.type === 'tilelayer');
    if (!layer || !layer.data) {
      return board;
    }

    const mapWidth = layer.width;
    const mapHeight = layer.height;

    for (let row = 0; row < mapHeight; row++) {
      for (let col = 0; col < mapWidth; col++) {
        const index = row * mapWidth + col;
        const gid = layer.data[index];

        if (gid === 0) {
          continue; // Loseta vacía / agujero
        }

        // Mapear GID a Bioma según Tiled
        // Asumimos: 1 = FIRE, 2 = GRASS, 3 = WATER, 4 = SAND, 5 = ICE
        let biome: Biome = 'GRASS';
        if (gid === 1) biome = 'FIRE';
        else if (gid === 2) biome = 'GRASS';
        else if (gid === 3) biome = 'WATER';
        else if (gid === 4) biome = 'SAND';
        else if (gid === 5) biome = 'ICE';

        // Conversión Staggered (Odd-q o Odd-r) a Axial (q,r)
        // Para hexágonos pointy-top, el stagger axis suele ser Y y el index ODD
        // q = col - (row - (row & 1)) / 2
        // r = row
        let q = 0, r = 0;
        
        // Offset coordinates (staggered) to axial conversion
        if (data.staggeraxis === 'y') {
           const staggerOffset = data.staggerindex === 'even' ? 1 : 0;
           // Odd-r offset to axial (Pointy top)
           q = col - Math.floor((row - (row & 1)) / 2);
           r = row;
        } else {
           // Default to Odd-q (Flat top) if not specified or different
           q = col;
           r = row - Math.floor((col - (col & 1)) / 2);
        }

        board.setTile({ hex: { q, r }, biome, occupant: null });
      }
    }

    return board;
  }
}
