/**
 * Tipos de dominio del cliente.
 *
 * ANTES: este archivo era una copia a mano ("espejo") de los tipos del servidor,
 * lo que provocaba drift. AHORA re-exporta la ÚNICA fuente de verdad en
 * @transcendence/shared. No añadas definiciones locales aquí: edita packages/shared.
 */
export type {
  Hex,
  Biome,
  PokemonType,
  MoveDamageClass,
  PokemonMove,
  Pokemon,
  Tile,
  BallKey,
  PlayerResources,
  MoveOptions,
  MatchStatus,
  CombatAction,
  MatchStateDTO,
  MatchState,
} from '@transcendence/shared';
