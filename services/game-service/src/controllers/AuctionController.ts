import { FastifyReply, FastifyRequest } from 'fastify';
import { AuctionService, AuctionError, CreateAuctionInput } from '../services/AuctionService.js';

function userId(request: FastifyRequest): string | undefined {
  return (request as FastifyRequest & { userId?: string }).userId;
}

interface CreateBody {
  kind?: 'pokemon' | 'item';
  pokemonId?: string;
  itemKind?: string;
  itemKey?: string;
  startingPrice?: number | null;
  buyNowPrice?: number | null;
  durationHours?: number;
}
interface BidBody {
  amount?: number;
}
interface IdParams {
  id: string;
}

/** Capa CONTROLADOR: casa de subastas. El id sale del JWT (hook global). */
export const AuctionController = {
  async list(_request: FastifyRequest, reply: FastifyReply) {
    try {
      return { success: true, auctions: await AuctionService.list() };
    } catch {
      return reply.code(500).send({ success: false, error: 'No se pudo cargar el mercado' });
    }
  },

  async mine(request: FastifyRequest, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    return { success: true, auctions: await AuctionService.mine(uid) };
  },

  async create(request: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const b = request.body ?? {};
    if (b.kind !== 'pokemon' && b.kind !== 'item') {
      return reply.code(400).send({ success: false, error: 'Tipo inválido' });
    }
    try {
      const input: CreateAuctionInput = {
        kind: b.kind,
        pokemonId: b.pokemonId,
        itemKind: b.itemKind,
        itemKey: b.itemKey,
        startingPrice: b.startingPrice ?? null,
        buyNowPrice: b.buyNowPrice ?? null,
        durationHours: Number(b.durationHours),
      };
      return { success: true, auction: await AuctionService.create(uid, input) };
    } catch (e) {
      if (e instanceof AuctionError) return reply.code(400).send({ success: false, error: e.message });
      throw e;
    }
  },

  async bid(request: FastifyRequest<{ Params: IdParams; Body: BidBody }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    try {
      const auction = await AuctionService.bid(uid, request.params.id, Number(request.body?.amount));
      return { success: true, auction };
    } catch (e) {
      if (e instanceof AuctionError) return reply.code(400).send({ success: false, error: e.message });
      throw e;
    }
  },

  async buy(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    try {
      const auction = await AuctionService.buyNow(uid, request.params.id);
      return { success: true, auction };
    } catch (e) {
      if (e instanceof AuctionError) return reply.code(400).send({ success: false, error: e.message });
      throw e;
    }
  },

  async cancel(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    try {
      await AuctionService.cancel(uid, request.params.id);
      return { success: true };
    } catch (e) {
      if (e instanceof AuctionError) return reply.code(400).send({ success: false, error: e.message });
      throw e;
    }
  },
};
