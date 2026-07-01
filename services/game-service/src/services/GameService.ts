import { Board, Biome, Pokemon, Tile } from '../engine/board.js';
import { Hex, hexEqual } from '../engine/hex.js';
import { getMoveOptions, MoveOptions } from '../engine/movement.js';
import { computeDamage, computeMoveDamage } from '../engine/combat.js';
import { terrainDamage } from '../engine/environment.js';
import { collectResources, PlayerResources } from '../engine/resources.js';

export type MatchStatus = 'active' | 'combat' | 'finished';
export type CombatAction = 'ATACAR' | 'HABILIDAD' | 'OBJETO' | 'HUIR' | 'MOVE';

/** Estado de un combate interactivo por turnos entre dos Pokémon. */
export interface CombatState {
  attackerId: string;
  defenderId: string;
  attackerHex: Hex;
  defenderHex: Hex;
  attacker: Pokemon; // copia viva (hp actual)
  defender: Pokemon;
  attackerPlayer: string;
  defenderPlayer: string;
  /** Id del Pokémon que debe elegir acción ahora. */
  turnActorId: string;
  round: number;
  log: string[];
  status: 'active' | 'finished';
  winnerId: string | null;
  loserId: string | null;
  outcome: 'ko' | 'fled' | null;
}

export interface MatchStateDTO {
  id: string;
  tiles: Tile[];
  players: string[];
  currentPlayer: string;
  turn: number;
  status: MatchStatus;
  winner: string | null;
  resources: Record<string, PlayerResources>;
  log: string[];
  combat: CombatState | null;
  /** Alianzas 2v2 ([[p1,p3],[p2,p4]]); null en todos contra todos. */
  alliances: string[][] | null;
  /** Jugadores ya eliminados (sin Pokémon o que abandonaron). */
  eliminated: string[];
}

export interface PlayResult {
  ok: boolean;
  error?: string;
  state: MatchStateDTO;
}

const emptyResources = (): PlayerResources => ({ FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 });
const candyKey = (type: string): keyof PlayerResources =>
  type === 'FIRE' ? 'FIRE_CANDY' : type === 'WATER' || type === 'ICE' ? 'WATER_CANDY' : 'GRASS_CANDY';
const nameOf = (p: Pokemon) => (p.name ?? p.id).toUpperCase();

const HABILIDAD_MULT = 1.6; // daño de habilidad
const HABILIDAD_COST = 1; // candies del propio tipo
const OBJETO_COST = 2; // candies (cualquier tipo)
const OBJETO_HEAL = 0.3; // fracción de maxHp curada

/**
 * Capa SERVICIO/DOMINIO: partida autoritativa. Única fuente de verdad del estado.
 * Gestiona movimiento por turnos y un sub-estado de COMBATE interactivo.
 */
export class GameService {
  constructor(
    public readonly id: string,
    private board: Board,
    private players: string[],
    private currentPlayer: string,
    private turn: number,
    private status: MatchStatus,
    private winner: string | null,
    private resources: Record<string, PlayerResources>,
    private log: string[],
    private combat: CombatState | null = null,
    private alliances: string[][] | null = null,
    private eliminated: string[] = []
  ) {}

  static create(
    id: string,
    board: Board,
    placements: { hex: Hex; pokemon: Pokemon }[],
    alliances: string[][] | null = null
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
    return new GameService(
      id,
      board,
      players,
      players[0]!,
      1,
      'active',
      null,
      resources,
      ['¡Comienza la partida!'],
      null,
      alliances
    );
  }

