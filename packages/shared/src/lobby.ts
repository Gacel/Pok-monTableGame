/**
 * Contratos del lobby multijugador (crear partida como anfitrión, buscar
 * partida, sala de espera). Compartidos entre game-service y frontend para
 * que cliente y servidor no se desincronicen.
 */

/** Cómo se juega la partida: en un solo navegador o entre navegadores. */
export type MatchMode = 'local' | 'online';

/** Modo de juego: todos contra todos (2-4) o por parejas (exactamente 4). */
export type GameMode = 'ffa' | 'teams';

/**
 * Ciclo de vida de una sala/partida.
 * `waiting`   → creada por el anfitrión, esperando jugadores y equipos.
 * `active`    → todos dentro y con equipo elegido; la partida ha comenzado.
 * `combat`    → sub-estado de partida (combate interactivo en curso).
 * `finished`  → hay ganador.
 * `abandoned` → cerrada sin terminar (anfitrión se fue en waiting).
 */
export type RoomStatus = 'waiting' | 'active' | 'combat' | 'finished' | 'abandoned';

export type PlayerSlot = 'player1' | 'player2' | 'player3' | 'player4';

export const PLAYER_SLOTS: readonly PlayerSlot[] = [
  'player1',
  'player2',
  'player3',
  'player4',
];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
/** Pokémon por equipo en el draft. */
export const DRAFT_TEAM_SIZE = 3;
/** Jugadores exactos que exige el modo 2 vs 2. */
export const TEAMS_MODE_PLAYERS = 4;

/** Alianzas del modo 2v2: P1+P3 (lado izquierdo) contra P2+P4 (derecho). */
export const TEAMS_MODE_ALLIANCES: readonly (readonly PlayerSlot[])[] = [
  ['player1', 'player3'],
  ['player2', 'player4'],
];

/** Un jugador dentro de una sala. `ready` = ya envió su equipo del draft. */
export interface RoomPlayer {
  userId: string;
  username: string;
  slot: PlayerSlot;
  ready: boolean;
}

/** Entrada de la lista pública "buscar partida". */
export interface LobbySummary {
  id: string;
  name: string;
  hostName: string;
  gameMode: GameMode;
  capacity: number;
  playerCount: number;
  createdAt: string;
}

/** Estado completo de una sala, personalizado con `youAre` según el token. */
export interface RoomInfo {
  id: string;
  name: string;
  gameMode: GameMode;
  capacity: number;
  status: RoomStatus;
  hostId: string;
  players: RoomPlayer[];
  /** Slot del usuario que consulta, o null si no participa. */
  youAre: PlayerSlot | null;
  /**
   * Pokémon ya reservados por OTROS jugadores de la sala. El draft online los
   * muestra bloqueados para que dos entrenadores no elijan el mismo Pokémon.
   */
  reserved?: string[];
}

export interface CreateRoomRequest {
  name: string;
  capacity: number;
  gameMode: GameMode;
}

export interface SubmitTeamRequest {
  /** Exactamente DRAFT_TEAM_SIZE nombres del roster. */
  team: string[];
}
