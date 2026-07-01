import { getDb } from './db.js';

export interface UserRecord {
  id: string;
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

  async create(id: string): Promise<UserRecord> {
    const db = await getDb();
    await db.run('INSERT OR IGNORE INTO users (id, level, coins) VALUES (?, 1, 0)', id);
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
