import type { PublicUser } from '@transcendence/shared';
import { showMainMenu } from '../../main';
import { apiFetch } from '../../net/api';
import { FONT, hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';

type Step = 'root' | 'friends' | 'add' | 'search' | 'recommended' | 'gift';

/** Sprite de entrenador a partir del avatar guardado (mismo mapeo que MainMenu). */
function spriteOf(avatarUrl: string | null): string {
  return avatarUrl === 'boy' ? 'red' : avatarUrl === 'girl' ? 'may' : avatarUrl || 'red';
}

/**
 * Capa VISTA: COMUNIDAD. Amigos REALES (backend /api/friends, /api/users/search).
 * Enviar regalo sigue como placeholder. Ver docs/FRONTEND_MENU.md §4.
 */
export class CommunityMenuView {
  private container: HTMLElement;
  private step: Step = 'root';
  private searchResults: PublicUser[] = [];
  private searchQuery = '';
  private notice = '';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    switch (this.step) {
      case 'friends':
        return void this.renderFriends();
      case 'add':
        return this.renderAdd();
      case 'search':
        return this.renderSearch();
      case 'recommended':
        return void this.renderRecommended();
      case 'gift':
        return this.renderGift();
      default:
        return this.renderRoot();
    }
  }

  private goto(step: Step) {
    this.step = step;
    this.notice = '';
    this.render();
  }

  // -------------------------------------------------------------- helpers UI

  private loading(title: string) {
    this.container.innerHTML = hubPanel(
      `${panelTitle(title)}
       <p class="text-white text-center animate-pulse" style="${FONT} font-size:12px;">Cargando…</p>
       ${backButton()}`,
      { minHeight: 520 }
    );
    document.getElementById('btn-back')?.addEventListener('click', () => this.goto('root'));
  }

  /** Fila de usuario: avatar + nombre + nivel + (acción opcional). */
  private userRow(u: PublicUser, actionHtml = ''): string {
    return `
      <div class="flex items-center justify-between gap-3 bg-gray-100 border-2 border-gray-400 rounded px-3 py-2">
        <div class="flex items-center gap-3 min-w-0">
          <img src="https://play.pokemonshowdown.com/sprites/trainers/${spriteOf(u.avatarUrl)}.png" class="w-12 h-12 object-contain pixelated bg-gray-200 border-2 border-gray-400 rounded-full flex-shrink-0" />
          <div class="flex flex-col min-w-0">
            <span class="text-black truncate" style="${FONT} font-size:11px;">${this.escape(u.username ?? '—')}</span>
            <span class="text-gray-600" style="${FONT} font-size:8px;">Lv. ${u.level}</span>
          </div>
        </div>
        ${actionHtml}
      </div>`;
  }

  private addBtn(u: PublicUser): string {
    return `<button data-add="${u.id}" class="add-btn flex-shrink-0 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded border-b-2 border-green-800 active:border-b-0" style="${FONT} font-size:9px;">➕ AÑADIR</button>`;
  }

  private wireAddButtons(onDone: () => void) {
    this.container.querySelectorAll<HTMLButtonElement>('.add-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.add;
        if (!userId) return;
        btn.disabled = true;
        btn.innerText = '…';
        try {
          const res = await apiFetch('/api/friends', {
            method: 'POST',
            body: JSON.stringify({ userId }),
          });
          if (res.ok) {
            btn.innerText = '✔ AMIGO';
            btn.classList.replace('bg-green-600', 'bg-gray-500');
          } else {
            const data = await res.json().catch(() => ({}));
            this.notice = data.error ?? 'No se pudo añadir';
            onDone();
          }
        } catch {
          this.notice = 'Error de red';
          onDone();
        }
      });
    });
  }

  // ------------------------------------------------------------------ pasos

  private renderRoot() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('COMUNIDAD')}
      ${panelCard(
        `<div class="flex flex-col gap-4" style="width:560px; max-width:100%;">
          ${menuButton({ id: 'btn-friends', label: 'AMIGOS CONECTADOS', icon: '🟢', color: 'green' })}
          ${menuButton({ id: 'btn-add', label: 'AÑADIR AMIGO', icon: '➕', color: 'blue' })}
          ${menuButton({ id: 'btn-gift', label: 'ENVIAR REGALO', icon: '🎁', color: 'purple' })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 620 }
    );
    document.getElementById('btn-friends')?.addEventListener('click', () => this.goto('friends'));
    document.getElementById('btn-add')?.addEventListener('click', () => this.goto('add'));
    document.getElementById('btn-gift')?.addEventListener('click', () => this.goto('gift'));
    document.getElementById('btn-back')?.addEventListener('click', () => showMainMenu());
  }

  private async renderFriends() {
    this.loading('MIS AMIGOS');
    let friends: PublicUser[] = [];
    try {
      const res = await apiFetch('/api/friends');
      const data = await res.json();
      friends = (data.friends ?? []) as PublicUser[];
    } catch {
      /* red caída */
    }

    const list = friends.length
      ? friends.map((u) => this.userRow(u)).join('')
      : `<p class="text-gray-500 text-center py-4" style="${FONT} font-size:9px;">Aún no tienes amigos. ¡Añade alguno!</p>`;

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('MIS AMIGOS')}
      ${panelCard(
        `<div class="flex flex-col gap-2 overflow-y-auto" style="width:560px; max-width:100%; max-height:420px;">${list}</div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 620 }
    );
    document.getElementById('btn-back')?.addEventListener('click', () => this.goto('root'));
  }

  private renderAdd() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('AÑADIR AMIGO')}
      ${panelCard(
        `<div class="flex flex-col gap-4" style="width:560px; max-width:100%;">
          ${menuButton({ id: 'btn-search', label: 'BUSCAR AMIGO', icon: '🔍', color: 'blue' })}
          ${menuButton({ id: 'btn-reco', label: 'RECOMENDADOS', icon: '✨', sublabel: 'Amigos de tus amigos', color: 'green' })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 540 }
    );
    document.getElementById('btn-search')?.addEventListener('click', () => this.goto('search'));
    document.getElementById('btn-reco')?.addEventListener('click', () => this.goto('recommended'));
    document.getElementById('btn-back')?.addEventListener('click', () => this.goto('root'));
  }

  private renderSearch() {
    const results = this.searchResults.length
      ? this.searchResults.map((u) => this.userRow(u, this.addBtn(u))).join('')
      : this.searchQuery.length >= 2
        ? `<p class="text-gray-500 text-center py-4" style="${FONT} font-size:9px;">Sin resultados</p>`
        : '';

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('BUSCAR AMIGO')}
      ${panelCard(
        `<div class="flex flex-col gap-3" style="width:560px; max-width:100%;">
          <div class="flex gap-2">
            <input id="search-input" value="${this.escape(this.searchQuery)}" maxlength="16" placeholder="Nombre del entrenador…" class="flex-1 bg-gray-100 text-black px-3 py-2 rounded border-2 border-gray-400 focus:outline-none focus:border-yellow-500" style="${FONT} font-size:10px;" />
            <button id="btn-do-search" class="px-4 bg-blue-600 hover:bg-blue-500 text-white rounded border-b-2 border-blue-800 active:border-b-0" style="${FONT} font-size:10px;">🔍</button>
          </div>
          ${this.notice ? `<p class="text-red-500 text-center" style="${FONT} font-size:9px;">⚠ ${this.escape(this.notice)}</p>` : ''}
          <div class="flex flex-col gap-2 overflow-y-auto" style="max-height:340px;">${results}</div>
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 620 }
    );

    const input = document.getElementById('search-input') as HTMLInputElement | null;
    const doSearch = async () => {
      const q = (input?.value ?? '').trim();
      this.searchQuery = q;
      this.notice = '';
      if (q.length < 2) {
        this.searchResults = [];
        this.notice = 'Escribe al menos 2 letras';
        this.renderSearch();
        return;
      }
      try {
        const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        this.searchResults = (data.users ?? []) as PublicUser[];
      } catch {
        this.searchResults = [];
        this.notice = 'Error de red';
      }
      this.renderSearch();
    };

    document.getElementById('btn-do-search')?.addEventListener('click', () => void doSearch());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void doSearch();
    });
    this.wireAddButtons(() => this.renderSearch());
    document.getElementById('btn-back')?.addEventListener('click', () => {
      this.searchResults = [];
      this.searchQuery = '';
      this.goto('add');
    });
  }

  private async renderRecommended() {
    this.loading('RECOMENDADOS');
    let users: PublicUser[] = [];
    try {
      const res = await apiFetch('/api/friends/recommended');
      const data = await res.json();
      users = (data.users ?? []) as PublicUser[];
    } catch {
      /* red caída */
    }

    const list = users.length
      ? users.map((u) => this.userRow(u, this.addBtn(u))).join('')
      : `<p class="text-gray-500 text-center py-4" style="${FONT} font-size:9px;">Nada por ahora. Añade amigos y verás sugerencias.</p>`;

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('RECOMENDADOS')}
      ${panelCard(
        `<div class="flex flex-col gap-3" style="width:560px; max-width:100%;">
          ${this.notice ? `<p class="text-red-500 text-center" style="${FONT} font-size:9px;">⚠ ${this.escape(this.notice)}</p>` : ''}
          <div class="flex flex-col gap-2 overflow-y-auto" style="max-height:380px;">${list}</div>
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 620 }
    );
    this.wireAddButtons(() => void this.renderRecommended());
    document.getElementById('btn-back')?.addEventListener('click', () => this.goto('add'));
  }

  private renderGift() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('ENVIAR REGALO')}
      ${panelCard(
        `<div class="grid grid-cols-2 gap-4" style="width:640px; max-width:100%;">
          ${menuButton({ label: 'COSMÉTICO', icon: '🎨', color: 'purple', disabled: true })}
          ${menuButton({ label: 'POKÉMON', icon: '🐾', color: 'red', disabled: true })}
          ${menuButton({ label: 'POKÉBALLS', icon: '🔴', color: 'blue', disabled: true })}
          ${menuButton({ label: 'MONEDAS', icon: '🪙', color: 'yellow', disabled: true })}
          ${menuButton({ label: 'PLAN PREMIUM', icon: '⭐', color: 'green', disabled: true, extraClass: 'col-span-2' })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 640 }
    );
    document.getElementById('btn-back')?.addEventListener('click', () => this.goto('root'));
  }

  private escape(s: string): string {
    return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] ?? c);
  }
}
