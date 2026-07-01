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
  private listeners: Set<Listener> = new Set();

  public pokeGifs: Record<string, string> = {};
  public pokeStatic: Record<string, string> = {};

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
  get cameraOffset(): { x: number; y: number } {
    return this._cameraOffset;
  }
  get zoom(): number {
    return this._zoom;
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
    if (!hex) this._moveOptions = null;
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
