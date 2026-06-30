import type { Hex, Tile } from './Types';

type Listener = () => void;

export class GameState {
  private _currentTiles: Tile[] = [];
  private _selectedHex: Hex | null = null;
  private _cameraOffset: { x: number, y: number } = { x: 0, y: 0 };
  private _zoom: number = 1.0;
  private listeners: Set<Listener> = new Set();
  
  public pokeGifs: Record<string, string> = {};
  public pokeStatic: Record<string, string> = {};

  get currentTiles(): Tile[] { return this._currentTiles; }
  get selectedHex(): Hex | null { return this._selectedHex; }
  get cameraOffset(): { x: number, y: number } { return this._cameraOffset; }
  get zoom(): number { return this._zoom; }

  set currentTiles(tiles: Tile[]) {
    this._currentTiles = tiles;
    this.notify();
  }

  set selectedHex(hex: Hex | null) {
    this._selectedHex = hex;
    this.notify();
  }

  setCameraOffset(x: number, y: number) {
    this._cameraOffset = { x, y };
    this.notify();
  }

  setZoom(z: number) {
    this._zoom = z;
    this.notify();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
