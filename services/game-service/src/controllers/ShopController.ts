import { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/UserModel.js';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';
import { BALLS, rollTier, pickFromTier } from '../services/loot.js';
import { LOOT_POOL_TIERS } from '../services/lootPool.js';
import { STONES, STONE_KIND, stoneByKey } from '../services/stones.js';
import { RARE_CANDY_KIND, RARE_CANDY_KEY, RARE_CANDY_PRICE } from '../services/rareCandies.js';
import { ItemModel } from '../models/ItemModel.js';
import { xpToNext } from '../engine/progression.js';

interface BuyBody {
  ball?: string;
}
interface BuyStoneBody {
  stone?: string;
  qty?: number;
}

/** Precio de recuperar un Pokémon perdido en Survival (T8.3). */
const RECOVER_PRICE = 10000;

function userId(request: FastifyRequest): string | null {
  return (request as FastifyRequest & { userId?: string }).userId ?? null;
}

/**
 * Capa CONTROLADOR: tienda de pokéballs. Compra autoritativa: valida saldo,
 * resta monedas, tira el tier según la bola y concede un Pokémon al inventario.
 */
export const ShopController = {
  /** Bolas disponibles (precio + probabilidad de Pokémon "bueno" T3+T4) para la UI. */
  async balls(_request: FastifyRequest) {
    const list = Object.values(BALLS).map((b) => ({
      key: b.key,
      price: b.price,
      dist: b.dist,
      goodChance: b.dist[2] + b.dist[3], // % de T3+T4
    }));
    return { success: true, balls: list };
  },

  async buy(request: FastifyRequest<{ Body: BuyBody }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const ball = BALLS[(request.body?.ball ?? '').trim()];
    if (!ball) return reply.code(400).send({ success: false, error: 'Bola inválida' });

    const user = await UserModel.findById(uid);
    if (!user) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });
    if (user.coins < ball.price) {
      return reply.code(402).send({ success: false, error: 'Monedas insuficientes', coins: user.coins });
    }

    // Pool de loot v1.0.0: ~200 Pokémon (distintos al draft) tierizados por poder.
    const tier = rollTier(ball.dist, Math.random);
    const name = pickFromTier(LOOT_POOL_TIERS, tier, Math.random);

    // Lógica Shiny según el precio de la Pokéball
    let shinyChance = 0.01; // Normal: 1%
    if (ball.price >= 10000) shinyChance = 0.20; // Master: 20%
    else if (ball.price >= 2000) shinyChance = 0.07; // Ultra: 7%
    else if (ball.price >= 1000) shinyChance = 0.03; // Super: 3%
    
    const isShiny = Math.random() < shinyChance;

    // Cobro + concesión (el usuario ya no puede tener saldo negativo: se validó arriba).
    await UserModel.addCoins(uid, -ball.price);
    await OwnedPokemonModel.grantMany(uid, [name], 'shop', isShiny);

    return { success: true, pokemon: { name, tier, isShiny }, coins: user.coins - ball.price };
  },

  /** Piedras evolutivas a la venta (T9.2). */
  async stones(_request: FastifyRequest) {
    return { success: true, stones: STONES.map((s) => ({ key: s.key, price: s.price, label: s.label })) };
  },

  /** Compra una piedra evolutiva: valida saldo, resta monedas y la añade al inventario. */
  async buyStone(request: FastifyRequest<{ Body: BuyStoneBody }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const stone = stoneByKey((request.body?.stone ?? '').trim());
    if (!stone) return reply.code(400).send({ success: false, error: 'Piedra inválida' });

    const qty = Math.floor(Number(request.body?.qty) || 1);
    if (qty < 1 || qty > 99) {
      return reply.code(400).send({ success: false, error: 'Cantidad inválida (1-99)' });
    }

    const totalPrice = stone.price * qty;
    const user = await UserModel.findById(uid);
    if (!user) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });
    if (user.coins < totalPrice) {
      return reply.code(402).send({ success: false, error: 'Monedas insuficientes', coins: user.coins });
    }

    await UserModel.addCoins(uid, -totalPrice);
    await ItemModel.add(uid, STONE_KIND, stone.key, qty);
    return { success: true, stone: { key: stone.key, label: stone.label }, qty, coins: user.coins - totalPrice };
  },

  async listLostPokemon(request: FastifyRequest, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const lost = await OwnedPokemonModel.listLost(uid);
    return {
      pokemon: lost.map(p => ({ id: p.id, name: p.name, level: p.level, price: RECOVER_PRICE })),
    };
  },

  async recoverPokemon(request: FastifyRequest<{ Body: { id?: string } }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const user = await UserModel.findById(uid);
    if (!user) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });
    if (user.coins < RECOVER_PRICE) {
      return reply.code(402).send({ success: false, error: 'Monedas insuficientes', coins: user.coins });
    }

    const targetId = (request.body as { id?: string } | undefined)?.id;
    const recovered = targetId
      ? await OwnedPokemonModel.recoverById(targetId, uid)
      : await OwnedPokemonModel.recoverLast(uid);
    if (!recovered) {
      return reply.code(400).send({ success: false, error: 'No tienes ningún Pokémon perdido' });
    }
    await UserModel.addCoins(uid, -RECOVER_PRICE);
    return {
      success: true,
      pokemon: { name: recovered.name, level: recovered.level },
      coins: user.coins - RECOVER_PRICE,
    };
  },

  async buyCandy(request: FastifyRequest<{ Body: { qty?: number } }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const qty = Math.floor(Number(request.body?.qty) || 1);
    if (qty < 1 || qty > 99) {
      return reply.code(400).send({ success: false, error: 'Cantidad inválida (1-99)' });
    }

    const totalPrice = RARE_CANDY_PRICE * qty;
    const user = await UserModel.findById(uid);
    if (!user) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });
    if (user.coins < totalPrice) {
      return reply.code(402).send({ success: false, error: 'Monedas insuficientes', coins: user.coins });
    }

    await UserModel.addCoins(uid, -totalPrice);
    await ItemModel.add(uid, RARE_CANDY_KIND, RARE_CANDY_KEY, qty);
    return { success: true, qty, coins: user.coins - totalPrice };
  },

  async useCandy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const pokemonId = request.params.id;
    const rec = await OwnedPokemonModel.findById(pokemonId);
    if (!rec || rec.user_id !== uid) {
      return reply.code(404).send({ success: false, error: 'Pokémon no encontrado' });
    }

    const candyQty = await ItemModel.getQty(uid, RARE_CANDY_KIND, RARE_CANDY_KEY);
    if (candyQty < 1) {
      return reply.code(400).send({ success: false, error: 'No tienes Caramelos Raros' });
    }

    const xpNeeded = xpToNext(rec.level) - (rec.xp ?? 0);
    if (xpNeeded === Infinity || xpNeeded <= 0) {
      return reply.code(400).send({ success: false, error: 'Este Pokémon ya está al nivel máximo' });
    }

    await ItemModel.add(uid, RARE_CANDY_KIND, RARE_CANDY_KEY, -1);
    const result = await OwnedPokemonModel.addXp(pokemonId, xpNeeded);
    if (!result) {
      return reply.code(500).send({ success: false, error: 'Error al subir de nivel' });
    }

    return { success: true, level: result.level, xp: result.xp, levelsGained: result.levelsGained };
  },
};
