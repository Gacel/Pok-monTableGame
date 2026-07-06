import { authState } from '../../auth/AuthState';

const FONT = "font-family: 'Press Start 2P', monospace;";
const inputCls =
  'w-full p-3 bg-gray-200 text-black border-4 border-gray-400 focus:border-yellow-400 outline-none text-xs';
const btnBase =
  'w-full py-3 border-b-4 active:border-b-0 active:mt-1 transition-all text-xs';

/**
 * Pantalla de acceso: LOGIN (email + contraseña) y REGISTRO completo
 * (Nombre, email, contraseña, confirmación, edad, Estudiante42). La sesión se
 * guarda en cookie HttpOnly (no en JS). Ver docs/AUTH.md.
 */
export class LoginView {
  private container: HTMLElement;
  private mode: 'login' | 'register' = 'login';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="w-full h-full flex items-center justify-center p-4">
        <div class="relative w-full max-w-md mx-auto p-1 bg-gray-900" style="border: 6px solid #fff; border-radius: 12px; box-shadow: 0 0 0 6px #000, 0 0 40px rgba(0,0,0,0.85);">
          <div class="bg-blue-900 border-4 border-black" style="border-radius: 6px; box-shadow: inset 0 0 30px rgba(0,0,0,0.6); padding: clamp(20px, 5vw, 40px);">
            <h2 class="font-bold mb-6 sm:mb-8 text-yellow-400 text-center drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]" style="${FONT} font-size: clamp(24px, 7vw, 40px); text-shadow: 3px 3px 0 #3b4cca, -3px -3px 0 #3b4cca;">
              POKé<span class="block text-white mt-3" style="font-size: clamp(14px, 4vw, 22px);">TRANSCENDENCE</span>
            </h2>
            <div id="auth-body"></div>
            <p class="mt-6 text-[9px] text-gray-400 text-center" style="${FONT}">© 2026 jvalle-d, sbenitez</p>
          </div>
        </div>
      </div>`;
    this.renderBody();
  }

  private renderBody(): void {
    const body = this.container.querySelector('#auth-body') as HTMLElement;
    body.innerHTML = this.mode === 'login' ? this.loginHtml() : this.registerHtml();
    if (this.mode === 'login') this.wireLogin();
    else this.wireRegister();
  }

  private loginHtml(): string {
    return `
      <div class="flex flex-col gap-4">
        <input type="email" id="login-email" placeholder="Correo" class="${inputCls}" style="${FONT}" autocomplete="username" />
        <input type="password" id="login-password" placeholder="Contraseña" class="${inputCls}" style="${FONT}" autocomplete="current-password" />
        <input type="text" id="login-2fa" placeholder="Código 2FA (si lo tienes)" class="${inputCls} hidden" style="${FONT}" inputmode="numeric" maxlength="6" />
        <button id="btn-login" class="${btnBase} bg-red-600 hover:bg-red-500 border-red-800 text-white" style="${FONT} box-shadow: 0 4px 0 #000;">ENTRAR</button>
        <p id="auth-error" class="text-red-300 text-[10px] text-center min-h-[14px]" style="${FONT}"></p>
        <button id="to-register" class="text-yellow-300 hover:text-yellow-100 text-[10px] underline" style="${FONT}">¿No tienes cuenta? Regístrate</button>
        <div class="border-t-2 border-dashed border-gray-500 my-1"></div>
        <button id="btn-google" class="${btnBase} bg-white hover:bg-gray-200 text-black border-gray-400 flex items-center justify-center gap-3" style="${FONT} box-shadow: 0 4px 0 #000;">
          <svg viewBox="0 0 24 24" class="w-5 h-5"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          GOOGLE LOGIN
        </button>
      </div>`;
  }

  private registerHtml(): string {
    return `
      <div class="flex flex-col gap-3">
        <input type="text" id="reg-name" placeholder="Nombre" maxlength="16" class="${inputCls}" style="${FONT}" />
        <input type="email" id="reg-email" placeholder="Correo" class="${inputCls}" style="${FONT}" autocomplete="username" />
        <input type="password" id="reg-password" placeholder="Contraseña (mín. 8)" class="${inputCls}" style="${FONT}" autocomplete="new-password" />
        <input type="password" id="reg-password2" placeholder="Confirmar contraseña" class="${inputCls}" style="${FONT}" autocomplete="new-password" />
        <input type="number" id="reg-age" placeholder="Edad" min="1" max="120" class="${inputCls}" style="${FONT}" />
        <label class="flex items-center gap-3 text-white text-[10px] py-1 cursor-pointer" style="${FONT}">
          <input type="checkbox" id="reg-student42" class="w-5 h-5 accent-yellow-400" />
          ¿Estudiante42?
        </label>
        <button id="btn-register" class="${btnBase} bg-green-600 hover:bg-green-500 border-green-800 text-white" style="${FONT} box-shadow: 0 4px 0 #000;">REGISTRARSE</button>
        <p id="auth-error" class="text-red-300 text-[10px] text-center min-h-[14px]" style="${FONT}"></p>
        <button id="to-login" class="text-yellow-300 hover:text-yellow-100 text-[10px] underline" style="${FONT}">¿Ya tienes cuenta? Inicia sesión</button>
      </div>`;
  }

  private err(): HTMLParagraphElement | null {
    return this.container.querySelector('#auth-error');
  }

  private wireLogin(): void {
    const val = (id: string) => (this.container.querySelector(`#${id}`) as HTMLInputElement).value.trim();

