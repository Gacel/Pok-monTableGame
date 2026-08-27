import { FastifyReply, FastifyRequest } from 'fastify';
import { TradeService, TradeError } from '../services/TradeService.js';
import type { TradeRecord, TradeSide } from '../models/TradeModel.js';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';

function userId(request: FastifyRequest): string | null {
  return (request as FastifyRequest & { userId?: string }).userId ?? null;
}

interface ProposeBody {
  toUserId?: string;
  offer?: unknown;
  request?: unknown;
}
interface IdParams {
  id?: string;
}

/** Resuelve los Pokémon de un lado a {id, name, level} para mostrarlos en la UI. */
async function describeSide(side: TradeSide) {
  const recs = await OwnedPokemonModel.findManyByIds(side.pokemonIds);
  return {
    pokemon: recs.map((r) => ({ id: r.id, name: r.name, level: r.level })),
    items: side.items,
    coins: side.coins,
  };
}

async function describeTrade(t: TradeRecord, me: string) {
  return {
    id: t.id,
    fromUser: t.from_user,
    toUser: t.to_user,
    direction: t.from_user === me ? 'outgoing' : 'incoming',
    offer: await describeSide(t.offer),
    request: await describeSide(t.request),
    createdAt: t.created_at,
  };
}

/** Capa CONTROLADOR: intercambios entre amigos (T10.1). */
export const TradeController = {
  async propose(request: FastifyRequest<{ Body: ProposeBody }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const to = String(request.body?.toUserId ?? '').trim();
    if (!to) return reply.code(400).send({ success: false, error: 'Falta el destinatario' });
    try {
      const trade = await TradeService.propose(uid, to, request.body?.offer, request.body?.request);
      return { success: true, trade: await describeTrade(trade, uid) };
    } catch (e) {
      return replyError(reply, e);
    }
  },

  async accept(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    try {
      const trade = await TradeService.accept(String(request.params?.id ?? ''), uid);
      return { success: true, trade: await describeTrade(trade, uid) };
    } catch (e) {
      return replyError(reply, e);
    }
  },

  async cancel(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    try {
      await TradeService.cancel(String(request.params?.id ?? ''), uid);
      return { success: true };
    } catch (e) {
      return replyError(reply, e);
    }
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const uid = userId(request);
    if (!uid) return reply.code(401).send({ success: false, error: 'No autenticado' });
    const trades = await TradeService.listFor(uid);
    return { success: true, trades: await Promise.all(trades.map((t) => describeTrade(t, uid))) };
  },
};

function replyError(reply: FastifyReply, e: unknown) {
  if (e instanceof TradeError) return reply.code(e.status).send({ success: false, error: e.message });
  return reply.code(500).send({ success: false, error: 'Error interno' });
}
