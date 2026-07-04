import { authState } from '../../auth/AuthState';
import { apiFetch } from '../../net/api';
import { FONT, panelTitle, panelCard, backButton } from './panel';

interface InvPokemon {
  id: string;
  name: string;
  level: number;
  isStarter: boolean;
  acquiredVia: string;
  type: string;
}
interface InvItem {
  kind: string;
  itemKey: string;
  qty: number;
}

const TYPE_COLOR: Record<string, string> = {
  FIRE: '#f08030', WATER: '#6890f0', GRASS: '#78c850', ELECTRIC: '#f8d030',
  NORMAL: '#a8a878', POISON: '#a040a0', FAIRY: '#ee99ac', ICE: '#98d8d8',
  PSYCHIC: '#f85888', DRAGON: '#7038f8', FLYING: '#a890f0',
};

/** Sprites reales de pokéballs (bitmap PokeAPI) para los objetos tipo pokeball. */
const BALL_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';

/**
 * Capa VISTA: INVENTARIO a pantalla completa (capa #inventory-layer, ocupa la
 * pantalla como el mapa). Izquierda: entrenador (>=50% alto). Derecha: dos
 * secciones con scroll (arriba Pokémon obtenidos, abajo Objetos), en cuadrícula.
 */
export class InventoryView {
  private container: HTMLElement;
  private onClose: () => void;
  private sprites: Record<string, string> = {};

  constructor(container: HTMLElement, onClose: () => void) {
    this.container = container;
    this.onClose = onClose;
  }

  public async render(): Promise<void> {
    this.drawShell('Cargando…');
    let pokemon: InvPokemon[] = [];
    let items: InvItem[] = [];
    try {
      const res = await apiFetch('/api/inventory');
      const data = await res.json();
      pokemon = (data.pokemon ?? []) as InvPokemon[];
      items = (data.items ?? []) as InvItem[];
    } catch {
      /* red caída */
    }
    await this.preloadSprites(pokemon);
    this.draw(pokemon, items);
  }

