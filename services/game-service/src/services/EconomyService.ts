import type { PlayerSlot } from '@transcendence/shared';
import type { PlayResult } from './GameService.js';
import { RoomService } from './RoomService.js';
import { UserModel } from '../models/UserModel.js';

/** Monedas: 500 por Pokémon vencido; pool de 1000×perdedores repartido entre ganadores. */
const COINS_PER_KO = 500;
const WIN_POOL_PER_LOSER = 1000;

/**
 * Capa SERVICIO: economía de partida. Antes vivía dentro de OnlineGameController
 * (lógica de negocio en un controlador). Aquí queda aislada y reutilizable.
 */
export const EconomyService = {
  /**
   * Acredita monedas tras una acción online/arena: 500 al killer por cada KO y,
   * al finalizar, el pool de victoria repartido entre los ganadores.
   */
  async awardForResult(matchId: string, result: PlayResult): Promise<void> {
    const state = result.state;
    const hasDefeats = (state.defeats?.length ?? 0) > 0;
    const finished = state.status === 'finished' && !!state.winner;
    if (!hasDefeats && !finished) return;

    const bySlot = await RoomService.slotUserMap(matchId);
    for (const d of state.defeats ?? []) {
      const uid = bySlot.get(d.killerSlot as PlayerSlot);
      if (uid) await UserModel.addCoins(uid, COINS_PER_KO);
    }
    if (finished && state.winner) {
      const winners = state.winner.split(' & ');
      const losers = Math.max(0, state.players.length - winners.length);
      const perWinner = winners.length > 0 ? Math.floor((WIN_POOL_PER_LOSER * losers) / winners.length) : 0;
      for (const slot of winners) {
        const uid = bySlot.get(slot as PlayerSlot);
        if (uid && perWinner > 0) await UserModel.addCoins(uid, perWinner);
      }
    }
  },
};
