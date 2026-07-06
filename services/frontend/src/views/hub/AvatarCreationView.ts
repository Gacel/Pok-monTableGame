import { authState } from '../../auth/AuthState';

export class AvatarCreationView {
  private container: HTMLElement;
  private selectedAvatar: string = 'red';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    const trainers = [
      { id: 'red', label: 'Red' },
      { id: 'may', label: 'May' },
      { id: 'blue', label: 'Blue' },
      { id: 'cynthia', label: 'Cynthia' },
      { id: 'ethan', label: 'Ethan' },
      { id: 'lyra', label: 'Lyra' },
      { id: 'steven', label: 'Steven' },
      { id: 'dawn', label: 'Dawn' },
    ];

    const gridHtml = trainers.map(t => {
      const isSelected = this.selectedAvatar === t.id;
      return `
        <button id="btn-avatar-${t.id}" data-id="${t.id}" class="avatar-btn w-16 h-16 bg-gray-200 border-4 ${isSelected ? 'border-yellow-400 opacity-100 scale-105' : 'border-gray-500 opacity-60 hover:opacity-90'} transition-all shadow-[inset_2px_2px_0_rgba(255,255,255,0.5)] rounded flex flex-col items-center justify-center p-1 cursor-pointer">
          <img src="https://play.pokemonshowdown.com/sprites/trainers/${t.id}.png" class="w-full h-full object-contain" style="image-rendering: pixelated;" alt="${t.label}" />
        </button>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="w-full flex justify-center px-2 transform scale-100 sm:scale-125 lg:scale-150 origin-center transition-transform">
        <div class="relative w-full max-w-lg mx-auto p-1 bg-gray-900" style="border: 4px solid #fff; border-radius: 8px; box-shadow: 0 0 0 4px #000, 0 0 20px rgba(0,0,0,0.8);">
          <div class="bg-blue-900 border-4 border-black p-5" style="border-radius: 4px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
          
          <div class="bg-white border-4 border-gray-800 p-3 mb-4 rounded-lg shadow-inner">
            <p class="text-black text-[10px] leading-relaxed font-bold text-center" style="font-family: 'Press Start 2P', monospace;">
              ¡Elige a tu Entrenador y tu Nombre en el mundo de POKé TRANSCENDENCE!
            </p>
          </div>

          <div class="flex flex-col items-center space-y-4">
            <div class="grid grid-cols-4 gap-2 sm:gap-3 bg-black bg-opacity-40 p-3 rounded-lg border-2 border-gray-700">
              ${gridHtml}
            </div>

            <input type="text" id="username-input" placeholder="TU NOMBRE" maxlength="10" class="w-full max-w-xs p-3 bg-gray-200 text-black border-4 border-gray-400 focus:border-yellow-400 outline-none text-xs text-center uppercase font-bold" style="font-family: 'Press Start 2P', monospace; box-shadow: inset 2px 2px 0 rgba(0,0,0,0.2);">

            <button id="btn-continue" class="w-full max-w-xs py-3 bg-green-600 hover:bg-green-500 text-white border-b-4 border-green-800 active:border-b-0 active:mt-1 transition-all text-xs font-bold cursor-pointer" style="font-family: 'Press Start 2P', monospace; box-shadow: 0 4px 0 #000;">
              LISTO
            </button>
          </div>

        </div>
      </div>
      </div>
    `;

    this.container.querySelectorAll<HTMLButtonElement>('.avatar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedAvatar = btn.dataset.id ?? 'red';
        this.container.querySelectorAll<HTMLButtonElement>('.avatar-btn').forEach(b => {
          if (b.dataset.id === this.selectedAvatar) {
            b.className = "avatar-btn w-16 h-16 bg-gray-200 border-4 border-yellow-400 opacity-100 scale-105 transition-all shadow-[inset_2px_2px_0_rgba(255,255,255,0.5)] rounded flex flex-col items-center justify-center p-1 cursor-pointer";
          } else {
            b.className = "avatar-btn w-16 h-16 bg-gray-200 border-4 border-gray-500 opacity-60 hover:opacity-90 transition-all shadow-[inset_2px_2px_0_rgba(255,255,255,0.5)] rounded flex flex-col items-center justify-center p-1 cursor-pointer";
          }
        });
      });
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
