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
      movementPattern TEXT NOT NULL,
      raw_data        TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      username   TEXT,
      avatarUrl  TEXT,
      level      INTEGER NOT NULL DEFAULT 1,
      coins      INTEGER NOT NULL DEFAULT 0,
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
  `);

  // Migración defensiva: añade columnas atk/def si la tabla pokemons ya existía.
  const cols = await db.all(`PRAGMA table_info(pokemons)`);
  const names = new Set(cols.map((c: { name: string }) => c.name));
  if (!names.has('atk')) await db.exec(`ALTER TABLE pokemons ADD COLUMN atk INTEGER NOT NULL DEFAULT 50`);
  if (!names.has('def')) await db.exec(`ALTER TABLE pokemons ADD COLUMN def INTEGER NOT NULL DEFAULT 40`);

  return db;
}
