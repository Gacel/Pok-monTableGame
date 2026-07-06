import type { GameMode } from '@transcendence/shared';
import { showMultiplayerMenu, startLocalGame } from '../../main';
import type { BotLevel } from '../../controllers/botStrategy';

export interface LocalGameConfig {
  players: number; // 2..4
  gameMode: GameMode; // 'ffa' | 'teams' (2v2, solo con 4)
  /** Slots controlados por la IA: slot → nivel. Vacío = todo humano (hot-seat). */
  bots?: Record<string, BotLevel>;
}

/**
 * Capa VISTA: configuración de la partida LOCAL (misma pantalla).
 * Nº de jugadores (2-4) y modo: todos contra todos o 2 vs 2 (con 4).
 */
const BOT_LABELS: Record<BotLevel, string> = { 1: 'FÁCIL', 2: 'NORMAL', 3: 'DIFÍCIL' };

export class LocalSetupView {
  private container: HTMLElement;
  private players = 2;
  private gameMode: GameMode = 'ffa';
  /** Rivales controlados por la IA (por defecto sí: "juega contra la máquina"). */
  private cpu = true;
  private botLevel: BotLevel = 2;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    if (this.players !== 4 && this.gameMode === 'teams') this.gameMode = 'ffa';

    const playerBtn = (n: number) => {
      const active = this.players === n;
      return `
        <button data-players="${n}" class="players-opt flex-1 py-3 text-[10px] rounded border-2 transition-all ${
          active
            ? 'bg-yellow-400 border-yellow-600 text-black font-bold shadow-[0_3px_0_#000]'
            : 'bg-gray-100 border-gray-400 text-gray-700 hover:bg-gray-200'
        }" style="font-family: 'Press Start 2P', monospace;">${n}</button>`;
    };

    const modeBtn = (mode: GameMode, label: string, hint: string, disabled: boolean) => {
      const active = this.gameMode === mode;
      return `
        <button data-mode="${mode}" ${disabled ? 'disabled' : ''} class="mode-opt w-full py-2 px-2 text-left text-[8px] rounded border-2 transition-all flex justify-between items-center ${
          disabled
            ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
            : active
              ? 'bg-yellow-400 border-yellow-600 text-black font-bold shadow-[0_3px_0_#000]'
              : 'bg-gray-100 border-gray-400 text-gray-700 hover:bg-gray-200'
        }" style="font-family: 'Press Start 2P', monospace;">
          <span>${label}</span><span class="text-[6px]">${hint}</span>
        </button>`;
    };

