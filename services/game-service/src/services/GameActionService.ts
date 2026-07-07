import type { Hex } from '@transcendence/shared';
import { GameService, PlayResult } from './GameService.js';
import { matchManager } from './MatchManager.js';
import { EconomyService } from './EconomyService.js';
import { hub } from '../realtime/hub.js';

export type GameAction =
  | { type: 'move'; from: Hex; to: Hex }
  | { type: 'cast'; from: Hex; target: Hex; moveIndex: number }
  | { type: 'deploy'; pokemonId: string; hex: Hex }
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
  }
}

/**
 * Capa SERVICIO: pipeline ÚNICO de acción de partida (validar → mutar → persistir
 * → economía → difundir). Antes estaba TRIPLICADO en GameController,
 * OnlineGameController y ws.routes, con divergencias (combate). Ahora HTTP y WSS,
 * local y online, comparten esta orquestación.
 */
export const GameActionService = {
  async apply(ctx: ActionContext, action: GameAction): Promise<PlayResult> {


    const result = run(ctx, action);
    if (!result.ok) return result;

    if (ctx.isLocal) {
      await matchManager.persist();
    } else if (ctx.matchId) {
      await matchManager.persistMatch(ctx.matchId);
      await EconomyService.awardForResult(ctx.matchId, result);
    }

    hub.broadcastPersonalized(ctx.room, (sCtx) => ({ type: 'state', state: ctx.game.getStateDTO(sCtx.slot ?? undefined) }));

    if (!ctx.isLocal && ctx.matchId && result.state.status === 'finished') {
      matchManager.evict(ctx.matchId);
    }
    return result;
  },
};
