import { Board, Biome, Pokemon, Tile } from '../engine/board.js';
import { Hex, hexEqual, hexNeighbors } from '../engine/hex.js';
import { getMoveOptions, MoveOptions } from '../engine/movement.js';
import { computeDamage, computeMoveDamage } from '../engine/combat.js';
import { terrainDamage } from '../engine/environment.js';
import { collectResources, PlayerResources } from '../engine/resources.js';
import { BALL_LABEL, pickChestBall } from '@transcendence/shared';

// Contratos de estado en @transcendence/shared (única fuente de verdad).
// Se re-exportan para no romper los imports existentes `from '../services/GameService.js'`.
export type { MatchStatus, CombatAction, CombatState, MatchStateDTO } from '@transcendence/shared';
import type { MatchStatus, CombatAction, CombatState, MatchStateDTO, BallKey } from '@transcendence/shared';

/** Turnos que tarda en reaparecer el cofre en ARENA tras recogerse. */
const CHEST_RESPAWN_TURNS = 4;

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
    private eliminated: string[] = [],
    /** ARENA: la partida NUNCA termina (siempre viva, aunque quede 0-1 jugadores). */
    private persistent: boolean = false,
    /** KOs acumulados por slot (para el resumen de recompensa). Persistido. */
    private kos: Record<string, number> = {},
    /** ARENA: turno en el que reaparece el cofre (0 = sin respawn pendiente). */
    private chestRespawnTurn: number = 0
  ) {}

  static create(
    id: string,
    board: Board,
    placements: { hex: Hex; pokemon: Pokemon }[],
    alliances: string[][] | null = null,
    persistent = false
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
    const game = new GameService(
      id,
      board,
      players,
      players[0]!,
      1,
      'active',
      null,
      resources,
      [persistent ? '¡Bienvenido a la ARENA!' : '¡Comienza la partida!'],
      null,
      alliances,
      [],
      persistent
    );
    game.seedChest(true);
    return game;
  }

  /**
   * ARENA: crea un mundo persistente VACÍO (0 jugadores). Nunca termina; los
   * jugadores entran/salen en caliente (addPlayer/removePlayer).
   */
  static createArena(id: string, board: Board): GameService {
    const game = new GameService(
      id,
      board,
      [],
      '',
      1,
      'active',
      null,
      {},
      ['🏟️ La ARENA está viva. Entra cuando quieras.'],
      null,
      null,
      [],
      true
    );
    game.seedChest(true);
    return game;
  }

  /** Tablero vivo (para calcular spawns al entrar en caliente en la ARENA). */
  getBoard(): Board {
    return this.board;
  }

  /** ¿Está este slot dentro de la partida? */
  hasPlayer(playerId: string): boolean {
    return this.players.includes(playerId);
  }

  /**
   * ARENA: añade un jugador EN CALIENTE con sus piezas ya colocadas (placements
   * calculados en un spawn aleatorio). Si el mundo estaba vacío, pasa a ser su turno.
   */
  addPlayer(playerId: string, placements: { hex: Hex; pokemon: Pokemon }[]): void {
    for (const { hex, pokemon } of placements) this.board.setOccupant(hex, pokemon);
    if (!this.players.includes(playerId)) {
      this.players.push(playerId);
      this.resources[playerId] = emptyResources();
    }
    this.eliminated = this.eliminated.filter((p) => p !== playerId);
    if (!this.currentPlayer) {
      this.currentPlayer = playerId;
      this.turn = 1;
    }
    this.log.push(`➕ ${playerId} ha entrado en la ARENA.`);
  }

  /**
   * ARENA: saca a un jugador EN CALIENTE (retira sus piezas). El mundo sigue vivo
   * aunque no quede nadie. Cancela con seguridad un combate en el que participara.
   */
  removePlayer(playerId: string): void {
    if (this.combat && (this.combat.attackerPlayer === playerId || this.combat.defenderPlayer === playerId)) {
      const c = this.combat;
      this.board.setOccupant(c.attackerHex, c.attacker.hp > 0 ? { ...c.attacker, hasActed: true } : null);
      c.defenders.forEach((d, i) => {
        this.board.setOccupant(c.defenderHexes[i]!, d.hp > 0 ? { ...d } : null);
      });
      this.combat = null;
      if (this.status === 'combat') this.status = 'active';
    }
    for (const tile of this.board.tiles.values()) {
      if (tile.occupant?.playerId === playerId) this.board.setOccupant(tile.hex, null);
    }
    this.players = this.players.filter((p) => p !== playerId);
    this.eliminated = this.eliminated.filter((p) => p !== playerId);
    delete this.resources[playerId];
    if (this.currentPlayer === playerId) this.currentPlayer = this.players[0] ?? '';
    this.log.push(`➖ ${playerId} ha salido de la ARENA.`);
  }

  /**
   * Bajas (KO causado por un atacante) de la ÚLTIMA acción. El controlador las
   * consume para dar 500 monedas al killer. Efímero: se resetea al inicio de cada
   * acción y NO se serializa.
   */
  private defeats: { killerSlot: string; victimSlot: string }[] = [];

  /**
   * Bolas a conceder al usuario de cada slot (al ganar o abandonar en arena).
   * Efímero como `defeats`: se resetea al inicio de cada acción y no se serializa.
   */
  private rewards: { slot: string; balls: BallKey[] }[] = [];

  // ------------------------------------------------------ cofres y botín (bolas)

  /** Distancia hex al origen (para colocar el cofre inicial cerca del centro). */
  private hexDist0(h: Hex): number {
    return (Math.abs(h.q) + Math.abs(h.r) + Math.abs(h.q + h.r)) / 2;
  }

  private hasChest(): boolean {
    for (const tile of this.board.tiles.values()) if (tile.chest) return true;
    return false;
  }

  /** Coloca un cofre en una casilla de tierra libre (central si `central`). */
  private seedChest(central = false): void {
    const land: Tile[] = [];
    for (const tile of this.board.tiles.values()) {
      if (tile.biome !== 'WATER' && !tile.occupant && !tile.chest && !tile.groundBall) land.push(tile);
    }
    if (!land.length) return;
    const chosen = central
      ? land.reduce((best, t) => (this.hexDist0(t.hex) < this.hexDist0(best.hex) ? t : best), land[0]!)
      : land[Math.floor(Math.random() * land.length)]!;
    chosen.chest = true;
    this.log.push('🎁 Ha aparecido un cofre en el mapa.');
  }

  /** El Pokémon que entra en `hex` recoge el cofre o la bola del suelo (1 bola/Pokémon). */
  private collectFromTile(pokemon: Pokemon | null, hex: Hex): void {
    if (!pokemon || pokemon.carriedBall) return;
    const tile = this.board.getTile(hex);
    if (!tile) return;
    if (tile.chest) {
      pokemon.carriedBall = pickChestBall(Math.random());
      tile.chest = false;
      this.log.push(`🎁 ${nameOf(pokemon)} abre el cofre y consigue ${BALL_LABEL[pokemon.carriedBall]}.`);
      if (this.persistent) this.chestRespawnTurn = this.turn + CHEST_RESPAWN_TURNS;
    } else if (tile.groundBall) {
      pokemon.carriedBall = tile.groundBall;
      delete tile.groundBall;
      this.log.push(`🔵 ${nameOf(pokemon)} recoge ${BALL_LABEL[pokemon.carriedBall]} del suelo.`);
    }
  }

  /** Un Pokémon KO suelta su bola en la casilla `hex` (recogible por otros). */
  private dropBall(pokemon: Pokemon, hex: Hex): void {
    if (!pokemon.carriedBall) return;
    const tile = this.board.getTile(hex);
    if (tile) {
      tile.groundBall = pokemon.carriedBall;
      this.log.push(`💥 ${nameOf(pokemon)} suelta ${BALL_LABEL[pokemon.carriedBall]} al caer.`);
    }
    delete pokemon.carriedBall;
  }

  private addKo(slot: string): void {
    this.kos[slot] = (this.kos[slot] ?? 0) + 1;
  }

  /** Reúne las bolas que llevan los Pokémon vivos de cada slot (recompensa). */
  private ballsCarriedBy(slot: string): BallKey[] {
    const balls: BallKey[] = [];
    for (const tile of this.board.tiles.values()) {
      const occ = tile.occupant;
      if (occ?.playerId === slot && occ.carriedBall) balls.push(occ.carriedBall);
    }
    return balls;
  }

  /** ARENA: reaparece el cofre si tocaba (o si el mundo se quedó sin ninguno). */
  private maybeRespawnChest(): void {
    if (!this.persistent || this.hasChest()) return;
    // Si hay respawn programado, espera al turno; si no (mundo sin cofre), siembra ya.
    if (this.chestRespawnTurn > 0 && this.turn < this.chestRespawnTurn) return;
    this.seedChest(false);
    this.chestRespawnTurn = 0;
  }

  /**
   * ARENA: garantiza que haya al menos un cofre (para mundos persistentes creados
   * antes de esta mecánica, que se cargan sin cofre). Respeta el respawn en curso.
   * Devuelve true si sembró (para que el caller persista).
   */
  ensureChest(): boolean {
    if (!this.persistent || this.hasChest() || this.chestRespawnTurn > 0) return false;
    this.seedChest(false);
    return true;
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
      persistent: this.persistent,
      defeats: this.defeats,
      kos: this.kos,
      rewards: this.rewards,
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
    this.defeats = [];
    this.rewards = [];
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
      if (moved) {
        moved.hasActed = true;
        this.collectFromTile(moved, to);
      }
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
    const primary = { ...this.board.getOccupant(to)! };
    const defenderPlayer = primary.playerId;

    // "Varios contra uno": todos los Pokémon del jugador defensor que están a
    // rango (adyacentes al punto de combate) se unen a la defensa contra el
    // atacante solitario. El primer defensor es el objetivo inicial.
    const defenders: Pokemon[] = [primary];
    const defenderHexes: Hex[] = [{ ...to }];
    for (const nb of hexNeighbors(to)) {
      const occ = this.board.getOccupant(nb);
      if (occ && occ.playerId === defenderPlayer && occ.id !== primary.id && occ.id !== attacker.id) {
        defenders.push({ ...occ });
        defenderHexes.push({ ...nb });
      }
    }

    this.combat = {
      attackerId: attacker.id,
      defenderId: primary.id,
      attackerHex: from,
      defenderHex: to,
      attacker,
      defender: primary,
      attackerPlayer: attacker.playerId,
      defenderPlayer,
      defenders,
      defenderHexes,
      targetId: primary.id,
      turnActorId: attacker.id, // el atacante actúa primero
      round: 1,
      log: [`¡${nameOf(attacker)} ataca a ${nameOf(primary)}!`],
      status: 'active',
      winnerId: null,
      loserId: null,
      outcome: null,
    };
    this.status = 'combat';
    const extra = defenders.length - 1;
    this.log.push(
      `Combate: ${nameOf(attacker)} vs ${nameOf(primary)}${extra > 0 ? ` (+${extra} de refuerzo)` : ''}.`
    );
  }

  /** Índice de un defensor por id (o -1). */
  private defenderIndex(id: string): number {
    return this.combat ? this.combat.defenders.findIndex((d) => d.id === id) : -1;
  }

  /** Defensores aún en pie, en orden. */
  private livingDefenders(): Pokemon[] {
    return this.combat ? this.combat.defenders.filter((d) => d.hp > 0) : [];
  }

  /** Fija el objetivo del atacante y sincroniza los campos espejo `defender*`. */
  private setTarget(id: string): boolean {
    const c = this.combat;
    if (!c) return false;
    const idx = this.defenderIndex(id);
    if (idx < 0 || c.defenders[idx]!.hp <= 0) return false;
    c.targetId = id;
    c.defenderId = id;
    c.defender = c.defenders[idx]!;
    c.defenderHex = c.defenderHexes[idx]!;
    return true;
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
  combatAction(action: CombatAction, moveName?: string, targetId?: string): PlayResult {
    this.defeats = [];
    this.rewards = [];
    if (this.status !== 'combat' || !this.combat) {
      return { ok: false, error: 'No hay combate en curso', state: this.getStateDTO() };
    }
    const c = this.combat;
    if (c.status !== 'active') {
      return { ok: false, error: 'Fase de combate cerrada', state: this.getStateDTO() };
    }

    const actorIsAttacker = c.turnActorId === c.attackerId;

    // Selección de objetivo: solo el atacante y solo entre defensores vivos.
    if (action === 'TARGET') {
      if (!actorIsAttacker) {
        return { ok: false, error: 'Solo el atacante elige objetivo', state: this.getStateDTO() };
      }
      if (!targetId || !this.setTarget(targetId)) {
        return { ok: false, error: 'Objetivo no válido', state: this.getStateDTO() };
      }
      return { ok: true, state: this.getStateDTO() };
    }

    // El atacante puede reapuntar en la misma acción (targetId opcional).
    if (actorIsAttacker && targetId) this.setTarget(targetId);

    const actor = actorIsAttacker
      ? c.attacker
      : (c.defenders.find((d) => d.id === c.turnActorId) ?? c.defender);
    const target = actorIsAttacker
      ? (c.defenders.find((d) => d.id === c.targetId && d.hp > 0) ?? this.livingDefenders()[0])
      : c.attacker;
    if (!target) {
      return { ok: false, error: 'No hay objetivo válido', state: this.getStateDTO() };
    }
    const actorHex = actorIsAttacker ? c.attackerHex : c.defenderHexes[this.defenderIndex(actor.id)]!;
    const targetHex = actorIsAttacker
      ? c.defenderHexes[this.defenderIndex(target.id)]!
      : c.attackerHex;
    const actorTerrain = this.terrainOf(actorHex);
    const targetTerrain = this.terrainOf(targetHex);

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
          // Economía: al huir, el que se queda (target) derrota al que huye (actor).
          this.defeats.push({ killerSlot: target.playerId, victimSlot: actor.playerId });
          this.addKo(target.playerId);
        } else {
          c.outcome = 'fled';
          c.winnerId = null;
          c.loserId = actor.id; // el que huyó
        }
        c.status = 'finished'; // fase de resultado; se resuelve con continueCombat()
        return { ok: true, state: this.getStateDTO() };
      }
    }

    // KO por daño (OBJETO cura, no puede tumbar a nadie).
    if (action !== 'OBJETO' && target.hp <= 0) {
      c.log.push(`¡${nameOf(target)} se ha debilitado!`);
      // Economía: el que actúa (actor) derrota al objetivo (target).
      this.defeats.push({ killerSlot: actor.playerId, victimSlot: target.playerId });
      this.addKo(actor.playerId);
      if (!actorIsAttacker) {
        // Un defensor tumbó al atacante → gana el bando defensor.
        c.outcome = 'ko';
        c.winnerId = actor.id;
        c.loserId = c.attackerId;
        c.status = 'finished';
        return { ok: true, state: this.getStateDTO() };
      }
      // El atacante tumbó a un defensor: ¿quedan más?
      const living = this.livingDefenders();
      if (living.length === 0) {
        c.outcome = 'ko';
        c.winnerId = c.attackerId;
        c.loserId = target.id;
        c.status = 'finished';
        return { ok: true, state: this.getStateDTO() };
      }
      // Aún hay defensores: se reapunta al primero vivo y responden ellos.
      this.setTarget(living[0]!.id);
      c.turnActorId = living[0]!.id;
      c.round += 1;
      return { ok: true, state: this.getStateDTO() };
    }

    // Sin KO: pasa el turno al siguiente actor (atacante ⇄ ronda de defensores).
    c.turnActorId = this.nextCombatActor(actorIsAttacker, actor.id);
    c.round += 1;
    return { ok: true, state: this.getStateDTO() };
  }

  /**
   * Siguiente en actuar. Tras el atacante actúan, en orden, todos los defensores
   * vivos; cuando el último defensor termina, el turno vuelve al atacante.
   */
  private nextCombatActor(actorIsAttacker: boolean, actorId: string): string {
    const c = this.combat!;
    const living = this.livingDefenders();
    if (actorIsAttacker) {
      return living.length ? living[0]!.id : c.attackerId;
    }
    const idx = living.findIndex((d) => d.id === actorId);
    if (idx >= 0 && idx + 1 < living.length) return living[idx + 1]!.id;
    return c.attackerId;
  }

  /** Cierra un combate ya resuelto (fase de resultado): aplica el tablero y sigue. */
  continueCombat(): PlayResult {
    this.defeats = [];
    this.rewards = [];
    if (this.status !== 'combat' || !this.combat || this.combat.status !== 'finished') {
      return { ok: false, error: 'No hay combate por resolver', state: this.getStateDTO() };
    }
    this.finalizeCombat();
    return { ok: true, state: this.getStateDTO() };
  }

  private finalizeCombat(): void {
    const c = this.combat;
    if (!c) return;

    // Los combatientes KO sueltan su bola en su casilla (recogible por otros).
    if (c.attacker.hp <= 0) this.dropBall(c.attacker, c.attackerHex);
    c.defenders.forEach((d, i) => {
      if (d.hp <= 0) this.dropBall(d, c.defenderHexes[i]!);
    });

    // Vuelca los defensores al tablero: los vivos con su HP, los KO se retiran.
    const writeDefenders = () => {
      c.defenders.forEach((d, i) => {
        this.board.setOccupant(c.defenderHexes[i]!, d.hp > 0 ? { ...d } : null);
      });
    };

    if (c.outcome === 'ko') {
      const attackerWon = c.winnerId === c.attackerId;
      this.board.setOccupant(c.attackerHex, null);
      if (attackerWon) {
        // Cayeron TODOS los defensores: se limpian sus casillas y el atacante
        // ocupa la casilla de combate INICIAL (adyacente a su origen), no la del
        // último reapuntado, que podría quedar lejos.
        c.defenders.forEach((_, i) => this.board.setOccupant(c.defenderHexes[i]!, null));
        const winHex = c.defenderHexes[0] ?? c.defenderHex;
        this.board.setOccupant(winHex, { ...c.attacker, hasActed: true });
        // El vencedor puede recoger un cofre/bola que hubiera en la casilla ocupada.
        this.collectFromTile(this.board.getOccupant(winHex), winHex);
        this.log.push(`${nameOf(c.attacker)} vence y ocupa la casilla.`);
      } else {
        // Cayó el atacante: los defensores supervivientes permanecen.
        writeDefenders();
        this.log.push(`${nameOf(c.attacker)} ha sido derrotado.`);
      }
    } else {
      // Huida: el atacante (si sobrevive) vuelve a su casilla; defensores igual.
      this.board.setOccupant(
        c.attackerHex,
        c.attacker.hp > 0 ? { ...c.attacker, hasActed: true } : null
      );
      writeDefenders();
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
    this.defeats = [];
    this.rewards = [];
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
    this.maybeRespawnChest();
    return { ok: true, state: this.getStateDTO() };
  }

  public abandon(playerId?: string): PlayResult {
    this.defeats = [];
    this.rewards = [];
    if (this.status === 'finished') {
      return { ok: false, error: 'La partida ya ha terminado', state: this.getStateDTO() };
    }
    const loser = playerId ?? this.currentPlayer;
    if (!this.players.includes(loser) || this.eliminated.includes(loser)) {
      return { ok: false, error: 'Ese jugador no está en la partida', state: this.getStateDTO() };
    }

    // Si hay combate en curso se cancela: el atacante y TODOS los defensores
    // vuelven al tablero con su HP actual antes de retirar las piezas del que
    // abandona.
    if (this.combat) {
      const c = this.combat;
      this.board.setOccupant(c.attackerHex, c.attacker.hp > 0 ? { ...c.attacker, hasActed: true } : null);
      c.defenders.forEach((d, i) => {
        this.board.setOccupant(c.defenderHexes[i]!, d.hp > 0 ? { ...d } : null);
      });
      this.combat = null;
      this.status = 'active';
    }

    // Bolas del que abandona: en ARENA se las lleva (recompensa al momento); en
    // partida finita las suelta en el mapa (la partida termina, es irrelevante).
    if (this.persistent) {
      const balls = this.ballsCarriedBy(loser);
      if (balls.length) this.rewards.push({ slot: loser, balls });
    } else {
      for (const tile of this.board.tiles.values()) {
        if (tile.occupant?.playerId === loser && tile.occupant.carriedBall) {
          this.dropBall(tile.occupant, tile.hex);
        }
      }
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
              this.dropBall(tile.occupant, tile.hex);
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

    // ARENA: partida persistente, nunca termina (se registran eliminaciones pero
    // el mundo sigue vivo aunque no quede nadie).
    if (this.persistent) return;

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
      // Recompensa: cada ganador se lleva las bolas de sus Pokémon supervivientes.
      for (const slot of alive) {
        const balls = this.ballsCarriedBy(slot);
        if (balls.length) this.rewards.push({ slot, balls });
      }
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
      persistent: this.persistent,
      kos: this.kos,
      chestRespawnTurn: this.chestRespawnTurn,
    });
  }

  static deserialize(json: string): GameService {
    const d = JSON.parse(json);
    const board = Board.deserialize(d.tiles);
    // Compatibilidad: combates guardados antes de "varios contra uno" no tienen
    // `defenders`; se normalizan al defensor único que sí guardaban.
    const combat: CombatState | null = d.combat ?? null;
    if (combat && !Array.isArray((combat as Partial<CombatState>).defenders)) {
      combat.defenders = [combat.defender];
      combat.defenderHexes = [combat.defenderHex];
      combat.targetId = combat.defenderId;
    }
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
      combat,
      d.alliances ?? null,
      d.eliminated ?? [],
      d.persistent ?? false,
      d.kos ?? {},
      d.chestRespawnTurn ?? 0
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
