import type { GameMode, LobbySummary, PlayerSlot, RoomInfo, RoomStatus } from '@transcendence/shared';
import {
  DRAFT_TEAM_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_SLOTS,
  TEAMS_MODE_PLAYERS,
} from '@transcendence/shared';
import { MatchModel, parseRoomPlayers, RoomRow, StoredRoomPlayer } from '../models/MatchModel.js';
import { matchManager, ROSTER_NAMES, ARENA_ID } from './MatchManager.js';
import { hub } from '../realtime/hub.js';
import { OwnedPokemonModel } from '../models/OwnedPokemonModel.js';

/** Minutos sin actividad tras los que una sala `waiting` se barre del lobby. */
const STALE_ROOM_MINUTES = 30;
/** Gracia para que el anfitrión reconecte (F5) antes de cerrar su sala. */
const HOST_GRACE_MS = 30_000;

const hostGraceTimers = new Map<string, NodeJS.Timeout>();

export class RoomError extends Error {
  constructor(
    public readonly code: number,
    message: string
  ) {
    super(message);
  }
}

function toRoomInfo(row: RoomRow, userId: string | null): RoomInfo {
  const players = parseRoomPlayers(row);
  const you = userId ? players.find((p) => p.userId === userId) : undefined;
  // Pokémon ya elegidos por el RESTO de jugadores: el draft online los bloquea.
  const reserved = [
    ...new Set(players.filter((p) => p.userId !== userId).flatMap((p) => p.team ?? [])),
  ];
  return {
    id: row.id,
    name: row.name ?? row.id,
    gameMode: row.game_mode,
    capacity: row.capacity,
    status: row.status as RoomStatus,
    hostId: row.host_id ?? '',
    players: players.map((p) => ({
      userId: p.userId,
      username: p.username,
      slot: p.slot,
      ready: p.team !== null,
    })),
    youAre: you?.slot ?? null,
    reserved,
  };
}

function nextFreeSlot(players: StoredRoomPlayer[], capacity: number): PlayerSlot | null {
  for (const slot of PLAYER_SLOTS.slice(0, capacity)) {
    if (!players.some((p) => p.slot === slot)) return slot;
  }
  return null;
}

async function loadRoom(matchId: string): Promise<RoomRow> {
  const row = await MatchModel.findRoom(matchId);
  if (!row || row.mode !== 'online') {
    throw new RoomError(404, 'La sala no existe');
  }
  return row;
}

/**
 * Ciclo de vida de las salas online (anfitrión crea → otros se unen → draft →
 * partida). Toda mutación se difunde a la sala por WSS como `{type:'room'}`.
 */
