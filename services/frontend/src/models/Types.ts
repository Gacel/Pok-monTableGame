export interface Hex {
  q: number;
  r: number;
}

export type Biome = 'FIRE' | 'WATER' | 'GRASS' | 'SAND' | 'ICE';
export type MovementPattern = 'FLYING' | 'TANK' | 'SPEEDSTER';

export interface Pokemon {
  id: string;
  playerId: string;
  name?: string;
  type: Biome;
  movementPattern: MovementPattern;
  hp: number;
  maxHp: number;
  atk?: number;
  def?: number;
  level?: number;
}

export interface Tile {
  hex: Hex;
  biome: Biome;
  occupant: Pokemon | null;
}

export interface PlayerResources {
  FIRE_CANDY: number;
  WATER_CANDY: number;
  GRASS_CANDY: number;
}

/** Estado autoritativo de la partida (espejo del DTO del game-service). */
export interface MatchState {
  id: string;
  tiles: Tile[];
  players: string[];
  currentPlayer: string;
  turn: number;
  status: 'active' | 'finished';
  winner: string | null;
  resources: Record<string, PlayerResources>;
  log: string[];
}

export interface MoveOptions {
  moves: Hex[];
  attacks: Hex[];
}
