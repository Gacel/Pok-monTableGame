import crypto from 'node:crypto';
import { getDb } from './db.js';

/** Un lado del intercambio: Pokémon (por ownedId), objetos (kind+key+qty) y monedas. */
export interface TradeSide {
  pokemonIds: string[];
  items: { kind: string; itemKey: string; qty: number }[];
  coins: number;
}

export interface TradeRecord {
  id: string;
  from_user: string;
  to_user: string;
  /** Lo que da el proponente (retenido en escrow). */
  offer: TradeSide;
  /** Lo que el proponente pide al destinatario (se valida/mueve al aceptar). */
  request: TradeSide;
  status: 'pending' | 'completed' | 'cancelled';
  created_at?: string;
}

interface TradeRow {
  id: string;
  from_user: string;
  to_user: string;
  offer_json: string;
  request_json: string;
  status: TradeRecord['status'];
  created_at?: string;
}

function toRecord(row: TradeRow): TradeRecord {
  return {
    id: row.id,
    from_user: row.from_user,
    to_user: row.to_user,
    offer: JSON.parse(row.offer_json) as TradeSide,
    request: JSON.parse(row.request_json) as TradeSide,
    status: row.status,
    ...(row.created_at ? { created_at: row.created_at } : {}),
  };
}

/** Capa MODELO: intercambios entre jugadores (T10.1). */
export const TradeModel = {
  async create(fromUser: string, toUser: string, offer: TradeSide, request: TradeSide): Promise<string> {
    const db = await getDb();
    const id = crypto.randomUUID();
    await db.run(
      'INSERT INTO trades (id, from_user, to_user, offer_json, request_json, status) VALUES (?, ?, ?, ?, ?, ?)',
      id, fromUser, toUser, JSON.stringify(offer), JSON.stringify(request), 'pending'
    );
    return id;
  },

  async find(id: string): Promise<TradeRecord | null> {
    const db = await getDb();
    const row = await db.get<TradeRow>('SELECT * FROM trades WHERE id = ?', id);
    return row ? toRecord(row) : null;
  },

  async setStatus(id: string, status: TradeRecord['status']): Promise<void> {
    const db = await getDb();
    await db.run('UPDATE trades SET status = ? WHERE id = ?', status, id);
  },

  /** Intercambios PENDIENTES en los que participa el usuario (entrantes y salientes). */
  async listPendingFor(userId: string): Promise<TradeRecord[]> {
    const db = await getDb();
    const rows = await db.all<TradeRow[]>(
      "SELECT * FROM trades WHERE status = 'pending' AND (from_user = ? OR to_user = ?) ORDER BY created_at DESC",
      userId, userId
    );
    return rows.map(toRecord);
  },
};
