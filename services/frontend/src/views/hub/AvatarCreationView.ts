import { authState } from '../../auth/AuthState';

export class AvatarCreationView {
  private container: HTMLElement;
  private selectedAvatar: string = 'boy';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    this.container.innerHTML = `
      <div class="transform scale-125 lg:scale-150 origin-center transition-transform">
        <div class="relative w-full max-w-lg mx-auto p-1 bg-gray-900" style="border: 4px solid #fff; border-radius: 8px; box-shadow: 0 0 0 4px #000, 0 0 20px rgba(0,0,0,0.8);">
          <div class="bg-blue-900 border-4 border-black p-6" style="border-radius: 4px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
          
          <div class="bg-white border-4 border-gray-800 p-4 mb-6 rounded-lg shadow-inner">
            <p class="text-black text-xs leading-loose" style="font-family: 'Press Start 2P', monospace;">
              ¡Hola! Estás a punto de entrar al mundo de POKé TRANSCENDENCE. Primero, dime, ¿cómo te llamas y cómo te ves?
            </p>
          </div>

          <div class="flex flex-col items-center space-y-6">
            <div class="flex gap-4">
              <button id="btn-boy" class="w-24 h-24 bg-gray-200 border-4 border-yellow-400 opacity-100 transition-all shadow-[inset_4px_4px_0_rgba(255,255,255,0.5)]">
                <img src="https://play.pokemonshowdown.com/sprites/trainers/red.png" class="w-full h-full object-contain pixelated" alt="Boy" />
              </button>
              <button id="btn-girl" class="w-24 h-24 bg-gray-200 border-4 border-gray-500 opacity-50 hover:opacity-80 transition-all shadow-[inset_4px_4px_0_rgba(255,255,255,0.5)]">
                <img src="https://play.pokemonshowdown.com/sprites/trainers/may.png" class="w-full h-full object-contain pixelated" alt="Girl" />
              </button>
            </div>

            <input type="text" id="username-input" placeholder="TU NOMBRE" maxlength="10" class="w-64 p-3 bg-gray-200 text-black border-4 border-gray-400 focus:border-yellow-400 outline-none text-xs text-center uppercase" style="font-family: 'Press Start 2P', monospace; box-shadow: inset 2px 2px 0 rgba(0,0,0,0.2);">

            <button id="btn-continue" class="w-64 py-3 bg-green-600 hover:bg-green-500 text-white border-b-4 border-green-800 active:border-b-0 active:mt-1 transition-all text-xs" style="font-family: 'Press Start 2P', monospace; box-shadow: 0 4px 0 #000;">
              LISTO
            </button>
          </div>

        </div>
      </div>
      </div>
    `;

    document.getElementById('btn-boy')?.addEventListener('click', () => {
      this.selectedAvatar = 'boy';
      document.getElementById('btn-boy')!.className = "w-24 h-24 bg-gray-200 border-4 border-yellow-400 opacity-100 transition-all shadow-[inset_4px_4px_0_rgba(255,255,255,0.5)] flex items-center justify-center";
      document.getElementById('btn-girl')!.className = "w-24 h-24 bg-gray-200 border-4 border-gray-500 opacity-50 hover:opacity-80 transition-all shadow-[inset_4px_4px_0_rgba(255,255,255,0.5)] flex items-center justify-center";
    });

    document.getElementById('btn-girl')?.addEventListener('click', () => {
      this.selectedAvatar = 'girl';
      document.getElementById('btn-girl')!.className = "w-24 h-24 bg-gray-200 border-4 border-yellow-400 opacity-100 transition-all shadow-[inset_4px_4px_0_rgba(255,255,255,0.5)] flex items-center justify-center";
      document.getElementById('btn-boy')!.className = "w-24 h-24 bg-gray-200 border-4 border-gray-500 opacity-50 hover:opacity-80 transition-all shadow-[inset_4px_4px_0_rgba(255,255,255,0.5)] flex items-center justify-center";
    });

    document.getElementById('btn-continue')?.addEventListener('click', async () => {
      const username = (document.getElementById('username-input') as HTMLInputElement).value.toUpperCase();
      if (!username) return;
      const btn = document.getElementById('btn-continue') as HTMLButtonElement;
      btn.innerText = 'GUARDANDO...';
      const success = await authState.registerAvatar(username, this.selectedAvatar);
      if (!success) {
        btn.innerText = 'LISTO';
        btn.classList.replace('bg-green-600', 'bg-red-600');
        setTimeout(() => btn.classList.replace('bg-red-600', 'bg-green-600'), 1000);
      }
    });
  }
}
