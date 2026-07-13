import { Board, Biome } from './board.js';
import { hexNeighbors } from './hex.js';
import { makeValueNoise, fractalNoise } from './noise.js';

/**
 * Generador procedural de un ecosistema hexagonal COHERENTE (no ruido al azar).
 *
 * Modelo mini-Whittaker: se combinan tres campos de ruido continuo
 * (elevación, temperatura, humedad) mediante reglas deterministas para obtener
 * masas de agua contiguas, costas de arena, praderas, zonas volcánicas y polos
 * helados. Todo es determinista a partir de la seed ⇒ reproducible y persistible.
 */

export interface EcosystemOptions {
  /** Radio del tablero hexagonal (en tiles). radius=20 ⇒ 1261 tiles. */
  radius: number;
  /** Umbral de nivel del mar sobre la elevación [0,1]. */
  seaLevel: number;
  /** Anchura de la franja de playa por encima del nivel del mar. */
  beachWidth: number;
  /** Umbral de montaña/cumbre sobre la elevación [0,1]. */
  mountainLevel: number;
}

const DEFAULTS: EcosystemOptions = {
  radius: 20,
  seaLevel: 0.4,
  beachWidth: 0.05,
  mountainLevel: 0.7,
};

/** smoothstep clásico usado para el falloff radial. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Genera un Board con un ecosistema realista.
 * @param seed  seed uint32 (usa hashStringToSeed para seeds legibles).
 */
export function generateEcosystem(seed: number, opts?: Partial<EcosystemOptions>): Board {
  const o: EcosystemOptions = { ...DEFAULTS, ...opts };
  const board = new Board();

  // Tres campos descorrelacionados por offsets de seed distintos.
  const elevField = makeValueNoise(seed);
  const tempField = makeValueNoise((seed ^ 0x9e3779b9) >>> 0);
  const humidField = makeValueNoise(Math.imul(seed, 0x2545f491) >>> 0);

  const R = o.radius;

  // 1ª pasada: clasificar cada hexágono del disco de radio R.
  for (let q = -R; q <= R; q++) {
    const r1 = Math.max(-R, -q - R);
    const r2 = Math.min(R, -q + R);
    for (let r = r1; r <= r2; r++) {
      // Coordenadas de muestreo en el espacio del ruido (axial pointy-top).
      const nx = q + r / 2;
      const ny = r;

      // Elevación fractal + falloff radial (bordes → mar, continente central).
      const s = -q - r; // tercera coord cúbica
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) / R; // 0 centro, 1 borde
      // Sesgo hacia tierra en el interior + falloff suave hacia el mar en el borde.
      let elevation = fractalNoise(elevField, nx, ny, 5, 0.5, 2.0, 0.06) + 0.08;
      elevation -= smoothstep(0.82, 1.12, dist) * 0.5;

      // Temperatura: fría en los polos (|r| alto) + ruido.
      const latitude = 1 - Math.abs(r) / R; // 1 ecuador, 0 polos
      const temperature = Math.min(
        1,
        Math.max(0, latitude * 0.7 + fractalNoise(tempField, nx, ny, 3, 0.5, 2.0, 0.05) * 0.3)
      );

      const humidity = fractalNoise(humidField, nx, ny, 4, 0.5, 2.0, 0.07);

      board.setTile({
        hex: { q, r },
        biome: classify(elevation, temperature, humidity, o),
        occupant: null,
      });
    }
  }

  // 2ª pasada: majority filter (suaviza sal-y-pimienta en tierra, respeta agua).
  smoothLand(board);

  return board;
}

/** Reglas de clasificación de bioma (el orden define la prioridad). */
function classify(
  elevation: number,
  temperature: number,
  humidity: number,
  o: EcosystemOptions
): Biome {
  if (elevation < o.seaLevel) return 'WATER';
  if (elevation < o.seaLevel + o.beachWidth) return 'SAND'; // costa
  // Cordilleras/picos: cumbre helada si es fría; volcánica (FIRE) solo si es seca;
  // el resto, roca (MOUNTAIN).
  if (elevation > o.mountainLevel) {
    if (temperature < 0.35) return 'ICE';
    if (humidity < 0.58) return 'FIRE';
    return 'MOUNTAIN';
  }
  if (temperature < 0.25) return 'ICE'; // polos
  if (humidity < 0.25 && temperature > 0.55) return 'SAND'; // desierto interior
  // Humedal cálido de tierras bajas: mucha humedad + templado/cálido + poca elevación
  // (justo por encima de la costa). Genera pantanos contiguos junto al agua.
  if (humidity > 0.56 && temperature > 0.4 && elevation < o.seaLevel + o.beachWidth + 0.2)
    return 'SWAMP';
  // Pradera húmeda/alta (hierba alta): tierras medias con humedad templada, por encima
  // del pantano. Es el terreno del sigilo (Épica 1).
  if (humidity > 0.5 && temperature > 0.35) return 'TALL_GRASS';
  return 'GRASS';
}

/**
 * Majority filter de 1 pasada sobre biomas de TIERRA: si ≥5 de 6 vecinos de
 * tierra comparten un bioma distinto, el tile lo adopta. No toca WATER para no
 * rellenar lagos ni deformar costas.
 */
function smoothLand(board: Board): void {
  const updates: { key: string; biome: Biome }[] = [];
  for (const tile of board.tiles.values()) {
    if (tile.biome === 'WATER') continue;
    const counts = new Map<Biome, number>();
    let landNeighbors = 0;
    for (const n of hexNeighbors(tile.hex)) {
      const nt = board.getTile(n);
      if (!nt || nt.biome === 'WATER') continue;
      landNeighbors++;
      counts.set(nt.biome, (counts.get(nt.biome) ?? 0) + 1);
    }
    if (landNeighbors < 5) continue;
    for (const [biome, count] of counts) {
      if (biome !== tile.biome && count >= 5) {
        updates.push({ key: `${tile.hex.q},${tile.hex.r}`, biome });
        break;
      }
    }
  }
  for (const u of updates) {
    const tile = board.tiles.get(u.key);
    if (tile) tile.biome = u.biome;
  }
}
