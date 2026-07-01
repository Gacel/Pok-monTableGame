import { Board, Pokemon, Tile } from '../engine/board.js';
import { Hex, hexEqual } from '../engine/hex.js';
import { getMoveOptions, MoveOptions } from '../engine/movement.js';
import { resolveCombat, CombatResult } from '../engine/combat.js';
import { collectResources, PlayerResources } from '../engine/resources.js';

export interface MatchStateDTO {
  id: string;
  tiles: Tile[];
  players: string[];
  currentPlayer: string;
  turn: number;
  status: 'active' | 'finished';
  winner: string | null;
  resources: Record<string, PlayerResources>;
  log: string[];
}

export interface PlayResult {
  ok: boolean;
  error?: string;
  combat?: CombatResult;
  state: MatchStateDTO;
}

const emptyResources = (): PlayerResources => ({ FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 });

/**
 * Capa SERVICIO/DOMINIO: partida autoritativa. Es la ÚNICA fuente de verdad del
 * estado de juego. Valida cada intención antes de mutar; nunca confía en el cliente.
 */
export class GameService {
  constructor(
    public readonly id: string,
    private board: Board,
    private players: string[],
    private currentPlayer: string,
    private turn: number,
    private status: 'active' | 'finished',
    private winner: string | null,
    private resources: Record<string, PlayerResources>,
    private log: string[]
  ) {}

  /** Crea una partida con un tablero y dos Pokémon iniciales colocados. */
  static create(
    id: string,
    board: Board,
    placements: { hex: Hex; pokemon: Pokemon }[]
  ): GameService {
    const players: string[] = [];
    const resources: Record<string, PlayerResources> = {};
    for (const { hex, pokemon } of placements) {
      board.setOccupant(hex, pokemon);
      if (!players.includes(pokemon.playerId)) {
        players.push(pokemon.playerId);
        resources[pokemon.playerId] = emptyResources();
      }
    }
    return new GameService(id, board, players, players[0]!, 1, 'active', null, resources, [
      '¡Comienza la partida!',
    ]);
  }

  getStateDTO(): MatchStateDTO {
    return {
      id: this.id,
      tiles: this.board.serialize(),
      players: this.players,
      currentPlayer: this.currentPlayer,
      turn: this.turn,
      status: this.status,
      winner: this.winner,
      resources: this.resources,
      log: this.log.slice(-30),
    };
  }

  getMoveOptions(hex: Hex): MoveOptions {
    return getMoveOptions(hex, this.board);
  }

  private countPokemon(playerId: string): number {
    let n = 0;
    for (const tile of this.board.tiles.values()) {
      if (tile.occupant?.playerId === playerId) n++;
    }
    return n;
  }

  private collectTurnResources(): void {
    const gained = collectResources(this.board);
    for (const [playerId, res] of Object.entries(gained)) {
      const acc = this.resources[playerId] ?? emptyResources();
      acc.FIRE_CANDY += res.FIRE_CANDY;
      acc.WATER_CANDY += res.WATER_CANDY;
      acc.GRASS_CANDY += res.GRASS_CANDY;
      this.resources[playerId] = acc;
    }
  }

  private checkWinCondition(): void {
    for (const p of this.players) {
      if (this.countPokemon(p) === 0) {
        this.status = 'finished';
        this.winner = this.players.find((x) => x !== p) ?? null;
        this.log.push(`🏆 ${this.winner} gana la partida.`);
        return;
      }
    }
  }

  private switchPlayer(): void {
    const idx = this.players.indexOf(this.currentPlayer);
    this.currentPlayer = this.players[(idx + 1) % this.players.length]!;
    this.turn += 1;
  }

  /** Aplica una intención de movimiento/ataque, validándola por completo. */
  play(playerId: string, from: Hex, to: Hex): PlayResult {
    if (this.status === 'finished') {
      return { ok: false, error: 'La partida ha terminado', state: this.getStateDTO() };
    }
    if (playerId !== this.currentPlayer) {
      return { ok: false, error: 'No es tu turno', state: this.getStateDTO() };
    }
    const mover = this.board.getOccupant(from);
    if (!mover) {
      return { ok: false, error: 'No hay ninguna pieza en el origen', state: this.getStateDTO() };
    }
    if (mover.playerId !== playerId) {
      return { ok: false, error: 'Esa pieza no es tuya', state: this.getStateDTO() };
    }

    const opts = getMoveOptions(from, this.board);
    const isMove = opts.moves.some((h) => hexEqual(h, to));
    const isAttack = opts.attacks.some((h) => hexEqual(h, to));

    let combat: CombatResult | undefined;

    if (isMove) {
      this.board.moveOccupant(from, to);
      this.log.push(`${(mover.name ?? mover.id).toUpperCase()} se mueve.`);
    } else if (isAttack) {
      const defender = this.board.getOccupant(to)!;
      const attackerTerrain = this.board.getTile(from)!.biome;
      const defenderTerrain = this.board.getTile(to)!.biome;
      combat = resolveCombat(mover, defender, attackerTerrain, defenderTerrain);
      this.log.push(...combat.log);

      if (combat.winnerId === mover.id) {
        // El atacante vence y ocupa la casilla del defensor.
        this.board.setOccupant(from, null);
        this.board.setOccupant(to, { ...mover, hp: combat.attacker.hp });
      } else {
        // El defensor resiste; el atacante cae.
        this.board.setOccupant(from, null);
        this.board.setOccupant(to, { ...defender, hp: combat.defender.hp });
      }
      this.checkWinCondition();
    } else {
      return { ok: false, error: 'Movimiento ilegal', state: this.getStateDTO() };
    }

    // Fin de turno: economía y cambio de jugador (si sigue viva la partida).
    this.collectTurnResources();
    if (this.status === 'active') this.switchPlayer();

    return { ok: true, ...(combat ? { combat } : {}), state: this.getStateDTO() };
  }

  /** Serializa el estado completo para persistencia en SQLite. */
  serialize(): string {
    return JSON.stringify({
      id: this.id,
      tiles: this.board.serialize(),
      players: this.players,
      currentPlayer: this.currentPlayer,
      turn: this.turn,
      status: this.status,
      winner: this.winner,
      resources: this.resources,
      log: this.log,
    });
  }

  static deserialize(json: string): GameService {
    const d = JSON.parse(json);
    const board = Board.deserialize(d.tiles);
    return new GameService(
      d.id,
      board,
      d.players,
      d.currentPlayer,
      d.turn,
      d.status,
      d.winner,
      d.resources,
      d.log ?? []
    );
  }

  get matchRow() {
    return {
      id: this.id,
      status: this.status,
      turn: this.turn,
      current_player: this.currentPlayer,
      winner: this.winner,
    };
  }
}
