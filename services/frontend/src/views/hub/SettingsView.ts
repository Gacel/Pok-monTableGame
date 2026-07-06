import { authState } from '../../auth/AuthState';
import { showMainMenu } from '../../main';

/**
 * Capa VISTA: configuración. De momento acoge el ranking (placeholder hasta
 * el user-service) y el cierre de sesión; aquí irán sonido, idioma, etc.
 */
export class SettingsView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    const user = authState.user;

    this.container.innerHTML = `
      <div class="w-full flex justify-center px-2 transform scale-100 sm:scale-125 lg:scale-150 origin-center transition-transform">
        <div class="relative w-full max-w-2xl mx-auto p-1 bg-gray-900" style="border: 4px solid #fff; border-radius: 8px; box-shadow: 0 0 0 4px #000, 0 0 20px rgba(0,0,0,0.8);">
          <div class="bg-blue-900 border-4 border-black p-4 flex flex-col items-center min-h-[400px] relative" style="border-radius: 4px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">

          <div class="bg-white border-4 border-gray-800 p-4 shadow-[4px_4px_0_#000] rounded-lg w-full max-w-sm relative mt-8">
            <h3 class="text-black text-xs mb-4 text-center border-b-2 border-gray-300 pb-2" style="font-family: 'Press Start 2P', monospace;">CONFIGURACIÓN</h3>

            <div class="mb-4 bg-gray-100 border border-gray-300 rounded p-2">
              <p class="text-black text-[8px]" style="font-family: 'Press Start 2P', monospace;">ENTRENADOR: ${user?.username ?? '—'}</p>
              <p class="text-gray-600 text-[7px] mt-1" style="font-family: 'Press Start 2P', monospace;">Nivel ${user?.level ?? 1} · ${user?.coins ?? 0} 🪙</p>
            </div>

            <div class="space-y-3 flex flex-col">
              <button id="btn-ranking" class="text-left w-full p-1 text-black text-[9px] hover:bg-gray-200 transition-colors flex items-center group focus:outline-none" style="font-family: 'Press Start 2P', monospace;">
                <span class="w-4 opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
                <span class="ml-2">🏆 Ranking</span>
              </button>
              <button id="btn-sound" disabled class="text-left w-full p-1 text-gray-400 text-[9px] flex items-center cursor-not-allowed" style="font-family: 'Press Start 2P', monospace;">
                <span class="ml-2">🔒 Sonido (pronto)</span>
              </button>
              <button id="btn-logout-settings" class="text-left w-full p-1 text-red-700 text-[9px] hover:bg-red-100 transition-colors flex items-center" style="font-family: 'Press Start 2P', monospace;">
                <span class="ml-2">🚪 Cerrar sesión</span>
              </button>
            </div>

            <button id="btn-back" class="text-left w-full p-1 mt-3 text-black text-[9px] hover:bg-gray-200 transition-colors flex items-center border-t-2 border-gray-200 pt-3" style="font-family: 'Press Start 2P', monospace;">
              <span class="ml-2">◀ VOLVER</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    `;

    document.getElementById('btn-ranking')?.addEventListener('click', () => {
      alert('El ranking global llegará con el user-service. ¡Próximamente!');
    });
    document.getElementById('btn-logout-settings')?.addEventListener('click', () => {
      authState.logout();
    });
    document.getElementById('btn-back')?.addEventListener('click', () => showMainMenu());
  }
}
