import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Board, Pokemon, Tile } from '../engine/board.js';
import { MapLoader, TiledMapData } from '../engine/mapLoader.js';
import { GameService } from './GameService.js';
import { PokemonService } from './PokemonService.js';
import { PokemonTemplate } from '../models/PokemonModel.js';
import { MatchModel } from '../models/MatchModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MATCH_ID = 'default';
const MAP_PATH = process.env.GAME_MAP_PATH ?? path.join(__dirname, '../../data/sample_map.json');
const TEAM_SIZE = 3;

/** Pool de 12 Pokémon para el draft (mezcla de tipos y patrones de movimiento). */
export const ROSTER_NAMES = [
  'charmander',
  'charizard',
  'vulpix',
  'growlithe', // FIRE → FLYING
  'squirtle',
  'blastoise',
  'psyduck',
  'poliwag', // WATER → TANK
  'bulbasaur',
  'oddish',
  'bellsprout',
  'tangela', // GRASS → SPEEDSTER
];

/**
 * Gestiona el ciclo de vida de la partida (MVP hot-seat con una partida por defecto):
 * roster de draft, creación 3v3 desde el mapa, persistencia y reanudación (C4.2).
 */
export class MatchManager {
  private match: GameService | null = null;
  private rosterCache: PokemonTemplate[] | null = null;

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

  /** Devuelve (y cachea) las 12 plantillas del pool de draft. */
  async getRoster(): Promise<PokemonTemplate[]> {
    if (this.rosterCache) return this.rosterCache;
    this.rosterCache = await Promise.all(ROSTER_NAMES.map((n) => PokemonService.getTemplate(n)));
    return this.rosterCache;
  }

  /** Colocaciones iniciales: los primeros N tiles para P1 y los últimos N para P2. */
  private placements(
    board: Board,
    team1: PokemonTemplate[],
    team2: PokemonTemplate[]
  ): { hex: Tile['hex']; pokemon: Pokemon }[] {
    const tiles = Array.from(board.tiles.values()).sort(
      (a, b) => a.hex.r - b.hex.r || a.hex.q - b.hex.q
    );
    const p1Tiles = tiles.slice(0, TEAM_SIZE);
    const p2Tiles = tiles.slice(-TEAM_SIZE).reverse();

    const build = (tpl: PokemonTemplate, playerId: string, i: number): Pokemon => ({
      ...tpl,
      id: `${playerId}-${i}`,
      playerId,
      level: 1,
    });

    return [
      ...team1.map((tpl, i) => ({ hex: p1Tiles[i]!.hex, pokemon: build(tpl, 'player1', i) })),
      ...team2.map((tpl, i) => ({ hex: p2Tiles[i]!.hex, pokemon: build(tpl, 'player2', i) })),
    ];
  }

  private async buildDefault(): Promise<GameService> {
    const board = this.loadBoard();
    const roster = await this.getRoster();
    // Por defecto: P1 tres de fuego, P2 tres de agua/planta.
    const team1 = roster.filter((p) => p.type === 'FIRE').slice(0, TEAM_SIZE);
    const team2 = [...roster.filter((p) => p.type === 'WATER'), ...roster.filter((p) => p.type === 'GRASS')].slice(0, TEAM_SIZE);
    return GameService.create(DEFAULT_MATCH_ID, board, this.placements(board, team1, team2));
  }

  /** Crea una partida a partir de los equipos elegidos en el draft. */
  async startMatch(teams: { player1: string[]; player2: string[] }): Promise<GameService> {
    const roster = await this.getRoster();
    const byName = new Map(roster.map((p) => [p.name, p]));
    const resolve = (names: string[]): PokemonTemplate[] =>
      names.map((n) => {
        const tpl = byName.get(n);
        if (!tpl) throw new Error(`Pokémon fuera del roster: ${n}`);
        return tpl;
      });

    const team1 = resolve(teams.player1);
    const team2 = resolve(teams.player2);
    const board = this.loadBoard();
    this.match = GameService.create(DEFAULT_MATCH_ID, board, this.placements(board, team1, team2));
    await this.persist();
    return this.match;
  }

  private loadBoard(): Board {
    try {
      const mapData = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8')) as TiledMapData;
      return MapLoader.loadTiledMap(mapData);
    } catch {
      return Board.generateBasic(4);
    }
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
