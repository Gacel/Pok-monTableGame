import type { MovementPattern, PokemonType } from '../../models/Types';
import type { GameMode } from '@transcendence/shared';

interface RosterEntry {
  name: string;
  type: PokemonType;
  movementPattern: MovementPattern;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
}

/** Configuración del draft: local secuencial (N jugadores) u online (solo tú). */
export type DraftConfig =
  | { mode: 'local'; players: number; gameMode: GameMode }
  | { mode: 'online'; playerLabel: string };

const TEAM_SIZE = 3;

/** Colores por jugador, alineados con el HUD (P1 azul, P2 rojo, P3 violeta, P4 amarillo). */
const PLAYER_COLORS = ['#3b82f6', '#ef4444', '#a855f7', '#eab308'];

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
 * Capa VISTA: pantalla de draft.
 *  - Local: cada jugador (1..N) elige 3 por turnos en la misma pantalla,
 *    sin repetir Pokémon entre jugadores.
 *  - Online: eliges SOLO tu equipo de 3 (los rivales draftean en su navegador).
 * Al confirmar, entrega los equipos en orden vía callback.
 */
export class DraftView {
  private container: HTMLElement;
  private config: DraftConfig;
  private onConfirm: (teams: string[][]) => void;

  private roster: RosterEntry[] = [];
  private sprites: Record<string, string> = {};
  private phase = 0; // índice del jugador que elige (siempre 0 en online)
  private picks: string[][];

  constructor(container: HTMLElement, config: DraftConfig, onConfirm: (teams: string[][]) => void) {
    this.container = container;
    this.config = config;
    this.onConfirm = onConfirm;
    const teams = config.mode === 'local' ? config.players : 1;
    this.picks = Array.from({ length: teams }, () => []);
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

  private totalPhases(): number {
    return this.picks.length;
  }

  private currentPicks(): string[] {
    return this.picks[this.phase] ?? [];
  }

  /** Título de la fase: JUGADOR N (+ equipo en 2v2) o tu etiqueta online. */
  private phaseTitle(): string {
    if (this.config.mode === 'online') {
      return `DRAFT — ${this.config.playerLabel.toUpperCase()}`;
    }
    const n = this.phase + 1;
    if (this.config.gameMode === 'teams') {
      const team = n === 1 || n === 3 ? 'EQUIPO A' : 'EQUIPO B';
      return `DRAFT — JUGADOR ${n} · ${team}`;
    }
    return `DRAFT — JUGADOR ${n}`;
  }

  private phaseColor(): string {
    if (this.config.mode === 'online') return '#facc15';
    return PLAYER_COLORS[this.phase] ?? '#facc15';
  }

  private draw(): void {
    // En local no se repite Pokémon entre jugadores; online cada uno es libre.
    const taken = new Set(this.picks.slice(0, this.phase).flat());
    const picks = this.currentPicks();
    const color = this.phaseColor();

    const cards = this.roster
      .map((p) => {
        const selected = picks.includes(p.name);
        const isTakenByOther = taken.has(p.name);
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
    const isLastPhase = this.phase === this.totalPhases() - 1;
    const confirmLabel =
      this.config.mode === 'online'
        ? 'CONFIRMAR EQUIPO ✔'
        : isLastPhase
          ? '¡A JUGAR!'
          : 'SIGUIENTE ▶';
    const btnStyle = isReady
      ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-300 hover:to-red-400 border-yellow-200 text-black font-extrabold shadow-[0_0_20px_rgba(250,204,21,0.9)] animate-pulse scale-105 cursor-pointer'
      : 'bg-gray-800 border-gray-900 text-gray-500 cursor-not-allowed opacity-60';

    this.container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center p-3 overflow-hidden">
        <h2 class="text-base mb-1" style="font-family:'Press Start 2P',monospace;color:${color};text-shadow:2px 2px 0 #000;">
          ${this.phaseTitle()}
        </h2>
        <p class="text-[8px] text-gray-300 mb-3" style="font-family:'Press Start 2P',monospace;">
          Elige ${TEAM_SIZE} Pokémon (${picks.length}/${TEAM_SIZE})${this.config.mode === 'local' ? ` · Fase ${this.phase + 1}/${this.totalPhases()}` : ''}
        </p>
        <div class="grid grid-cols-6 gap-2 max-w-4xl">${cards}</div>
        <div class="mt-4 flex gap-4 items-center justify-between w-full max-w-4xl px-4 bg-gray-900 bg-opacity-80 p-2 rounded border border-gray-700">
          <span class="text-[8px] text-gray-300" style="font-family:'Press Start 2P',monospace;">Elegidos: <span class="text-yellow-400 font-bold">${picks.map((n) => n.toUpperCase()).join('  ') || '—'}</span></span>
          <button id="draft-confirm" ${isReady ? '' : 'disabled'}
            class="px-6 py-3 text-xs rounded border-2 transition-all ${btnStyle}"
            style="font-family:'Press Start 2P',monospace;">
            ${confirmLabel}
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
    if (this.phase < this.totalPhases() - 1) {
      this.phase += 1;
      this.draw();
    } else {
      this.onConfirm(this.picks);
    }
  }
}
