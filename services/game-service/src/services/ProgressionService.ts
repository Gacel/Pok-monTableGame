import type { MatchStateDTO } from '@transcendence/shared';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';

/** XP a la instancia atacante por cada KO que provoca. */
const XP_PER_KO = 30;
/** XP de bonus a cada instancia propia que sobrevive en el equipo ganador. */
const XP_WIN_SURVIVOR = 40;

/**
 * Capa SERVICIO: progresión de instancias tras una acción/partida (T6.1). Otorga XP a los
 * Pokémon PROPIOS (`ownedId`) por sus KOs y, al terminar, un bonus a los supervivientes del
 * bando ganador. Persiste nivel/XP. Las piezas de draft/local (sin `ownedId`) se ignoran.
 */
export const ProgressionService = {
  async awardMatchXp(state: MatchStateDTO): Promise<void> {
    // XP por KO: a la instancia atacante (si es un Pokémon propio).
    for (const d of state.defeats ?? []) {
      if (d.killerOwnedId) await OwnedPokemonModel.addXp(d.killerOwnedId, XP_PER_KO);
    }

    // Bonus de victoria: a cada instancia propia VIVA del bando ganador, una sola vez
    // (al finalizar la partida).
    if (state.status === 'finished' && state.winner) {
      const winners = new Set(state.winner.split(' & '));
      const seen = new Set<string>();
      for (const tile of state.tiles) {
        const occ = tile.occupant;
        if (!occ?.ownedId || !winners.has(occ.playerId)) continue;
        if (seen.has(occ.ownedId)) continue; // colosos ocupan varias casillas
        seen.add(occ.ownedId);
        await OwnedPokemonModel.addXp(occ.ownedId, XP_WIN_SURVIVOR);
      }
    }
  },
};
