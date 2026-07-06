import { apiFetch } from '../../net/api';
import { getSprite } from '../../net/PokeSprites';
import { FONT, hubPanel, panelTitle, panelCard, backButton } from './panel';

interface OwnedPokemon {
  id: string;
  name: string;
  level: number;
  type: string;
}

const TYPE_COLOR: Record<string, string> = {
  FIRE: '#f08030', WATER: '#6890f0', GRASS: '#78c850', ELECTRIC: '#f8d030',
  NORMAL: '#a8a878', POISON: '#a040a0', FAIRY: '#ee99ac', ICE: '#98d8d8',
  PSYCHIC: '#f85888', DRAGON: '#7038f8', FLYING: '#a890f0',
};

/**
 * Selector de equipo desde el INVENTARIO propio (para ARENA / Battle Royale:
 * el jugador usa sus propios Pokémon, no un draft). Elige `pick` (3).
 */
export class OwnedTeamPickerView {
  private container: HTMLElement;
  private title: string;
  private pick: number;
  private onConfirm: (names: string[]) => void;
  private onBack: () => void;

  private owned: OwnedPokemon[] = [];
  private sprites: Record<string, string> = {};
  private selected: Set<string> = new Set();

  constructor(
    container: HTMLElement,
    opts: { title: string; pick?: number; onConfirm: (names: string[]) => void; onBack: () => void }
  ) {
    this.container = container;
    this.title = opts.title;
    this.pick = opts.pick ?? 3;
    this.onConfirm = opts.onConfirm;
    this.onBack = opts.onBack;
  }

  public async render(): Promise<void> {
    this.container.innerHTML = hubPanel(
      `${panelTitle(this.title)}<p class="text-white text-center animate-pulse" style="${FONT} font-size:12px;">Cargando inventario…</p>`,
      { minHeight: 640 }
    );
    try {
      const res = await apiFetch('/api/inventory');
      const data = await res.json();
      this.owned = (data.pokemon ?? []) as OwnedPokemon[];
    } catch {
      /* red caída */
    }
    await this.preloadSprites();
    this.draw();
  }

  private async preloadSprites(): Promise<void> {
    await Promise.all(
      this.owned.map(async (p) => {
        if (this.sprites[p.name]) return;
        this.sprites[p.name] = await getSprite(p.name);
      })
    );
  }

  private draw(): void {
    // Se selecciona por id de instancia, pero el equipo se envía por nombre.
    const cards = this.owned
      .map((p) => {
        const sel = this.selected.has(p.id);
        const color = TYPE_COLOR[p.type] ?? '#888';
        return `
        <button data-id="${p.id}" class="owned-card flex flex-col items-center rounded border-4 ${
          sel ? 'border-yellow-400 bg-yellow-100' : 'border-gray-700 bg-gray-800'
        }" style="padding:8px;">
          <img src="${this.sprites[p.name] ?? ''}" alt="${p.name}" class="w-16 h-16 object-contain" style="image-rendering:pixelated;" />
          <span class="uppercase" style="${FONT} font-size:7px; color:${sel ? '#000' : '#fff'};">${p.name}</span>
          <span style="${FONT} font-size:6px; color:${color};">${p.type} · Lv.${p.level}</span>
        </button>`;
      })
      .join('');

    const n = this.selected.size;
    const ready = n === this.pick;
    const empty = this.owned.length === 0;

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle(this.title)}
      <p class="text-white text-center mb-4" style="${FONT} font-size:10px;">Usa tus propios Pokémon · elegidos ${n}/${this.pick}</p>
      ${panelCard(
        empty
          ? `<p class="text-gray-500 text-center" style="${FONT} font-size:10px;">No tienes Pokémon en el inventario.</p>`
          : `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 overflow-y-auto w-full max-w-xl" style="max-height:min(420px, 60vh);">${cards}</div>`,
        'flex flex-col items-center'
      )}
      <div class="flex flex-wrap justify-center gap-4 mt-6">
        ${backButton('btn-owned-back')}
        <button id="btn-owned-confirm" ${ready ? '' : 'disabled'} class="px-8 py-3 rounded border-b-4 ${
          ready
            ? 'bg-green-600 hover:bg-green-500 text-white border-green-800 active:border-b-0'
            : 'bg-gray-600 text-gray-300 border-gray-800 cursor-not-allowed'
        }" style="${FONT} font-size:12px; box-shadow:0 4px 0 #000;">▶ ENTRAR</button>
      </div>
      `,
      { minHeight: 700 }
    );

    this.container.querySelectorAll<HTMLButtonElement>('.owned-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id!;
        if (this.selected.has(id)) this.selected.delete(id);
        else if (this.selected.size < this.pick) this.selected.add(id);
        this.draw();
      });
    });
    document.getElementById('btn-owned-back')?.addEventListener('click', () => this.onBack());
    document.getElementById('btn-owned-confirm')?.addEventListener('click', () => {
      if (this.selected.size !== this.pick) return;
      const names = this.owned.filter((p) => this.selected.has(p.id)).map((p) => p.name);
      this.onConfirm(names);
    });
  }
}
