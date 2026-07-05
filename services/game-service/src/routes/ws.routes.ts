import { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { matchManager, ARENA_ID } from '../services/MatchManager.js';
import { RoomService } from '../services/RoomService.js';
import { MessageModel } from '../models/MessageModel.js';
import { FriendModel } from '../models/FriendModel.js';
import { resolveUser } from '../auth/identity.js';
import { readSessionToken } from '../auth/cookie.js';
import { hub, LOCAL_ROOM } from '../realtime/hub.js';
import { GameService } from '../services/GameService.js';
import { GameActionService, GameAction } from '../services/GameActionService.js';
import { Hex } from '../engine/hex.js';
import { isHex } from '../utils/hex.js';

interface WsMessage {
  type: 'move' | 'chat' | 'combat_action' | 'combat_continue' | 'end_turn' | 'abandon';
  from?: Hex;
  to?: Hex;
  text?: string;
  action?: string;
  moveName?: string;
}

interface WsQuery {
  matchId?: string;
  token?: string;
}


/**
 * Sincronización de tablero + chat por WSS, agrupada por sala.
 *   - Sin `matchId` → sala local hot-seat (comportamiento clásico).
 *   - Con `matchId` (+ `token`) → sala online: el socket queda atado a la
 *     identidad y SOLO puede actuar como su propio slot (autoridad servidor).
 */
export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, async (connection: SocketStream, request) => {
    const socket = connection.socket as WebSocket;
    const query = request.query as WsQuery;
    const matchId = (query.matchId ?? '').trim();

    // Exigir sesión válida para abrir el socket. La cookie HttpOnly viaja en el
    // handshake (mismo origen); se acepta `token` por query como respaldo.
    const user = await resolveUser(readSessionToken(request) ?? query.token);
    if (!user) {
      socket.close(4401, 'No autenticado');
      return;
    }

    if (matchId.startsWith('dm:')) {
      // ---- Chat directo (DM) entre dos amigos: sala 'dm:<idA>:<idB>' ----
      // Los ids van ordenados, así ambos extremos comparten la misma sala.
      const ids = matchId.slice(3).split(':');
      if (ids.length !== 2 || !ids.includes(user.id)) {
        socket.close(4403, 'Canal no autorizado');
        return;
      }
      // Solo se permite DM entre amigos aceptados (evita spam/acoso dirigido).
      const other = ids[0] === user.id ? ids[1]! : ids[0]!;
      if (!(await FriendModel.areFriends(user.id, other))) {
        socket.close(4403, 'Solo puedes chatear con amigos');
        return;
      }
      hub.join(matchId, socket, { userId: user.id, username: user.username, slot: null });
      // Historial persistente: al abrir el chat se envían los últimos mensajes.
      const history = await MessageModel.history(matchId, 50);
      hub.send(socket, { type: 'chat_history', messages: history });
    } else if (!matchId) {
      // ---- Sala LOCAL (hot-seat en un solo navegador) -----------------
      // El actor sigue siendo currentPlayer (turno compartido), pero el socket
      // exige un usuario autenticado.
      hub.join(LOCAL_ROOM, socket, { userId: user.id, username: user.username, slot: null });
      hub.send(socket, { type: 'state', state: matchManager.get().getStateDTO() });
    } else {
      // ---- Sala ONLINE -------------------------------------------------
      let room;
      try {
        room = await RoomService.get(matchId, user.id);
        hub.join(matchId, socket, {
          userId: user.id,
          username: user.username ?? null,
          slot: room.youAre,
        });
      } catch {
        socket.close(4404, 'Sala no encontrada');
        return;
      }
      hub.send(socket, { type: 'room', room });
      const game = await matchManager.getMatch(matchId);
      if (game) hub.send(socket, { type: 'state', state: game.getStateDTO() });
    }

    socket.on('message', async (raw: Buffer) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        hub.send(socket, { type: 'error', error: 'JSON inválido' });
        return;
      }

      const ctx = hub.ctxOf(socket);
      if (!ctx) return;
      const isLocal = ctx.matchId === LOCAL_ROOM;

      // Chat: siempre permitido, solo dentro de la sala.
      if (msg.type === 'chat') {
        const text = (msg.text ?? '').toString().slice(0, 200);
        if (!text.trim()) return;
        // DM: se PERSISTE en BD; el resto de salas (juego) sigue efímero.
        if (ctx.matchId.startsWith('dm:') && ctx.userId) {
          const saved = await MessageModel.add(ctx.matchId, ctx.userId, text);
          hub.broadcast(ctx.matchId, {
            type: 'chat',
            text: ctx.username ? `${ctx.username}: ${text}` : text,
            from: ctx.userId,
            at: saved.created_at,
          });
        } else {
          const label = ctx.username ? `${ctx.username}: ${text}` : text;
          hub.broadcast(ctx.matchId, { type: 'chat', text: label });
        }
        return;
      }

      // Acciones de juego: resolver la partida y el actor según la sala.
      let game: GameService | null;
      let actor: string | null;
      if (isLocal) {
        game = matchManager.get();
        actor = game.getStateDTO().currentPlayer; // hot-seat: turno compartido
      } else {
        game = await matchManager.getMatch(ctx.matchId);
        actor = ctx.slot; // online: SOLO tu propio slot
        if (!game) {
          hub.send(socket, { type: 'error', error: 'La partida aún no ha empezado' });
          return;
        }
        if (!actor) {
          hub.send(socket, { type: 'error', error: 'No participas en esta partida' });
          return;
        }
      }

      // Traduce el sobre WS a una acción del pipeline ÚNICO (mismo que HTTP).
      let action: GameAction | null = null;
      if (msg.type === 'move') {
        if (!isHex(msg.from) || !isHex(msg.to)) {
          hub.send(socket, { type: 'error', error: 'Coordenadas inválidas' });
          return;
        }
        action = { type: 'move', from: msg.from, to: msg.to };
      } else if (msg.type === 'combat_action') {
        action = { type: 'combat_action', action: String(msg.action ?? ''), moveName: msg.moveName };
      } else if (msg.type === 'combat_continue') {
        action = { type: 'combat_continue' };
      } else if (msg.type === 'end_turn') {
        action = { type: 'end_turn' };
      } else if (msg.type === 'abandon') {
        action = { type: 'abandon' };
      }
      if (!action) return;

      const result = await GameActionService.apply(
        { game, actor: actor!, isLocal, room: ctx.matchId, matchId: isLocal ? undefined : ctx.matchId },
        action
      );
      if (!result.ok) hub.send(socket, { type: 'error', error: result.error });
    });

    const onGone = () => {
      const ctx = hub.ctxOf(socket);
      hub.leave(socket);
      if (!ctx || !ctx.userId) return;
      if (ctx.matchId === ARENA_ID) {
        // ARENA: al irse (y sin otros sockets suyos) se retira del mundo vivo.
        if (!hub.hasUser(ARENA_ID, ctx.userId)) void RoomService.leaveArena(ctx.userId);
      } else if (ctx.matchId !== LOCAL_ROOM) {
        void RoomService.handleDisconnect(ctx.matchId, ctx.userId);
      }
    };
    socket.on('close', onGone);
    socket.on('error', onGone);
  });
}
