import { apiFetch } from './api';

/** DTO de subasta (espejo de AuctionDTO del servidor). */
export interface Auction {
  id: string;
  sellerId: string;
  kind: 'pokemon' | 'item';
  displayName: string;
  displayLevel: number | null;
  startingPrice: number | null;
  buyNowPrice: number | null;
  currentBid: number | null;
  hasBids: boolean;
  durationHours: number;
  commissionPct: number;
  expiresAt: string;
  status: string;
}

export interface CreateAuctionPayload {
  kind: 'pokemon' | 'item';
  pokemonId?: string;
  itemKind?: string;
  itemKey?: string;
  startingPrice?: number | null;
  buyNowPrice?: number | null;
  durationHours: number;
}

async function asJson(res: Response): Promise<any> {
  return res.json().catch(() => ({}));
}

/** Capa de RED del frontend para la casa de subastas. */
export const AuctionApi = {
  async list(): Promise<Auction[]> {
    const res = await apiFetch('/api/auctions');
    const b = await asJson(res);
    return b.auctions ?? [];
  },
  async mine(): Promise<Auction[]> {
    const res = await apiFetch('/api/auctions/mine');
    const b = await asJson(res);
    return b.auctions ?? [];
  },
  async create(payload: CreateAuctionPayload): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch('/api/auctions', { method: 'POST', body: JSON.stringify(payload) });
    const b = await asJson(res);
    return { ok: res.ok && b.success, error: b.error };
  },
  async bid(id: string, amount: number): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch(`/api/auctions/${id}/bid`, { method: 'POST', body: JSON.stringify({ amount }) });
    const b = await asJson(res);
    return { ok: res.ok && b.success, error: b.error };
  },
  async buy(id: string): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch(`/api/auctions/${id}/buy`, { method: 'POST' });
    const b = await asJson(res);
    return { ok: res.ok && b.success, error: b.error };
  },
  async cancel(id: string): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch(`/api/auctions/${id}/cancel`, { method: 'POST' });
    const b = await asJson(res);
    return { ok: res.ok && b.success, error: b.error };
  },
};
