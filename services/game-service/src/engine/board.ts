import { Hex } from './hex.js';

export type Biome = 'FIRE' | 'WATER' | 'GRASS' | 'SAND' | 'ICE';

export type PokemonType =
  | 'FIRE'
  | 'WATER'
  | 'GRASS'
  | 'POISON'
  | 'FLYING'
  | 'DRAGON'
  | 'PSYCHIC'
  | 'NORMAL'
  | 'ELECTRIC'
  | 'ICE'
  | 'FAIRY';

export type MovementPattern = 'FLYING' | 'TANK' | 'SPEEDSTER';

export type MoveDamageClass = 'physical' | 'special' | 'status';

/** Un ataque concreto de un Pokémon (importado de PokeAPI y curado para combate). */
export interface PokemonMove {
  /** Identificador/nombre del movimiento (ej. 'ember'); se muestra y se valida por él. */
  name: string;
  /** Tipo del movimiento, ya normalizado al dominio (afecta a la ventaja de tipo). */
  type: PokemonType;
  /** Potencia base (0 si no inflige daño directo). */
  power: number;
  /** Categoría PokeAPI: física (gratis) / especial (cuesta 1 candy) / estado. */
  damageClass: MoveDamageClass;
  /** Precisión 0-100 (informativo). */
  accuracy?: number;
  /** Puntos de poder (informativo). */
  pp?: number;
}

export interface Pokemon {
  id: string;
  playerId: string;
  name?: string;
  type: PokemonType;
  movementPattern: MovementPattern;
  hp: number;
  maxHp: number;
  /** Ataque base (por defecto 50 si no se especifica). */
  atk?: number;
  /** Defensa base (por defecto 40 si no se especifica). */
  def?: number;
  /** Nivel de combate; usado como umbral para evolución. */
  level?: number;
  /** Orientación horizontal del Pokémon en el tablero ('left' | 'right'). */
  facing?: 'left' | 'right';
  /** Turnos consecutivos permaneciendo en terreno de lava (FIRE). */
  lavaTurns?: number;
  /** Si ya realizó su acción de movimiento o ataque en el turno actual. */
  hasActed?: boolean;
  /** Ataques curados (≤4) disponibles en la fase de combate. */
  moves?: PokemonMove[];
}

export interface Tile {
  hex: Hex;
  biome: Biome;
  occupant: Pokemon | null;
}

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
