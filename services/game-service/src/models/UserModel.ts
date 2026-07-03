import { getDb } from './db.js';

export interface UserRecord {
  id: string;
  email?: string | null;
  username: string | null;
  avatarUrl: string | null;
  level: number;
  coins: number;
  created_at?: string;
}

/** Capa MODELO: acceso a datos de usuarios. Sin lógica HTTP. */
export const UserModel = {
  async findById(id: string): Promise<UserRecord | undefined> {
    const db = await getDb();
    return db.get<UserRecord>('SELECT * FROM users WHERE id = ?', id);
  },

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const db = await getDb();
    return db.get<UserRecord>('SELECT * FROM users WHERE email = ?', email);
  },

  /** Busca usuarios por nombre (para "añadir amigo"), excluyendo a `excludeId`. */
  async searchByUsername(query: string, excludeId: string): Promise<UserRecord[]> {
    const db = await getDb();
    return db.all<UserRecord[]>(
      `SELECT * FROM users
       WHERE username IS NOT NULL AND username LIKE ? AND id != ?
       ORDER BY username LIMIT 20`,
      `%${query}%`,
      excludeId
    );
  },

  async create(id: string): Promise<UserRecord> {
    const db = await getDb();
    await db.run('INSERT OR IGNORE INTO users (id, level, coins) VALUES (?, 1, 0)', id);
    const user = await this.findById(id);
    if (!user) throw new Error('No se pudo crear el usuario');
    return user;
  },

  /** Crea (o recupera) un usuario guardando su email. Base del registro real. */
  async createWithEmail(id: string, email: string): Promise<UserRecord> {
    const db = await getDb();
    await db.run(
      'INSERT OR IGNORE INTO users (id, email, level, coins) VALUES (?, ?, 1, 0)',
      id,
      email
    );
    // Si ya existía sin email (datos antiguos), lo completa.
    await db.run('UPDATE users SET email = ? WHERE id = ? AND (email IS NULL OR email = "")', email, id);
    const user = await this.findById(id);
    if (!user) throw new Error('No se pudo crear el usuario');
    return user;
  },

  async findOrCreate(id: string): Promise<UserRecord> {
    return (await this.findById(id)) ?? (await this.create(id));
  },

  async setProfile(id: string, username: string, avatarUrl: string): Promise<UserRecord | undefined> {
    const db = await getDb();
    await db.run('UPDATE users SET username = ?, avatarUrl = ? WHERE id = ?', username, avatarUrl, id);
    return this.findById(id);
  },

  async addCoins(id: string, amount: number): Promise<void> {
    const db = await getDb();
    await db.run('UPDATE users SET coins = coins + ? WHERE id = ?', amount, id);
  },
};
