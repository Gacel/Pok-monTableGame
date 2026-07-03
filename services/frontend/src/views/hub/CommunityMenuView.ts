import type { PublicUser } from '@transcendence/shared';
import { showMainMenu } from '../../main';
import { apiFetch } from '../../net/api';
import { authState } from '../../auth/AuthState';
import { WsClient } from '../../net/WsClient';
import { FONT, hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';

type Step = 'root' | 'friends' | 'add' | 'search' | 'recommended' | 'requests' | 'dm' | 'gift';

function spriteOf(avatarUrl: string | null): string {
  return avatarUrl === 'boy' ? 'red' : avatarUrl === 'girl' ? 'may' : avatarUrl || 'red';
}

/** Sala WS del chat directo entre dos usuarios (ids ordenados = misma sala). */
function dmRoom(a: string, b: string): string {
  return 'dm:' + [a, b].sort().join(':');
}

/**
 * Capa VISTA: COMUNIDAD.
 *  - Amigos (con presencia 🟢) → pulsar abre CHAT directo (DM por WSS).
 *  - Añadir amigo → Buscar / Recomendados: envía SOLICITUD (a confirmar).
 *  - Solicitudes entrantes: aceptar / rechazar.
 * Ver docs/FRONTEND_MENU.md §4.
 */
export class CommunityMenuView {
  private container: HTMLElement;
  private step: Step = 'root';
  private searchResults: PublicUser[] = [];
  private searchQuery = '';
  private notice = '';
  private requestCount = 0;
  private dmFriend: PublicUser | null = null;
  private dmWs: WsClient | null = null;

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
      case 'requests':
        return void this.renderRequests();
      case 'dm':
        return this.renderDm();
      case 'gift':
        return this.renderGift();
      default:
        return void this.renderRoot();
    }
  }

  private goto(step: Step) {
    if (this.step === 'dm' && step !== 'dm') this.closeDm();
    this.step = step;
    this.notice = '';
    this.render();
  }

  private closeDm() {
    this.dmWs?.close();
    this.dmWs = null;
    this.dmFriend = null;
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

  private dot(online?: boolean): string {
    const c = online ? '#22c55e' : '#9ca3af';
    return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};border:2px solid #000;"></span>`;
  }

  private userRow(u: PublicUser, actionHtml = '', clickable = false): string {
    return `
      <div ${clickable ? `data-open="${u.id}"` : ''} class="friend-row flex items-center justify-between gap-3 bg-gray-100 border-2 border-gray-400 rounded px-3 py-2 ${clickable ? 'cursor-pointer hover:bg-yellow-100' : ''}">
        <div class="flex items-center gap-3 min-w-0">
          ${this.dot(u.online)}
          <img src="https://play.pokemonshowdown.com/sprites/trainers/${spriteOf(u.avatarUrl)}.png" class="w-12 h-12 object-contain pixelated bg-gray-200 border-2 border-gray-400 rounded-full flex-shrink-0" />
          <div class="flex flex-col min-w-0">
            <span class="text-black truncate" style="${FONT} font-size:11px;">${this.escape(u.username ?? '—')}</span>
            <span class="text-gray-600" style="${FONT} font-size:8px;">Lv. ${u.level}${clickable ? (u.online ? ' · en línea' : ' · desconectado') : ''}</span>
          </div>
        </div>
        ${actionHtml}
      </div>`;
  }

  private addBtn(u: PublicUser): string {
    return `<button data-add="${u.id}" class="add-btn flex-shrink-0 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded border-b-2 border-green-800 active:border-b-0" style="${FONT} font-size:9px;">➕ SOLICITAR</button>`;
  }

  private wireAddButtons(onDone: () => void) {
    this.container.querySelectorAll<HTMLButtonElement>('.add-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const userId = btn.dataset.add;
        if (!userId) return;
        btn.disabled = true;
        btn.innerText = '…';
        try {
          const res = await apiFetch('/api/friends/requests', {
            method: 'POST',
            body: JSON.stringify({ userId }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            btn.innerText = data.status === 'accepted' ? '✔ AMIGO' : '✔ SOLICITADO';
            btn.classList.replace('bg-green-600', 'bg-gray-500');
          } else {
            this.notice = data.error ?? 'No se pudo solicitar';
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

  private async renderRoot() {
    // Recuento de solicitudes entrantes para el badge.
    try {
      const res = await apiFetch('/api/friends/requests');
      const data = await res.json();
      this.requestCount = (data.requests ?? []).length;
    } catch {
      this.requestCount = 0;
    }
    const reqLabel = this.requestCount > 0 ? `SOLICITUDES (${this.requestCount})` : 'SOLICITUDES';

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('COMUNIDAD')}
      ${panelCard(
        `<div class="flex flex-col gap-4" style="width:560px; max-width:100%;">
          ${menuButton({ id: 'btn-friends', label: 'AMIGOS CONECTADOS', icon: '🟢', color: 'green' })}
          ${menuButton({ id: 'btn-add', label: 'AÑADIR AMIGO', icon: '➕', color: 'blue' })}
          ${menuButton({ id: 'btn-requests', label: reqLabel, icon: '📨', color: this.requestCount > 0 ? 'yellow' : 'gray' })}
          ${menuButton({ id: 'btn-gift', label: 'ENVIAR REGALO', icon: '🎁', color: 'purple' })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 680 }
    );
    document.getElementById('btn-friends')?.addEventListener('click', () => this.goto('friends'));
    document.getElementById('btn-add')?.addEventListener('click', () => this.goto('add'));
    document.getElementById('btn-requests')?.addEventListener('click', () => this.goto('requests'));
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
      ? friends.map((u) => this.userRow(u, '💬', true)).join('')
      : `<p class="text-gray-500 text-center py-4" style="${FONT} font-size:9px;">Aún no tienes amigos. ¡Añade alguno!</p>`;

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('MIS AMIGOS')}
      ${panelCard(
        `<p class="text-gray-600 text-center mb-3" style="${FONT} font-size:8px;">Pulsa un amigo para chatear</p>
         <div class="flex flex-col gap-2 overflow-y-auto" style="width:560px; max-width:100%; max-height:420px;">${list}</div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 640 }
    );
    this.container.querySelectorAll<HTMLElement>('.friend-row[data-open]').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.dataset.open;
        const friend = friends.find((f) => f.id === id);
        if (friend) this.openDm(friend);
      });
    });
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

  private async renderRequests() {
    this.loading('SOLICITUDES');
    let requests: PublicUser[] = [];
    try {
      const res = await apiFetch('/api/friends/requests');
      const data = await res.json();
      requests = (data.requests ?? []) as PublicUser[];
    } catch {
      /* red caída */
    }
    this.requestCount = requests.length;

    const actions = (u: PublicUser) => `
      <div class="flex gap-2 flex-shrink-0">
        <button data-accept="${u.id}" class="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded border-b-2 border-green-800 active:border-b-0" style="${FONT} font-size:9px;">✔</button>
        <button data-reject="${u.id}" class="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded border-b-2 border-red-800 active:border-b-0" style="${FONT} font-size:9px;">✖</button>
      </div>`;

    const list = requests.length
      ? requests.map((u) => this.userRow(u, actions(u))).join('')
      : `<p class="text-gray-500 text-center py-4" style="${FONT} font-size:9px;">No tienes solicitudes pendientes.</p>`;

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('SOLICITUDES')}
      ${panelCard(
        `<div class="flex flex-col gap-2 overflow-y-auto" style="width:560px; max-width:100%; max-height:400px;">${list}</div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 620 }
    );

    const respond = async (id: string, action: 'accept' | 'reject') => {
      try {
        await apiFetch(`/api/friends/requests/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
      } catch {
        /* ignore */
      }
      void this.renderRequests();
    };
    this.container.querySelectorAll<HTMLButtonElement>('[data-accept]').forEach((b) =>
      b.addEventListener('click', () => void respond(b.dataset.accept!, 'accept'))
    );
    this.container.querySelectorAll<HTMLButtonElement>('[data-reject]').forEach((b) =>
      b.addEventListener('click', () => void respond(b.dataset.reject!, 'reject'))
    );
    document.getElementById('btn-back')?.addEventListener('click', () => this.goto('root'));
  }

  // ------------------------------------------------------------------ chat DM

  private openDm(friend: PublicUser) {
    this.dmFriend = friend;
    this.step = 'dm';
    this.render();
  }

  private renderDm() {
    const friend = this.dmFriend;
    if (!friend) return this.goto('friends');
    const myId = authState.user?.id ?? '';

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle(`CHAT · ${this.escape(friend.username ?? '')}`)}
      ${panelCard(
        `<div class="flex flex-col" style="width:600px; max-width:100%;">
          <div id="dm-messages" class="flex flex-col gap-2 overflow-y-auto bg-gray-100 border-2 border-gray-400 rounded p-3 mb-3" style="height:360px;"></div>
          <div class="flex gap-2">
            <input id="dm-input" maxlength="200" placeholder="Escribe un mensaje…" class="flex-1 bg-gray-100 text-black px-3 py-2 rounded border-2 border-gray-400 focus:outline-none focus:border-yellow-500" style="${FONT} font-size:10px;" />
            <button id="dm-send" class="px-4 bg-green-600 hover:bg-green-500 text-white rounded border-b-2 border-green-800 active:border-b-0" style="${FONT} font-size:10px;">▶</button>
          </div>
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 620 }
    );

    const messagesEl = document.getElementById('dm-messages') as HTMLElement | null;
    const append = (text: string) => {
      if (!messagesEl) return;
      const div = document.createElement('div');
      div.className = 'text-black break-words';
      div.setAttribute('style', `${FONT} font-size:9px;`);
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    // (Re)conecta el canal DM.
    this.dmWs?.close();
    this.dmWs = new WsClient((msg) => {
      if (msg.type === 'chat' && typeof msg.text === 'string') append(msg.text);
    });
    this.dmWs.connect(dmRoom(myId, friend.id));

    const input = document.getElementById('dm-input') as HTMLInputElement | null;
    const send = () => {
      const text = (input?.value ?? '').trim();
      if (!text) return;
      this.dmWs?.sendChat(text);
      if (input) input.value = '';
    };
    document.getElementById('dm-send')?.addEventListener('click', send);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });
    document.getElementById('btn-back')?.addEventListener('click', () => this.goto('friends'));
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
