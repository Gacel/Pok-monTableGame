import { FastifyReply, FastifyRequest } from 'fastify';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';
import { ItemModel } from '../models/ItemModel.js';
import { UserModel } from '../models/UserModel.js';
import { FriendModel } from '../models/FriendModel.js';
import { PokemonService } from '../services/PokemonService.js';

interface GiftParams {
  id?: string;
}
interface GiftBody {
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
};
