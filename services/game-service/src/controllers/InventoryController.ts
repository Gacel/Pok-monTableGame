import { FastifyReply, FastifyRequest } from 'fastify';
import { SPRITE_TO_BALL } from '@transcendence/shared';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';
import { ItemModel } from '../models/ItemModel.js';
import { UserModel } from '../models/UserModel.js';
import { FriendModel } from '../models/FriendModel.js';
import { PokemonService } from '../services/PokemonService.js';
import { BALLS, rollTier, pickFromTier } from '../services/loot.js';
import { LOOT_POOL_TIERS } from '../services/lootPool.js';

interface GiftParams {
  id?: string;
}
interface GiftBody {
  toUserId?: string;
}
interface OpenBallBody {
  itemKey?: string;
}
interface GiftItemBody {
  kind?: string;
  itemKey?: string;
  toUserId?: string;
}

function userId(request: FastifyRequest): string | null {
  return (request as FastifyRequest & { userId?: string }).userId ?? null;
}

/** Capa CONTROLADOR: inventario del usuario (Pokémon propios + objetos). */
export const InventoryController = {
  async get(request: FastifyRequest, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const [owned, items] = await Promise.all([
      OwnedPokemonModel.listByUser(uid),
      ItemModel.listByUser(uid),
    ]);

    // Enriquecer cada Pokémon con sus stats (cache-first, no paga red tras la 1ª vez).
    const pokemon = await Promise.all(
      owned.map(async (p) => {
        let type = 'NORMAL';
        let hp = 0;
        let atk = 0;
        let def = 0;
        try {
          const t = await PokemonService.getTemplate(p.name);
          type = t.type;
          hp = t.hp;
          atk = t.atk;
          def = t.def;
        } catch {
          /* si PokeAPI falla, se devuelve solo el nombre */
        }
        return {
          id: p.id,
          name: p.name,
          level: p.level,
          isStarter: p.is_starter === 1,
          acquiredVia: p.acquired_via,
          type,
          hp,
          atk,
          def,
        };
      })
    );

    return {
      success: true,
      pokemon,
      items: items.map((i) => ({ kind: i.kind, itemKey: i.item_key, qty: i.qty })),
    };
  },

  /**
   * Regala un Pokémon propio a un AMIGO (transferencia directa de propiedad).
   * Validación autoritativa en servidor: propiedad, no en subasta, amistad y no a
   * uno mismo. No confía en el cliente.
   */
  async gift(
    request: FastifyRequest<{ Params: GiftParams; Body: GiftBody }>,
    reply: FastifyReply
  ) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const id = String(request.params.id ?? '');
    const toUserId = String(request.body?.toUserId ?? '').trim();
    if (!id || !toUserId) {
      return reply.code(400).send({ success: false, error: 'Faltan datos del regalo' });
    }
    if (toUserId === uid) {
      return reply.code(400).send({ success: false, error: 'No puedes regalarte a ti mismo' });
    }

    const rec = await OwnedPokemonModel.findById(id);
    if (!rec || rec.user_id !== uid) {
      return reply.code(404).send({ success: false, error: 'Pokémon no encontrado' });
    }
    if (rec.auction_id != null) {
      return reply.code(400).send({ success: false, error: 'Ese Pokémon está en una subasta' });
    }

    const target = await UserModel.findById(toUserId);
    if (!target) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });
    if (!(await FriendModel.areFriends(uid, toUserId))) {
      return reply.code(403).send({ success: false, error: 'Solo puedes regalar a tus amigos' });
    }

    await OwnedPokemonModel.gift(id, toUserId);
    return { success: true };
  },

  /**
   * Abre una bola del inventario: gasta 1 unidad y concede un Pokémon con el mismo
   * loot que la tienda (tier por bola). `itemKey` es el nombre de sprite PokeAPI
   * (poke-ball/great-ball/ultra-ball/master-ball).
   */
  async openBall(request: FastifyRequest<{ Body: OpenBallBody }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const itemKey = String(request.body?.itemKey ?? '').trim();
    const ballKey = SPRITE_TO_BALL[itemKey];
    const ball = ballKey ? BALLS[ballKey] : undefined;
    if (!ball) return reply.code(400).send({ success: false, error: 'Bola inválida' });

    if ((await ItemModel.getQty(uid, 'pokeball', itemKey)) < 1) {
      return reply.code(400).send({ success: false, error: 'No tienes esa bola' });
    }

    const tier = rollTier(ball.dist, Math.random);
    const name = pickFromTier(LOOT_POOL_TIERS, tier, Math.random);
    await ItemModel.add(uid, 'pokeball', itemKey, -1);
    await OwnedPokemonModel.grantMany(uid, [name], 'chest');

    return { success: true, pokemon: { name, tier } };
  },

  /** Regala un objeto (bola) a un amigo: transfiere 1 unidad. */
  async giftItem(request: FastifyRequest<{ Body: GiftItemBody }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });

    const kind = String(request.body?.kind ?? '').trim();
    const itemKey = String(request.body?.itemKey ?? '').trim();
    const toUserId = String(request.body?.toUserId ?? '').trim();
    if (!kind || !itemKey || !toUserId) {
      return reply.code(400).send({ success: false, error: 'Faltan datos del regalo' });
    }
    if (toUserId === uid) {
      return reply.code(400).send({ success: false, error: 'No puedes regalarte a ti mismo' });
    }

    const target = await UserModel.findById(toUserId);
    if (!target) return reply.code(404).send({ success: false, error: 'Usuario no encontrado' });
    if (!(await FriendModel.areFriends(uid, toUserId))) {
      return reply.code(403).send({ success: false, error: 'Solo puedes regalar a tus amigos' });
    }

    const ok = await ItemModel.transfer(uid, toUserId, kind, itemKey, 1);
    if (!ok) return reply.code(400).send({ success: false, error: 'No tienes ese objeto' });
    return { success: true };
  },
};
