/**
 * Contratos del ESTADO DE PARTIDA compartidos entre game-service y frontend.
 * ÚNICA fuente de verdad. El servidor es autoritativo: el cliente recibe
 * `MatchStateDTO` y solo renderiza.
 */
import type { Hex, Pokemon, Tile, PlayerResources } from './domain.js';
import type { BallKey } from './balls.js';

export type MatchStatus = 'active' | 'combat' | 'finished';
export type CombatAction = 'ATACAR' | 'HABILIDAD' | 'OBJETO' | 'HUIR' | 'MOVE' | 'TARGET';

/**
 * Estado de un combate interactivo por turnos ("varios contra uno"): un atacante
 * solitario contra uno o VARIOS defensores del mismo jugador a rango. Los campos
 * `defender*` reflejan el objetivo actual del atacante (`targetId`).
 */
export interface CombatState {
  attackerId: string;
  defenderId: string;
  attackerHex: Hex;
  defenderHex: Hex;
  attacker: Pokemon;
  defender: Pokemon;
  attackerPlayer: string;
  defenderPlayer: string;
  /** Todos los defensores que participan. */
  defenders: Pokemon[];
  /** Hexes paralelos a `defenders`. */
  defenderHexes: Hex[];
  /** Id del defensor al que el atacante dirige sus acciones. */
  targetId: string;
  /** Id del Pokémon que debe elegir acción ahora. */
  turnActorId: string;
  round: number;
  log: string[];
  status: 'active' | 'finished';
  winnerId: string | null;
  loserId: string | null;
  outcome: 'ko' | 'fled' | null;
}

/** Estado autoritativo de la partida (DTO que difunde el servidor). */
export interface MatchStateDTO {
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
  alliances: string[][] | null;
  /** Jugadores ya eliminados (sin Pokémon o que abandonaron). */
  eliminated: string[];
  /** ARENA: partida persistente que nunca termina. */
  persistent: boolean;
  /** Bajas por KO de la última acción (para economía). Efímero, no persistido. */
  defeats: { killerSlot: string; victimSlot: string }[];
  /** KOs acumulados por slot durante la partida (para el resumen de recompensa). Persistido. */
  kos?: Record<string, number>;
  /**
   * Bolas a conceder al usuario de cada slot (al ganar o abandonar en arena).
   * Efímero, patrón `defeats`: no se persiste, viaja en el DTO y la economía lo consume.
   */
  rewards?: { slot: string; balls: BallKey[] }[];
}

/** Alias histórico usado por el frontend. */
export type MatchState = MatchStateDTO;
