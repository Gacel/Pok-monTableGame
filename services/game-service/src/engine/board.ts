import type { Hex } from './hex.js';

// Tipos de dominio en @transcendence/shared (única fuente de verdad). Se
// re-exportan aquí para no romper los imports `from '../engine/board.js'`.
export type {
  Biome,
  PokemonType,
  MovementPattern,
  MoveDamageClass,
  PokemonMove,
  Pokemon,
  Tile,
} from '@transcendence/shared';
import type { Pokemon, Tile } from '@transcendence/shared';

export class Board {
  public tiles: Map<string, Tile> = new Map();

  public static hexKey(hex: Hex): string {
    return `${hex.q},${hex.r}`;
  }

  public getTile(hex: Hex): Tile | undefined {
    return this.tiles.get(Board.hexKey(hex));
  }

  public setTile(tile: Tile): void {
    this.tiles.set(Board.hexKey(tile.hex), tile);
  }
  
  public getOccupant(hex: Hex): Pokemon | null {
    return this.getTile(hex)?.occupant ?? null;
  }
  
  public setOccupant(hex: Hex, pokemon: Pokemon | null): void {
    const tile = this.getTile(hex);
    if (tile) {
      if (pokemon && !pokemon.facing) {
        const hx = hex.q + hex.r / 2;
        pokemon.facing = hx < 0 ? 'right' : hx > 0 ? 'left' : (pokemon.playerId === 'player1' ? 'right' : 'left');
      }
      tile.occupant = pokemon;
    }
  }

  public moveOccupant(from: Hex, to: Hex): boolean {
    const fromTile = this.getTile(from);
    const toTile = this.getTile(to);
    
    // Check if tiles exist, from has an occupant, and to is empty
    if (!fromTile || !toTile || !fromTile.occupant || toTile.occupant) {
      return false;
    }
    
    // Actualizar orientación según la dirección del movimiento (sólo derecha o izquierda)
    const fromX = from.q + from.r / 2;
    const toX = to.q + to.r / 2;
    if (toX > fromX) {
      fromTile.occupant.facing = 'right';
    } else if (toX < fromX) {
      fromTile.occupant.facing = 'left';
    }

    // Move the occupant
    toTile.occupant = fromTile.occupant;
    fromTile.occupant = null;
    
    return true;
  }

  // Generate a basic hexagon shaped board with a given radius
  public static generateBasic(radius: number): Board {
    const board = new Board();
    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      for (let r = r1; r <= r2; r++) {
        const hash = Math.abs(q * 31 + r * 17) % 3;
        const biome = hash === 0 ? 'FIRE' : hash === 1 ? 'WATER' : 'GRASS';
        board.setTile({ hex: { q, r }, biome, occupant: null });
      }
    }
    return board;
  }
  
  public serialize(): any {
    return Array.from(this.tiles.values());
  }
  
  public static deserialize(data: any[]): Board {
    const board = new Board();
    for (const item of data) {
      board.setTile(item);
    }
    return board;
  }
}
