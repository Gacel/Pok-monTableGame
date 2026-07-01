export interface Hex {
  q: number;
  r: number;
}

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

/** Un ataque concreto de un Pokémon (espejo del PokemonMove del servidor). */
export interface PokemonMove {
  name: string;
  type: PokemonType;
  power: number;
  damageClass: MoveDamageClass;
  accuracy?: number;
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
  atk?: number;
  def?: number;
  level?: number;
  facing?: 'left' | 'right';
  lavaTurns?: number;
  hasActed?: boolean;
  moves?: PokemonMove[];
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
export type CombatAction = 'ATACAR' | 'HABILIDAD' | 'OBJETO' | 'HUIR' | 'MOVE';

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
  loserId: string | null;
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
  /** Alianzas 2v2 ([[p1,p3],[p2,p4]]); null en todos contra todos. */
  alliances?: string[][] | null;
  /** Jugadores eliminados (sin Pokémon o que abandonaron). */
  eliminated?: string[];
}

export interface MoveOptions {
  moves: Hex[];
  attacks: Hex[];
}
