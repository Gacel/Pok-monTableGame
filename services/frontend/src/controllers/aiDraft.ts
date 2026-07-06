import { typeAdvantage } from '@transcendence/shared';
import type { BotLevel } from './botStrategy';

/**
 * Selección del equipo de la IA (partida de un jugador). Lógica PURA y testeable.
 *
 * Por dificultad:
 *  - FÁCIL (1):   equipo aleatorio.
 *  - NORMAL (2):  los de mejores stats (con algo de azar).
 *  - DIFÍCIL (3): CONTRAPICA por tipo al equipo del jugador (ventaja de tipo) y
 *                 además valora stats. Elige lo que mejor le gana al rival.
 *
 * Nunca repite Pokémon del equipo del jugador (regla de no-repetición local).
 */
export interface RosterMon {
  name: string;
  type: string;
  hp: number;
  atk: number;
  def: number;
}

const TEAM_SIZE = 3;

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const statSum = (p: RosterMon): number => (p.hp ?? 0) + (p.atk ?? 0) + (p.def ?? 0);

export function pickAiTeam(
  roster: RosterMon[],
  humanTeam: string[],
  level: BotLevel,
  rng: () => number
): string[] {
  const avail = roster.filter((p) => !humanTeam.includes(p.name));
  if (avail.length <= TEAM_SIZE) return avail.slice(0, TEAM_SIZE).map((p) => p.name);

  // FÁCIL: totalmente aleatorio.
  if (level === 1) {
    return shuffle(avail, rng)
      .slice(0, TEAM_SIZE)
      .map((p) => p.name);
  }

  const humanTypes = humanTeam
    .map((n) => roster.find((p) => p.name === n)?.type)
    .filter((t): t is string => !!t);

  // NORMAL y DIFÍCIL puntúan por stats; DIFÍCIL además contrapica por tipo.
  const scored = avail
    .map((p) => {
      let score = statSum(p);
      if (level === 3 && humanTypes.length) {
        const adv =
          humanTypes.reduce((s, ht) => s + typeAdvantage(p.type, ht), 0) / humanTypes.length;
        score += adv * 120; // premia fuerte la ventaja de tipo frente al rival
      }
      // Algo de azar para que no sea 100% predecible (menos en DIFÍCIL).
      score += rng() * (level === 3 ? 20 : 60);
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, TEAM_SIZE).map((s) => s.p.name);
}