  private async preloadSprites(pokemon: InvPokemon[]): Promise<void> {
    await Promise.all(
      pokemon.map(async (p) => {
        if (this.sprites[p.name]) return;
        try {
          const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${p.name.toLowerCase()}`);
          const d = await r.json();
          this.sprites[p.name] =
            d.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default ||
            d.sprites?.front_default ||
            '';
        } catch {
          this.sprites[p.name] = '';
        }
      })
    );
  }

  private trainerSprite(): string {
    const a = authState.user?.avatarUrl;
    const name = a === 'boy' ? 'red' : a === 'girl' ? 'may' : a || 'red';
    return `https://play.pokemonshowdown.com/sprites/trainers/${name}.png`;
  }

  private drawShell(bodyMsg: string): void {
    this.container.innerHTML = `
      <div class="w-full h-full flex flex-col p-6 bg-blue-900" style="box-shadow: inset 0 0 30px rgba(0,0,0,0.6);">
        <div class="flex items-center justify-between mb-4">
          ${panelTitle('INVENTARIO')}
          ${backButton('btn-inv-back')}
        </div>
        <p class="text-white text-center animate-pulse" style="${FONT} font-size:12px;">${bodyMsg}</p>
      </div>`;
    document.getElementById('btn-inv-back')?.addEventListener('click', () => this.onClose());
  }

  private pokemonCell(p: InvPokemon): string {
    const color = TYPE_COLOR[p.type] ?? '#888';
    const tag = p.isStarter ? '⭐' : p.acquiredVia === 'capture' ? '🎯' : '';
    return `
      <div class="flex flex-col items-center rounded border-2 border-gray-700 bg-gray-800" style="padding:4px;">
        <img src="${this.sprites[p.name] ?? ''}" alt="${p.name}" class="w-11 h-11 object-contain" style="image-rendering:pixelated;" />
        <span class="uppercase text-white truncate" style="${FONT} font-size:6px; max-width:100%;">${tag}${p.name}</span>
        <span style="${FONT} font-size:5px; color:${color};">Lv.${p.level}</span>
      </div>`;
  }

  private itemCell(it: InvItem): string {
    const isBall = it.kind === 'pokeball';
    const img = isBall
      ? `<img src="${BALL_SPRITE}/${it.itemKey}.png" alt="${it.itemKey}" class="w-11 h-11 object-contain" style="image-rendering:pixelated;" />`
      : `<div class="w-11 h-11 flex items-center justify-center" style="font-size:24px;">${it.kind === 'cosmetic' ? '🎨' : '📦'}</div>`;
    return `
      <div class="flex flex-col items-center rounded border-2 border-gray-700 bg-gray-800" style="padding:4px;">
        ${img}
        <span class="uppercase text-white truncate" style="${FONT} font-size:6px; max-width:100%;">${it.itemKey}</span>
        <span class="text-yellow-300" style="${FONT} font-size:6px;">x${it.qty}</span>
      </div>`;
  }

  private draw(pokemon: InvPokemon[], items: InvItem[]): void {
    const u = authState.user;
    const grid = 'grid gap-2 overflow-y-auto pr-2';
    const gridStyle = 'grid-template-columns:repeat(auto-fill,minmax(60px,1fr));';

    const pokeGrid = pokemon.length
      ? pokemon.map((p) => this.pokemonCell(p)).join('')
      : `<p class="text-gray-400" style="${FONT} font-size:9px;">Sin Pokémon todavía.</p>`;
    const itemGrid = items.length
      ? items.map((it) => this.itemCell(it)).join('')
      : `<p class="text-gray-400" style="${FONT} font-size:9px;">Sin objetos todavía.</p>`;

    this.container.innerHTML = `
      <div class="w-full h-full flex flex-col p-6 bg-blue-900" style="box-shadow: inset 0 0 30px rgba(0,0,0,0.6);">
        <div class="flex items-center justify-between mb-4">
          ${panelTitle('INVENTARIO')}
          ${backButton('btn-inv-back')}
        </div>

        <div class="flex flex-1 gap-6 min-h-0">
          <!-- IZQUIERDA: entrenador (>=50% alto) -->
          <div class="w-1/3 flex">
            ${panelCard(
              `<div class="w-full h-full flex flex-col items-center justify-center text-center gap-4" style="min-height:50vh;">
                 <img src="${this.trainerSprite()}" alt="entrenador" class="pixelated block mx-auto" style="width:220px;height:220px;object-fit:contain;image-rendering:pixelated;" />
                 <span class="text-black" style="${FONT} font-size:16px;">${u?.username ?? ''}</span>
                 <span class="text-gray-600" style="${FONT} font-size:11px;">Lv. ${u?.level ?? 1} · 🪙 ${u?.coins ?? 0}</span>
                 <span class="text-gray-500" style="${FONT} font-size:9px;">${pokemon.length} Pokémon · ${items.length} objetos</span>
               </div>`,
              'flex-1 flex w-full'
            )}
          </div>

          <!-- DERECHA: dos secciones con scroll -->
          <div class="flex-1 flex flex-col gap-6 min-h-0">
            <div class="flex-1 flex flex-col min-h-0">
              ${panelCard(
                `<h3 class="text-black mb-3" style="${FONT} font-size:13px;">POKÉMON OBTENIDOS</h3>
                 <div class="${grid}" style="${gridStyle}">${pokeGrid}</div>`,
                'flex-1 flex flex-col min-h-0'
              )}
            </div>
            <div class="flex-1 flex flex-col min-h-0">
              ${panelCard(
                `<h3 class="text-black mb-3" style="${FONT} font-size:13px;">OBJETOS</h3>
                 <div class="${grid}" style="${gridStyle}">${itemGrid}</div>`,
                'flex-1 flex flex-col min-h-0'
              )}
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById('btn-inv-back')?.addEventListener('click', () => this.onClose());
  }
}
