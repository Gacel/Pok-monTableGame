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
      if (!killerUser) continue; // sin dueño humano que capture (IA/salvaje)

      if (gameMode === 'survival') {
        // Capturar el salvaje derrotado por el humano (los salvajes no tienen instancia).
        if (!d.victimOwnedId && d.victimName) {
          await OwnedPokemonModel.capture(killerUser, d.victimName);
          results.push({ slot: d.killerSlot, name: d.victimName, kind: 'capture' });
        }
      } else {
        // BR: robar la instancia rival (nunca la propia).
        const victimUser = slotUser.get(d.victimSlot) ?? null;
        if (d.victimOwnedId && victimUser !== killerUser) {
          await OwnedPokemonModel.transfer(d.victimOwnedId, killerUser);
          results.push({ slot: d.killerSlot, name: d.victimName ?? '', kind: 'steal' });
        }
      }
    }
    return results;
  },
};
