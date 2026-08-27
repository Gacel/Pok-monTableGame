import { MOVE_SHAPES } from './moveShapes.js';

/** Subconjunto de un move necesario para puntuar/seleccionar (subset de MoveRow). */
export interface MoveCandidate {
  name: string;
  type: string;
  power?: number | null;
  damageClass?: string | null;
}

/** Moves curados en `MOVE_SHAPES` = emblemáticos → pequeño bonus de selección. */
const NOTABLE = new Set(Object.keys(MOVE_SHAPES));

/**
 * Puntuación de un candidato: potencia + STAB (mismo tipo que el Pokémon) + bonus a
 * moves emblemáticos. Cuanto mayor, más "representativo/útil".
 */
export function scoreMove(m: MoveCandidate, pokeType: string): number {
  const power = m.power ?? 0;
  const stab = m.type === pokeType ? 25 : 0;
  const notable = NOTABLE.has(m.name) ? 20 : 0;
  return power + stab + notable;
}

/**
 * Elige `count` moves representativos y **variados**: ordena por puntuación y hace una
 * primera pasada con **máximo 2 por tipo** (para no llevar 4 del mismo tipo), y una
 * segunda pasada de relleno sin límite si faltan. Preserva los objetos de entrada.
 */
export function selectMoves<T extends MoveCandidate>(
  candidates: T[],
  pokeType: string,
  count = 4
): T[] {
  const scored = [...candidates]
    .map((m) => ({ m, s: scoreMove(m, pokeType) }))
    .sort((a, b) => b.s - a.s);

  const picked: T[] = [];
  const seen = new Set<string>();
  const perType = new Map<string, number>();

  // 1ª pasada: variedad (máx 2 por tipo).
  for (const { m } of scored) {
    if (picked.length >= count) break;
    if (seen.has(m.name)) continue;
    if ((perType.get(m.type) ?? 0) >= 2) continue;
    seen.add(m.name);
    perType.set(m.type, (perType.get(m.type) ?? 0) + 1);
    picked.push(m);
  }
  // 2ª pasada: relleno por puntuación si aún faltan.
  for (const { m } of scored) {
    if (picked.length >= count) break;
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    picked.push(m);
  }
  return picked;
}
