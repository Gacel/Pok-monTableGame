import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = open({
      filename: path.join(__dirname, '../data/game.db'),
      driver: sqlite3.Database
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS pokemons (
          name TEXT PRIMARY KEY,
          hp INTEGER NOT NULL,
          maxHp INTEGER NOT NULL,
          type TEXT NOT NULL,
          movementPattern TEXT NOT NULL,
          raw_data TEXT
        );
      `);
      console.log('✅ SQLite database initialized at data/game.db');
      return db;
    });
  }
  return dbPromise;
}

export interface PokemonDBRecord {
  name: string;
  hp: number;
  maxHp: number;
  type: string;
  movementPattern: string;
  raw_data: string;
}
