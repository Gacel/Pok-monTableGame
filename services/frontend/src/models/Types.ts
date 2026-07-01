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

export type MatchStatus = 'active' | 'combat' | 'finished';
export type CombatAction = 'ATACAR' | 'HABILIDAD' | 'OBJETO' | 'HUIR';

/** Estado de un combate interactivo (espejo del CombatState del servidor). */
export interface CombatState {
  attackerId: string;
  defenderId: string;
  attackerHex: Hex;
  defenderHex: Hex;
  attacker: Pokemon;
  defender: Pokemon;
  attackerPlayer: string;
  defenderPlayer: string;
  turnActorId: string;
  round: number;
  log: string[];
  status: 'active' | 'finished';
  winnerId: string | null;
  outcome: 'ko' | 'fled' | null;
}

/** Estado autoritativo de la partida (espejo del DTO del game-service). */
export interface MatchState {
  id: string;
  tiles: Tile[];
  players: string[];
  currentPlayer: string;
  turn: number;
  status: MatchStatus;
  winner: string | null;
  resources: Record<string, PlayerResources>;
  log: string[];
  combat: CombatState | null;
}

export interface MoveOptions {
  moves: Hex[];
  attacks: Hex[];
}
