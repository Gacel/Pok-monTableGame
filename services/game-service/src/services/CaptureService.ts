import type { GameMode, MatchStateDTO, CaptureResult } from '@transcendence/shared';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';

/**
 * Capa SERVICIO: captura al derrotar ("tazos", Épica 8). Tras una acción, por cada KO:
 *  - **Survival**: si el humano derrota a un **salvaje** (sin `ownedId`), lo **captura** →
 *    nueva instancia en su inventario (T8.2).
 *  - **Battle Royale**: si un jugador derrota una **instancia** rival, la **roba** →
 *    transferencia de propiedad (T8.4).
 * Los KOs sin ganador humano (p.ej. los que hace la IA salvaje) no capturan nada.
 */
export const CaptureService = {
  async resolve(
    gameMode: GameMode,
    slotUser: Map<string, string | null>,
    state: MatchStateDTO
  ): Promise<CaptureResult[]> {
    if (gameMode !== 'survival' && gameMode !== 'br') return [];

    const results: CaptureResult[] = [];
    for (const d of state.defeats ?? []) {
      const killerUser = slotUser.get(d.killerSlot) ?? null;
      const victimUser = slotUser.get(d.victimSlot) ?? null;

      if (gameMode === 'survival') {
        // Captura: el humano derrota a un salvaje (sin instancia previa) → nueva instancia.
        if (killerUser && !d.victimOwnedId && d.victimName) {
          await OwnedPokemonModel.capture(killerUser, d.victimName);
          results.push({ slot: d.killerSlot, name: d.victimName, kind: 'capture' });
        }
        // Pérdida (T8.3): cae una instancia PROPIA del humano → se retira del inventario.
        if (victimUser && d.victimOwnedId) {
          await OwnedPokemonModel.markLost(d.victimOwnedId);
          results.push({ slot: d.victimSlot, name: d.victimName ?? '', kind: 'lost' });
        }
      } else {
        // BR: el ganador roba la instancia rival (nunca la propia).
        if (killerUser && d.victimOwnedId && victimUser !== killerUser) {
          await OwnedPokemonModel.transfer(d.victimOwnedId, killerUser);
          results.push({ slot: d.killerSlot, name: d.victimName ?? '', kind: 'steal' });
        }
      }
    }
    return results;
  },
};
