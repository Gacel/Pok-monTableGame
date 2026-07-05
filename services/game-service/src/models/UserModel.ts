import { getDb } from './db.js';

export interface UserRecord {
  id: string;
  email?: string | null;
  /** Hash scrypt de la contraseña. NUNCA se envía al cliente (ver toSafe). */
  password_hash?: string | null;
  username: string | null;
  avatarUrl: string | null;
  age?: number | null;
  is_student42?: number; // 0/1 (SQLite no tiene boolean)
  totp_secret?: string | null; // NUNCA se envía al cliente
  two_factor_enabled?: number; // 0/1
  level: number;
  coins: number;
  created_at?: string;
}

/** Vista segura de un usuario para enviar al PROPIO cliente (/me): sin secretos. */
export interface SafeUser {
  id: string;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  age: number | null;
  isStudent42: boolean;
  twoFactorEnabled: boolean;
  level: number;
  coins: number;
}

export interface NewAccount {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  age: number;
  isStudent42: boolean;
}

/** Capa MODELO: acceso a datos de usuarios. Sin lógica HTTP. */
export const UserModel = {
  /** Elimina campos sensibles antes de enviar el usuario a su propio cliente. */
  toSafe(u: UserRecord): SafeUser {
    return {
      id: u.id,
      email: u.email ?? null,
      username: u.username,
      avatarUrl: u.avatarUrl,
      age: u.age ?? null,
      isStudent42: !!u.is_student42,
      twoFactorEnabled: !!u.two_factor_enabled,
      level: u.level,
      coins: u.coins,
    };
  },

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

  /** Registro real: crea la cuenta con contraseña (hash) y datos de perfil. */
  async createAccount(a: NewAccount): Promise<UserRecord> {
    const db = await getDb();
    await db.run(
      `INSERT INTO users (id, email, password_hash, username, age, is_student42, level, coins)
       VALUES (?, ?, ?, ?, ?, ?, 1, 5000)`,
      a.id,
      a.email,
      a.passwordHash,
      a.username,
      a.age,
      a.isStudent42 ? 1 : 0
    );
    const user = await this.findById(a.id);
    if (!user) throw new Error('No se pudo crear el usuario');
    return user;
  },

  /** Crea (o recupera) un usuario de OAuth (Google): sin contraseña. */
  async createOAuthUser(id: string, email: string): Promise<UserRecord> {
    const db = await getDb();
    await db.run('INSERT OR IGNORE INTO users (id, email, level, coins) VALUES (?, ?, 1, 5000)', id, email);
    const user = await this.findByEmail(email);
    if (!user) throw new Error('No se pudo crear el usuario');
    return user;
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

  /** 2FA: guarda el secreto TOTP (aún no habilitado). */
  async setTotpSecret(id: string, secret: string): Promise<void> {
    const db = await getDb();
    await db.run('UPDATE users SET totp_secret = ? WHERE id = ?', secret, id);
  },

  /** 2FA: activa/desactiva la verificación en dos pasos. */
  async setTwoFactor(id: string, enabled: boolean): Promise<void> {
    const db = await getDb();
    await db.run('UPDATE users SET two_factor_enabled = ? WHERE id = ?', enabled ? 1 : 0, id);
  },
};
