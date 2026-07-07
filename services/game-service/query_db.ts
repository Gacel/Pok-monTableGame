import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';

async function main() {
  const db = await open({ filename: 'data/game.db', driver: sqlite3.Database });
  const rows = await db.all("SELECT * FROM moves LIMIT 1;");
  console.log(rows);
  const info = await db.all("PRAGMA table_info(moves);");
  console.log(info);
}
main();
