import { apiFetch } from '../net/api';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export class AuthState {
  public user: any = null;
  public sessionToken: string | null = null;

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.sessionToken = localStorage.getItem('token');
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notify() {
    for (const l of this.listeners) l();
  }

  public async checkSession() {
    if (this.sessionToken) {
      await this.fetchUserProfile();
      // Si el token es inválido o el usuario ya no existe, fetchUserProfile limpia
      // la sesión: no hay sesión válida → volver a Welcome.
      return !!this.user;
    }
    return false;
  }

  /** Login (cuenta existente) o signup (crear cuenta) según `path`. */
  private async authWithEmail(path: string, email: string): Promise<AuthResult> {
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        this.sessionToken = data.token;
        localStorage.setItem('token', data.token);
        this.user = data.user;
        this.notify();
        return { ok: true };
      }
      return { ok: false, error: data.error ?? 'No se pudo completar la operación' };
    } catch (e) {
      console.error('Auth error', e);
      return { ok: false, error: 'Error de red' };
    }
  }

  public loginWithEmail(email: string): Promise<AuthResult> {
    return this.authWithEmail('/api/auth/login', email);
  }

  public signupWithEmail(email: string): Promise<AuthResult> {
    return this.authWithEmail('/api/auth/signup', email);
  }

  public async fetchUserProfile() {
    if (!this.sessionToken) return;
    try {
      const res = await fetch('/api/users/me', {
        headers: { 'Authorization': `Bearer ${this.sessionToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.user = data.user;
      } else {
        this.user = null;
        this.sessionToken = null;
        localStorage.removeItem('token');
      }
      this.notify();
    } catch (e) {
      console.error("Failed to fetch user profile", e);
    }
  }

  public async registerAvatar(username: string, avatarUrl: string) {
    if (!this.sessionToken) return false;
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

  public logout() {
    this.sessionToken = null;
    this.user = null;
    localStorage.removeItem('token');
    this.notify();
  }
}

export const authState = new AuthState();
