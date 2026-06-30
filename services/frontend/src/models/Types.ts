export interface Hex {
  q: number;
  r: number;
}

export interface Tile {
  hex: Hex;
  biome: 'FIRE' | 'WATER' | 'GRASS' | 'SAND' | 'ICE';
  occupant: any | null;
}
