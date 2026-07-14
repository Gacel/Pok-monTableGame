import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Ruta del fichero SQLite. Configurable por env para tests/despliegue. */
const DB_FILE = process.env.GAME_DB_PATH ?? path.join(__dirname, '../../data/game.db');

let dbPromise: Promise<Database> | null = null;

/**
 * Devuelve una única conexión SQLite (singleton) con las migraciones aplicadas.
 * Capa MODELO: aquí vive TODO el acceso a datos; ni controladores ni servicios
 * abren conexiones por su cuenta.
 */
export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<Database> {
  // Asegura el directorio de datos (por si el volumen está vacío).
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = await open({ filename: DB_FILE, driver: sqlite3.Database });
  await db.exec('PRAGMA journal_mode = WAL;');
  await db.exec('PRAGMA foreign_keys = ON;');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS pokemons (
      name            TEXT PRIMARY KEY,
      hp              INTEGER NOT NULL,
      maxHp           INTEGER NOT NULL,
      atk             INTEGER NOT NULL DEFAULT 50,
      def             INTEGER NOT NULL DEFAULT 40,
      type            TEXT NOT NULL,
      speed           INTEGER NOT NULL DEFAULT 3,
      size            TEXT NOT NULL DEFAULT 'medium',
      raw_data        TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT,
      username   TEXT,
      avatarUrl  TEXT,
      level      INTEGER NOT NULL DEFAULT 1,
      coins      INTEGER NOT NULL DEFAULT 5000,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS matches (
      id             TEXT PRIMARY KEY,
      status         TEXT NOT NULL DEFAULT 'active',
      turn           INTEGER NOT NULL DEFAULT 1,
      current_player TEXT,
      winner         TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS match_state (
      match_id   TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );

    -- Catálogo de movimientos importado de PokeAPI (deduplicado por nombre).
    CREATE TABLE IF NOT EXISTS moves (
      name         TEXT PRIMARY KEY,
      type         TEXT NOT NULL DEFAULT 'NORMAL',
      power        INTEGER,
      accuracy     INTEGER,
      pp           INTEGER,
      damage_class TEXT,
      short_effect TEXT,
      target       TEXT,
      display_name TEXT,
      raw_data     TEXT
    );

    -- Learnset: qué movimientos puede aprender cada Pokémon (sin FK para no
    -- depender del orden de inserción entre pokemons/moves).
    CREATE TABLE IF NOT EXISTS pokemon_moves (
      pokemon_name TEXT NOT NULL,
      move_name    TEXT NOT NULL,
      learn_method TEXT,
      level        INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (pokemon_name, move_name)
    );
    CREATE INDEX IF NOT EXISTS idx_pokemon_moves_pokemon ON pokemon_moves(pokemon_name);

    -- Amistades ACEPTADAS (COMUNIDAD). Bidireccional: se guardan las dos direcciones.
    CREATE TABLE IF NOT EXISTS friendships (
      user_id    TEXT NOT NULL,
      friend_id  TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, friend_id)
    );
    CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);

    -- Solicitudes de amistad PENDIENTES (deben confirmarse por el receptor).
    CREATE TABLE IF NOT EXISTS friend_requests (
      from_id    TEXT NOT NULL,
      to_id      TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (from_id, to_id)
    );
    CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_id);

    -- Pokémon PROPIOS del jugador (inventario). Instancia por fila (permite
    -- duplicados y transferencias en survival). name = referencia lógica a pokemons.name.
    CREATE TABLE IF NOT EXISTS owned_pokemon (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      level        INTEGER NOT NULL DEFAULT 1,
      is_starter   INTEGER NOT NULL DEFAULT 0,
      is_shiny     INTEGER NOT NULL DEFAULT 0,
      acquired_via TEXT NOT NULL DEFAULT 'starter',
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_owned_pokemon_user ON owned_pokemon(user_id);

    -- Objetos del jugador (cosméticos, pokéballs...). qty por (user, kind, item_key).
    CREATE TABLE IF NOT EXISTS owned_items (
      user_id    TEXT NOT NULL,
      kind       TEXT NOT NULL,
      item_key   TEXT NOT NULL,
      qty        INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, kind, item_key)
    );
    CREATE INDEX IF NOT EXISTS idx_owned_items_user ON owned_items(user_id);

    -- Mensajes de chat directo (DM) PERSISTENTES. dm_room = 'dm:idA:idB' (ordenado).
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      dm_room    TEXT NOT NULL,
      from_id    TEXT NOT NULL,
      text       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(dm_room, id);

    -- Casa de subastas: cada fila es un lote a la venta (pokémon u objeto).
    CREATE TABLE IF NOT EXISTS auctions (
      id             TEXT PRIMARY KEY,
      seller_id      TEXT NOT NULL,
      kind           TEXT NOT NULL,            -- 'pokemon' | 'item'
      pokemon_id     TEXT,                     -- owned_pokemon.id (kind=pokemon)
      item_kind      TEXT,                     -- owned_items.kind (kind=item)
      item_key       TEXT,                     -- owned_items.item_key (kind=item)
      display_name   TEXT NOT NULL,
      display_level  INTEGER,
      starting_price INTEGER,                  -- puja mínima (nullable)
      buy_now_price  INTEGER,                  -- precio fijo (nullable)
      current_bid    INTEGER,
      current_bidder TEXT,
      duration_hours INTEGER NOT NULL,         -- 12|24|48
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at     TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'active',  -- active|sold|expired|cancelled
      winner_id      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status, expires_at);
  `);

  // Escrow de Pokémon en subasta: bloquea la instancia sin perder metadatos.
  const opCols = await db.all(`PRAGMA table_info(owned_pokemon)`);
  if (!opCols.some((c: { name: string }) => c.name === 'auction_id')) {
    await db.exec(`ALTER TABLE owned_pokemon ADD COLUMN auction_id TEXT`);
  }
  if (!opCols.some((c: { name: string }) => c.name === 'is_shiny')) {
    await db.exec(`ALTER TABLE owned_pokemon ADD COLUMN is_shiny INTEGER NOT NULL DEFAULT 0`);
  }

  // Migración defensiva: columna `email` en users (si la tabla ya existía).
  const userCols = await db.all(`PRAGMA table_info(users)`);
  const userNames = new Set(userCols.map((c: { name: string }) => c.name));
  if (!userNames.has('email')) await db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
  // Registro real: contraseña (hash), datos de perfil y 2FA.
  if (!userNames.has('password_hash')) await db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
  if (!userNames.has('age')) await db.exec(`ALTER TABLE users ADD COLUMN age INTEGER`);
  if (!userNames.has('is_student42'))
    await db.exec(`ALTER TABLE users ADD COLUMN is_student42 INTEGER NOT NULL DEFAULT 0`);
  if (!userNames.has('totp_secret')) await db.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`);
  if (!userNames.has('two_factor_enabled'))
    await db.exec(`ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0`);
  // Índice único de email (múltiples NULL permitidos en SQLite).
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  // Migración defensiva: añade columnas atk/def si la tabla pokemons ya existía.
  const cols = await db.all(`PRAGMA table_info(pokemons)`);
  const names = new Set(cols.map((c: { name: string }) => c.name));
  if (!names.has('atk')) await db.exec(`ALTER TABLE pokemons ADD COLUMN atk INTEGER NOT NULL DEFAULT 50`);
  if (!names.has('def')) await db.exec(`ALTER TABLE pokemons ADD COLUMN def INTEGER NOT NULL DEFAULT 40`);
  if (!names.has('speed')) await db.exec(`ALTER TABLE pokemons ADD COLUMN speed INTEGER NOT NULL DEFAULT 3`);
  if (!names.has('size')) await db.exec(`ALTER TABLE pokemons ADD COLUMN size TEXT NOT NULL DEFAULT 'medium'`);
  if (names.has('movementPattern')) {
    try {
      await db.exec(`ALTER TABLE pokemons DROP COLUMN movementPattern`);
    } catch {
      // Si SQLite es viejo y no soporta DROP COLUMN, no importa, ya no se usa, pero requeriría default value o nullable.
    }
  }

  // Migración defensiva: columnas del lobby multijugador en `matches`.
  const matchCols = await db.all(`PRAGMA table_info(matches)`);
  const matchNames = new Set(matchCols.map((c: { name: string }) => c.name));
  if (!matchNames.has('name')) await db.exec(`ALTER TABLE matches ADD COLUMN name TEXT`);
  if (!matchNames.has('mode'))
    await db.exec(`ALTER TABLE matches ADD COLUMN mode TEXT NOT NULL DEFAULT 'local'`);
  if (!matchNames.has('game_mode'))
    await db.exec(`ALTER TABLE matches ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'ffa'`);
  if (!matchNames.has('capacity'))
    await db.exec(`ALTER TABLE matches ADD COLUMN capacity INTEGER NOT NULL DEFAULT 2`);
  if (!matchNames.has('host_id')) await db.exec(`ALTER TABLE matches ADD COLUMN host_id TEXT`);
  if (!matchNames.has('players_json'))
    await db.exec(`ALTER TABLE matches ADD COLUMN players_json TEXT`);

  // Migración defensiva: columna target en moves
  const moveCols = await db.all(`PRAGMA table_info(moves)`);
  if (!moveCols.some((c: { name: string }) => c.name === 'target')) {
    await db.exec(`ALTER TABLE moves ADD COLUMN target TEXT`);
  }

  return db;
}
