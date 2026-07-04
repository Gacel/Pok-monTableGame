import { FastifyReply, FastifyRequest } from 'fastify';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';
import { ItemModel } from '../models/ItemModel.js';
import { PokemonService } from '../services/PokemonService.js';

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
};
