import { apiFetch } from '../net/api';

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** El login requiere un código 2FA (el usuario tiene 2FA activado). */
  twoFactorRequired?: boolean;
}

/** Datos del propio usuario (espejo de SafeUser del servidor, /api/users/me). */
export interface AuthUser {
  id: string;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  age: number | null;
  isStudent42: boolean;
  twoFactorEnabled: boolean;
  level: number;
  coins: number;
  pokemonCount?: number;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  age: number;
  student42: boolean;
}

/**
 * Estado de autenticación del cliente.
 *
 * La sesión vive en una cookie `HttpOnly` gestionada por el servidor: el cliente
 * NO guarda ni lee el JWT. La validez de la sesión se determina consultando
 * /api/users/me (200 = sesión válida).
 */
export class AuthState {
  public user: AuthUser | null = null;

  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notify() {
    for (const l of this.listeners) l();
  }

  /** ¿Hay sesión válida? (cookie presente y aceptada por el servidor). */
  public async checkSession(): Promise<boolean> {
    await this.fetchUserProfile();
    return !!this.user;
  }

  public async signup(data: SignupData): Promise<AuthResult> {
    try {
      const res = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        this.user = body.user;
        this.notify();
        return { ok: true };
      }
      return { ok: false, error: body.error ?? 'No se pudo registrar' };
    } catch (e) {
      console.error('Signup error', e);
      return { ok: false, error: 'Error de red' };
    }
  }

  public async login(email: string, password: string, code?: string): Promise<AuthResult> {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, ...(code ? { code } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        this.user = body.user;
        this.notify();
        return { ok: true };
      }
      return { ok: false, error: body.error ?? 'No se pudo entrar', twoFactorRequired: !!body.twoFactorRequired };
    } catch (e) {
      console.error('Login error', e);
      return { ok: false, error: 'Error de red' };
    }
  }

  public async fetchUserProfile(): Promise<void> {
    try {
      const res = await apiFetch('/api/users/me');
      if (res.ok) {
        const data = await res.json();
        this.user = data.user;
      } else {
        this.user = null;
      }
      this.notify();
    } catch (e) {
      console.error('Failed to fetch user profile', e);
      this.user = null;
    }
  }

  public async registerAvatar(username: string, avatarUrl: string): Promise<boolean> {
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, avatarUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        this.user = data.user;
        this.notify();
        return true;
      }
    } catch (e) {
      console.error('Registration error', e);
    }
    return false;
  }

  public async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignora: limpiamos el estado local igualmente */
    }
    this.user = null;
    this.notify();
  }
}

export const authState = new AuthState();
