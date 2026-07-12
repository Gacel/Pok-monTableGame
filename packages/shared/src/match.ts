/**
 * Contratos del ESTADO DE PARTIDA compartidos entre game-service y frontend.
 * ÚNICA fuente de verdad. El servidor es autoritativo: el cliente recibe
 * `MatchStateDTO` y solo renderiza.
 */
import type { Pokemon, Tile, PlayerResources } from './domain.js';
import type { BallKey } from './balls.js';

export type MatchStatus = 'deployment' | 'active' | 'finished';
export type CombatAction = 'ATACAR' | 'HABILIDAD' | 'OBJETO' | 'HUIR' | 'MOVE';

/** Tipos de evento puntual de una acción/turno (feedback visual en el cliente). */
export type TurnEventKind =
  | 'damage'
  | 'heal'
  | 'ko'
  | 'reveal'
  | 'knockback'
  | 'dash'
  | 'capture';

/**
 * Evento puntual de una acción/turno, para feedback visual (números flotantes,
 * flashes, tweens). Efímero: se resetea al inicio de cada acción, viaja en el DTO
 * y NO se persiste (mismo patrón que `defeats`/`rewards`).
 */
export interface TurnEvent {
  kind: TurnEventKind;
  /** Id de la pieza implicada (identidad). */
  pokemonId?: string;
  /** Casilla donde ocurre (posición para el número flotante / flash). */
  hex?: Tile['hex'];
  /** Variación de HP con signo: daño negativo, curación positiva. */
  delta?: number;
  /** Origen/destino de un desplazamiento (knockback/dash) — tickets posteriores. */
  from?: Tile['hex'];
  to?: Tile['hex'];
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
  /** Alianzas 2v2 ([[p1,p3],[p2,p4]]); null en todos contra todos. */
  alliances: string[][] | null;
  /** Jugadores ya eliminados (sin Pokémon o que abandonaron). */
  eliminated: string[];
  /** ARENA: partida persistente que nunca termina. */
  persistent: boolean;
  /** Bajas por KO de la última acción (para economía). Efímero, no persistido. */
  defeats: { killerSlot: string; victimSlot: string }[];
  /** Tiempo límite de la fase de despliegue en formato UNIX (ms). */
  deploymentDeadline?: number;
  /** Pokémon pendientes de desplegar en Turno 0. */
  reserve?: Record<string, Pokemon[]>;
  /** Casillas válidas para el despliegue de cada jugador. */
  deploymentZones?: Record<string, Tile['hex'][]>;
  /** KOs acumulados por slot durante la partida (para el resumen de recompensa). Persistido. */
  kos?: Record<string, number>;
  /**
   * Bolas a conceder al usuario de cada slot (al ganar o abandonar en arena).
   * Efímero, patrón `defeats`: no se persiste, viaja en el DTO y la economía lo consume.
   */
  rewards?: { slot: string; balls: BallKey[] }[];
  /** Eventos de la última acción para feedback visual. Efímero, no persistido. */
  events?: TurnEvent[];
}

/** Alias histórico usado por el frontend. */
export type MatchState = MatchStateDTO;
