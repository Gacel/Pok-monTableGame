/**
 * Catálogo de evolución (T5.2, D13): parseo *fiel a PokeAPI* de una cadena de evolución
 * (`/evolution-chain/{id}`) para saber, dada una especie, si evoluciona, a qué forma y con
 * qué disparador. Lógica pura y testeable (sin red ni SQLite).
 */

export type EvolutionTrigger = 'level' | 'stone' | 'trade' | 'other';

export interface EvolutionInfo {
  /** Especie destino (slug PokeAPI). */
  evolvesTo: string;
  trigger: EvolutionTrigger;
  /** Nivel mínimo (trigger `level`). */
  minLevel?: number;
  /** Objeto requerido (trigger `stone`, o intercambio con objeto). */
  item?: string;
}

/** Nodo de la cadena de evolución de PokeAPI (subset usado). */
export interface ChainLink {
  species: { name: string };
  evolution_details?: {
    trigger?: { name?: string };
    min_level?: number | null;
    item?: { name?: string } | null;
  }[];
  evolves_to?: ChainLink[];
}
export interface EvolutionChainResponse {
  chain: ChainLink;
}

function findNode(node: ChainLink, name: string): ChainLink | null {
  if (node.species?.name === name) return node;
  for (const child of node.evolves_to ?? []) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}

/**
 * Dada la cadena y una especie, devuelve su evolución (la primera rama) o `null` si es forma
 * final / no evoluciona. Mapea el trigger de PokeAPI al dominio: `level-up`→`level`,
 * `use-item`→`stone`, `trade`→`trade`, resto→`other`.
 */
export function parseEvolutionChain(chain: EvolutionChainResponse, name: string): EvolutionInfo | null {
  const node = findNode(chain.chain, name.toLowerCase());
  if (!node || !node.evolves_to || node.evolves_to.length === 0) return null;

  const child = node.evolves_to[0]!;
  const d = child.evolution_details?.[0] ?? {};
  const raw = d.trigger?.name ?? '';

  const info: EvolutionInfo = { evolvesTo: child.species.name, trigger: 'other' };
  if (raw === 'level-up') {
    info.trigger = 'level';
    if (d.min_level != null) info.minLevel = d.min_level;
  } else if (raw === 'use-item') {
    info.trigger = 'stone';
    if (d.item?.name) info.item = d.item.name;
  } else if (raw === 'trade') {
    info.trigger = 'trade';
    if (d.item?.name) info.item = d.item.name;
  }
  return info;
}

// ------------------------------------------------------- resolución (T9.1)

/** Nombre en español de las piedras evolutivas de Gen 1 (slug PokeAPI → etiqueta). */
export const STONE_ES: Record<string, string> = {
  'fire-stone': 'Piedra Fuego',
  'water-stone': 'Piedra Agua',
  'thunder-stone': 'Piedra Trueno',
  'leaf-stone': 'Piedra Hoja',
  'moon-stone': 'Piedra Lunar',
};

/** Requisito legible (español) de una evolución. */
export function requirementLabel(info: EvolutionInfo): string {
  switch (info.trigger) {
    case 'level':
      return `Nivel ${info.minLevel ?? '?'}`;
    case 'stone':
      return STONE_ES[info.item ?? ''] ?? `Objeto: ${info.item ?? '?'}`;
    case 'trade':
      return info.item ? `Intercambio (con ${info.item})` : 'Intercambio';
    default:
      return 'No evoluciona por ahora';
  }
}

/** Resolución de evolución de una INSTANCIA en su contexto (nivel + objetos). */
export interface EvolutionResolution {
  /** Info de evolución de la especie (null = forma final / no evoluciona). */
  info: EvolutionInfo | null;
  /** Especie destino, o null si no evoluciona. */
  target: string | null;
  trigger: EvolutionTrigger | null;
  /** Requisito legible (español). */
  requirement: string;
  /** ¿Cumple el requisito AHORA en este contexto? (los de intercambio son de la Épica 10). */
  canEvolve: boolean;
}

/**
 * Resuelve, para una instancia, si puede evolucionar ya, a qué forma y con qué requisito.
 * PURA (sin red ni SQLite): recibe el catálogo (`info`) y el contexto. Los triggers `trade`/
 * `other` no evolucionan aquí (el intercambio es la Épica 10).
 */
export function resolveEvolution(
  info: EvolutionInfo | null,
  ctx: { level: number; items?: ReadonlySet<string> }
): EvolutionResolution {
  if (!info) {
    return { info: null, target: null, trigger: null, requirement: 'Forma final', canEvolve: false };
  }
  let canEvolve = false;
  if (info.trigger === 'level') {
    canEvolve = ctx.level >= (info.minLevel ?? Infinity);
  } else if (info.trigger === 'stone') {
    canEvolve = !!info.item && (ctx.items?.has(info.item) ?? false);
  }
  return {
    info,
    target: info.evolvesTo,
    trigger: info.trigger,
    requirement: requirementLabel(info),
    canEvolve,
  };
}
