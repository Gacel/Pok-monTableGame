import type { WebSocket } from 'ws';
import type { PlayerSlot } from '@transcendence/shared';

/** Sala de la partida local hot-seat (clientes que conectan sin matchId). */
export const LOCAL_ROOM = 'default';

/** Metadatos de un socket: a qué sala pertenece y quién es (si se identificó). */
export interface SocketCtx {
  matchId: string;
  userId: string | null;
  username: string | null;
  slot: PlayerSlot | null;
}

/**
 * Hub de tiempo real: mantiene las conexiones WSS agrupadas por sala (partida)
 * y difunde mensajes SOLO dentro de cada sala. El servidor valida ANTES de
 * difundir → autoridad del servidor.
 */
class RealtimeHub {
  private rooms: Map<string, Set<WebSocket>> = new Map();
  private ctx: WeakMap<WebSocket, SocketCtx> = new WeakMap();
  /** Presencia global: nº de sockets abiertos por usuario (varias salas/pestañas). */
  private online: Map<string, number> = new Map();

  join(matchId: string, socket: WebSocket, ctx: Omit<SocketCtx, 'matchId'>): void {
    let room = this.rooms.get(matchId);
    if (!room) {
      room = new Set();
      this.rooms.set(matchId, room);
    }
    room.add(socket);
    this.ctx.set(socket, { matchId, ...ctx });
    if (ctx.userId) this.online.set(ctx.userId, (this.online.get(ctx.userId) ?? 0) + 1);
  }

  leave(socket: WebSocket): void {
    const ctx = this.ctx.get(socket);
    if (!ctx) return;
    const room = this.rooms.get(ctx.matchId);
    if (room) {
      room.delete(socket);
      if (room.size === 0) this.rooms.delete(ctx.matchId);
    }
    if (ctx.userId) {
      const n = (this.online.get(ctx.userId) ?? 0) - 1;
      if (n <= 0) this.online.delete(ctx.userId);
      else this.online.set(ctx.userId, n);
    }
  }

  /** Presencia: ¿tiene el usuario algún socket abierto (en cualquier sala)? */
  isOnline(userId: string): boolean {
    return (this.online.get(userId) ?? 0) > 0;
  }

  ctxOf(socket: WebSocket): SocketCtx | undefined {
    return this.ctx.get(socket);
  }

  roomSize(matchId: string): number {
    return this.rooms.get(matchId)?.size ?? 0;
  }

  /** ¿Sigue el usuario conectado a la sala por algún socket? (p.ej. tras F5). */
  hasUser(matchId: string, userId: string): boolean {
    const room = this.rooms.get(matchId);
    if (!room) return false;
    for (const socket of room) {
      if (this.ctx.get(socket)?.userId === userId) return true;
    }
    return false;
  }

  /** Envía un objeto (serializado a JSON) a todos los clientes de la sala. */
  broadcast(matchId: string, message: unknown): void {
    const room = this.rooms.get(matchId);
    if (!room) return;
    const payload = JSON.stringify(message);
    for (const socket of room) {
      // 1 === WebSocket.OPEN
      if (socket.readyState === 1) {
        try {
          socket.send(payload);
        } catch {
          room.delete(socket);
        }
      }
    }
  }

  /** Envía un objeto personalizado para cada cliente de la sala según su contexto (ej. para ocultar enemigos en la niebla de guerra). */
  broadcastPersonalized(matchId: string, factory: (ctx: SocketCtx) => unknown): void {
    const room = this.rooms.get(matchId);
    if (!room) return;
    for (const socket of room) {
      if (socket.readyState === 1) {
        try {
          const ctx = this.ctx.get(socket);
          if (ctx) {
             const message = factory(ctx);
             socket.send(JSON.stringify(message));
          }
        } catch {
          room.delete(socket);
        }
      }
    }
  }

  /** Envía a un único socket. */
  send(socket: WebSocket, message: unknown): void {
    if (socket.readyState === 1) socket.send(JSON.stringify(message));
  }
}

export const hub = new RealtimeHub();
