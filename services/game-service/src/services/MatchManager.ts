import fs from 'node:fs';
import crypto from 'node:crypto';
import type { GameMode } from '@transcendence/shared';
import { TEAMS_MODE_ALLIANCES, TEAMS_MODE_PLAYERS } from '@transcendence/shared';
import { Board, Pokemon, Tile } from '../engine/board.js';
import { MapLoader, TiledMapData } from '../engine/mapLoader.js';
import { generateEcosystem } from '../engine/mapGenerator.js';
import { largestLandComponent, pickCornerSpawns } from '../engine/spawns.js';
import { hashStringToSeed } from '../engine/rng.js';
import { GameService } from './GameService.js';
import { PokemonService } from './PokemonService.js';
import { PokemonTemplate } from '../models/PokemonModel.js';
import { MatchModel } from '../models/MatchModel.js';

const DEFAULT_MATCH_ID = 'default';
/** Solo se usa si se define GAME_MAP_PATH (mapa Tiled manual, opt-in). */
const MAP_PATH = process.env.GAME_MAP_PATH;
/** Seed estable ⇒ mismo ecosistema en cada partida nueva; las guardadas no regeneran. */
const MAP_SEED = process.env.GAME_MAP_SEED ?? 'transcendence-default';
const MAP_RADIUS = Number(process.env.GAME_MAP_RADIUS ?? 20);
const TEAM_SIZE = 3;

/**
 * Pool de Pokémon para el draft. Solo formas base: se han purgado las
 * evoluciones (charizard, blastoise, pidgeot, dragonite, jolteon), que se
 * obtendrán evolucionando en partida más adelante.
 */
export const ROSTER_NAMES = [
  'charmander', 'vulpix', 'growlithe', // FIRE
  'squirtle', 'psyduck', 'poliwag', // WATER
  'bulbasaur', 'oddish', 'bellsprout', 'tangela', // GRASS
  'ekans', 'zubat', // POISON
  'aerodactyl', // FLYING
  'dratini', // DRAGON
  'abra', 'mewtwo', // PSYCHIC
  'snorlax', 'eevee', // NORMAL
  'pikachu', // ELECTRIC
  'lapras', 'articuno', // ICE
  'clefairy', 'jigglypuff', // FAIRY
];

/**
 * Gestiona el ciclo de vida de la partida (MVP hot-seat con una partida por defecto):
 * roster de draft, creación 3v3 desde el mapa, persistencia y reanudación (C4.2).
 */
export class MatchManager {
  private match: GameService | null = null;
  private rosterCache: PokemonTemplate[] | null = null;
  /** Partidas online en memoria, indexadas por matchId (carga perezosa). */
  private onlineMatches: Map<string, GameService> = new Map();

  async init(): Promise<GameService> {
    const saved = await MatchModel.loadState(DEFAULT_MATCH_ID);
    if (saved) {
      this.match = GameService.deserialize(saved);
    } else {
      this.match = await this.buildDefault();
      await this.persist();
    }
    return this.match;
  }

  /** Devuelve (y cachea) las plantillas del pool de draft. */
  async getRoster(): Promise<PokemonTemplate[]> {
    if (this.rosterCache) return this.rosterCache;
    this.rosterCache = await Promise.all(ROSTER_NAMES.map((n) => PokemonService.getTemplate(n)));
    return this.rosterCache;
  }

  /**
   * Colocaciones iniciales: spawns en las esquinas de la mayor componente
   * de tierra conectada (equipos alcanzables, ningún Pokémon nace en agua).
   */
  private placements(
    board: Board,
    teams: PokemonTemplate[][]
  ): { hex: Tile['hex']; pokemon: Pokemon }[] {
    const component = largestLandComponent(board);
    const hexClusters = pickCornerSpawns(board, component, TEAM_SIZE, teams.length);

    const build = (tpl: PokemonTemplate, playerId: string, i: number): Pokemon => ({
      ...tpl,
      id: `${playerId}-${i}`,
      playerId,
      level: 1,
    });

    const result: { hex: Tile['hex']; pokemon: Pokemon }[] = [];
    teams.forEach((team, tIdx) => {
      const playerId = `player${tIdx + 1}`;
      const cluster = hexClusters[tIdx] ?? [];
      team.forEach((tpl, i) => {
        if (cluster[i]) {
          result.push({ hex: cluster[i]!, pokemon: build(tpl, playerId, i) });
        }
      });
    });

    return result;
  }

  /**
   * Adjunta los ataques curados (importados de PokeAPI) a cada Pokémon en juego.
   * Se hace al crear la partida (≤12 Pokémon) y se cachea en SQLite, por lo que
   * solo la primera partida paga el coste de red; las siguientes son instantáneas.
   */
  private async withMoves(
    placements: { hex: Tile['hex']; pokemon: Pokemon }[]
  ): Promise<{ hex: Tile['hex']; pokemon: Pokemon }[]> {
    await Promise.all(
      placements.map(async (p) => {
        p.pokemon.moves = await PokemonService.getCuratedMoves(p.pokemon.name ?? '', p.pokemon.type);
      })
    );
    return placements;
  }

