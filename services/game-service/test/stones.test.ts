import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const TMP_DB = path.join(os.tmpdir(), `t92-stones-${crypto.randomUUID()}.db`);
process.env.GAME_DB_PATH = TMP_DB;

await import('../src/models/db.js'); // fuerza migraciones sobre la BD temporal
const { ItemModel } = await import('../src/models/ItemModel.js');
const { STONES, isStone, stoneByKey, STONE_KIND } = await import('../src/services/stones.js');

describe('T9.2 · catálogo de piedras', () => {
  it('las 5 piedras Gen 1 con slug PokeAPI y etiqueta ES', () => {
    expect(STONES.map((s) => s.key).sort()).toEqual(
      ['fire-stone', 'leaf-stone', 'moon-stone', 'thunder-stone', 'water-stone']
    );
    expect(stoneByKey('fire-stone')?.label).toBe('Piedra Fuego');
    expect(isStone('fire-stone')).toBe(true);
    expect(isStone('mega-stone')).toBe(false);
  });
});

describe('T9.2 · compra de piedra (lógica de inventario/saldo)', () => {
  it('añadir una piedra la acumula en owned_items (kind stone)', async () => {
    const uid = crypto.randomUUID();
    await ItemModel.add(uid, STONE_KIND, 'water-stone', 1);
    await ItemModel.add(uid, STONE_KIND, 'water-stone', 1);
    expect(await ItemModel.getQty(uid, STONE_KIND, 'water-stone')).toBe(2);
    const items = await ItemModel.listByUser(uid);
    expect(items.find((i) => i.item_key === 'water-stone')?.kind).toBe('stone');
  });
});

describe('T11.7 · compra de varias piedras (qty)', () => {
  it('añadir qty>1 acumula correctamente', async () => {
    const uid = crypto.randomUUID();
    await ItemModel.add(uid, STONE_KIND, 'fire-stone', 3);
    expect(await ItemModel.getQty(uid, STONE_KIND, 'fire-stone')).toBe(3);
    await ItemModel.add(uid, STONE_KIND, 'fire-stone', 5);
    expect(await ItemModel.getQty(uid, STONE_KIND, 'fire-stone')).toBe(8);
  });
});
