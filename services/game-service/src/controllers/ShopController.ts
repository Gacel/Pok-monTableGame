import { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/UserModel.js';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';
import { matchManager } from '../services/MatchManager.js';
import { BALLS, buildTiers, rollTier, pickFromTier } from '../services/loot.js';

interface BuyBody {
  ball?: string;
}

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

    const roster = await matchManager.getRoster();
    const tiers = buildTiers(roster);
    const tier = rollTier(ball.dist, Math.random);
    const name = pickFromTier(tiers, tier, Math.random);

    // Cobro + concesión (el usuario ya no puede tener saldo negativo: se validó arriba).
    await UserModel.addCoins(uid, -ball.price);
    await OwnedPokemonModel.grantMany(uid, [name], 'shop');

    return { success: true, pokemon: { name, tier }, coins: user.coins - ball.price };
  },
};
