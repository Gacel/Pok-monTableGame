import { showMainMenu } from '../../main';
import { apiFetch } from '../../net/api';
import { getSprite } from '../../net/PokeSprites';
import { authState } from '../../auth/AuthState';
import { FONT, hubPanel, panelTitle, panelCard } from './panel';

interface StarterOption {
  name: string;
  type: string;
  hp: number;
  atk: number;
  def: number;
}

const TYPE_COLOR: Record<string, string> = {
  FIRE: '#f08030', WATER: '#6890f0', GRASS: '#78c850', ELECTRIC: '#f8d030',
  NORMAL: '#a8a878', POISON: '#a040a0', FAIRY: '#ee99ac', ICE: '#98d8d8',
  PSYCHIC: '#f85888', DRAGON: '#7038f8', FLYING: '#a890f0',
};

/**
 * Capa VISTA: selección de STARTERS (primer login). Elige 3 de 12 Pokémon
 * balanceados. Al confirmar se conceden como Pokémon propios y se entra al menú.
 */
export class StarterSelectionView {
  private container: HTMLElement;
  private options: StarterOption[] = [];
  private sprites: Record<string, string> = {};
  private selected: Set<string> = new Set();
  private pick = 3;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async render(): Promise<void> {
    this.container.innerHTML = hubPanel(
      `${panelTitle('ELIGE TUS 3 POKÉMON')}
       <p class="text-white text-center animate-pulse" style="${FONT} font-size:12px;">Cargando…</p>`,
      { minHeight: 700 }
    );
    try {
      const res = await apiFetch('/api/starters/options');
      const data = await res.json();
      this.options = (data.options ?? []) as StarterOption[];
      this.pick = data.pick ?? 3;
      await this.preloadSprites();
    } catch {
      /* red caída: se mostrará vacío */
    }
    this.draw();
  }

  private async preloadSprites(): Promise<void> {
    await Promise.all(
      this.options.map(async (o) => {
        this.sprites[o.name] = await getSprite(o.name);
      })
    );
  }

  private draw(): void {
    const cards = this.options
      .map((o) => {
        const sel = this.selected.has(o.name);
        const color = TYPE_COLOR[o.type] ?? '#888';
        return `
        <button data-name="${o.name}" class="starter-card flex flex-col items-center rounded border-4 ${
          sel ? 'border-yellow-400 bg-yellow-100' : 'border-gray-700 bg-gray-800'
        } transition-all" style="padding:10px;">
          <img src="${this.sprites[o.name] ?? ''}" alt="${o.name}" class="w-16 h-16 object-contain" style="image-rendering:pixelated;" />
          <span class="uppercase" style="${FONT} font-size:8px; color:${sel ? '#000' : '#fff'};">${o.name}</span>
          <span style="${FONT} font-size:6px; color:${color};">${o.type}</span>
          <span style="${FONT} font-size:6px; color:${sel ? '#333' : '#aaa'};">HP ${o.hp} · ${o.atk}/${o.def}</span>
        </button>`;
      })
      .join('');

    const n = this.selected.size;
    const ready = n === this.pick;

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('ELIGE TUS 3 POKÉMON')}
      <p class="text-white text-center mb-4" style="${FONT} font-size:10px;">Equilibrados en poder · elegidos ${n}/${this.pick}</p>
      ${panelCard(
        `<div class="grid grid-cols-4 gap-3" style="width:640px; max-width:100%;">${cards}</div>`,
        'flex flex-col items-center'
      )}
      <button id="btn-confirm-starters" ${ready ? '' : 'disabled'} class="mt-6 px-8 py-3 rounded border-b-4 ${
        ready
          ? 'bg-green-600 hover:bg-green-500 text-white border-green-800 active:border-b-0 active:mt-7'
          : 'bg-gray-600 text-gray-300 border-gray-800 cursor-not-allowed'
      }" style="${FONT} font-size:12px; box-shadow:0 4px 0 #000;">▶ CONFIRMAR</button>
      `,
      { minHeight: 720 }
    );

    this.container.querySelectorAll<HTMLButtonElement>('.starter-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name!;
        if (this.selected.has(name)) this.selected.delete(name);
        else if (this.selected.size < this.pick) this.selected.add(name);
        this.draw();
      });
    });
    document.getElementById('btn-confirm-starters')?.addEventListener('click', () => void this.confirm());
  }

  private async confirm(): Promise<void> {
    if (this.selected.size !== this.pick) return;
    const btn = document.getElementById('btn-confirm-starters') as HTMLButtonElement | null;
    if (btn) btn.innerText = 'GUARDANDO...';
    try {
      const res = await apiFetch('/api/starters', {
        method: 'POST',
        body: JSON.stringify({ names: [...this.selected] }),
      });
      if (res.ok) {
        // Refresca el perfil (pokemonCount>0) → el guard navega al menú.
        await authState.fetchUserProfile();
        showMainMenu();
        return;
      }
    } catch {
      /* red */
    }
    if (btn) btn.innerText = '▶ CONFIRMAR';
  }
}
