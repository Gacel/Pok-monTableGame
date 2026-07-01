import type { Biome, MovementPattern } from '../../models/Types';

interface RosterEntry {
  name: string;
  type: Biome;
  movementPattern: MovementPattern;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
}

export interface DraftTeams {
  player1: string[];
  player2: string[];
}

const TEAM_SIZE = 3;

const TYPE_COLOR: Record<string, string> = {
  FIRE: '#ef4444',
  WATER: '#3b82f6',
  GRASS: '#22c55e',
  SAND: '#eab308',
  ICE: '#93c5fd',
};

const PATTERN_LABEL: Record<MovementPattern, string> = {
  FLYING: 'Volador · Alfil',
  TANK: 'Tanque · Rey',
  SPEEDSTER: 'Velocista · Caballo',
};

/**
 * Capa VISTA: pantalla de draft. El Jugador 1 elige 3 y luego el Jugador 2 elige 3
 * de un pool de 12. Al confirmar, entrega los equipos vía callback.
 */
export class DraftView {
  private container: HTMLElement;
  private onConfirm: (teams: DraftTeams) => void;

  private roster: RosterEntry[] = [];
  private sprites: Record<string, string> = {};
  private phase: 'player1' | 'player2' = 'player1';
  private picks: DraftTeams = { player1: [], player2: [] };

  constructor(container: HTMLElement, onConfirm: (teams: DraftTeams) => void) {
    this.container = container;
    this.onConfirm = onConfirm;
  }

  async render(): Promise<void> {
    this.container.innerHTML = this.loadingHtml('Cargando Pokémon…');
    try {
      const res = await fetch('/api/game/roster');
      const data = await res.json();
      this.roster = (data.roster ?? []) as RosterEntry[];
      await this.preloadSprites();
    } catch {
      this.container.innerHTML = this.loadingHtml('Error cargando el roster. Reintenta.');
      return;
    }
    this.draw();
  }

  private async preloadSprites(): Promise<void> {
    await Promise.all(
      this.roster.map(async (p) => {
        try {
          const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${p.name.toLowerCase()}`);
          if (!r.ok) return;
          const d = await r.json();
          this.sprites[p.name] =
            d.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default ||
            d.sprites?.front_default ||
            '';
        } catch {
          /* sin sprite */
        }
      })
    );
  }

  private loadingHtml(msg: string): string {
    return `<div class="w-full h-full flex items-center justify-center text-yellow-400 text-xs" style="font-family:'Press Start 2P',monospace;">${msg}</div>`;
  }

  private currentPicks(): string[] {
    return this.picks[this.phase];
  }

  private draw(): void {
    const taken = new Set(this.picks.player1); // no repetir entre jugadores
    const picks = this.currentPicks();
    const color = this.phase === 'player1' ? '#f87171' : '#60a5fa';

    const cards = this.roster
      .map((p) => {
        const selected = picks.includes(p.name);
        const disabled = this.phase === 'player2' && taken.has(p.name);
        const border = selected ? '#facc15' : disabled ? '#374151' : '#111827';
        return `
        <button data-name="${p.name}" ${disabled ? 'disabled' : ''}
          class="draft-card relative flex flex-col items-center bg-gray-800 p-2 rounded-lg transition-all ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-700'}"
          style="border:4px solid ${border};">
          <img src="${this.sprites[p.name] ?? ''}" alt="${p.name}" class="w-16 h-16 object-contain" style="image-rendering:pixelated;" />
          <span class="text-[9px] text-white mt-1 uppercase" style="font-family:'Press Start 2P',monospace;">${p.name}</span>
          <span class="text-[7px] mt-1 px-1 rounded" style="font-family:'Press Start 2P',monospace;background:${TYPE_COLOR[p.type] ?? '#666'};color:#000;">${p.type}</span>
          <span class="text-[6px] text-gray-400 mt-1" style="font-family:'Press Start 2P',monospace;">${PATTERN_LABEL[p.movementPattern]}</span>
          ${selected ? '<span class="absolute top-1 right-1 text-yellow-400 text-xs">★</span>' : ''}
        </button>`;
      })
      .join('');

    this.container.innerHTML = `
      <div class="min-h-full flex flex-col items-center p-6">
        <h2 class="text-lg mb-1" style="font-family:'Press Start 2P',monospace;color:${color};text-shadow:2px 2px 0 #000;">
          DRAFT — ${this.phase === 'player1' ? 'JUGADOR 1' : 'JUGADOR 2'}
        </h2>
        <p class="text-[9px] text-gray-300 mb-4" style="font-family:'Press Start 2P',monospace;">
          Elige ${TEAM_SIZE} Pokémon (${picks.length}/${TEAM_SIZE})
        </p>
        <div class="grid grid-cols-4 gap-3 max-w-3xl">${cards}</div>
        <div class="mt-6 flex gap-4 items-center">
          <span class="text-[8px] text-gray-400" style="font-family:'Press Start 2P',monospace;">Elegidos: ${picks.map((n) => n.toUpperCase()).join('  ') || '—'}</span>
          <button id="draft-confirm" ${picks.length === TEAM_SIZE ? '' : 'disabled'}
            class="px-5 py-3 text-xs rounded border-b-4 active:border-b-0 active:mt-1 ${picks.length === TEAM_SIZE ? 'bg-green-600 hover:bg-green-500 border-green-800 text-white' : 'bg-gray-700 border-gray-800 text-gray-500 cursor-not-allowed'}"
            style="font-family:'Press Start 2P',monospace;">
            ${this.phase === 'player1' ? 'SIGUIENTE ▶' : '¡A JUGAR!'}
          </button>
        </div>
      </div>`;

    this.container.querySelectorAll<HTMLButtonElement>('.draft-card').forEach((btn) => {
      btn.addEventListener('click', () => this.toggle(btn.dataset.name ?? ''));
    });
    this.container.querySelector('#draft-confirm')?.addEventListener('click', () => this.confirm());
  }

  private toggle(name: string): void {
    if (!name) return;
    const picks = this.currentPicks();
    const idx = picks.indexOf(name);
    if (idx >= 0) picks.splice(idx, 1);
    else if (picks.length < TEAM_SIZE) picks.push(name);
    this.draw();
  }

  private confirm(): void {
    if (this.currentPicks().length !== TEAM_SIZE) return;
    if (this.phase === 'player1') {
      this.phase = 'player2';
      this.draw();
    } else {
      this.onConfirm(this.picks);
    }
  }
}
