import { getDb } from './db.js';
import type { UserRecord } from './UserModel.js';

/**
 * Capa MODELO: amistades (COMUNIDAD). La amistad es bidireccional; se guardan
 * las dos direcciones (a→b y b→a) para que listar y recomendar sea trivial.
 */
export const FriendModel = {
  /** Crea la amistad mutua (idempotente). No permite auto-amistad. */
  async add(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) return;
    const db = await getDb();
    await db.run(
      'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?), (?, ?)',
      userId,
      friendId,
      friendId,
      userId
    );
  },

  async areFriends(a: string, b: string): Promise<boolean> {
    const db = await getDb();
    const row = await db.get(
      'SELECT 1 AS x FROM friendships WHERE user_id = ? AND friend_id = ?',
      a,
      b
    );
    return !!row;
  },

  /** ¿Hay una solicitud pendiente de `fromId` hacia `toId`? */
  async hasRequest(fromId: string, toId: string): Promise<boolean> {
    const db = await getDb();
    const row = await db.get(
      'SELECT 1 AS x FROM friend_requests WHERE from_id = ? AND to_id = ?',
      fromId,
      toId
    );
    return !!row;
  },

  /** Registra una solicitud pendiente (idempotente). */
  async sendRequest(fromId: string, toId: string): Promise<void> {
    const db = await getDb();
    await db.run(
      'INSERT OR IGNORE INTO friend_requests (from_id, to_id) VALUES (?, ?)',
      fromId,
      toId
    );
  },

  /** Solicitudes ENTRANTES pendientes de `userId` (con datos del emisor). */
  async listIncoming(userId: string): Promise<UserRecord[]> {
    const db = await getDb();
    return db.all<UserRecord[]>(
      `SELECT u.* FROM friend_requests r
       JOIN users u ON u.id = r.from_id
       WHERE r.to_id = ?
       ORDER BY r.created_at DESC`,
      userId
    );
  },

  /** Acepta la solicitud fromId→toId: crea amistad mutua y borra la solicitud. */
  async accept(fromId: string, toId: string): Promise<void> {
    await this.add(fromId, toId);
    const db = await getDb();
    // Elimina cualquier solicitud en ambos sentidos.
    await db.run(
      'DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
      fromId,
      toId,
      toId,
      fromId
    );
  },

  /** Rechaza/cancela una solicitud (en el sentido dado). */
  async removeRequest(fromId: string, toId: string): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?', fromId, toId);
  },

  /** Lista los amigos de `userId` (datos completos de usuario). */
  async list(userId: string): Promise<UserRecord[]> {
    const db = await getDb();
    return db.all<UserRecord[]>(
      `SELECT u.* FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = ?
       ORDER BY u.username`,
      userId
    );
  },

  /**
   * Recomendados: amigos de mis amigos que aún no son amigos míos (ni yo mismo).
   */
  async recommended(userId: string): Promise<UserRecord[]> {
    const db = await getDb();
    return db.all<UserRecord[]>(
      `SELECT DISTINCT u.* FROM friendships f1
       JOIN friendships f2 ON f1.friend_id = f2.user_id
       JOIN users u ON u.id = f2.friend_id
       WHERE f1.user_id = ?
         AND f2.friend_id != ?
         AND f2.friend_id NOT IN (SELECT friend_id FROM friendships WHERE user_id = ?)
       ORDER BY u.username LIMIT 20`,
      userId,
      userId,
      userId
    );
  },
};
