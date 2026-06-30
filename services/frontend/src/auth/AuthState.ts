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
      return true;
    }
    return false;
  }

  public async loginWithEmail(email: string) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        const data = await res.json();
        this.sessionToken = data.token;
        localStorage.setItem('token', data.token);
        this.user = data.user;
        this.notify();
        return true;
      }
    } catch (e) {
      console.error("Login error", e);
    }
    return false;
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.sessionToken, username, avatarUrl })
      });
      if (res.ok) {
        const data = await res.json();
        this.user = data.user;
        this.notify();
        return true;
      }
    } catch (e) {
      console.error("Registration error", e);
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