export const RoomService = {
  toRoomInfo,

  async create(
    hostId: string,
    hostName: string,
    name: string,
    capacity: number,
    gameMode: GameMode
  ): Promise<RoomInfo> {
    const clean = name.trim().slice(0, 32);
    if (!clean) throw new RoomError(400, 'La partida necesita un nombre');
    if (!Number.isInteger(capacity) || capacity < MIN_PLAYERS || capacity > MAX_PLAYERS) {
      throw new RoomError(400, `La sala debe ser de ${MIN_PLAYERS} a ${MAX_PLAYERS} jugadores`);
    }
    if (gameMode === 'teams' && capacity !== TEAMS_MODE_PLAYERS) {
      throw new RoomError(400, 'El modo 2 vs 2 requiere exactamente 4 jugadores');
    }

    const id = matchManager.newId();
    const players: StoredRoomPlayer[] = [
      { userId: hostId, username: hostName, slot: 'player1', team: null },
    ];
    await MatchModel.createRoom(id, clean, gameMode, capacity, hostId, players);
    const row = await loadRoom(id);
    return toRoomInfo(row, hostId);
  },

  async list(): Promise<LobbySummary[]> {
    await MatchModel.sweepStaleRooms(STALE_ROOM_MINUTES);
    const rows = await MatchModel.listOpenRooms();
    return rows.map((row) => {
      const players = parseRoomPlayers(row);
      const host = players.find((p) => p.userId === row.host_id);
      return {
        id: row.id,
        name: row.name ?? row.id,
        hostName: host?.username ?? '???',
        gameMode: row.game_mode,
        capacity: row.capacity,
        playerCount: players.length,
        createdAt: row.created_at,
      };
    });
  },

  async get(matchId: string, userId: string | null): Promise<RoomInfo> {
    const row = await loadRoom(matchId);
    return toRoomInfo(row, userId);
  },

  async join(matchId: string, userId: string, username: string): Promise<RoomInfo> {
    const row = await loadRoom(matchId);
    if (row.status !== 'waiting') throw new RoomError(409, 'La partida ya ha empezado');
    const players = parseRoomPlayers(row);
    if (players.some((p) => p.userId === userId)) {
      return toRoomInfo(row, userId); // ya dentro (reintento/rejoin)
    }
    if (players.length >= row.capacity) throw new RoomError(409, 'La sala está llena');
    const slot = nextFreeSlot(players, row.capacity);
    if (!slot) throw new RoomError(409, 'La sala está llena');

    players.push({ userId, username, slot, team: null });
    await MatchModel.updateRoomPlayers(matchId, players);
    const updated = await loadRoom(matchId);
    hub.broadcast(matchId, { type: 'room', room: toRoomInfo(updated, null) });
    return toRoomInfo(updated, userId);
  },

  /** Guarda el equipo del draft; si ya están todos, arranca la partida. */
  async submitTeam(matchId: string, userId: string, team: string[]): Promise<RoomInfo> {
    const row = await loadRoom(matchId);
    if (row.status !== 'waiting') throw new RoomError(409, 'La partida ya ha empezado');
    const players = parseRoomPlayers(row);
    const me = players.find((p) => p.userId === userId);
    if (!me) throw new RoomError(403, 'No estás en esta sala');

    const valid =
      Array.isArray(team) &&
      team.length === DRAFT_TEAM_SIZE &&
      team.every((n) => typeof n === 'string' && ROSTER_NAMES.includes(n)) &&
      new Set(team).size === team.length;
    if (!valid) {
      throw new RoomError(400, `Elige ${DRAFT_TEAM_SIZE} Pokémon distintos del roster`);
    }

    // No dos entrenadores con el mismo Pokémon: se rechaza si otro jugador de la
    // sala ya lo reservó (fuente de verdad autoritativa, evita "transferencias").
    const reservedByOthers = new Set(
      players.filter((p) => p.userId !== userId).flatMap((p) => p.team ?? [])
    );
    const clash = team.find((n) => reservedByOthers.has(n));
    if (clash) {
      throw new RoomError(409, `Otro jugador ya eligió a ${clash.toUpperCase()}`);
    }

    me.team = [...team];
    await MatchModel.updateRoomPlayers(matchId, players);

    // ¿Sala completa y todos con equipo? → crear el juego autoritativo.
    if (players.length === row.capacity && players.every((p) => p.team !== null)) {
      const teams: Record<string, string[]> = {};
      for (const p of players) teams[p.slot] = p.team!;
      const game = await matchManager.createGame(matchId, teams, row.game_mode);
      hub.broadcast(matchId, { type: 'room', room: toRoomInfo(await loadRoom(matchId), null) });
      hub.broadcast(matchId, { type: 'state', state: game.getStateDTO() });
    } else {
      hub.broadcast(matchId, { type: 'room', room: toRoomInfo(await loadRoom(matchId), null) });
    }
    return this.get(matchId, userId);
  },

  /** El anfitrión cierra su sala antes de empezar. */
  async cancel(matchId: string, userId: string): Promise<void> {
    const row = await loadRoom(matchId);
    if (row.host_id !== userId) throw new RoomError(403, 'Solo el anfitrión puede cerrar la sala');
    if (row.status !== 'waiting') throw new RoomError(409, 'La partida ya ha empezado');
    await MatchModel.deleteRoom(matchId);
    hub.broadcast(matchId, { type: 'room_closed', matchId });
  },

  /**
   * Desconexión de un socket de sala en `waiting`:
   * - invitado → se libera su hueco;
   * - anfitrión → gracia de 30 s por si es un F5; si no vuelve, sala cerrada.
   */
  async handleDisconnect(matchId: string, userId: string): Promise<void> {
    const row = await MatchModel.findRoom(matchId);
    if (!row || row.mode !== 'online' || row.status !== 'waiting') return;
    if (hub.hasUser(matchId, userId)) return; // sigue conectado por otro socket

    if (row.host_id === userId) {
      const prev = hostGraceTimers.get(matchId);
      if (prev) clearTimeout(prev);
      const timer = setTimeout(() => {
        hostGraceTimers.delete(matchId);
        void (async () => {
          const fresh = await MatchModel.findRoom(matchId);
          if (!fresh || fresh.status !== 'waiting') return;
          if (hub.hasUser(matchId, userId)) return; // reconectó
          await MatchModel.deleteRoom(matchId);
          hub.broadcast(matchId, { type: 'room_closed', matchId });
        })();
      }, HOST_GRACE_MS);
      timer.unref?.();
      hostGraceTimers.set(matchId, timer);
      return;
    }

    const players = parseRoomPlayers(row).filter((p) => p.userId !== userId);
    await MatchModel.updateRoomPlayers(matchId, players);
    const fresh = await MatchModel.findRoom(matchId);
    if (fresh) hub.broadcast(matchId, { type: 'room', room: toRoomInfo(fresh, null) });
  },

  /** Slot del usuario en la sala (para atar identidad → player1..4). */
  async slotFor(matchId: string, userId: string | null): Promise<PlayerSlot | null> {
    if (!userId) return null;
    const row = await MatchModel.findRoom(matchId);
    if (!row) return null;
    return parseRoomPlayers(row).find((p) => p.userId === userId)?.slot ?? null;
  },

  /** Mapa slot(player1..4) → userId (para acreditar monedas por KO/victoria). */
  async slotUserMap(matchId: string): Promise<Map<PlayerSlot, string>> {
    const row = await MatchModel.findRoom(matchId);
    if (!row) return new Map();
    return new Map(parseRoomPlayers(row).map((p) => [p.slot, p.userId]));
  },

  // --------------------------------------------------------------- ARENA (mundo vivo)

  /** Garantiza la fila + el mundo de la ARENA (persistente, estado `active`). */
  async ensureArena(): Promise<RoomRow> {
    let row = await MatchModel.findRoom(ARENA_ID);
    if (!row) {
      await MatchModel.createRoom(ARENA_ID, 'ARENA', 'arena', MAX_PLAYERS, '', []);
      await MatchModel.updateRoomStatus(ARENA_ID, 'active');
      await matchManager.getOrCreateArena();
      row = await MatchModel.findRoom(ARENA_ID);
    }
    return row!;
  },

  /** Estado de la ARENA (reserved = Pokémon en uso por los presentes). */
  async getArena(userId: string | null): Promise<RoomInfo> {
    const row = await this.ensureArena();
    return toRoomInfo(row, userId);
  },

  /**
   * Entrada DIRECTA a la ARENA (sin sala/host/espera): asigna un slot libre,
   * coloca el equipo en un spawn aleatorio y devuelve la sala. Máx 4 a la vez.
   */
  async joinArena(userId: string, username: string, team: string[]): Promise<RoomInfo> {
    const row = await this.ensureArena();
    const players = parseRoomPlayers(row);

    // Reingreso: ya estás dentro (evita duplicar piezas).
    if (players.some((p) => p.userId === userId)) {
      return toRoomInfo(row, userId);
    }
    if (players.length >= row.capacity) {
      throw new RoomError(409, 'La ARENA está llena (máx 4). Prueba en un momento.');
    }
    // ARENA usa los Pokémon PROPIOS del jugador (no el draft): el equipo debe
    // ser un subconjunto de su inventario. Varios jugadores pueden llevar el
    // mismo Pokémon (sin regla de unicidad cruzada como en el draft).
    const shape =
      Array.isArray(team) &&
      team.length === DRAFT_TEAM_SIZE &&
      team.every((n) => typeof n === 'string') &&
      new Set(team).size === team.length;
    if (!shape) throw new RoomError(400, `Elige ${DRAFT_TEAM_SIZE} Pokémon distintos`);

    const owned = new Set((await OwnedPokemonModel.listByUser(userId)).map((p) => p.name));
    if (!team.every((n) => owned.has(n))) {
      throw new RoomError(400, 'Solo puedes usar Pokémon de tu inventario');
    }

    const slot = nextFreeSlot(players, row.capacity);
    if (!slot) throw new RoomError(409, 'La ARENA está llena');

    players.push({ userId, username, slot, team: [...team] });
    await MatchModel.updateRoomPlayers(ARENA_ID, players);
    await matchManager.addToArena(slot, team);

    const updated = await loadRoom(ARENA_ID);
    const game = await matchManager.getMatch(ARENA_ID);
    hub.broadcast(ARENA_ID, { type: 'room', room: toRoomInfo(updated, null) });
    if (game) hub.broadcast(ARENA_ID, { type: 'state', state: game.getStateDTO() });
    return toRoomInfo(updated, userId);
  },

  /** Salida de la ARENA (retira tus piezas; el mundo sigue vivo). */
  async leaveArena(userId: string): Promise<void> {
    const row = await MatchModel.findRoom(ARENA_ID);
    if (!row) return;
    const players = parseRoomPlayers(row);
    const me = players.find((p) => p.userId === userId);
    if (!me) return;
    await MatchModel.updateRoomPlayers(ARENA_ID, players.filter((p) => p.userId !== userId));
    await matchManager.removeFromArena(me.slot);

    const updated = await MatchModel.findRoom(ARENA_ID);
    const game = await matchManager.getMatch(ARENA_ID);
    if (updated) hub.broadcast(ARENA_ID, { type: 'room', room: toRoomInfo(updated, null) });
    if (game) hub.broadcast(ARENA_ID, { type: 'state', state: game.getStateDTO() });
  },
};
