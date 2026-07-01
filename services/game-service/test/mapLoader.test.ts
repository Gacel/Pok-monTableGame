import { expect, test, describe } from 'vitest';
import { MapLoader, TiledMapData } from '../src/engine/mapLoader.js';

describe('MapLoader', () => {
  test('should load a Tiled map JSON correctly', () => {
    const mockTiledData: TiledMapData = {
      width: 2,
      height: 2,
      staggeraxis: 'y',
      staggerindex: 'odd',
      layers: [
        {
          type: 'tilelayer',
          width: 2,
          height: 2,
          data: [
            1, 2, // Row 0
            3, 0  // Row 1 (staggered)
          ]
        }
      ]
    };

    const board = MapLoader.loadTiledMap(mockTiledData);
    
    // Mapeo del loader (documentado): 1=FIRE, 2=GRASS, 3=WATER, 4=SAND, 5=ICE.
    // (col=0, row=0) -> q=0, r=0 (gid=1 -> FIRE)
    const tile00 = board.getTile({ q: 0, r: 0 });
    expect(tile00).toBeDefined();
    expect(tile00?.biome).toBe('FIRE');

    // (col=1, row=0) -> q=1, r=0 (gid=2 -> GRASS)
    const tile10 = board.getTile({ q: 1, r: 0 });
    expect(tile10).toBeDefined();
    expect(tile10?.biome).toBe('GRASS');

    // (col=0, row=1) -> odd-r staggered logic:
    // q = col - floor(row/2) = 0 - floor(1/2) = 0
    // r = row = 1
    // (q=0, r=1) -> gid=3 -> WATER
    const tile01 = board.getTile({ q: 0, r: 1 });
    expect(tile01).toBeDefined();
    expect(tile01?.biome).toBe('WATER');

    // (col=1, row=1) -> gid=0 -> Empty
    // q = 1 - 0 = 1, r = 1
    const tile11 = board.getTile({ q: 1, r: 1 });
    expect(tile11).toBeUndefined(); // Should be empty (0)
  });
});
