import fs from 'node:fs';
import crypto from 'node:crypto';
import type { GameMode } from '@transcendence/shared';
import { TEAMS_MODE_ALLIANCES, TEAMS_MODE_PLAYERS, OWNED_TEAM_MODES } from '@transcendence/shared';
import { Board, Pokemon, Tile } from '../engine/board.js';
import { MapLoader, TiledMapData } from '../engine/mapLoader.js';
import { generateEcosystem } from '../engine/mapGenerator.js';
import { largestLandComponent, pickCornerSpawns, pickRandomSpawns } from '../engine/spawns.js';
import { hashStringToSeed, makeRng } from '../engine/rng.js';
import { GameService } from './GameService.js';
import { PokemonService } from './PokemonService.js';
import { PokemonTemplate } from '../models/PokemonModel.js';
import { MatchModel } from '../models/MatchModel.js';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';
import { scaledVitals } from '../engine/progression.js';
import { isGen1, randomGen1Names } from '../engine/gen1.js';

/**
 * Plantilla de Pokémon augmentada con la identidad de una instancia del inventario
 * (`ownedId`) y su nivel real. Las piezas de draft/roster son plantillas planas (sin
 * estos campos); las de equipos por instancia (T6.3) los llevan.
 */
type TeamPiece = PokemonTemplate & { ownedId?: string; level?: number };

const DEFAULT_MATCH_ID = 'default';
/** Mundo ARENA persistente: un único matchId global, siempre vivo, sin sala/host. */
export const ARENA_ID = 'arena';
/** Solo se usa si se define GAME_MAP_PATH (mapa Tiled manual, opt-in). */
const MAP_PATH = process.env.GAME_MAP_PATH;
/** Seed estable ⇒ mismo ecosistema en cada partida nueva; las guardadas no regeneran. */
const MAP_SEED = process.env.GAME_MAP_SEED ?? 'transcendence-default';
const MAP_RADIUS = Number(process.env.GAME_MAP_RADIUS ?? 20);
/** ARENA: mapa ≥4x (R=42 → 5419 tiles ≈ 4.3x de los 1261 de R=20). */
const ARENA_MAP_RADIUS = Number(process.env.GAME_ARENA_MAP_RADIUS ?? 42);
const TEAM_SIZE = 3;
/** Tamaño del pool de draft aleatorio (local/IA): 50 Pokémon Gen-1 distintos por draft. */
const DRAFT_POOL_SIZE = 50;

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
 * Pool de STARTERS (12 opciones balanceadas por poder ~157-233, con cobertura de
 * tipos). El jugador elige 3 en su primer inicio de sesión. Se evitan los outliers
 * (mewtwo/snorlax/lapras/articuno/aerodactyl arriba, abra abajo).
 */
export const STARTER_POOL = [
  'charmander', 'squirtle', 'bulbasaur', 'pikachu', 'eevee', 'growlithe',
  'psyduck', 'oddish', 'clefairy', 'ekans', 'poliwag', 'vulpix',
];
export const STARTER_PICK = 3;

/**
 * Gestiona el ciclo de vida de la partida (MVP hot-seat con una partida por defecto):
 * roster de draft, creación 3v3 desde el mapa, persistencia y reanudación (C4.2).
 */
export class MatchManager {
  private match: GameService | null = null;
  private rosterCache: PokemonTemplate[] | null = null;
  /** Partidas online en memoria, indexadas por matchId (carga perezosa). */
  private onlineMatches: Map<string, GameService> = new Map();
  /** Metadatos de la partida LOCAL en curso (modo + dueño humano) para captura/pérdida. */
  private localMeta: { gameMode: GameMode; ownerUserId: string | null } = {
    gameMode: 'ffa',
    ownerUserId: null,
  };
  /** Config de la última partida local (para la REVANCHA: repetir la misma, no una por defecto). */
  private lastLocalStart: {
    teams: Record<string, string[]>;
    gameMode: GameMode;
    ownerUserId: string | null;
  } | null = null;
  /** Timer de forzado de fin de despliegue de la partida local en curso (para poder cancelarlo). */
  private deploymentTimer: ReturnType<typeof setTimeout> | null = null;

