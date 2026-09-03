import type { Hex } from '@transcendence/shared';
import { GameService, PlayResult } from './GameService.js';
import { matchManager } from './MatchManager.js';
import { EconomyService } from './EconomyService.js';
import { ProgressionService } from './ProgressionService.js';
import { CaptureService } from './CaptureService.js';
import { RoomService } from './RoomService.js';
import { PokemonService } from './PokemonService.js';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';
import { hub } from '../realtime/hub.js';
import type { CaptureResult } from '@transcendence/shared';
import type { Hex as HexT } from '@transcendence/shared';

export type GameAction =
  | { type: 'move'; from: Hex; to: Hex }
  | { type: 'cast'; from: Hex; target: Hex; moveIndex: number }
  | { type: 'deploy'; pokemonId: string; hex: Hex }
  | { type: 'evolve'; from: Hex }
  | { type: 'end_turn' }
  | { type: 'abandon' }
  | { type: 'forceStart' };

/**
 * Contexto de ejecución de una acción.
 *  - `isLocal`: sala hot-seat (persistencia global, sin economía ni evict).
 *  - online: `matchId` para persistir/econonomía/evict; `room` es el destino del broadcast.
 */
export interface ActionContext {
  game: GameService;
  actor: string;
  isLocal: boolean;
  room: string;
  matchId?: string | undefined;
}



function run(ctx: ActionContext, action: GameAction): PlayResult {
  const { game, actor, isLocal } = ctx;
  switch (action.type) {
    case 'move':
      return game.play(actor, action.from, action.to);
    case 'cast':
      return game.cast(actor, action.from, action.target, action.moveIndex);
    case 'deploy':
      return game.deploy(actor, action.pokemonId, action.hex);
    case 'end_turn':
      return isLocal ? game.endTurn() : game.endTurn(actor);
    case 'abandon':
      return isLocal ? game.abandon() : game.abandon(actor);
    case 'forceStart':
      return game.forceStart();
    case 'evolve':
      // Se resuelve de forma asíncrona (catálogo + plantilla) en `resolveEvolve`.
      throw new Error('evolve se resuelve en apply()');
  }
}

/**
 * Evolución IN-MATCH (T9.4): resuelve el catálogo de evolución y la plantilla destino (async,
 * cache-first) y delega la mutación/coste en el engine. Persiste la nueva forma en la instancia
 * (`ownedId`) si la pieza es un Pokémon propio (D13: la forma persiste en ambos flujos).
 */
async function resolveEvolve(ctx: ActionContext, from: HexT): Promise<PlayResult> {
  const occ = ctx.game.getBoard().getOccupant(from);
  if (!occ) return { ok: false, error: 'No hay ninguna pieza ahí', state: ctx.game.getStateDTO() };

  const info = await PokemonService.getEvolution(occ.name ?? '');
  if (!info) {
    return { ok: false, error: 'Este Pokémon no evoluciona', state: ctx.game.getStateDTO() };
  }
  const tpl = await PokemonService.getTemplate(info.evolvesTo);
  const result = ctx.game.evolvePiece(ctx.actor, from, info, tpl);
  // Persiste la forma en el inventario si es una instancia propia (Survival/BR).
  if (result.ok && occ.ownedId) {
    await OwnedPokemonModel.evolve(occ.ownedId, info.evolvesTo).catch(() => {});
  }
  return result;
}

/**
 * Capa SERVICIO: pipeline ÚNICO de acción de partida (validar → mutar → persistir
 * → economía → difundir). Antes estaba TRIPLICADO en GameController,
 * OnlineGameController y ws.routes, con divergencias (combate). Ahora HTTP y WSS,
 * local y online, comparten esta orquestación.
 */
export const GameActionService = {
  async apply(ctx: ActionContext, action: GameAction): Promise<PlayResult> {
    const result = action.type === 'evolve' ? await resolveEvolve(ctx, action.from) : run(ctx, action);
    if (!result.ok) return result;

    let captures: CaptureResult[] = [];
    if (ctx.isLocal) {
      await matchManager.persist();
      await ProgressionService.awardMatchXp(result.state);
      const meta = matchManager.getLocalMeta();
      if (meta.gameMode === 'survival' && meta.ownerUserId) {
        const slotUser = new Map<string, string | null>([['player1', meta.ownerUserId]]);
        captures = await CaptureService.resolve('survival', slotUser, result.state);
      }
    } else if (ctx.matchId) {
      await matchManager.persistMatch(ctx.matchId);
      await EconomyService.awardForResult(ctx.matchId, result);
      await ProgressionService.awardMatchXp(result.state); // XP a las instancias propias (T6.1)
      // Robo PvP: en Battle Royale, un KO transfiere la instancia rival al ganador (T8.4).
      if ((await RoomService.gameModeOf(ctx.matchId)) === 'br') {
        const slotUser = new Map<string, string | null>(await RoomService.slotUserMap(ctx.matchId));
        captures = await CaptureService.resolve('br', slotUser, result.state);
      }
    }

    hub.broadcastPersonalized(ctx.room, (sCtx) => ({ type: 'state', state: ctx.game.getStateDTO(sCtx.slot ?? undefined) }));
    if (captures.length) hub.broadcast(ctx.room, { type: 'capture', captures });

    if (!ctx.isLocal && ctx.matchId && result.state.status === 'finished') {
      matchManager.evict(ctx.matchId);
    }
    return result;
  },
};
