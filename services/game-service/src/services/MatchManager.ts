import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Board, Pokemon } from '../engine/board.js';
import { MapLoader, TiledMapData } from '../engine/mapLoader.js';
import { GameService } from './GameService.js';
import { PokemonService } from './PokemonService.js';
import { MatchModel } from '../models/MatchModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_MATCH_ID = 'default';
const MAP_PATH = process.env.GAME_MAP_PATH ?? path.join(__dirname, '../../data/sample_map.json');

/**
 * Gestiona el ciclo de vida de la partida (MVP hot-seat con una partida por defecto).
 * Encapsula creación desde el mapa, persistencia y reanudación (C4.2).
 */
export class MatchManager {
  private match: GameService | null = null;

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

  private async buildDefault(): Promise<GameService> {
    const board = this.loadBoard();

    const [starterP1, starterP2] = await Promise.all([
      PokemonService.getTemplate('charmander'),
      PokemonService.getTemplate('squirtle'),
    ]);

    const p1: Pokemon = { ...starterP1, id: 'p1', playerId: 'player1', level: 1 };
    const p2: Pokemon = { ...starterP2, id: 'p2', playerId: 'player2', level: 1 };

    return GameService.create(DEFAULT_MATCH_ID, board, [
      { hex: { q: 0, r: 0 }, pokemon: p1 },
      { hex: { q: 3, r: 3 }, pokemon: p2 },
    ]);
  }

  private loadBoard(): Board {
    try {
      const mapData = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8')) as TiledMapData;
      return MapLoader.loadTiledMap(mapData);
    } catch {
      // Si no hay mapa, genera uno hexagonal básico para no caer.
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