  /** Modo + dueño humano de la partida local actual (Survival: player1 = ownerUserId). */
  getLocalMeta(): { gameMode: GameMode; ownerUserId: string | null } {
    return this.localMeta;
  }

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

  /** Devuelve (y cachea) las plantillas del roster ESTABLE (draft online 1v1/2v2). */
  async getRoster(): Promise<PokemonTemplate[]> {
    if (this.rosterCache) return this.rosterCache;
    this.rosterCache = await Promise.all(ROSTER_NAMES.map((n) => PokemonService.getTemplate(n)));
    return this.rosterCache;
  }

  /**
   * Pool de draft para partidas LOCALES y vs-IA: `n` Pokémon **aleatorios** de Gen 1,
   * distintos cada draft (a diferencia del roster online, estable). Las plantillas se
   * cachean (getTemplate), solo la selección es aleatoria.
   */
  async draftPool(n = DRAFT_POOL_SIZE): Promise<PokemonTemplate[]> {
    const names = randomGen1Names(n);
    return Promise.all(names.map((nm) => PokemonService.getTemplate(nm)));
  }

  /**
   * Colocaciones iniciales: spawns en las esquinas de la mayor componente
   * de tierra conectada (equipos alcanzables, ningún Pokémon nace en agua).
   */
  private placements(
    board: Board,
    teams: TeamPiece[][],
    gameMode: GameMode = 'ffa'
  ): { hex: Tile['hex']; pokemon: Pokemon }[] {
    const component = largestLandComponent(board);
    // ARENA: spawns aleatorios (distintos cada partida). Resto: esquinas fijas.
    const hexClusters =
      gameMode === 'arena'
        ? pickRandomSpawns(board, component, TEAM_SIZE, teams.length, makeRng(this.freshSeed()))
        : pickCornerSpawns(board, component, TEAM_SIZE, teams.length);

    const build = (tpl: TeamPiece, playerId: string, i: number): Pokemon => {
      // Nivel REAL de la instancia (equipos por ownedId, T6.3); las piezas de draft son Lv.1.
      const level = tpl.level ?? 1;
      return {
        ...tpl,
        id: `${playerId}-${i}`,
        playerId,
        level,
        // Stats escaladas por nivel (T6.2): a Lv.1 no altera nada (draft intacto).
        ...scaledVitals(tpl, level),
        ...(tpl.ownedId ? { ownedId: tpl.ownedId } : {}),
      };
    };

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

  /**
   * Resuelve nombres del draft a plantillas, en orden player1..player4. Acepta cualquier
   * especie **Gen 1** (el pool de draft local/IA es aleatorio entre los 151, no una lista
   * fija), resolviéndola por PokeAPI (cache-first). Mantiene la regla de unicidad cruzada.
   */
  private async resolveTeams(teams: Record<string, string[]>): Promise<PokemonTemplate[][]> {
    // Regla de draft: ningún Pokémon puede repetirse, ni dentro de un equipo ni
    // entre equipos. Validación autoritativa en el servidor (no confiar en la UI).
    const seen = new Set<string>();
    for (let i = 1; i <= 4; i++) {
      for (const n of teams[`player${i}`] ?? []) {
        if (seen.has(n)) throw new Error(`Pokémon repetido en el draft: ${n}`);
        seen.add(n);
      }
    }

    const resolve = (names: string[]): Promise<PokemonTemplate[]> =>
      Promise.all(
        names.map((n) => {
          if (!isGen1(n)) throw new Error(`Pokémon no válido: ${n}`);
          return PokemonService.getTemplate(n);
        })
      );

    const teamArrays: PokemonTemplate[][] = [];
    for (let i = 1; i <= 4; i++) {
      const names = teams[`player${i}`];
      if (names && names.length > 0) {
        teamArrays.push(await resolve(names));
      }
    }
    if (teamArrays.length < 2) {
      throw new Error('Se necesitan al menos 2 equipos para iniciar la partida');
    }
    return teamArrays;
  }

  /**
   * Como resolveTeams pero SIN la regla de unicidad cruzada: en BR/ARENA cada jugador usa
   * sus PROPIOS Pokémon (varios pueden llevar el mismo). Los equipos llegan como `ownedId[]`
   * (T6.3): se carga la instancia real (nombre + nivel) y se arrastra el `ownedId`, para que
   * la partida refleje el nivel/stats reales, no plantillas a nivel 1.
   */
  private async resolveOwnedTeams(teams: Record<string, string[]>): Promise<TeamPiece[][]> {
    const teamArrays: TeamPiece[][] = [];
    for (let i = 1; i <= 4; i++) {
      const ids = teams[`player${i}`];
      if (ids && ids.length > 0) {
        teamArrays.push(await this.ownedTeamFromIds(ids));
      }
    }
    if (teamArrays.length < 2) {
      throw new Error('Se necesitan al menos 2 equipos para iniciar la partida');
    }
    return teamArrays;
  }

  /**
   * SURVIVAL (1J vs IA): el player1 son `ownedId[]` (equipo propio del humano, con su nivel);
   * el player2 son nombres de especie (IA **salvaje**, sin `ownedId` → capturables como nuevas
   * instancias, T8.2). Exactamente 2 equipos.
   */
  private async resolveSurvivalTeams(teams: Record<string, string[]>): Promise<TeamPiece[][]> {
    const owned = await this.ownedTeamFromIds(teams.player1 ?? []);
    const wildNames = teams.player2 ?? [];
    const wild = await Promise.all(
      wildNames.map((n) => {
        if (!isGen1(n)) throw new Error(`Pokémon salvaje no válido: ${n}`);
        return PokemonService.getTemplate(n);
      })
    );
    if (owned.length === 0 || wild.length === 0) {
      throw new Error('Survival necesita tu equipo y el de la IA');
    }
    return [owned, wild];
  }

  /**
   * Resuelve `ownedId[]` a piezas de equipo con su nivel real. La plantilla base (stats,
   * tipo, tamaño) se saca por especie de PokeAPI (cache-first); el nivel/identidad, de la
   * instancia del inventario. La propiedad se valida antes (RoomService), aquí solo se carga.
   */
  private async ownedTeamFromIds(ids: string[]): Promise<TeamPiece[]> {
    const records = await OwnedPokemonModel.findManyByIds(ids);
    return Promise.all(
      records.map(async (rec) => {
        const tpl = await PokemonService.getTemplate(rec.name);
        return { ...tpl, ownedId: rec.id, level: rec.level };
      })
    );
  }

  /** Alianzas del modo 2v2 (P1+P3 vs P2+P4); null en todos contra todos. */
  private alliancesFor(gameMode: GameMode, teamCount: number): string[][] | null {
    if (gameMode !== 'teams') return null;
    if (teamCount !== TEAMS_MODE_PLAYERS) {
      throw new Error('El modo 2 vs 2 requiere exactamente 4 jugadores');
    }
    return TEAMS_MODE_ALLIANCES.map((team) => [...team]);
  }

  /**
   * Crea la partida LOCAL. En SURVIVAL, el player1 llega como `ownedId[]` (equipo propio) y
   * el resto como nombres (IA salvaje); se guarda `ownerUserId` para atribuir capturas/pérdidas
   * al humano (T8.2/T8.3). El resto de modos locales usan el draft (nombres).
   */
  async startMatch(
    teams: Record<string, string[]>,
    gameMode: GameMode = 'ffa',
    ownerUserId: string | null = null
  ): Promise<GameService> {
    if (gameMode === 'survival') {
      // Propiedad autoritativa: el player1 deben ser instancias libres del propio usuario.
      if (!ownerUserId || !(await OwnedPokemonModel.allOwnedBy(ownerUserId, teams.player1 ?? []))) {
        throw new Error('Solo puedes llevar Pokémon de tu inventario a Survival');
      }
    }
    const teamArrays =
      gameMode === 'survival' ? await this.resolveSurvivalTeams(teams) : await this.resolveTeams(teams);
    this.localMeta = { gameMode, ownerUserId };
    // Recuerda la config para la REVANCHA (repetir la MISMA partida, no una por defecto).
    this.lastLocalStart = { teams, gameMode, ownerUserId };
    const board = this.loadBoard(gameMode);
    const placements = await this.withMoves(this.placements(board, teamArrays, gameMode));
    this.match = GameService.create(
      DEFAULT_MATCH_ID,
      board,
      placements,
      this.alliancesFor(gameMode, teamArrays.length),
      gameMode === 'arena'
    );
    await this.persist();
    this.scheduleLocalForceStart();
    return this.match;
  }

  /**
   * Fuerza el fin del despliegue a los 42s. Cancela cualquier timer anterior y captura la
   * instancia CONCRETA de partida: si mientras tanto empieza otra (revancha, reinicio), el
   * timer viejo no la arranca por error (bug de "se inicia otra automáticamente").
   */
  private scheduleLocalForceStart(): void {
    if (this.deploymentTimer) clearTimeout(this.deploymentTimer);
    const target = this.match;
    const timer = setTimeout(() => {
      this.deploymentTimer = null;
      if (this.match === target && target && target.getStateDTO().status === 'deployment') {
        target.forceStart();
        this.persist().catch(console.error);
        import('../realtime/hub.js')
          .then((m) => m.hub.broadcastPersonalized('local', (ctx) => ({ type: 'state', state: target.getStateDTO(ctx.slot ?? undefined) })))
          .catch(console.error);
      }
    }, 42000);
    timer.unref?.(); // no mantener vivo el proceso solo por este timer
    this.deploymentTimer = timer;
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
    // BR/ARENA usan Pokémon propios (sin unicidad cruzada); el resto, draft.
    const teamArrays = OWNED_TEAM_MODES.includes(gameMode)
      ? await this.resolveOwnedTeams(teams)
      : await this.resolveTeams(teams);
    const board = this.loadBoard(gameMode);
    const placements = await this.withMoves(this.placements(board, teamArrays, gameMode));
    const game = GameService.create(
      id,
      board,
      placements,
      this.alliancesFor(gameMode, teamArrays.length),
      gameMode === 'arena'
    );
    this.onlineMatches.set(id, game);
    await this.persistMatch(id);
    
    setTimeout(() => {
      const g = this.onlineMatches.get(id);
      if (g && g.getStateDTO().status === 'deployment') {
         g.forceStart();
         this.persistMatch(id).catch(console.error);
         import('../realtime/hub.js').then(m => m.hub.broadcastPersonalized(id, (ctx) => ({ type: 'state', state: g.getStateDTO(ctx.slot ?? undefined) }))).catch(console.error);
      }
    }, 42000);
    
    return game;
  }

  async persistMatch(id: string): Promise<void> {
    const game = this.onlineMatches.get(id);
    if (!game) return;
    await MatchModel.upsert(game.matchRow, game.serialize());
  }

  // ----------------------------------------------------------- ARENA (mundo vivo)

  private buildPokemon(tpl: TeamPiece, playerId: string, i: number): Pokemon {
    const level = tpl.level ?? 1;
    return {
      ...tpl,
      id: `${playerId}-${i}`,
      playerId,
      level,
      ...scaledVitals(tpl, level), // stats escaladas por nivel (T6.2)
      ...(tpl.ownedId ? { ownedId: tpl.ownedId } : {}),
    };
  }

  /** Devuelve la ARENA global (la crea vacía y persistente si no existía). */
  async getOrCreateArena(): Promise<GameService> {
    const existing = await this.getMatch(ARENA_ID);
    if (existing) {
      // Mundos creados antes de la mecánica de cofres se cargan sin cofre: se
      // siembra uno para que siempre haya botín que disputar.
      if (existing.ensureChest()) await this.persistMatch(ARENA_ID);
      return existing;
    }
    const board = this.loadBoard('arena');
    const game = GameService.createArena(ARENA_ID, board);
    this.onlineMatches.set(ARENA_ID, game);
    await this.persistMatch(ARENA_ID);
    return game;
  }

  /** Añade un jugador a la ARENA en un spawn ALEATORIO (entrada en caliente). Equipo por `ownedId`. */
  async addToArena(slot: string, ownedIds: string[]): Promise<void> {
    const game = await this.getOrCreateArena();
    // Equipo desde el inventario propio (instancias reales con su nivel): T6.3.
    const templates = await this.ownedTeamFromIds(ownedIds);
    const board = game.getBoard();
    const component = largestLandComponent(board);
    const cluster =
      pickRandomSpawns(board, component, TEAM_SIZE, 1, makeRng(this.freshSeed()))[0] ?? [];
    const placements = templates
      .map((tpl, i) => ({ hex: cluster[i]!, pokemon: this.buildPokemon(tpl, slot, i) }))
      .filter((p) => p.hex);
    await this.withMoves(placements);
    game.addPlayer(slot, placements);
    await this.persistMatch(ARENA_ID);
  }

  /** Saca a un jugador de la ARENA (retira sus piezas; el mundo sigue vivo). */
  async removeFromArena(slot: string): Promise<void> {
    const game = await this.getMatch(ARENA_ID);
    if (!game) return;
    game.removePlayer(slot);
    await this.persistMatch(ARENA_ID);
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

  /** Semilla no determinista (spawns aleatorios de ARENA distintos cada partida). */
  private freshSeed(): number {
    return hashStringToSeed(crypto.randomUUID());
  }

  private loadBoard(gameMode: GameMode = 'ffa'): Board {
    // Opt-in: mapa Tiled manual si se define GAME_MAP_PATH.
    if (MAP_PATH) {
      try {
        const mapData = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8')) as TiledMapData;
        return MapLoader.loadTiledMap(mapData);
      } catch {
        // Si el Tiled indicado falla, caemos al ecosistema procedural.
      }
    }
    // ARENA usa un mapa ≥4x más grande; el resto, el tamaño normal (seed estable).
    const radius = gameMode === 'arena' ? ARENA_MAP_RADIUS : MAP_RADIUS;
    return generateEcosystem(hashStringToSeed(MAP_SEED), { radius });
  }

  get(): GameService {
    if (!this.match) throw new Error('MatchManager no inicializado');
    return this.match;
  }

  async persist(): Promise<void> {
    if (!this.match) return;
    await MatchModel.upsert(this.match.matchRow, this.match.serialize());
  }

  /**
   * REVANCHA / reinicio de la partida local: repite la MISMA configuración (modo + equipos)
   * de la última partida, no una partida por defecto de 4 jugadores con roster (ese era el bug).
   * Si no hay partida local previa, cae a la de por defecto.
   */
  async reset(): Promise<GameService> {
    if (this.lastLocalStart) {
      const { teams, gameMode, ownerUserId } = this.lastLocalStart;
      return this.startMatch(teams, gameMode, ownerUserId);
    }
    if (this.deploymentTimer) {
      clearTimeout(this.deploymentTimer);
      this.deploymentTimer = null;
    }
    this.match = await this.buildDefault();
    await this.persist();
    return this.match;
  }
}

export const matchManager = new MatchManager();
