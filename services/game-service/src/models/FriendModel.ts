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
