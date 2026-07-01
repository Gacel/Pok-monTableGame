import type { MovementPattern, PokemonType } from '../../models/Types';

interface RosterEntry {
  name: string;
  type: PokemonType;
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
  ICE: '#06b6d4',
  POISON: '#a855f7',
  FLYING: '#6366f1',
  DRAGON: '#4338ca',
  PSYCHIC: '#ec4899',
  NORMAL: '#9ca3af',
  ELECTRIC: '#eab308',
  FAIRY: '#f472b6',
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
        const isTakenByOther = this.phase === 'player2' && taken.has(p.name);
        const isTeamFull = picks.length === TEAM_SIZE && !selected;
        const disabled = isTakenByOther || isTeamFull;
        const border = selected ? '#facc15' : disabled ? '#374151' : '#1e293b';
        return `
        <button data-name="${p.name}" ${disabled ? 'disabled' : ''}
          class="draft-card relative flex flex-col items-center bg-gray-800 p-1.5 rounded-lg transition-all ${disabled ? 'opacity-35 cursor-not-allowed grayscale bg-gray-950' : 'hover:bg-gray-700 hover:scale-105'}"
          style="border:3px solid ${border};">
          <img src="${this.sprites[p.name] ?? ''}" alt="${p.name}" class="w-14 h-14 object-contain" style="image-rendering:pixelated;" />
          <span class="text-[8px] text-white mt-0.5 uppercase font-bold" style="font-family:'Press Start 2P',monospace;">${p.name}</span>
          <span class="text-[6px] mt-1 px-1.5 py-0.5 rounded font-bold" style="font-family:'Press Start 2P',monospace;background:${TYPE_COLOR[p.type] ?? '#666'};color:#000;">${p.type}</span>
          <span class="text-[5.5px] text-gray-300 mt-0.5" style="font-family:'Press Start 2P',monospace;">${PATTERN_LABEL[p.movementPattern]}</span>
          ${selected ? '<span class="absolute top-1 right-1 text-yellow-400 text-sm animate-pulse">★</span>' : ''}
        </button>`;
      })
      .join('');

    const isReady = picks.length === TEAM_SIZE;
    const btnStyle = isReady
      ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-300 hover:to-red-400 border-yellow-200 text-black font-extrabold shadow-[0_0_20px_rgba(250,204,21,0.9)] animate-pulse scale-105 cursor-pointer'
      : 'bg-gray-800 border-gray-900 text-gray-500 cursor-not-allowed opacity-60';

    this.container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center p-3 overflow-hidden">
        <h2 class="text-base mb-1" style="font-family:'Press Start 2P',monospace;color:${color};text-shadow:2px 2px 0 #000;">
          DRAFT — ${this.phase === 'player1' ? 'JUGADOR 1' : 'JUGADOR 2'}
        </h2>
        <p class="text-[8px] text-gray-300 mb-3" style="font-family:'Press Start 2P',monospace;">
          Elige ${TEAM_SIZE} Pokémon (${picks.length}/${TEAM_SIZE})
        </p>
        <div class="grid grid-cols-6 gap-2 max-w-4xl">${cards}</div>
        <div class="mt-4 flex gap-4 items-center justify-between w-full max-w-4xl px-4 bg-gray-900 bg-opacity-80 p-2 rounded border border-gray-700">
          <span class="text-[8px] text-gray-300" style="font-family:'Press Start 2P',monospace;">Elegidos: <span class="text-yellow-400 font-bold">${picks.map((n) => n.toUpperCase()).join('  ') || '—'}</span></span>
          <button id="draft-confirm" ${isReady ? '' : 'disabled'}
            class="px-6 py-3 text-xs rounded border-2 transition-all ${btnStyle}"
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
