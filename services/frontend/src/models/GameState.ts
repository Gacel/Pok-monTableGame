import type { Hex, Tile, MatchState, MoveOptions } from './Types';

type Listener = () => void;

/**
 * Capa MODELO (frontend): estado observable derivado del estado autoritativo del
 * servidor. No calcula reglas de juego; solo refleja lo que el servidor dice.
 */
export class GameState {
  private _match: MatchState | null = null;
  private _moveOptions: MoveOptions | null = null;
  private _selectedHex: Hex | null = null;
  private _cameraOffset: { x: number; y: number } = { x: 0, y: 0 };
  private _zoom = 1.0;
  private _activeMoveIndex: number | null = null;
  public selectedReserveId: string | null = null;
  public hoverHex: Hex | null = null;
  private _lastInteractedPokemonId: Record<string, string | null> = {};
  private listeners: Set<Listener> = new Set();

  public pokeGifs: Record<string, string> = {};
  public pokeStatic: Record<string, string> = {};

  /** Slot propio en partidas ONLINE (player1..4); null en local hot-seat. */
  public mySlot: string | null = null;
  /** Nombres visibles por slot (player1 → username) en partidas online. */
  public playerNames: Record<string, string> = {};

  /** Etiqueta visible de un jugador: username online o el propio slot. */
  labelFor(playerId: string | undefined | null): string {
    if (!playerId) return '';
    return this.playerNames[playerId] ?? playerId;
  }

  get match(): MatchState | null {
    return this._match;
  }
  get currentTiles(): Tile[] {
    return this._match?.tiles ?? [];
  }
  get moveOptions(): MoveOptions | null {
    return this._moveOptions;
  }
  get selectedHex(): Hex | null {
    return this._selectedHex;
  }
  get activeMoveIndex(): number | null {
    return this._activeMoveIndex;
  }
  get cameraOffset(): { x: number; y: number } {
    return this._cameraOffset;
  }
  get zoom(): number {
    return this._zoom;
  }
  get lastInteractedPokemonId(): Record<string, string | null> {
    return this._lastInteractedPokemonId;
  }

  setMatch(match: MatchState): void {
    this._match = match;
    this.notify();
  }

  set moveOptions(opts: MoveOptions | null) {
    this._moveOptions = opts;
    this.notify();
  }

  set selectedHex(hex: Hex | null) {
    this._selectedHex = hex;
    if (!hex) {
      this._moveOptions = null;
      this._activeMoveIndex = null;
    }
    this.notify();
  }

  set activeMoveIndex(idx: number | null) {
    this._activeMoveIndex = idx;
    this.notify();
  }

  setCameraOffset(x: number, y: number): void {
    this._cameraOffset = { x, y };
    this.notify();
  }

  setZoom(z: number): void {
    this._zoom = z;
    this.notify();
  }

  setLastInteractedPokemon(playerId: string | undefined, pokemonId: string | undefined | null): void {
    if (!playerId || !pokemonId) return;
    if (this._lastInteractedPokemonId[playerId] !== pokemonId) {
      this._lastInteractedPokemonId[playerId] = pokemonId;
      this.notify();
    }
  }

  getLastInteractedTile(playerId: string | undefined): Tile | undefined {
    const match = this.match;
    if (!match || !playerId) return undefined;
    const lastId = this._lastInteractedPokemonId[playerId];
    if (lastId) {
      const tile = match.tiles.find((t) => t.occupant?.id === lastId && t.occupant?.playerId === playerId);
      if (tile) return tile;
    }
    // Fallback al primer Pokémon vivo de ese jugador
    const fallback = match.tiles.find((t) => t.occupant?.playerId === playerId);
    if (fallback && fallback.occupant) {
      this._lastInteractedPokemonId[playerId] = fallback.occupant.id;
    }
    return fallback;
  }

  /** ¿Es (q,r) un destino de movimiento resaltado? */
  isMoveTarget(hex: Hex): boolean {
    return this._moveOptions?.moves.some((h) => h.q === hex.q && h.r === hex.r) ?? false;
  }
  /** ¿Es (q,r) un objetivo de ataque resaltado? */
  isAttackTarget(hex: Hex): boolean {
    return this._moveOptions?.attacks.some((h) => h.q === hex.q && h.r === hex.r) ?? false;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(): void {
    for (const listener of this.listeners) listener();
  }
}
