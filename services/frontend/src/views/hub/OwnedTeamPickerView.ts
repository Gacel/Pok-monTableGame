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
  /** Devuelve los `ownedId` de las instancias elegidas (equipos por instancia, T6.3). */
  private onConfirm: (ownedIds: string[]) => void;
  private onBack: () => void;

  private owned: OwnedPokemon[] = [];
  private sprites: Record<string, string> = {};
  private selected: Set<string> = new Set();

  constructor(
    container: HTMLElement,
    opts: { title: string; pick?: number; onConfirm: (ownedIds: string[]) => void; onBack: () => void }
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
    // Se selecciona y se ENVÍA por id de instancia (equipos por ownedId, T6.3): así la
    // partida usa el nivel/stats reales de esa instancia concreta, no una plantilla Lv.1.
    const cards = this.owned
      .map((p) => {
        const sel = this.selected.has(p.id);
        const color = TYPE_COLOR[p.type] ?? '#888';
        return `
        <button data-id="${p.id}" class="owned-card flex flex-col items-center rounded border-4 transition-colors ${
          sel ? 'border-yellow-400 bg-yellow-100' : 'border-gray-700 bg-gray-800'
        }" style="padding:6px;">
          <img src="${this.sprites[p.name] ?? ''}" alt="${p.name}" class="w-14 h-14 sm:w-16 sm:h-16 object-contain" style="image-rendering:pixelated;" />
          <span class="owned-card-name uppercase text-center leading-tight" style="${FONT} font-size:7px; color:${sel ? '#000' : '#fff'};">${p.name}</span>
          <span style="${FONT} font-size:6px; color:${color};">${p.type} · Lv.${p.level}</span>
        </button>`;
      })
      .join('');

    const empty = this.owned.length === 0;

    // La rejilla APROVECHA el ancho de pantalla (hasta 8 columnas) y solo hace scroll si el
    // inventario no cabe en alto. La selección se actualiza IN-PLACE (sin re-render), para no
    // reiniciar la vista/scroll al clicar.
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle(this.title)}
      <p class="text-white text-center mb-4" style="${FONT} font-size:10px;">Usa tus propios Pokémon · elegidos <span id="owned-count">${this.selected.size}</span>/${this.pick}</p>
      ${panelCard(
        empty
          ? `<p class="text-gray-500 text-center" style="${FONT} font-size:10px;">No tienes Pokémon en el inventario.</p>`
          : `<div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3 w-full" style="max-height:min(62vh, 720px); overflow-y:auto;">${cards}</div>`,
        'flex flex-col items-center w-full'
      )}
      <div class="flex flex-wrap justify-center gap-4 mt-6">
        ${backButton('btn-owned-back')}
        <button id="btn-owned-confirm" disabled class="px-8 py-3 rounded border-b-4 bg-gray-600 text-gray-300 border-gray-800 cursor-not-allowed" style="${FONT} font-size:12px; box-shadow:0 4px 0 #000;">▶ ENTRAR</button>
      </div>
      `,
      { minHeight: 700 }
    );

    this.container.querySelectorAll<HTMLButtonElement>('.owned-card').forEach((btn) => {
      btn.addEventListener('click', () => this.toggleCard(btn));
    });
    this.updateFooter();
    document.getElementById('btn-owned-back')?.addEventListener('click', () => this.onBack());
    document.getElementById('btn-owned-confirm')?.addEventListener('click', () => {
      if (this.selected.size !== this.pick) return;
      // Preserva el ORDEN de selección de `this.selected` (Set inserta en orden de clic).
      const ids = [...this.selected];
      this.onConfirm(ids);
    });
  }

  /** Alterna la selección de una carta SIN re-renderizar (no reinicia la vista/scroll). */
  private toggleCard(btn: HTMLButtonElement): void {
    const id = btn.dataset.id!;
    if (this.selected.has(id)) {
      this.selected.delete(id);
    } else if (this.selected.size < this.pick) {
      this.selected.add(id);
    } else {
      return; // ya hay `pick` elegidos: ignorar
    }
    const sel = this.selected.has(id);
    btn.classList.toggle('border-yellow-400', sel);
    btn.classList.toggle('bg-yellow-100', sel);
    btn.classList.toggle('border-gray-700', !sel);
    btn.classList.toggle('bg-gray-800', !sel);
    const name = btn.querySelector<HTMLElement>('.owned-card-name');
    if (name) name.style.color = sel ? '#000' : '#fff';
    this.updateFooter();
  }

  /** Actualiza el contador y el botón ENTRAR según la selección (in-place). */
  private updateFooter(): void {
    const count = document.getElementById('owned-count');
    if (count) count.textContent = String(this.selected.size);
    const btn = document.getElementById('btn-owned-confirm') as HTMLButtonElement | null;
    if (!btn) return;
    const ready = this.selected.size === this.pick;
    btn.disabled = !ready;
    btn.className = `px-8 py-3 rounded border-b-4 ${
      ready
        ? 'bg-green-600 hover:bg-green-500 text-white border-green-800 active:border-b-0'
        : 'bg-gray-600 text-gray-300 border-gray-800 cursor-not-allowed'
    }`;
  }
}
