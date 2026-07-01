import { showLocalSetup, showLobby, showMainMenu } from '../../main';

/**
 * Capa VISTA: submenú MULTIJUGADOR. Dos caminos:
 *  - LOCAL  → 2-4 jugadores en la misma pantalla (hot-seat).
 *  - ONLINE → crear partida (anfitrión) o buscar partida (lobby).
 */
export class MultiplayerMenuView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    this.container.innerHTML = `
      <div class="transform scale-125 lg:scale-150 origin-center transition-transform">
        <div class="relative w-full max-w-2xl mx-auto p-1 bg-gray-900" style="border: 4px solid #fff; border-radius: 8px; box-shadow: 0 0 0 4px #000, 0 0 20px rgba(0,0,0,0.8);">
          <div class="bg-blue-900 border-4 border-black p-4 flex flex-col items-center min-h-[400px] relative" style="border-radius: 4px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">

          <div class="bg-white border-4 border-gray-800 p-4 shadow-[4px_4px_0_#000] rounded-lg w-full max-w-sm relative mt-8">
            <h3 class="text-black text-xs mb-4 text-center border-b-2 border-gray-300 pb-2" style="font-family: 'Press Start 2P', monospace;">MULTIJUGADOR</h3>

            <button id="btn-local" class="w-full mb-4 py-3 bg-red-600 hover:bg-red-500 text-white border-b-4 border-red-800 active:border-b-0 active:mt-1 transition-all rounded flex flex-col items-center gap-2" style="font-family: 'Press Start 2P', monospace; box-shadow: 0 4px 0 #000;">
              <span class="text-[8px] bg-yellow-400 text-black px-2 py-1 rounded">👥 MISMA PANTALLA</span>
              <span class="text-[12px]">▶ PARTIDA LOCAL</span>
              <span class="text-[7px] text-yellow-200">2-4 jugadores · por turnos</span>
            </button>

            <button id="btn-online" class="w-full mb-4 py-3 bg-blue-600 hover:bg-blue-500 text-white border-b-4 border-blue-800 active:border-b-0 active:mt-1 transition-all rounded flex flex-col items-center gap-2" style="font-family: 'Press Start 2P', monospace; box-shadow: 0 4px 0 #000;">
              <span class="text-[8px] bg-yellow-400 text-black px-2 py-1 rounded">🌐 OTRO NAVEGADOR</span>
              <span class="text-[12px]">▶ ONLINE</span>
              <span class="text-[7px] text-yellow-200">Crear partida · Buscar partida</span>
            </button>

            <p class="text-black text-[7px] leading-relaxed mb-2 bg-gray-100 border border-gray-300 rounded p-2" style="font-family: 'Press Start 2P', monospace;">
              Todos contra todos (2-4) o 2 vs 2 (4 jugadores). Elige 3 Pokémon, controla biomas para ganar candies y derrota a tus rivales.
            </p>

            <button id="btn-back" class="text-left w-full p-1 text-black text-[9px] hover:bg-gray-200 transition-colors flex items-center group focus:outline-none border-t-2 border-gray-200 pt-3" style="font-family: 'Press Start 2P', monospace;">
              <span class="ml-2">◀ VOLVER</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    `;

    document.getElementById('btn-local')?.addEventListener('click', () => showLocalSetup());
    document.getElementById('btn-online')?.addEventListener('click', () => showLobby());
    document.getElementById('btn-back')?.addEventListener('click', () => showMainMenu());
  }
}
