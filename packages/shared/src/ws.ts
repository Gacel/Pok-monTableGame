/**
 * Contratos de mensajes WebSocket entre game-service y frontend.
 * El servidor es autoritativo: el cliente solo recibe `state` y envía
 * acciones que el servidor valida antes de difundir.
 */
import type { RoomInfo } from './lobby.js';
import type { MatchStateDTO } from './match.js';

/** Coordenada axial de una casilla hexagonal. */
export interface WsHex {
  q: number;
  r: number;
}

/** Mensajes que el cliente puede enviar por el socket. */
export type WsClientMessage =
  | { type: 'chat'; text: string }
  | { type: 'move'; from: WsHex; to: WsHex }
  | { type: 'combat_action'; action: string; moveName?: string }
  | { type: 'combat_continue' }
  | { type: 'end_turn' }
  | { type: 'abandon' };

/** Mensajes que difunde el servidor. `state` es el MatchStateDTO autoritativo. */
export type WsServerMessage =
  | { type: 'state'; state: MatchStateDTO }
  | { type: 'room'; room: RoomInfo }
  | { type: 'room_closed'; matchId: string }
  | { type: 'chat'; text: string }
  | { type: 'error'; error: string };