  /** Aliados en 2v2 (incluye a uno mismo); en FFA cada jugador va solo. */
  private sameTeam = (a: string, b: string): boolean => {
    if (a === b) return true;
    if (!this.alliances) return false;
    return this.alliances.some((team) => team.includes(a) && team.includes(b));
  };

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
      combat: this.combat,
      alliances: this.alliances,
      eliminated: this.eliminated,
    };
  }

  getMoveOptions(hex: Hex): MoveOptions {
    if (this.status !== 'active') return { moves: [], attacks: [] };
    const occ = this.board.getOccupant(hex);
    if (occ && occ.hasActed) return { moves: [], attacks: [] };
    return getMoveOptions(hex, this.board, this.sameTeam);
  }

  // ---------------------------------------------------------------- movimiento
  play(playerId: string, from: Hex, to: Hex): PlayResult {
    if (this.status === 'finished') {
      return { ok: false, error: 'La partida ha terminado', state: this.getStateDTO() };
    }
    if (this.status === 'combat') {
      return { ok: false, error: 'Hay un combate en curso', state: this.getStateDTO() };
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
    if (mover.hasActed) {
      return { ok: false, error: 'Esa pieza ya ha actuado en este turno', state: this.getStateDTO() };
    }

    const opts = getMoveOptions(from, this.board, this.sameTeam);
    const isMove = opts.moves.some((h) => hexEqual(h, to));
    const isAttack = opts.attacks.some((h) => hexEqual(h, to));

    if (isMove) {
      this.board.moveOccupant(from, to);
      const moved = this.board.getOccupant(to);
      if (moved) moved.hasActed = true;
      this.log.push(`${nameOf(mover)} se mueve.`);
      return { ok: true, state: this.getStateDTO() };
    }
    if (isAttack) {
      this.initiateCombat(from, to);
      return { ok: true, state: this.getStateDTO() };
    }
    return { ok: false, error: 'Movimiento ilegal', state: this.getStateDTO() };
  }

  // ------------------------------------------------------------------- combate
  private initiateCombat(from: Hex, to: Hex): void {
    const attacker = { ...this.board.getOccupant(from)!, hasActed: true };
    const defender = { ...this.board.getOccupant(to)! };
    this.combat = {
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerHex: from,
      defenderHex: to,
      attacker,
      defender,
      attackerPlayer: attacker.playerId,
      defenderPlayer: defender.playerId,
      turnActorId: attacker.id, // el atacante actúa primero
      round: 1,
      log: [`¡${nameOf(attacker)} ataca a ${nameOf(defender)}!`],
      status: 'active',
      winnerId: null,
      loserId: null,
      outcome: null,
    };
    this.status = 'combat';
    this.log.push(`Combate: ${nameOf(attacker)} vs ${nameOf(defender)}.`);
  }

  private terrainOf(hex: Hex): Biome {
    return this.board.getTile(hex)?.biome ?? 'GRASS';
  }

  private spendCandies(playerId: string, amount: number, prefer: string): boolean {
    const res = this.resources[playerId] ?? emptyResources();
    const total = res.FIRE_CANDY + res.WATER_CANDY + res.GRASS_CANDY;
    if (total < amount) return false;
    let left = amount;
    const order: (keyof PlayerResources)[] = [
      candyKey(prefer),
      'FIRE_CANDY',
      'WATER_CANDY',
      'GRASS_CANDY',
    ];
    for (const k of order) {
      while (left > 0 && res[k] > 0) {
        res[k]--;
        left--;
      }
    }
    this.resources[playerId] = res;
    return true;
  }

  /** Aplica una acción de combate para el Pokémon cuyo turno es. */
  combatAction(action: CombatAction, moveName?: string): PlayResult {
    if (this.status !== 'combat' || !this.combat) {
      return { ok: false, error: 'No hay combate en curso', state: this.getStateDTO() };
    }
    const c = this.combat;
    if (c.status !== 'active') {
      return { ok: false, error: 'Fase de combate cerrada', state: this.getStateDTO() };
    }
    const actorId = c.turnActorId;
    const actor = actorId === c.attackerId ? c.attacker : c.defender;
    const target = actorId === c.attackerId ? c.defender : c.attacker;
    const actorTerrain = this.terrainOf(actorId === c.attackerId ? c.attackerHex : c.defenderHex);
    const targetTerrain = this.terrainOf(actorId === c.attackerId ? c.defenderHex : c.attackerHex);

    switch (action) {
      case 'MOVE': {
        const move = (actor.moves ?? []).find((m) => m.name === moveName);
        if (!move) {
          return { ok: false, error: 'Ataque no disponible', state: this.getStateDTO() };
        }
        // Los ataques especiales cuestan 1 candy del tipo del movimiento; los físicos son gratis.
        if (move.damageClass === 'special' && !this.spendCandies(actor.playerId, 1, move.type)) {
          return { ok: false, error: 'Sin candies para ataque especial', state: this.getStateDTO() };
        }
        const dmg = computeMoveDamage(actor, target, move, actorTerrain, targetTerrain);
        target.hp = Math.max(0, target.hp - dmg);
        c.log.push(`${nameOf(actor)} usa ${move.name.toUpperCase()}: ${dmg} de daño (${nameOf(target)}: ${target.hp}).`);
        break;
      }
      case 'ATACAR': {
        const dmg = computeDamage(actor, target, actorTerrain, targetTerrain);
        target.hp = Math.max(0, target.hp - dmg);
        c.log.push(`${nameOf(actor)} ATACA: ${dmg} de daño (${nameOf(target)}: ${target.hp}).`);
        break;
      }
      case 'HABILIDAD': {
        if (!this.spendCandies(actor.playerId, HABILIDAD_COST, actor.type)) {
          return { ok: false, error: 'Sin recursos para HABILIDAD', state: this.getStateDTO() };
        }
        const dmg = Math.round(computeDamage(actor, target, actorTerrain, targetTerrain) * HABILIDAD_MULT);
        target.hp = Math.max(0, target.hp - dmg);
        c.log.push(`${nameOf(actor)} usa HABILIDAD: ${dmg} de daño (${nameOf(target)}: ${target.hp}).`);
        break;
      }
      case 'OBJETO': {
        if (!this.spendCandies(actor.playerId, OBJETO_COST, actor.type)) {
          return { ok: false, error: 'Sin recursos para OBJETO', state: this.getStateDTO() };
        }
        const heal = Math.round(actor.maxHp * OBJETO_HEAL);
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        c.log.push(`${nameOf(actor)} usa OBJETO: cura ${heal} (${nameOf(actor)}: ${actor.hp}).`);
        break;
      }
      case 'HUIR': {
        // Huir tiene riesgo: el rival lanza un golpe libre.
        const dmg = computeDamage(target, actor, targetTerrain, actorTerrain);
        actor.hp = Math.max(0, actor.hp - dmg);
        c.log.push(`${nameOf(actor)} huye; ${nameOf(target)} le alcanza con ${dmg} de daño.`);
        if (actor.hp <= 0) {
          c.outcome = 'ko';
          c.winnerId = target.id;
          c.loserId = actor.id;
        } else {
          c.outcome = 'fled';
          c.winnerId = null;
          c.loserId = actor.id; // el que huyó
        }
        c.status = 'finished'; // fase de resultado; se resuelve con continueCombat()
        return { ok: true, state: this.getStateDTO() };
      }
    }

    // KO por daño → pasa a fase de resultado (no se finaliza hasta "continuar").
    if (target.hp <= 0) {
      c.outcome = 'ko';
      c.winnerId = actor.id;
      c.loserId = target.id;
      c.log.push(`¡${nameOf(target)} se ha debilitado!`);
      c.status = 'finished';
    } else {
      c.turnActorId = target.id; // pasa el turno al rival
      c.round += 1;
    }
    return { ok: true, state: this.getStateDTO() };
  }

  /** Cierra un combate ya resuelto (fase de resultado): aplica el tablero y sigue. */
  continueCombat(): PlayResult {
    if (this.status !== 'combat' || !this.combat || this.combat.status !== 'finished') {
      return { ok: false, error: 'No hay combate por resolver', state: this.getStateDTO() };
    }
    this.finalizeCombat();
    return { ok: true, state: this.getStateDTO() };
  }

  private finalizeCombat(): void {
    const c = this.combat;
    if (!c) return;

    if (c.outcome === 'ko') {
      const attackerWon = c.winnerId === c.attackerId;
      this.board.setOccupant(c.attackerHex, null);
      if (attackerWon) {
        this.board.setOccupant(c.defenderHex, { ...c.attacker, hasActed: true });
        this.log.push(`${nameOf(c.attacker)} vence y ocupa la casilla.`);
      } else {
        this.board.setOccupant(c.defenderHex, { ...c.defender });
        this.log.push(`${nameOf(c.defender)} resiste el ataque.`);
      }
    } else {
      // Huida: ambos sobreviven en sus casillas, con el HP actualizado.
      this.board.setOccupant(c.attackerHex, { ...c.attacker, hasActed: true });
      this.board.setOccupant(c.defenderHex, { ...c.defender });
      this.log.push('El combate termina en huida.');
    }

    this.combat = null;
    this.status = 'active';
    this.checkWinCondition();
    // Si el eliminado era el jugador de turno (p.ej. atacante que pierde su
    // último Pokémon), el turno pasa al siguiente vivo.
    if (this.status === 'active' && this.eliminated.includes(this.currentPlayer)) {
      this.switchPlayer();
    }
  }

  // --------------------------------------------------------------------- turnos
  public endTurn(playerId?: string): PlayResult {
    if (this.status === 'finished') {
      return { ok: false, error: 'La partida ha terminado', state: this.getStateDTO() };
    }
    if (this.status === 'combat') {
      return { ok: false, error: 'Hay un combate en curso', state: this.getStateDTO() };
    }
    if (playerId && playerId !== this.currentPlayer) {
      return { ok: false, error: 'No es tu turno', state: this.getStateDTO() };
    }

    for (const tile of this.board.tiles.values()) {
      if (tile.occupant) {
        tile.occupant.hasActed = false;
      }
    }

    this.collectTurnResources();
    this.applyLavaDamage();
    if (this.status === 'active') this.switchPlayer();
    return { ok: true, state: this.getStateDTO() };
  }

  public abandon(playerId?: string): PlayResult {
    if (this.status === 'finished') {
      return { ok: false, error: 'La partida ya ha terminado', state: this.getStateDTO() };
    }
    const loser = playerId ?? this.currentPlayer;
    if (!this.players.includes(loser) || this.eliminated.includes(loser)) {
      return { ok: false, error: 'Ese jugador no está en la partida', state: this.getStateDTO() };
    }

    // Si hay combate en curso se cancela: ambos Pokémon vuelven al tablero
    // con su HP actual antes de retirar las piezas del que abandona.
    if (this.combat) {
      this.board.setOccupant(this.combat.attackerHex, { ...this.combat.attacker, hasActed: true });
      this.board.setOccupant(this.combat.defenderHex, { ...this.combat.defender });
      this.combat = null;
      this.status = 'active';
    }

    // Abandonar = eliminación: se retiran todas sus piezas y la partida sigue
    // para el resto (con 2 jugadores esto acaba la partida directamente).
    for (const tile of this.board.tiles.values()) {
      if (tile.occupant?.playerId === loser) this.board.setOccupant(tile.hex, null);
    }
    this.log.push(`🏳️ ${loser} ha abandonado la partida.`);
    this.checkWinCondition();
    if (this.status === 'active' && this.currentPlayer === loser) this.switchPlayer();
    return { ok: true, state: this.getStateDTO() };
  }

  private applyLavaDamage(): void {
    for (const tile of this.board.tiles.values()) {
      if (tile.occupant) {
        if (tile.biome === 'FIRE') {
          if (tile.occupant.type !== 'FIRE' && tile.occupant.type !== 'FLYING') {
            tile.occupant.lavaTurns = (tile.occupant.lavaTurns ?? 0) + 1;
          }
          const dmg = terrainDamage(tile.occupant, 'FIRE');
          if (dmg > 0) {
            tile.occupant.hp -= dmg;
            this.log.push(`¡${nameOf(tile.occupant)} se quema en la lava (-${dmg} HP, turno ${tile.occupant.lavaTurns})!`);
            if (tile.occupant.hp <= 0) {
              this.log.push(`¡${nameOf(tile.occupant)} ha caído KO por la lava!`);
              this.board.setOccupant(tile.hex, null);
            }
          }
        } else {
          tile.occupant.lavaTurns = 0;
        }
      }
    }
    this.checkWinCondition();
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
    // Eliminación: quedarse sin Pokémon te saca de la partida, pero esta sigue
    // hasta que solo sobreviva un jugador (FFA) o un equipo (2v2).
    for (const p of this.players) {
      if (!this.eliminated.includes(p) && this.countPokemon(p) === 0) {
        this.eliminated.push(p);
        this.log.push(`💀 ${p} ha sido eliminado.`);
      }
    }

    const alive = this.players.filter((p) => !this.eliminated.includes(p));
    if (alive.length === 0) {
      this.status = 'finished';
      this.winner = null;
      this.log.push('🏁 La partida termina sin supervivientes.');
      return;
    }
    const first = alive[0]!;
    if (alive.every((p) => this.sameTeam(first, p))) {
      this.status = 'finished';
      this.winner = alive.join(' & ');
      this.log.push(`🏆 ${this.winner} gana la partida.`);
    }
  }

  private switchPlayer(): void {
    let idx = this.players.indexOf(this.currentPlayer);
    for (let i = 0; i < this.players.length; i++) {
      idx = (idx + 1) % this.players.length;
      const next = this.players[idx]!;
      if (!this.eliminated.includes(next)) {
        this.currentPlayer = next;
        break;
      }
    }
    this.turn += 1;
  }

  // ------------------------------------------------------------- persistencia
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
      combat: this.combat,
      alliances: this.alliances,
      eliminated: this.eliminated,
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
      d.log ?? [],
      d.combat ?? null,
      d.alliances ?? null,
      d.eliminated ?? []
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