    this.container.querySelector('#to-register')?.addEventListener('click', () => {
      this.mode = 'register';
      this.renderBody();
    });

    this.container.querySelector('#btn-login')?.addEventListener('click', async () => {
      const email = val('login-email');
      const password = val('login-password');
      const code = val('login-2fa');
      const el = this.err();
      const btn = this.container.querySelector('#btn-login') as HTMLButtonElement;
      if (!email || !password) {
        if (el) el.innerText = 'Introduce correo y contraseña';
        return;
      }
      if (el) el.innerText = '';
      btn.innerText = 'CONECTANDO...';
      const result = await authState.login(email, password, code || undefined);
      if (!result.ok) {
        btn.innerText = 'ENTRAR';
        if (result.twoFactorRequired) {
          (this.container.querySelector('#login-2fa') as HTMLElement).classList.remove('hidden');
        }
        if (el) el.innerText = result.error ?? 'No se pudo entrar';
      }
    });

    this.container.querySelector('#btn-google')?.addEventListener('click', () => {
      window.location.href = '/api/auth/google/login';
    });
  }

  private wireRegister(): void {
    const val = (id: string) => (this.container.querySelector(`#${id}`) as HTMLInputElement).value.trim();

    this.container.querySelector('#to-login')?.addEventListener('click', () => {
      this.mode = 'login';
      this.renderBody();
    });

    this.container.querySelector('#btn-register')?.addEventListener('click', async () => {
      const name = val('reg-name');
      const email = val('reg-email');
      const password = val('reg-password');
      const password2 = val('reg-password2');
      const age = parseInt(val('reg-age'), 10);
      const student42 = (this.container.querySelector('#reg-student42') as HTMLInputElement).checked;
      const el = this.err();

      if (!name || !email || !password) {
        if (el) el.innerText = 'Completa Nombre, correo y contraseña';
        return;
      }
      if (password.length < 8) {
        if (el) el.innerText = 'La contraseña debe tener al menos 8 caracteres';
        return;
      }
      if (password !== password2) {
        if (el) el.innerText = 'Las contraseñas no coinciden';
        return;
      }
      if (!Number.isInteger(age) || age < 1 || age > 120) {
        if (el) el.innerText = 'Introduce una edad válida';
        return;
      }

      const btn = this.container.querySelector('#btn-register') as HTMLButtonElement;
      if (el) el.innerText = '';
      btn.innerText = 'CREANDO...';
      const result = await authState.signup({ name, email, password, age, student42 });
      if (!result.ok) {
        btn.innerText = 'REGISTRARSE';
        if (el) el.innerText = result.error ?? 'No se pudo registrar';
      }
    });
  }
}
