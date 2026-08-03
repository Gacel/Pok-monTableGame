import { TradeModel, TradeRecord, TradeSide } from '../models/TradeModel.js';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';
import { ItemModel } from '../models/ItemModel.js';
import { UserModel } from '../models/UserModel.js';
import { FriendModel } from '../models/FriendModel.js';
import { PokemonService } from './PokemonService.js';

export class TradeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Sanea un lado del intercambio (arrays, enteros no negativos, ids únicos). */
function normalizeSide(raw: Partial<TradeSide> | undefined): TradeSide {
  const pokemonIds = Array.from(new Set((raw?.pokemonIds ?? []).filter((x) => typeof x === 'string')));
  const items = (raw?.items ?? [])
    .filter((i) => i && typeof i.kind === 'string' && typeof i.itemKey === 'string')
    .map((i) => ({ kind: i.kind, itemKey: i.itemKey, qty: Math.max(1, Math.floor(i.qty || 0)) }));
  const coins = Math.max(0, Math.floor(raw?.coins || 0));
  return { pokemonIds, items, coins };
}

const isEmpty = (s: TradeSide): boolean => s.pokemonIds.length === 0 && s.items.length === 0 && s.coins === 0;

/**
 * Evolución POR INTERCAMBIO (T10.3, fiel a Gen 1): si la instancia recién intercambiada
 * evoluciona por `trade` (Kadabra→Alakazam, Machoke→Machamp, Graveler→Golem, Haunter→Gengar),
 * se aplica. Silencioso si no procede.
 */
async function applyTradeEvolution(pokemonId: string): Promise<void> {
  const rec = await OwnedPokemonModel.findById(pokemonId);
  if (!rec) return;
  const info = await PokemonService.getEvolution(rec.name).catch(() => null);
  if (info && info.trigger === 'trade') {
    await OwnedPokemonModel.evolve(pokemonId, info.evolvesTo);
  }
}

/** Valida que `user` posee TODO lo de `side` libre (no en subasta/trade/perdido). */
async function assertOwns(user: string, side: TradeSide, who: string): Promise<void> {
  if (side.pokemonIds.length > 0 && !(await OwnedPokemonModel.allOwnedBy(user, side.pokemonIds))) {
    throw new TradeError(400, `${who} no dispone de esos Pokémon`);
  }
  for (const it of side.items) {
    if ((await ItemModel.getQty(user, it.kind, it.itemKey)) < it.qty) {
      throw new TradeError(400, `${who} no tiene suficientes ${it.itemKey}`);
    }
  }
  if (side.coins > 0) {
    const u = await UserModel.findById(user);
    if (!u || u.coins < side.coins) throw new TradeError(400, `${who} no tiene monedas suficientes`);
  }
}

/**
 * Capa SERVICIO: intercambios con **escrow** (T10.1). El proponente oferta assets que quedan
 * retenidos; el destinatario aporta lo pedido al aceptar. Si se cancela, el escrow se devuelve.
 */
export const TradeService = {
  /** Propone un intercambio a un amigo y retiene en escrow lo ofertado. */
  async propose(fromUser: string, toUser: string, rawOffer: unknown, rawRequest: unknown): Promise<TradeRecord> {
    if (fromUser === toUser) throw new TradeError(400, 'No puedes intercambiar contigo mismo');
    if (!(await FriendModel.areFriends(fromUser, toUser))) {
      throw new TradeError(403, 'Solo puedes intercambiar con tus amigos');
    }
    const offer = normalizeSide(rawOffer as Partial<TradeSide>);
    const request = normalizeSide(rawRequest as Partial<TradeSide>);
    if (isEmpty(offer) && isEmpty(request)) throw new TradeError(400, 'El intercambio está vacío');

    await assertOwns(fromUser, offer, 'Tú');

    const id = await TradeModel.create(fromUser, toUser, offer, request);
    // Escrow de lo ofertado.
    for (const pid of offer.pokemonIds) await OwnedPokemonModel.setTrade(pid, id);
    for (const it of offer.items) await ItemModel.add(fromUser, it.kind, it.itemKey, -it.qty);
    if (offer.coins > 0) await UserModel.addCoins(fromUser, -offer.coins);

    return (await TradeModel.find(id))!;
  },

  /** El destinatario acepta: aporta lo pedido y se cruzan las propiedades. */
  async accept(tradeId: string, byUser: string): Promise<TradeRecord> {
    const t = await TradeModel.find(tradeId);
    if (!t || t.status !== 'pending') throw new TradeError(404, 'Intercambio no disponible');
    if (t.to_user !== byUser) throw new TradeError(403, 'No es tu intercambio');

    // El receptor debe poseer AHORA lo pedido (libre).
    await assertOwns(byUser, t.request, 'El destinatario');

    // Entrega lo ofertado (escrow) al receptor.
    for (const pid of t.offer.pokemonIds) await OwnedPokemonModel.completeTrade(pid, t.to_user);
    for (const it of t.offer.items) await ItemModel.add(t.to_user, it.kind, it.itemKey, it.qty);
    if (t.offer.coins > 0) await UserModel.addCoins(t.to_user, t.offer.coins);

    // Entrega lo pedido (del receptor) al proponente.
    for (const pid of t.request.pokemonIds) await OwnedPokemonModel.completeTrade(pid, t.from_user);
    for (const it of t.request.items) {
      await ItemModel.add(t.to_user, it.kind, it.itemKey, -it.qty);
      await ItemModel.add(t.from_user, it.kind, it.itemKey, it.qty);
    }
    if (t.request.coins > 0) {
      await UserModel.addCoins(t.to_user, -t.request.coins);
      await UserModel.addCoins(t.from_user, t.request.coins);
    }

    // Evoluciones por intercambio (T10.3): se aplican a las instancias recién movidas.
    for (const pid of [...t.offer.pokemonIds, ...t.request.pokemonIds]) {
      await applyTradeEvolution(pid);
    }

    await TradeModel.setStatus(tradeId, 'completed');
    return (await TradeModel.find(tradeId))!;
  },

  /** Cancela un intercambio pendiente (cualquiera de los dos) y devuelve el escrow. */
  async cancel(tradeId: string, byUser: string): Promise<void> {
    const t = await TradeModel.find(tradeId);
    if (!t || t.status !== 'pending') throw new TradeError(404, 'Intercambio no disponible');
    if (t.from_user !== byUser && t.to_user !== byUser) throw new TradeError(403, 'No es tu intercambio');

    // Devuelve el escrow al proponente.
    for (const pid of t.offer.pokemonIds) await OwnedPokemonModel.setTrade(pid, null);
    for (const it of t.offer.items) await ItemModel.add(t.from_user, it.kind, it.itemKey, it.qty);
    if (t.offer.coins > 0) await UserModel.addCoins(t.from_user, t.offer.coins);

    await TradeModel.setStatus(tradeId, 'cancelled');
  },

  /** Intercambios pendientes en los que participa el usuario. */
  async listFor(userId: string): Promise<TradeRecord[]> {
    return TradeModel.listPendingFor(userId);
  },
};
