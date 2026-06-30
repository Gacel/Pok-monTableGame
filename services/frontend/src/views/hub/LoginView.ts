import { authState } from '../../auth/AuthState';

export class LoginView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    this.container.innerHTML = `
      <div class="transform scale-125 lg:scale-150 origin-center transition-transform">
        <div class="relative w-full max-w-lg mx-auto p-1 bg-gray-900" style="border: 4px solid #fff; border-radius: 8px; box-shadow: 0 0 0 4px #000, 0 0 20px rgba(0,0,0,0.8);">
          <div class="bg-blue-900 border-4 border-black p-8 text-center" style="border-radius: 4px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
          <h2 class="text-4xl font-bold mb-8 text-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]" style="font-family: 'Press Start 2P', monospace; text-shadow: 2px 2px 0 #3b4cca, -2px -2px 0 #3b4cca, 2px -2px 0 #3b4cca, -2px 2px 0 #3b4cca;">
            POKé<br/><span class="text-2xl mt-4 block text-white">TRANSCENDENCE</span>
          </h2>
          
          <div class="space-y-6 mt-12 flex flex-col items-center">
            <input type="email" id="email-input" placeholder="Correo / ID" class="w-64 p-3 bg-gray-200 text-black border-4 border-gray-400 focus:border-yellow-400 outline-none text-xs text-center" style="font-family: 'Press Start 2P', monospace; box-shadow: inset 2px 2px 0 rgba(0,0,0,0.2);">
            
            <button id="btn-login" class="w-64 py-3 bg-red-600 hover:bg-red-500 text-white border-b-4 border-red-800 active:border-b-0 active:mt-1 transition-all text-xs" style="font-family: 'Press Start 2P', monospace; box-shadow: 0 4px 0 #000;">
              ENTRAR
            </button>

            <!-- Separador -->
            <div class="w-64 border-t-2 border-dashed border-gray-500 my-2"></div>

            <button id="btn-google" class="w-64 py-3 bg-white hover:bg-gray-200 text-black border-b-4 border-gray-400 active:border-b-0 active:mt-1 transition-all text-[10px] flex items-center justify-center gap-3" style="font-family: 'Press Start 2P', monospace; box-shadow: 0 4px 0 #000;">
              <svg viewBox="0 0 24 24" class="w-4 h-4"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              GOOGLE LOGIN
            </button>
          </div>
          
          <p class="mt-8 text-[10px] text-gray-400" style="font-family: 'Press Start 2P', monospace;">© 2026 ft_transcendence</p>
        </div>
      </div>
      </div>
    `;

    document.getElementById('btn-login')?.addEventListener('click', async () => {
      const email = (document.getElementById('email-input') as HTMLInputElement).value;
      if (!email) return;
      const btn = document.getElementById('btn-login') as HTMLButtonElement;
      btn.innerText = 'CONECTANDO...';
      const success = await authState.loginWithEmail(email);
      if (!success) {
        btn.innerText = 'ENTRAR';
        btn.classList.replace('bg-red-600', 'bg-gray-600');
        setTimeout(() => btn.classList.replace('bg-gray-600', 'bg-red-600'), 1000);
      }
    });

    document.getElementById('btn-google')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-google') as HTMLButtonElement;
      btn.innerText = 'CONECTANDO...';
      const mockGoogleEmail = "google_user_" + Math.floor(Math.random() * 1000) + "@gmail.com";
      const success = await authState.loginWithEmail(mockGoogleEmail);
      if (!success) {
        btn.innerText = 'GOOGLE LOGIN';
      }
    });
  }
}
