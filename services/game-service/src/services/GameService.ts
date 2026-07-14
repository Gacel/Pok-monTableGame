import { Board, Pokemon, Tile } from '../engine/board.js';
import { Hex, hexEqual, hexDistance, hexNeighbors } from '../engine/hex.js';
import { getMoveOptions, MoveOptions } from '../engine/movement.js';
import { computeMoveDamage, calculateAoE } from '../engine/combat.js';
import { terrainDamage } from '../engine/environment.js';
import { collectResources, PlayerResources } from '../engine/resources.js';
import { BALL_LABEL, pickChestBall } from '@transcendence/shared';

// Contratos de estado en @transcendence/shared (única fuente de verdad).
// Se re-exportan para no romper los imports existentes `from '../services/GameService.js'`.
export type { MatchStatus, MatchStateDTO, TurnEvent } from '@transcendence/shared';
import type { MatchStatus, MatchStateDTO, BallKey, TurnEvent } from '@transcendence/shared';

/** Turnos que tarda en reaparecer el cofre en ARENA tras recogerse. */
const CHEST_RESPAWN_TURNS = 4;

export interface PlayResult {
  ok: boolean;
  error?: string;
  state: MatchStateDTO;
}

const emptyResources = (): PlayerResources => ({ FIRE_CANDY: 0, WATER_CANDY: 0, GRASS_CANDY: 0 });
const nameOf = (p: Pokemon) => (p.name ?? p.id).toUpperCase();

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
    private alliances: string[][] | null = null,
    private eliminated: string[] = [],
    /** ARENA: la partida NUNCA termina (siempre viva, aunque quede 0-1 jugadores). */
    private persistent: boolean = false,
    public deploymentDeadline?: number,
    public reserve: Record<string, Pokemon[]> = {},
    public deploymentZones: Record<string, Hex[]> = {},
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
    const reserve: Record<string, Pokemon[]> = {};
    const deploymentZones: Record<string, Hex[]> = {};

    for (const { pokemon } of placements) {
      if (!players.includes(pokemon.playerId)) {
        players.push(pokemon.playerId);
        resources[pokemon.playerId] = emptyResources();
        reserve[pokemon.playerId] = [];
        deploymentZones[pokemon.playerId] = [];
      }
      reserve[pokemon.playerId]!.push(pokemon);
    }
    
    // Assign deployment zones using Voronoi diagram based on first placement hex
    const playerBases: Record<string, Hex> = {};
    for (const { hex, pokemon } of placements) {
      if (!playerBases[pokemon.playerId]) {
        playerBases[pokemon.playerId] = hex;
      }
    }

    for (const t of board.tiles.values()) {
      if (t.biome === 'WATER') continue;
      
      let minD = Infinity;
      let owner: string | null = null;
      for (const [pId, base] of Object.entries(playerBases)) {
        const d = hexDistance(t.hex, base);
        if (d < minD) {
          minD = d;
          owner = pId;
        } else if (d === minD) {
          // Break ties deterministically
          if (pId < (owner ?? '')) owner = pId;
        }
      }
      if (owner) {
        deploymentZones[owner]!.push(t.hex);
      }
    }
    const game = new GameService(
      id,
      board,
      players,
      players[0]!,
      1,
      'deployment',
      null,
      resources,
      ['¡Fase de despliegue! Tienes 42 segundos.'],
      alliances,
      [],
      persistent,
      Date.now() + 42000, // 42 seconds from now
      reserve,
      deploymentZones
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

  /**
   * Eventos de feedback visual de la ÚLTIMA acción (daño, KO, …). El frontend los
   * consume para animar. Efímero como `defeats`: se resetea al inicio de cada acción
   * y NO se serializa.
   */
  private events: TurnEvent[] = [];

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

  getStateDTO(requestingPlayerId?: string): MatchStateDTO {
    const censoredIds = new Set<string>();
    const serializedTiles = this.board.serialize().map((tile: Tile) => {
      // Si la partida está activa, el pokemon está oculto, y no somos de su equipo, lo censuramos.
      // En fase de despliegue, la visibilidad la gestiona el frontend de forma global.
      if (
        this.status === 'active' &&
        tile.occupant &&
        tile.occupant.isHidden &&
        requestingPlayerId &&
        !this.sameTeam(tile.occupant.playerId, requestingPlayerId)
      ) {
        censoredIds.add(tile.occupant.id);
        return { ...tile, occupant: null };
      }
      return tile;
    });

    // Un evento que apunta a un enemigo AÚN oculto para este jugador se omite (un
    // número flotante no debe revelar una pieza invisible). Los KO de piezas ya
    // retiradas del tablero se conservan (su id no está entre los censurados).
    const events = censoredIds.size
      ? this.events.filter((e) => !e.pokemonId || !censoredIds.has(e.pokemonId))
      : this.events;

    return {
      id: this.id,
      tiles: serializedTiles,
      players: this.players,
      currentPlayer: this.currentPlayer,
      turn: this.turn,
      status: this.status,
      winner: this.winner,
      resources: this.resources,
      log: this.log.slice(-30),
      alliances: this.alliances,
      eliminated: this.eliminated,
      persistent: this.persistent,
      defeats: this.defeats,
      ...(this.deploymentDeadline !== undefined ? { deploymentDeadline: this.deploymentDeadline } : {}),
      reserve: this.reserve,
      deploymentZones: this.deploymentZones,
      kos: this.kos,
      rewards: this.rewards,
      events,
    };
  }

  getMoveOptions(hex: Hex): MoveOptions {
    if (this.status !== 'active') return { moves: [], attacks: [] };
    const occ = this.board.getOccupant(hex);
    if (occ && occ.hasActed) return { moves: [], attacks: [] };
    return getMoveOptions(hex, this.board, this.sameTeam);
  }

  // ---------------------------------------------------------------- despliegue
  public deploy(playerId: string, pokemonId: string, hex: Hex): PlayResult {
    this.defeats = [];
    this.events = [];
    if (this.status === 'deployment' && this.deploymentDeadline && Date.now() > this.deploymentDeadline) {
      this.forceStart();
    }
    if (this.status !== 'deployment') {
      return { ok: false, error: 'La fase de despliegue ha terminado', state: this.getStateDTO() };
    }
    const myReserve = this.reserve[playerId];
    if (!myReserve) {
      return { ok: false, error: 'No tienes Pokémon en reserva', state: this.getStateDTO() };
    }
    const pokeIndex = myReserve.findIndex((p) => p.id === pokemonId);
    if (pokeIndex < 0) {
      return { ok: false, error: 'El Pokémon no está en tu reserva', state: this.getStateDTO() };
    }
    const validZones = this.deploymentZones[playerId];
    if (!validZones || !validZones.some((z) => hexEqual(z, hex))) {
      return { ok: false, error: 'Casilla fuera de tu zona de despliegue', state: this.getStateDTO() };
    }
    // Check occupancy using getOccupiedHexes for sizes
    const pokemon = myReserve[pokeIndex]!;
    const hexes = this.board.getOccupiedHexes(pokemon, hex);
    for (const h of hexes) {
      if (this.board.getOccupant(h)) {
        return { ok: false, error: 'Casilla ocupada o insuficiente espacio', state: this.getStateDTO() };
      }
    }
    
    // Place it
    myReserve.splice(pokeIndex, 1);
    this.board.setOccupant(hex, pokemon);
    this.log.push(`${playerId} despliega a ${nameOf(pokemon)}.`);

    // If everyone has deployed everything, start match automatically?
    const allDeployed = Object.values(this.reserve).every((res) => res.length === 0);
    if (allDeployed) {
      this.forceStart();
    }

    return { ok: true, state: this.getStateDTO() };
  }

  public forceStart(): PlayResult {
    if (this.status === 'deployment') {
      this.status = 'active';
      this.log.push('¡El despliegue ha terminado! ¡Comienza la partida!');
      // Colocar los Pokémon no desplegados en casillas aleatorias válidas de su zona
      for (const [playerId, res] of Object.entries(this.reserve)) {
        if (!res || res.length === 0) continue;
        const zones = this.deploymentZones[playerId] ?? [];
        // Aleatorizar el orden de las zonas
        const shuffledZones = [...zones].sort(() => Math.random() - 0.5);
        for (const p of res) {
          for (const hex of shuffledZones) {
             const hexes = this.board.getOccupiedHexes(p, hex);
             const canPlace = hexes.every(h => !this.board.getOccupant(h) && this.board.getTile(h));
             if (canPlace) {
                this.board.setOccupant(hex, p);
                break;
             }
          }
        }
      }
      this.reserve = {};
    }
    this.updateStealthVisibility();
    return { ok: true, state: this.getStateDTO() };
  }

  // ---------------------------------------------------------------- movimiento
  play(playerId: string, from: Hex, to: Hex): PlayResult {
    this.defeats = [];
    this.rewards = [];
    this.events = [];
    if (this.status === 'finished') {
      return { ok: false, error: 'La partida ha terminado', state: this.getStateDTO() };
    }
    if (this.status === 'deployment') {
      return { ok: false, error: 'Aún en fase de despliegue', state: this.getStateDTO() };
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

    if (isMove) {
      this.board.moveOccupant(from, to);
      const moved = this.board.getOccupant(to);
      if (moved) {
        moved.hasActed = true;
        moved.revealed = false; // reubicarse permite volver a esconderse (T1.1)
        this.collectFromTile(moved, to);
      }
      this.log.push(`${nameOf(mover)} se mueve.`);
      this.updateStealthVisibility();
      return { ok: true, state: this.getStateDTO() };
    }
    return { ok: false, error: 'Movimiento ilegal', state: this.getStateDTO() };
  }

  private updateStealthVisibility(): void {
    if (this.status !== 'active') return;
    const pokes = new Map<string, { pokemon: Pokemon; hexes: Hex[] }>();
    for (const tile of this.board.tiles.values()) {
      if (tile.occupant) {
        if (!pokes.has(tile.occupant.id)) {
          pokes.set(tile.occupant.id, { pokemon: tile.occupant, hexes: [] });
        }
        pokes.get(tile.occupant.id)!.hexes.push(tile.hex);
      }
    }

    for (const { pokemon, hexes } of pokes.values()) {
      // Si está en hierba, asume oculto inicialmente, salvo que haya un enemigo cerca.
      // Solo consideramos hierba alta si TODAS sus casillas ocupadas son TALL_GRASS.
      const inGrass = hexes.length > 0 && hexes.every((h) => this.board.getTile(h)?.biome === 'TALL_GRASS');
      
      let enemyAdjacent = false;
      for (const hex of hexes) {
        const neighbors = hexNeighbors(hex);
        for (const n of neighbors) {
          const adjOcc = this.board.getOccupant(n);
          if (adjOcc && !this.sameTeam(adjOcc.playerId, pokemon.playerId)) {
            enemyAdjacent = true;
            break;
          }
        }
        if (enemyAdjacent) break;
      }

      if (inGrass && !enemyAdjacent && !pokemon.hasActed && !pokemon.revealed) {
        // Puede esconderse (salvo si fue descubierto por daño y no se ha reubicado, T1.1)
        if (pokemon.isHidden === false || pokemon.isHidden === undefined) {
           pokemon.isHidden = true;
        }
      } else if (enemyAdjacent && pokemon.isHidden) {
        pokemon.isHidden = false;
        this.log.push(`👁️ ¡${nameOf(pokemon)} ha sido descubierto!`);
      } else if (!inGrass && pokemon.isHidden) {
        pokemon.isHidden = false;
      }
    }
  }

  // ---------------------------------------------------------------- combate AoE
  cast(playerId: string, from: Hex, targetHex: Hex, moveIndex: number): PlayResult {
    this.defeats = [];
    this.rewards = [];
    this.events = [];
    if (this.status !== 'active') {
      return { ok: false, error: 'La partida no está activa', state: this.getStateDTO() };
    }
    if (playerId !== this.currentPlayer) {
      return { ok: false, error: 'No es tu turno', state: this.getStateDTO() };
    }
    const caster = this.board.getOccupant(from);
    if (!caster) {
      return { ok: false, error: 'No hay ninguna pieza tuya en el origen', state: this.getStateDTO() };
    }
    if (caster.playerId !== playerId) {
      return { ok: false, error: 'Esa pieza no es tuya', state: this.getStateDTO() };
    }
    if (caster.hasActed) {
      return { ok: false, error: 'Esa pieza ya ha actuado en este turno', state: this.getStateDTO() };
    }

    const move = caster.moves?.[moveIndex];
    if (!move) {
      return { ok: false, error: 'El movimiento seleccionado no existe', state: this.getStateDTO() };
    }
    
    // Validar rango (distancia geométrica entre centro del caster y el targetHex)
    // Asumimos que los ataques siempre se pueden lanzar si el centro está dentro del range.
    const range = move.range ?? 1;
    const dist = hexDistance(from, targetHex);

    // El centro del AoE debe estar dentro del alcance (también los radiales — TA.1: se
    // acabó el "rango infinito").
    if (dist > range) {
       return { ok: false, error: 'El objetivo está fuera de rango', state: this.getStateDTO() };
    }

    // Auto-cast (dist 0) solo válido para ondas radiales autocentradas.
    if (dist === 0 && move.aoe !== 'radius') {
       return { ok: false, error: 'No puedes atacarte a ti mismo con este movimiento', state: this.getStateDTO() };
    }

    const aoe = move.aoe || 'single';
    const moveRange = move.range || 1;
    const aoeHexes = calculateAoE(from, targetHex, aoe, moveRange, move.radius);
    let hits = 0;
    
    this.log.push(`🔥 ${nameOf(caster)} lanza ${move.name.toUpperCase()}!`);
    
    // Aplicar daño a todo ocupante en el área afectada
    const processed = new Set<string>(); // para no dañar al mismo pokemon grande 2 veces
    for (const h of aoeHexes) {
      const tile = this.board.getTile(h);
      if (tile && tile.occupant && !processed.has(tile.occupant.id)) {
         // Evitar fuego amigo a no ser que el ataque lo especifique (simplificado: daña a todos los enemigos)
         if (!this.sameTeam(tile.occupant.playerId, caster.playerId)) {
            processed.add(tile.occupant.id);
            const targetTerrain = tile.biome;
            const casterTerrain = this.board.getTile(from)?.biome ?? 'GRASS';
            
            const dmg = computeMoveDamage(caster, tile.occupant, move, casterTerrain, targetTerrain);
            if (dmg > 0) {
              tile.occupant.hp = Math.max(0, tile.occupant.hp - dmg);
              hits++;
              this.log.push(`💥 ${nameOf(tile.occupant)} recibe ${dmg} de daño (HP: ${tile.occupant.hp}).`);
              this.events.push({ kind: 'damage', pokemonId: tile.occupant.id, hex: tile.hex, delta: -dmg });

              if (tile.occupant.hp <= 0) {
                 this.log.push(`💀 ¡${nameOf(tile.occupant)} ha caído KO!`);
                 this.events.push({ kind: 'ko', pokemonId: tile.occupant.id, hex: tile.hex });
                 this.defeats.push({ killerSlot: caster.playerId, victimSlot: tile.occupant.playerId });
                 this.addKo(caster.playerId);
                 this.dropBall(tile.occupant, tile.hex);
                 this.board.setOccupant(tile.hex, null);
              } else if (tile.occupant.isHidden) {
                 // Golpeado por AoE y sobrevive: se descubre (T1.1). `revealed` evita que
                 // updateStealthVisibility lo vuelva a ocultar estando quieto.
                 tile.occupant.isHidden = false;
                 tile.occupant.revealed = true;
                 this.log.push(`👁️ ¡${nameOf(tile.occupant)} ha sido descubierto!`);
                 this.events.push({ kind: 'reveal', pokemonId: tile.occupant.id, hex: tile.hex });
              }
            }
         }
      }
    }
    
    if (hits === 0) {
      this.log.push(`💨 El ataque no golpeó a nadie.`);
    }

    caster.hasActed = true;
    caster.isHidden = false; // El ataque rompe el sigilo inmediatamente
    
    this.updateStealthVisibility();
    this.checkWinCondition();
    return { ok: true, state: this.getStateDTO() };
  }

  // --------------------------------------------------------------------- turnos
  public endTurn(playerId?: string): PlayResult {
    this.defeats = [];
    this.rewards = [];
    this.events = [];
    if (this.status === 'finished') {
      return { ok: false, error: 'La partida ha terminado', state: this.getStateDTO() };
    }
    if (this.status === 'deployment') {
      return { ok: false, error: 'La partida aún no ha empezado', state: this.getStateDTO() };
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
    this.applyEndOfTurnEffects();
    if (this.status === 'active') this.switchPlayer();
    this.maybeRespawnChest();
    return { ok: true, state: this.getStateDTO() };
  }

  public abandon(playerId?: string): PlayResult {
    this.defeats = [];
    this.rewards = [];
    this.events = [];
    if (this.status === 'finished') {
      return { ok: false, error: 'La partida ya ha terminado', state: this.getStateDTO() };
    }
    const loser = playerId ?? this.currentPlayer;
    if (!this.players.includes(loser) || this.eliminated.includes(loser)) {
      return { ok: false, error: 'Ese jugador no está en la partida', state: this.getStateDTO() };
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

  /**
   * Aplica al final del turno los efectos de terreno de TODOS los biomas (no solo
   * lava): daño de lava (escalado por `lavaTurns`), daño de pantano y curaciones
   * (valores negativos de `terrainDamage`, preparado para T2.2). Emite eventos de
   * turno (T0.1) de daño/curación/KO.
   */
  private applyEndOfTurnEffects(): void {
    // Deduplicar por id: un `large` ocupa varios hexes y no debe sufrir el efecto
    // varias veces (mismo patrón que `cast`). Hoy todos son `medium` (1 hex); esto
    // es defensa de cara a T4.1.
    const processed = new Set<string>();
    for (const tile of this.board.tiles.values()) {
      const occ = tile.occupant;
      if (!occ || processed.has(occ.id)) continue;
      processed.add(occ.id);

      // `lavaTurns`: escala en FIRE consecutivo (excepto FIRE/FLYING); se reinicia
      // en cuanto la pieza deja la lava.
      if (tile.biome === 'FIRE') {
        if (occ.type !== 'FIRE' && occ.type !== 'FLYING') {
          occ.lavaTurns = (occ.lavaTurns ?? 0) + 1;
        }
      } else {
        occ.lavaTurns = 0;
      }

      const raw = terrainDamage(occ, tile.biome);
      if (raw === 0) continue;

      // Clamp a [0, maxHp] (soporta daño raw>0 y curación raw<0). El evento usa el
      // delta REALMENTE aplicado: curar a HP lleno no emite un "+N" fantasma.
      const maxHp = occ.maxHp ?? occ.hp;
      const before = occ.hp;
      occ.hp = Math.max(0, Math.min(maxHp, before - raw));
      const applied = occ.hp - before; // <0 daño real · >0 curación real · 0 sin efecto
      if (applied === 0) continue;

      if (applied < 0) {
        const lost = -applied;
        this.events.push({ kind: 'damage', pokemonId: occ.id, hex: tile.hex, delta: applied });
        if (tile.biome === 'FIRE') {
          this.log.push(`¡${nameOf(occ)} se quema en la lava (-${lost} HP, turno ${occ.lavaTurns})!`);
        } else if (tile.biome === 'SWAMP') {
          this.log.push(`☠️ ${nameOf(occ)} sufre el pantano (-${lost} HP).`);
        } else {
          this.log.push(`${nameOf(occ)} sufre el terreno (-${lost} HP).`);
        }
        if (occ.hp <= 0) {
          this.log.push(`¡${nameOf(occ)} ha caído KO por el terreno!`);
          this.events.push({ kind: 'ko', pokemonId: occ.id, hex: tile.hex });
          this.dropBall(occ, tile.hex);
          this.board.setOccupant(tile.hex, null);
        }
      } else {
        // Curación (Planta en hierba alta, 8% maxHp — D9).
        this.events.push({ kind: 'heal', pokemonId: occ.id, hex: tile.hex, delta: applied });
        this.log.push(`♻️ ${nameOf(occ)} se regenera (+${applied} HP).`);
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
      alliances: this.alliances,
      eliminated: this.eliminated,
      persistent: this.persistent,
      deploymentDeadline: this.deploymentDeadline,
      reserve: this.reserve,
      deploymentZones: this.deploymentZones,
      kos: this.kos,
      chestRespawnTurn: this.chestRespawnTurn,
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
      d.alliances ?? null,
      d.eliminated ?? [],
      d.persistent ?? false,
      d.deploymentDeadline,
      d.reserve ?? {},
      d.deploymentZones ?? {},
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