    this.container.innerHTML = `
      <div class="transform scale-125 lg:scale-150 origin-center transition-transform">
        <div class="relative w-full max-w-2xl mx-auto p-1 bg-gray-900" style="border: 4px solid #fff; border-radius: 8px; box-shadow: 0 0 0 4px #000, 0 0 20px rgba(0,0,0,0.8);">
          <div class="bg-blue-900 border-4 border-black p-4 flex flex-col items-center min-h-[400px] relative" style="border-radius: 4px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">

          <div class="bg-white border-4 border-gray-800 p-4 shadow-[4px_4px_0_#000] rounded-lg w-full max-w-sm relative mt-6">
            <h3 class="text-black text-xs mb-4 text-center border-b-2 border-gray-300 pb-2" style="font-family: 'Press Start 2P', monospace;">PARTIDA LOCAL</h3>

            <p class="text-black text-[8px] mb-2" style="font-family: 'Press Start 2P', monospace;">JUGADORES</p>
            <div class="flex gap-2 mb-4">${[2, 3, 4].map(playerBtn).join('')}</div>

            <p class="text-black text-[8px] mb-2" style="font-family: 'Press Start 2P', monospace;">MODO</p>
            <div class="space-y-2 mb-4">
              ${modeBtn('ffa', '⚔️ TODOS CONTRA TODOS', `${this.players} rivales`, false)}
              ${modeBtn('teams', '🤝 2 VS 2', this.players === 4 ? 'P1+P3 vs P2+P4' : 'requiere 4', this.players !== 4)}
            </div>

            <p class="text-black text-[8px] mb-2" style="font-family: 'Press Start 2P', monospace;">RIVALES</p>
            <div class="flex gap-2 mb-3">
              <button data-cpu="1" class="cpu-opt flex-1 py-2 text-[8px] rounded border-2 ${
                this.cpu
                  ? 'bg-yellow-400 border-yellow-600 text-black font-bold shadow-[0_3px_0_#000]'
                  : 'bg-gray-100 border-gray-400 text-gray-700 hover:bg-gray-200'
              }" style="font-family: 'Press Start 2P', monospace;">🤖 CPU</button>
              <button data-cpu="0" class="cpu-opt flex-1 py-2 text-[8px] rounded border-2 ${
                !this.cpu
                  ? 'bg-yellow-400 border-yellow-600 text-black font-bold shadow-[0_3px_0_#000]'
                  : 'bg-gray-100 border-gray-400 text-gray-700 hover:bg-gray-200'
              }" style="font-family: 'Press Start 2P', monospace;">👥 HUMANOS</button>
            </div>
            ${
              this.cpu
                ? `<p class="text-black text-[8px] mb-2" style="font-family: 'Press Start 2P', monospace;">DIFICULTAD IA</p>
            <div class="flex gap-2 mb-4">
              ${([1, 2, 3] as BotLevel[])
                .map(
                  (lvl) =>
                    `<button data-level="${lvl}" class="level-opt flex-1 py-2 text-[7px] rounded border-2 ${
                      this.botLevel === lvl
                        ? 'bg-red-500 border-red-700 text-white font-bold shadow-[0_3px_0_#000]'
                        : 'bg-gray-100 border-gray-400 text-gray-700 hover:bg-gray-200'
                    }" style="font-family: 'Press Start 2P', monospace;">${BOT_LABELS[lvl]}</button>`
                )
                .join('')}
            </div>`
                : `<p class="text-gray-500 text-[7px] mb-4" style="font-family: 'Press Start 2P', monospace;">Hot-seat: todos los jugadores en esta pantalla.</p>`
            }

            <button id="btn-start-draft" class="w-full py-3 bg-red-600 hover:bg-red-500 text-white border-b-4 border-red-800 active:border-b-0 active:mt-1 transition-all rounded flex flex-col items-center gap-1" style="font-family: 'Press Start 2P', monospace; box-shadow: 0 4px 0 #000;">
              <span class="text-[11px]">▶ EMPEZAR DRAFT</span>
              <span class="text-[7px] text-yellow-200">3 Pokémon por jugador</span>
            </button>

            <button id="btn-back" class="text-left w-full p-1 mt-3 text-black text-[9px] hover:bg-gray-200 transition-colors flex items-center border-t-2 border-gray-200 pt-3" style="font-family: 'Press Start 2P', monospace;">
              <span class="ml-2">◀ VOLVER</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    `;

    this.container.querySelectorAll<HTMLButtonElement>('.players-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.players = Number(btn.dataset.players);
        this.render();
      });
    });
    this.container.querySelectorAll<HTMLButtonElement>('.mode-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.gameMode = (btn.dataset.mode === 'teams' ? 'teams' : 'ffa') as GameMode;
        this.render();
      });
    });
    this.container.querySelectorAll<HTMLButtonElement>('.cpu-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cpu = btn.dataset.cpu === '1';
        this.render();
      });
    });
    this.container.querySelectorAll<HTMLButtonElement>('.level-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.botLevel = Number(btn.dataset.level) as BotLevel;
        this.render();
      });
    });
    document.getElementById('btn-start-draft')?.addEventListener('click', () => {
      // Con CPU, los jugadores 2..N son bots del nivel elegido (P1 = humano).
      const bots: Record<string, BotLevel> = {};
      if (this.cpu) {
        for (let i = 2; i <= this.players; i++) bots[`player${i}`] = this.botLevel;
      }
      startLocalGame({ players: this.players, gameMode: this.gameMode, bots });
    });
    document.getElementById('btn-back')?.addEventListener('click', () => showMultiplayerMenu());
  }
}
