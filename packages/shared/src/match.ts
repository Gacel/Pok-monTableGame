/**
 * Contratos del ESTADO DE PARTIDA compartidos entre game-service y frontend.
 * ÚNICA fuente de verdad. El servidor es autoritativo: el cliente recibe
 * `MatchStateDTO` y solo renderiza.
 */
import type { Tile, PlayerResources, Pokemon } from './domain.js';

export type MatchStatus = 'deployment' | 'active' | 'finished';
export type CombatAction = 'ATACAR' | 'HABILIDAD' | 'OBJETO' | 'HUIR' | 'MOVE';

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
}

/** Alias histórico usado por el frontend. */
export type MatchState = MatchStateDTO;
