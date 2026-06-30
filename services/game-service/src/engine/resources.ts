import { Board } from './board.js';

export interface PlayerResources {
  FIRE_CANDY: number;
  WATER_CANDY: number;
  GRASS_CANDY: number;
}

// Simula la recolección de recursos al final de un turno
export function collectResources(board: Board): Record<string, PlayerResources> {
  const result: Record<string, PlayerResources> = {};

  for (const tile of board.tiles.values()) {
    if (tile.occupant) {
      const playerId = tile.occupant.playerId;
      
      if (!result[playerId]) {
        result[playerId] = { FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 };
      }

      if (tile.biome === 'FIRE') {
        result[playerId]!.FIRE_CANDY += 1;
      } else if (tile.biome === 'WATER') {
        result[playerId]!.WATER_CANDY += 1;
      } else if (tile.biome === 'GRASS') {
        result[playerId]!.GRASS_CANDY += 1;
      }
    }
  }

  return result;
}
