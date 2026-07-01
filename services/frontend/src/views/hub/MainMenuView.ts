import { authState } from '../../auth/AuthState';
import { showMultiplayerMenu, showSettings } from '../../main';

/**
 * Capa VISTA: menú principal. Orden fijo: Un Jugador, Multijugador, Tienda,
 * Configuración. Un Jugador (vs IA) y Tienda llegarán en fases posteriores.
 */
export class MainMenuView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    const user = authState.user;
    if (!user) return;

    const spriteName = user.avatarUrl === 'boy' ? 'red' : user.avatarUrl === 'girl' ? 'may' : (user.avatarUrl || 'red');

    this.container.innerHTML = `
      <div class="transform scale-125 lg:scale-150 origin-center transition-transform">
        <div class="relative w-full max-w-2xl mx-auto p-1 bg-gray-900" style="border: 4px solid #fff; border-radius: 8px; box-shadow: 0 0 0 4px #000, 0 0 20px rgba(0,0,0,0.8);">
          <div class="bg-blue-900 border-4 border-black p-4 flex flex-col items-center min-h-[400px] relative" style="border-radius: 4px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">

          <!-- Top Bar: Trainer Info -->
          <div class="w-full bg-white border-4 border-gray-800 p-3 flex justify-between items-center shadow-inner rounded mb-8">
            <div class="flex items-center gap-3">
              <img src="https://play.pokemonshowdown.com/sprites/trainers/${spriteName}.png" class="w-10 h-10 object-contain pixelated bg-gray-200 border-2 border-gray-400 rounded-full" />
              <div class="flex flex-col">
                <span class="text-black font-bold text-[10px]" style="font-family: 'Press Start 2P', monospace;">${user.username}</span>
                <span class="text-gray-600 text-[8px] mt-1" style="font-family: 'Press Start 2P', monospace;">Lv. ${user.level}</span>
              </div>
            </div>
            <div class="text-black text-[10px] flex items-center gap-2" style="font-family: 'Press Start 2P', monospace;">
              <span>${user.coins}</span> <span class="text-yellow-500 text-sm">🪙</span>
            </div>
          </div>

          <!-- Menu Options -->
          <div class="bg-white border-4 border-gray-800 p-4 shadow-[4px_4px_0_#000] rounded-lg w-full max-w-sm relative">
            <h3 class="text-black text-xs mb-4 text-center border-b-2 border-gray-300 pb-2" style="font-family: 'Press Start 2P', monospace;">MENÚ PRINCIPAL</h3>

            <div class="space-y-3 flex flex-col">
              <button id="btn-singleplayer" disabled class="text-left w-full p-2 text-gray-400 text-[9px] flex items-center cursor-not-allowed" style="font-family: 'Press Start 2P', monospace;">
                <span class="ml-2">🔒 UN JUGADOR · vs IA (pronto)</span>
              </button>

              <!-- Acción principal destacada -->
              <button id="btn-multiplayer" class="w-full py-3 bg-red-600 hover:bg-red-500 text-white border-b-4 border-red-800 active:border-b-0 active:mt-1 transition-all rounded flex flex-col items-center gap-2" style="font-family: 'Press Start 2P', monospace; box-shadow: 0 4px 0 #000;">
                <span class="text-[12px]">▶ MULTIJUGADOR</span>
                <span class="text-[7px] text-yellow-200">Local o Online · 2-4 jugadores · FFA o 2 vs 2</span>
              </button>

              <button id="btn-shop" disabled class="text-left w-full p-2 text-gray-400 text-[9px] flex items-center cursor-not-allowed" style="font-family: 'Press Start 2P', monospace;">
                <span class="ml-2">🔒 TIENDA (pronto)</span>
              </button>

              <button id="btn-settings" class="text-left w-full p-2 text-black text-[9px] hover:bg-gray-200 transition-colors flex items-center group focus:outline-none" style="font-family: 'Press Start 2P', monospace;">
                <span class="w-4 opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
                <span class="ml-2">⚙️ CONFIGURACIÓN</span>
              </button>
            </div>
          </div>

          <!-- Logout -->
          <button id="btn-logout" class="absolute bottom-4 right-4 text-white text-[8px] hover:text-red-400 underline" style="font-family: 'Press Start 2P', monospace;">
            CERRAR SESIÓN
          </button>
        </div>
      </div>
      </div>
    `;

    document.getElementById('btn-multiplayer')?.addEventListener('click', () => {
      showMultiplayerMenu();
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      showSettings();
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      authState.logout();
    });
  }
}
