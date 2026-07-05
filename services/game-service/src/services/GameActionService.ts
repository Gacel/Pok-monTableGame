import type { Hex, PlayerSlot } from '@transcendence/shared';
import { CombatAction, GameService, PlayResult } from './GameService.js';
import { matchManager } from './MatchManager.js';
import { EconomyService } from './EconomyService.js';
import { hub } from '../realtime/hub.js';

export const COMBAT_ACTIONS: CombatAction[] = ['ATACAR', 'HABILIDAD', 'OBJETO', 'HUIR', 'MOVE', 'TARGET'];

/** Acción de partida ya normalizada. `combat_action.action` se valida dentro. */
export type GameAction =
  | { type: 'move'; from: Hex; to: Hex }
  | { type: 'combat_action'; action: string; moveName?: string | undefined; targetId?: string | undefined }
  | { type: 'combat_continue' }
  | { type: 'end_turn' }
  | { type: 'abandon' };

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

/** ¿Controla `slot` al Pokémon que debe actuar en el combate en curso? */
export function controlsCombatTurn(game: GameService, slot: PlayerSlot): boolean {
  const combat = game.getStateDTO().combat;
  if (!combat) return false;
  const actorPlayer =
    combat.turnActorId === combat.attackerId ? combat.attackerPlayer : combat.defenderPlayer;
  return actorPlayer === slot;
}

function run(ctx: ActionContext, action: GameAction): PlayResult {
  const { game, actor, isLocal } = ctx;
  switch (action.type) {
    case 'move':
      return game.play(actor, action.from, action.to);
    case 'combat_action':
      return game.combatAction(action.action.toUpperCase() as CombatAction, action.moveName, action.targetId);
    case 'combat_continue':
      return game.continueCombat();
    case 'end_turn':
      return isLocal ? game.endTurn() : game.endTurn(actor);
    case 'abandon':
      return isLocal ? game.abandon() : game.abandon(actor);
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
    // Validación de acción de combate (única fuente) y propiedad del turno (online).
    if (action.type === 'combat_action') {
      if (!(COMBAT_ACTIONS as readonly string[]).includes(action.action.toUpperCase())) {
        return { ok: false, error: 'Acción de combate inválida', state: ctx.game.getStateDTO() };
      }
      if (!ctx.isLocal && !controlsCombatTurn(ctx.game, ctx.actor as PlayerSlot)) {
        return { ok: false, error: 'No es el turno de tu Pokémon', state: ctx.game.getStateDTO() };
      }
    }

    const result = run(ctx, action);
    if (!result.ok) return result;

    if (ctx.isLocal) {
      await matchManager.persist();
    } else if (ctx.matchId) {
      await matchManager.persistMatch(ctx.matchId);
      await EconomyService.awardForResult(ctx.matchId, result);
    }

    hub.broadcast(ctx.room, { type: 'state', state: result.state });

    if (!ctx.isLocal && ctx.matchId && result.state.status === 'finished') {
      matchManager.evict(ctx.matchId);
    }
    return result;
  },
};
