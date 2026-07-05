import { randomUUID } from 'node:crypto';
import { AuctionModel, AuctionRecord, AuctionKind } from '../models/AuctionModel.js';
import { UserModel } from '../models/UserModel.js';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';
import { ItemModel } from '../models/ItemModel.js';

/**
 * Condiciones por duración: comisión (% del precio de venta, al vender) y tarifa
 * plana (si NO se vende, al expirar). Ver docs/AUCTIONS.md.
 */
export const AUCTION_TERMS: Record<number, { commission: number; unsoldFee: number }> = {
  12: { commission: 0.05, unsoldFee: 100 },
  24: { commission: 0.1, unsoldFee: 200 },
  48: { commission: 0.15, unsoldFee: 400 },
};
const DURATIONS = [12, 24, 48];
const MAX_PRICE = 10_000_000;

export interface CreateAuctionInput {
  kind: AuctionKind;
  pokemonId?: string | undefined;
  itemKind?: string | undefined;
  itemKey?: string | undefined;
  startingPrice?: number | null | undefined;
  buyNowPrice?: number | null | undefined;
  durationHours: number;
}

export interface AuctionDTO {
  id: string;
  sellerId: string;
  kind: AuctionKind;
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

export class AuctionError extends Error {}

async function coinsOf(id: string): Promise<number> {
  return (await UserModel.findById(id))?.coins ?? 0;
}

function toDTO(a: AuctionRecord): AuctionDTO {
  return {
    id: a.id,
    sellerId: a.seller_id,
    kind: a.kind,
    displayName: a.display_name,
    displayLevel: a.display_level,
    startingPrice: a.starting_price,
    buyNowPrice: a.buy_now_price,
    currentBid: a.current_bid,
    hasBids: !!a.current_bidder,
    durationHours: a.duration_hours,
    commissionPct: Math.round((AUCTION_TERMS[a.duration_hours]?.commission ?? 0) * 100),
    expiresAt: a.expires_at,
    status: a.status,
  };
}

/** Entrega el lote (pokémon u objeto) a `toUserId`. */
async function deliver(a: AuctionRecord, toUserId: string): Promise<void> {
  if (a.kind === 'pokemon' && a.pokemon_id) {
    await OwnedPokemonModel.transferSold(a.pokemon_id, toUserId);
  } else if (a.kind === 'item' && a.item_kind && a.item_key) {
    await ItemModel.add(toUserId, a.item_kind, a.item_key, 1);
  }
}

/** Devuelve el escrow al vendedor (subasta no vendida o cancelada). */
async function returnEscrow(a: AuctionRecord): Promise<void> {
  if (a.kind === 'pokemon' && a.pokemon_id) {
    await OwnedPokemonModel.setAuction(a.pokemon_id, null);
  } else if (a.kind === 'item' && a.item_kind && a.item_key) {
    await ItemModel.add(a.seller_id, a.item_kind, a.item_key, 1);
  }
}

/**
 * Capa SERVICIO: casa de subastas. El servidor es autoritativo (valida saldo,
 * propiedad y estado). Las pujas escrowan monedas; el lote se retiene en depósito.
 */
export const AuctionService = {
  /** Liquida todas las subastas vencidas (idempotente). */
  async settleExpired(): Promise<void> {
    const expired = await AuctionModel.listExpired();
    for (const a of expired) {
      if (a.current_bidder && a.current_bid) {
        // Vendida por pujas: el comprador ya pagó (escrow). El vendedor cobra menos comisión.
        const commission = AUCTION_TERMS[a.duration_hours]?.commission ?? 0;
        const proceeds = Math.floor(a.current_bid * (1 - commission));
        await deliver(a, a.current_bidder);
        await UserModel.addCoins(a.seller_id, proceeds);
        await AuctionModel.close(a.id, 'sold', a.current_bidder);
      } else {
        // No vendida: se devuelve el lote y se cobra la tarifa plana (sin saldo negativo).
        await returnEscrow(a);
        const fee = AUCTION_TERMS[a.duration_hours]?.unsoldFee ?? 0;
        const charge = Math.min(fee, await coinsOf(a.seller_id));
        if (charge > 0) await UserModel.addCoins(a.seller_id, -charge);
        await AuctionModel.close(a.id, 'expired', null);
      }
    }
  },

  async list(): Promise<AuctionDTO[]> {
    await this.settleExpired();
    return (await AuctionModel.listActive()).map(toDTO);
  },

  async mine(sellerId: string): Promise<AuctionDTO[]> {
    await this.settleExpired();
    return (await AuctionModel.listBySeller(sellerId)).map(toDTO);
  },

  async create(sellerId: string, input: CreateAuctionInput): Promise<AuctionDTO> {
    if (!DURATIONS.includes(input.durationHours)) {
      throw new AuctionError('Duración inválida (12, 24 o 48h)');
    }
    const starting = normPrice(input.startingPrice);
    const buyNow = normPrice(input.buyNowPrice);
    if (starting === null && buyNow === null) {
      throw new AuctionError('Indica un precio de salida o un precio fijo');
    }
    if (starting !== null && buyNow !== null && buyNow < starting) {
      throw new AuctionError('El precio fijo no puede ser menor que el de salida');
    }

    const id = randomUUID();
    let displayName = '';
    let displayLevel: number | null = null;

    if (input.kind === 'pokemon') {
      if (!input.pokemonId) throw new AuctionError('Falta el Pokémon');
      const p = await OwnedPokemonModel.findById(input.pokemonId);
      if (!p || p.user_id !== sellerId) throw new AuctionError('Ese Pokémon no es tuyo');
      if ((p as { auction_id?: string | null }).auction_id) {
        throw new AuctionError('Ese Pokémon ya está en subasta');
      }
      displayName = p.name;
      displayLevel = p.level;
      await AuctionModel.create({
        id, sellerId, kind: 'pokemon', pokemonId: input.pokemonId,
        displayName, displayLevel, startingPrice: starting, buyNowPrice: buyNow,
        durationHours: input.durationHours,
      });
      await OwnedPokemonModel.setAuction(input.pokemonId, id);
    } else {
      if (!input.itemKind || !input.itemKey) throw new AuctionError('Falta el objeto');
      if ((await ItemModel.getQty(sellerId, input.itemKind, input.itemKey)) < 1) {
        throw new AuctionError('No tienes ese objeto');
      }
      displayName = input.itemKey;
      await AuctionModel.create({
        id, sellerId, kind: 'item', itemKind: input.itemKind, itemKey: input.itemKey,
        displayName, startingPrice: starting, buyNowPrice: buyNow,
        durationHours: input.durationHours,
      });
      await ItemModel.add(sellerId, input.itemKind, input.itemKey, -1);
    }

    const created = await AuctionModel.findById(id);
    return toDTO(created!);
  },

  async bid(bidderId: string, auctionId: string, amount: number): Promise<AuctionDTO> {
    await this.settleExpired();
    const a = await AuctionModel.findById(auctionId);
    if (!a || a.status !== 'active') throw new AuctionError('La subasta ya no está activa');
    if (a.seller_id === bidderId) throw new AuctionError('No puedes pujar en tu propia subasta');
    if (a.starting_price === null) throw new AuctionError('Esta subasta es solo de precio fijo');
    if (!Number.isInteger(amount) || amount <= 0) throw new AuctionError('Puja inválida');
    if (a.buy_now_price !== null && amount >= a.buy_now_price) {
      throw new AuctionError('Esa cantidad alcanza el precio fijo: usa "Comprar ya"');
    }
    const min = a.current_bid !== null ? a.current_bid + 1 : a.starting_price;
    if (amount < min) throw new AuctionError(`La puja mínima es ${min}`);
    if ((await coinsOf(bidderId)) < amount) throw new AuctionError('No tienes monedas suficientes');

    // Escrow: retira al pujador y reembolsa al anterior mejor postor.
    await UserModel.addCoins(bidderId, -amount);
    if (a.current_bidder && a.current_bid) {
      await UserModel.addCoins(a.current_bidder, a.current_bid);
    }
    await AuctionModel.setBid(auctionId, amount, bidderId);
    return toDTO((await AuctionModel.findById(auctionId))!);
  },

  async buyNow(buyerId: string, auctionId: string): Promise<AuctionDTO> {
    await this.settleExpired();
    const a = await AuctionModel.findById(auctionId);
    if (!a || a.status !== 'active') throw new AuctionError('La subasta ya no está activa');
    if (a.seller_id === buyerId) throw new AuctionError('No puedes comprar tu propia subasta');
    if (a.buy_now_price === null) throw new AuctionError('Esta subasta no tiene precio fijo');
    if ((await coinsOf(buyerId)) < a.buy_now_price) {
      throw new AuctionError('No tienes monedas suficientes');
    }

    await UserModel.addCoins(buyerId, -a.buy_now_price);
    if (a.current_bidder && a.current_bid) {
      await UserModel.addCoins(a.current_bidder, a.current_bid); // reembolsa puja pendiente
    }
    await deliver(a, buyerId);
    const commission = AUCTION_TERMS[a.duration_hours]?.commission ?? 0;
    await UserModel.addCoins(a.seller_id, Math.floor(a.buy_now_price * (1 - commission)));
    await AuctionModel.close(auctionId, 'sold', buyerId);
    return toDTO((await AuctionModel.findById(auctionId))!);
  },

  async cancel(sellerId: string, auctionId: string): Promise<void> {
    await this.settleExpired();
    const a = await AuctionModel.findById(auctionId);
    if (!a || a.status !== 'active') throw new AuctionError('La subasta ya no está activa');
    if (a.seller_id !== sellerId) throw new AuctionError('No es tu subasta');
    if (a.current_bidder) throw new AuctionError('No puedes cancelar: ya tiene pujas');
    await returnEscrow(a);
    await AuctionModel.close(auctionId, 'cancelled', null);
  },
};

function normPrice(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (!Number.isInteger(v) || v <= 0 || v > MAX_PRICE) throw new AuctionError('Precio inválido');
  return v;
}