  private async buildDefault(): Promise<GameService> {
    const board = this.loadBoard();
    const roster = await this.getRoster();
    // Por defecto: 4 jugadores
    const team1 = roster.filter((p) => p.type === 'FIRE').slice(0, TEAM_SIZE);
    const team2 = roster.filter((p) => p.type === 'WATER').slice(0, TEAM_SIZE);
    const team3 = roster.filter((p) => p.type === 'GRASS').slice(0, TEAM_SIZE);
    const team4 = [...roster.filter((p) => p.type === 'ELECTRIC'), ...roster.filter((p) => p.type === 'NORMAL')].slice(0, TEAM_SIZE);
    const placements = await this.withMoves(this.placements(board, [team1, team2, team3, team4]));
    return GameService.create(DEFAULT_MATCH_ID, board, placements);
  }

  /** Resuelve nombres del roster a plantillas, en orden player1..player4. */
  private async resolveTeams(teams: Record<string, string[]>): Promise<PokemonTemplate[][]> {
    const roster = await this.getRoster();
    const byName = new Map(roster.map((p) => [p.name, p]));
    const resolve = (names: string[]): PokemonTemplate[] =>
      names.map((n) => {
        const tpl = byName.get(n);
        if (!tpl) throw new Error(`Pokémon fuera del roster: ${n}`);
        return tpl;
      });

    const teamArrays: PokemonTemplate[][] = [];
    for (let i = 1; i <= 4; i++) {
      const names = teams[`player${i}`];
      if (names && names.length > 0) {
        teamArrays.push(resolve(names));
      }
    }
    if (teamArrays.length < 2) {
      throw new Error('Se necesitan al menos 2 equipos para iniciar la partida');
    }
    return teamArrays;
  }

  /** Alianzas del modo 2v2 (P1+P3 vs P2+P4); null en todos contra todos. */
  private alliancesFor(gameMode: GameMode, teamCount: number): string[][] | null {
    if (gameMode !== 'teams') return null;
    if (teamCount !== TEAMS_MODE_PLAYERS) {
      throw new Error('El modo 2 vs 2 requiere exactamente 4 jugadores');
    }
    return TEAMS_MODE_ALLIANCES.map((team) => [...team]);
  }

  /** Crea la partida LOCAL a partir de los equipos elegidos en el draft. */
  async startMatch(
    teams: Record<string, string[]>,
    gameMode: GameMode = 'ffa'
  ): Promise<GameService> {
    const teamArrays = await this.resolveTeams(teams);
    const board = this.loadBoard();
    const placements = await this.withMoves(this.placements(board, teamArrays));
    this.match = GameService.create(
      DEFAULT_MATCH_ID,
      board,
      placements,
      this.alliancesFor(gameMode, teamArrays.length)
    );
    await this.persist();
    return this.match;
  }

  // ------------------------------------------------------- partidas online

  newId(): string {
    return `m_${crypto.randomUUID()}`;
  }

  /** Partida online por id: memoria → SQLite (carga perezosa) → error. */
  async getMatch(id: string): Promise<GameService | null> {
    const cached = this.onlineMatches.get(id);
    if (cached) return cached;
    const saved = await MatchModel.loadState(id);
    if (!saved) return null;
    const game = GameService.deserialize(saved);
    this.onlineMatches.set(id, game);
    return game;
  }

  /** Crea el juego de una sala online cuando todos han enviado su equipo. */
  async createGame(
    id: string,
    teams: Record<string, string[]>,
    gameMode: GameMode
  ): Promise<GameService> {
    const teamArrays = await this.resolveTeams(teams);
    const board = this.loadBoard();
    const placements = await this.withMoves(this.placements(board, teamArrays));
    const game = GameService.create(
      id,
      board,
      placements,
      this.alliancesFor(gameMode, teamArrays.length)
    );
    this.onlineMatches.set(id, game);
    await this.persistMatch(id);
    return game;
  }

  async persistMatch(id: string): Promise<void> {
    const game = this.onlineMatches.get(id);
    if (!game) return;
    await MatchModel.upsert(game.matchRow, game.serialize());
  }

  /** Saca una partida terminada de la caché en memoria. */
  evict(id: string): void {
    this.onlineMatches.delete(id);
  }

  async persistAll(): Promise<void> {
    await this.persist();
    for (const id of this.onlineMatches.keys()) {
      await this.persistMatch(id);
    }
  }

  private loadBoard(): Board {
    // Opt-in: mapa Tiled manual si se define GAME_MAP_PATH.
    if (MAP_PATH) {
      try {
        const mapData = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8')) as TiledMapData;
        return MapLoader.loadTiledMap(mapData);
      } catch {
        // Si el Tiled indicado falla, caemos al ecosistema procedural.
      }
    }
    // Por defecto: ecosistema procedural grande y coherente (seed estable).
    return generateEcosystem(hashStringToSeed(MAP_SEED), { radius: MAP_RADIUS });
  }

  get(): GameService {
    if (!this.match) throw new Error('MatchManager no inicializado');
    return this.match;
  }

  async persist(): Promise<void> {
    if (!this.match) return;
    await MatchModel.upsert(this.match.matchRow, this.match.serialize());
  }

  async reset(): Promise<GameService> {
    this.match = await this.buildDefault();
    await this.persist();
    return this.match;
  }
}

export const matchManager = new MatchManager();
