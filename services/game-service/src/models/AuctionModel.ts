import { getDb } from './db.js';

export type AuctionKind = 'pokemon' | 'item';
export type AuctionStatus = 'active' | 'sold' | 'expired' | 'cancelled';

export interface AuctionRecord {
  id: string;
  seller_id: string;
  kind: AuctionKind;
  pokemon_id: string | null;
  item_kind: string | null;
  item_key: string | null;
  display_name: string;
  display_level: number | null;
  starting_price: number | null;
  buy_now_price: number | null;
  current_bid: number | null;
  current_bidder: string | null;
  duration_hours: number;
  created_at: string;
  expires_at: string;
  status: AuctionStatus;
  winner_id: string | null;
}

export interface NewAuction {
  id: string;
  sellerId: string;
  kind: AuctionKind;
  pokemonId?: string | null;
  itemKind?: string | null;
  itemKey?: string | null;
  displayName: string;
  displayLevel?: number | null;
  startingPrice?: number | null;
  buyNowPrice?: number | null;
  durationHours: number;
}

/** Capa MODELO: acceso a datos de la casa de subastas. Sin lógica HTTP. */
export const AuctionModel = {
  async create(a: NewAuction): Promise<AuctionRecord> {
    const db = await getDb();
    await db.run(
      `INSERT INTO auctions
        (id, seller_id, kind, pokemon_id, item_kind, item_key, display_name, display_level,
         starting_price, buy_now_price, duration_hours, expires_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), 'active')`,
      a.id,
      a.sellerId,
      a.kind,
      a.pokemonId ?? null,
      a.itemKind ?? null,
      a.itemKey ?? null,
      a.displayName,
      a.displayLevel ?? null,
      a.startingPrice ?? null,
      a.buyNowPrice ?? null,
      a.durationHours,
      `+${a.durationHours} hours`
    );
    const row = await this.findById(a.id);
    if (!row) throw new Error('No se pudo crear la subasta');
    return row;
  },

  async findById(id: string): Promise<AuctionRecord | undefined> {
    const db = await getDb();
    return db.get<AuctionRecord>('SELECT * FROM auctions WHERE id = ?', id);
  },

  /** Subastas activas (no expiradas), para el listado del mercado. */
  async listActive(): Promise<AuctionRecord[]> {
    const db = await getDb();
    return db.all<AuctionRecord[]>(
      "SELECT * FROM auctions WHERE status = 'active' ORDER BY expires_at ASC"
    );
  },

  /** Subastas del vendedor (cualquier estado), historial incluido. */
  async listBySeller(sellerId: string): Promise<AuctionRecord[]> {
    const db = await getDb();
    return db.all<AuctionRecord[]>(
      'SELECT * FROM auctions WHERE seller_id = ? ORDER BY created_at DESC LIMIT 50',
      sellerId
    );
  },

  /** Activas ya vencidas (para liquidar). */
  async listExpired(): Promise<AuctionRecord[]> {
    const db = await getDb();
    return db.all<AuctionRecord[]>(
      "SELECT * FROM auctions WHERE status = 'active' AND expires_at <= datetime('now')"
    );
  },

  async setBid(id: string, bid: number, bidderId: string): Promise<void> {
    const db = await getDb();
    await db.run('UPDATE auctions SET current_bid = ?, current_bidder = ? WHERE id = ?', bid, bidderId, id);
  },

  async close(id: string, status: AuctionStatus, winnerId: string | null): Promise<void> {
    const db = await getDb();
    await db.run('UPDATE auctions SET status = ?, winner_id = ? WHERE id = ?', status, winnerId, id);
  },
};
