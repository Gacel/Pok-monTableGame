import { authState } from '../../auth/AuthState';
import { apiFetch } from '../../net/api';
import { getSprite } from '../../net/PokeSprites';
import { FONT, panelTitle, panelCard, backButton } from './panel';
import { openPokemonDetail } from './PokemonDetailModal';
import { openContextMenu } from './ContextMenu';
import { AuctionApi } from '../../net/AuctionApi';
import { escapeHtml } from '../../utils/html';
import type { PokemonType } from '../../models/Types';

interface InvPokemon {
  id: string;
  name: string;
  level: number;
  isStarter: boolean;
  acquiredVia: string;
  type: string;
  hp?: number;
  atk?: number;
  def?: number;
}
interface InvItem {
  kind: string;
  itemKey: string;
  qty: number;
}

const TYPE_COLOR: Record<string, string> = {
  FIRE: '#f08030', WATER: '#6890f0', GRASS: '#78c850', ELECTRIC: '#f8d030',
  NORMAL: '#a8a878', POISON: '#a040a0', FAIRY: '#ee99ac', ICE: '#98d8d8',
  PSYCHIC: '#f85888', DRAGON: '#7038f8', FLYING: '#a890f0',
};

/** Sprites reales de pokéballs (bitmap PokeAPI) para los objetos tipo pokeball. */
const BALL_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';

/**
 * Capa VISTA: INVENTARIO a pantalla completa (capa #inventory-layer, ocupa la
 * pantalla como el mapa). Izquierda: entrenador (>=50% alto). Derecha: dos
 * secciones con scroll (arriba Pokémon obtenidos, abajo Objetos), en cuadrícula.
 */
export class InventoryView {
  private container: HTMLElement;
  private onClose: () => void;
  private sprites: Record<string, string> = {};

  constructor(container: HTMLElement, onClose: () => void) {
    this.container = container;
    this.onClose = onClose;
  }

  public async render(): Promise<void> {
    this.drawShell('Cargando…');
    let pokemon: InvPokemon[] = [];
    let items: InvItem[] = [];
    try {
      const res = await apiFetch('/api/inventory');
      const data = await res.json();
      pokemon = (data.pokemon ?? []) as InvPokemon[];
      items = (data.items ?? []) as InvItem[];
    } catch {
      /* red caída */
    }
    await this.preloadSprites(pokemon);
    this.draw(pokemon, items);
  }

  private async preloadSprites(pokemon: InvPokemon[]): Promise<void> {
    await Promise.all(
      pokemon.map(async (p) => {
        if (this.sprites[p.name]) return;
        this.sprites[p.name] = await getSprite(p.name);
      })
    );
  }

  private trainerSprite(): string {
    const a = authState.user?.avatarUrl;
    const name = a === 'boy' ? 'red' : a === 'girl' ? 'may' : a || 'red';
    return `https://play.pokemonshowdown.com/sprites/trainers/${name}.png`;
  }

  private drawShell(bodyMsg: string): void {
    this.container.innerHTML = `
      <div class="w-full h-full flex flex-col p-4 sm:p-6 bg-blue-900 overflow-y-auto" style="box-shadow: inset 0 0 30px rgba(0,0,0,0.6);">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          ${panelTitle('INVENTARIO')}
          ${backButton('btn-inv-back')}
        </div>
        <p class="text-white text-center animate-pulse" style="${FONT} font-size:12px;">${bodyMsg}</p>
      </div>`;
    document.getElementById('btn-inv-back')?.addEventListener('click', () => this.onClose());
  }

  private pokemonCell(p: InvPokemon): string {
    const color = TYPE_COLOR[p.type] ?? '#888';
    const tag = p.isStarter ? '⭐' : p.acquiredVia === 'capture' ? '🎯' : '';
    // Hover SIN transform (scale provocaba overflow → barra de scroll): solo borde.
    return `
      <div class="pkmn-cell flex flex-col items-center rounded border-2 border-gray-700 bg-gray-800 cursor-pointer transition-colors hover:border-yellow-400 hover:bg-gray-700" data-id="${p.id}" role="button" tabindex="0" title="Click: ficha · Click derecho: acciones" style="padding:4px;">
        <img src="${this.sprites[p.name] ?? ''}" alt="${p.name}" class="w-11 h-11 object-contain" style="image-rendering:pixelated;" />
        <span class="uppercase text-white truncate" style="${FONT} font-size:6px; max-width:100%;">${tag}${p.name}</span>
        <span style="${FONT} font-size:5px; color:${color};">Lv.${p.level}</span>
      </div>`;
  }

  /** Abre la ficha del Pokémon con lo ya conocido (tipo/nivel/stats/sprite). */
  private openDetail(p: InvPokemon): void {
    openPokemonDetail({
      name: p.name,
      type: p.type as PokemonType,
      level: p.level,
      hp: p.hp,
      atk: p.atk,
      def: p.def,
      spriteUrl: this.sprites[p.name],
    });
  }

  /** Menú contextual (botón derecho) de un Pokémon del inventario. */
  private showContextMenu(p: InvPokemon, x: number, y: number): void {
    openContextMenu(
      x,
      y,
      [
        { icon: '🔍', label: 'Ver ficha', onClick: () => this.openDetail(p) },
        { icon: '⚖️', label: 'Vender en subasta', onClick: () => this.openSellDialog(p) },
        { icon: '🎁', label: 'Regalar a un amigo', onClick: () => void this.openGiftDialog(p) },
      ],
      `${p.name} · Nv.${p.level}`
    );
  }

  /** Modal retro genérico (mismo marco que la ficha). Devuelve el cuerpo y el cierre. */
  private openDialog(title: string, inner: string): { body: HTMLElement; close: () => void } {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[210] flex items-center justify-center p-4';
    overlay.style.background = 'rgba(0,0,0,0.72)';
    overlay.innerHTML = `
      <div class="relative bg-gray-900 w-full" style="max-width:min(360px, 94vw); border:6px solid #fff; border-radius:12px; box-shadow:0 0 0 6px #000, 0 0 40px rgba(0,0,0,0.85);">
        <button data-close aria-label="Cerrar" class="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white border-2 border-white flex items-center justify-center z-10" style="${FONT} font-size:11px; box-shadow:0 2px 0 #000;">✕</button>
        <div class="bg-blue-900 border-4 border-black overflow-y-auto" style="border-radius:6px; box-shadow:inset 0 0 30px rgba(0,0,0,0.6); padding:clamp(14px, 3vw, 22px); max-height:88vh;">
          <h3 class="text-yellow-400 uppercase text-center mb-3" style="${FONT} font-size:12px; text-shadow:2px 2px 0 #000;">${escapeHtml(title)}</h3>
          <div data-body></div>
        </div>
      </div>`;
    const close = (): void => overlay.remove();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('[data-close]')?.addEventListener('click', close);
    document.body.appendChild(overlay);
    const body = overlay.querySelector('[data-body]') as HTMLElement;
    body.innerHTML = inner;
    return { body, close };
  }

  /** Diálogo para publicar un Pokémon en la casa de subastas. */
  private openSellDialog(p: InvPokemon): void {
    this.sellDialog(`Vender ${p.name}`, 'El Pokémon queda retenido hasta que se venda o expire.', (s, b, d) =>
      AuctionApi.create({ kind: 'pokemon', pokemonId: p.id, startingPrice: s, buyNowPrice: b, durationHours: d })
    );
  }

  /** Diálogo para publicar un objeto (bola) en la casa de subastas. */
  private openSellItemDialog(it: InvItem): void {
    this.sellDialog(`Vender ${it.itemKey}`, 'El objeto queda retenido hasta que se venda o expire.', (s, b, d) =>
      AuctionApi.create({ kind: 'item', itemKind: it.kind, itemKey: it.itemKey, startingPrice: s, buyNowPrice: b, durationHours: d })
    );
  }

  /** Diálogo genérico de venta en subasta (Pokémon u objeto). */
  private sellDialog(
    title: string,
    footnote: string,
    doSell: (
      startingPrice: number | null,
      buyNowPrice: number | null,
      durationHours: number
    ) => Promise<{ ok: boolean; error?: string }>
  ): void {
    const input = 'w-full p-2 bg-gray-100 text-black border-2 border-gray-400 rounded';
    const { body, close } = this.openDialog(
      title,
      `<div class="flex flex-col gap-2">
         <label class="text-gray-200" style="${FONT} font-size:8px;">Precio de salida (puja mínima, opcional)</label>
         <input id="sell-start" type="number" min="1" class="${input}" style="${FONT} font-size:10px;" />
         <label class="text-gray-200 mt-1" style="${FONT} font-size:8px;">Precio fijo «cómpralo ya» (opcional)</label>
         <input id="sell-buynow" type="number" min="1" class="${input}" style="${FONT} font-size:10px;" />
         <label class="text-gray-200 mt-1" style="${FONT} font-size:8px;">Duración</label>
         <select id="sell-duration" class="${input}" style="${FONT} font-size:9px;">
           <option value="12">12h · comisión 5%</option>
           <option value="24">24h · comisión 10%</option>
           <option value="48">48h · comisión 15%</option>
         </select>
         <p id="sell-msg" class="text-red-400 min-h-[14px] mt-1" style="${FONT} font-size:8px;"></p>
         <button id="sell-go" class="bg-yellow-500 hover:bg-yellow-400 text-black py-2 rounded border-b-4 border-yellow-700 active:border-b-0" style="${FONT} font-size:10px;">PUBLICAR SUBASTA</button>
         <p class="text-gray-400" style="${FONT} font-size:7px; line-height:1.5;">Indica al menos un precio. ${escapeHtml(footnote)}</p>
       </div>`
    );
    const msg = body.querySelector('#sell-msg') as HTMLElement;
    body.querySelector('#sell-go')?.addEventListener('click', () => {
      void (async () => {
        const start = (body.querySelector('#sell-start') as HTMLInputElement).value;
        const buyNow = (body.querySelector('#sell-buynow') as HTMLInputElement).value;
        const duration = parseInt((body.querySelector('#sell-duration') as HTMLSelectElement).value, 10);
        const startingPrice = start ? parseInt(start, 10) : null;
        const buyNowPrice = buyNow ? parseInt(buyNow, 10) : null;
        if (startingPrice === null && buyNowPrice === null) {
          msg.textContent = 'Indica un precio de salida o fijo';
          return;
        }
        const r = await doSell(startingPrice, buyNowPrice, duration);
        if (r.ok) {
          close();
          await this.render();
        } else {
          msg.textContent = r.error ?? 'No se pudo publicar';
        }
      })();
    });
  }

  /** Regalar un Pokémon a un amigo. */
  private async openGiftDialog(p: InvPokemon): Promise<void> {
    await this.giftDialog(`Regalar ${p.name}`, `${p.name} (Nv.${p.level})`, async (toUserId) => {
      const res = await apiFetch(`/api/inventory/pokemon/${encodeURIComponent(p.id)}/gift`, {
        method: 'POST',
        body: JSON.stringify({ toUserId }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && data.success, error: data.error };
    });
  }

  /** Regalar un objeto (bola) a un amigo. */
  private async openGiftItemDialog(it: InvItem): Promise<void> {
    await this.giftDialog(`Regalar ${it.itemKey}`, `${it.itemKey}`, async (toUserId) => {
      const res = await apiFetch('/api/inventory/item/gift', {
        method: 'POST',
        body: JSON.stringify({ kind: it.kind, itemKey: it.itemKey, toUserId }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && data.success, error: data.error };
    });
  }

  /** Diálogo genérico de regalo: lista amigos y ejecuta `doGift(toUserId)`. */
  private async giftDialog(
    title: string,
    subject: string,
    doGift: (toUserId: string) => Promise<{ ok: boolean; error?: string }>
  ): Promise<void> {
    const { body, close } = this.openDialog(
      title,
      `<p class="text-gray-300 animate-pulse text-center" style="${FONT} font-size:9px;">Cargando amigos…</p>`
    );
    let friends: { id: string; username: string | null }[] = [];
    try {
      const res = await apiFetch('/api/friends');
      const data = await res.json();
      friends = (data.friends ?? []) as { id: string; username: string | null }[];
    } catch {
      /* red caída */
    }
    if (!friends.length) {
      body.innerHTML = `<p class="text-gray-300 text-center" style="${FONT} font-size:9px; line-height:1.7;">No tienes amigos a quien regalar.<br>Añade amigos en COMUNIDAD.</p>`;
      return;
    }
    body.innerHTML = `
      <p class="text-gray-300 mb-2 text-center" style="${FONT} font-size:8px;">Elige a quién regalar:</p>
      <div class="flex flex-col gap-1.5 overflow-y-auto pr-1" style="max-height:44vh;">
        ${friends
          .map(
            (f) =>
              `<button data-uid="${escapeHtml(f.id)}" class="gift-friend w-full text-left text-white bg-gray-800 hover:bg-blue-700 rounded px-3 py-2 border border-gray-700 truncate" style="${FONT} font-size:9px;">${escapeHtml(f.username ?? 'jugador')}</button>`
          )
          .join('')}
      </div>
      <p id="gift-msg" class="text-red-400 min-h-[14px] mt-2" style="${FONT} font-size:8px;"></p>`;
    const msg = body.querySelector('#gift-msg') as HTMLElement;
    body.querySelectorAll<HTMLButtonElement>('.gift-friend').forEach((btn) => {
      btn.addEventListener('click', () => {
        void (async () => {
          const toUserId = btn.dataset.uid ?? '';
          const uname = btn.textContent?.trim() || 'ese jugador';
          if (!confirm(`¿Regalar ${subject} a ${uname}? No podrás deshacerlo.`)) return;
          const r = await doGift(toUserId);
          if (r.ok) {
            close();
            await this.render();
          } else {
            msg.textContent = r.error ?? 'No se pudo regalar';
          }
        })();
      });
    });
  }

  /** Menú contextual de un OBJETO (bola): Abrir / Vender / Regalar. */
  private showItemContextMenu(it: InvItem, x: number, y: number): void {
    openContextMenu(
      x,
      y,
      [
        { icon: '📦', label: 'Abrir', onClick: () => void this.openBall(it) },
        { icon: '⚖️', label: 'Vender en subasta', onClick: () => this.openSellItemDialog(it) },
        { icon: '🎁', label: 'Regalar a un amigo', onClick: () => void this.openGiftItemDialog(it) },
      ],
      `${it.itemKey} · x${it.qty}`
    );
  }

  /** Abre una bola: el servidor tira loot y concede un Pokémon. */
  private async openBall(it: InvItem): Promise<void> {
    try {
      const res = await apiFetch('/api/inventory/item/open', {
        method: 'POST',
        body: JSON.stringify({ itemKey: it.itemKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const name = String(data.pokemon?.name ?? '').toUpperCase();
        alert(`¡Has conseguido ${name}!`);
        await this.render();
      } else {
        alert(data.error ?? 'No se pudo abrir la bola');
      }
    } catch {
      alert('Error de red al abrir la bola');
    }
  }

  private itemCell(it: InvItem): string {
    const isBall = it.kind === 'pokeball';
    const img = isBall
      ? `<img src="${BALL_SPRITE}/${it.itemKey}.png" alt="${it.itemKey}" class="w-11 h-11 object-contain" style="image-rendering:pixelated;" />`
      : `<div class="w-11 h-11 flex items-center justify-center" style="font-size:24px;">${it.kind === 'cosmetic' ? '🎨' : '📦'}</div>`;
    // Solo las bolas tienen acciones (Abrir/Vender/Regalar) → celda interactiva.
    const interactive = isBall
      ? `item-cell cursor-pointer transition-colors hover:border-yellow-400 hover:bg-gray-700`
      : '';
    const dataAttrs = isBall ? `data-kind="${it.kind}" data-key="${it.itemKey}"` : '';
    const title = isBall ? `title="Click derecho: acciones"` : '';
    return `
      <div class="${interactive} flex flex-col items-center rounded border-2 border-gray-700 bg-gray-800" ${dataAttrs} ${title} style="padding:4px;">
        ${img}
        <span class="uppercase text-white truncate" style="${FONT} font-size:6px; max-width:100%;">${it.itemKey}</span>
        <span class="text-yellow-300" style="${FONT} font-size:6px;">x${it.qty}</span>
      </div>`;
  }

  private draw(pokemon: InvPokemon[], items: InvItem[]): void {
    const u = authState.user;
    const grid = 'grid gap-2 overflow-y-auto pr-2';
    const gridStyle = 'grid-template-columns:repeat(auto-fill,minmax(60px,1fr));';

    const pokeGrid = pokemon.length
      ? pokemon.map((p) => this.pokemonCell(p)).join('')
      : `<p class="text-gray-400" style="${FONT} font-size:9px;">Sin Pokémon todavía.</p>`;
    const itemGrid = items.length
      ? items.map((it) => this.itemCell(it)).join('')
      : `<p class="text-gray-400" style="${FONT} font-size:9px;">Sin objetos todavía.</p>`;

    this.container.innerHTML = `
      <div class="w-full h-full flex flex-col p-4 sm:p-6 bg-blue-900 overflow-y-auto" style="box-shadow: inset 0 0 30px rgba(0,0,0,0.6);">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          ${panelTitle('INVENTARIO')}
          ${backButton('btn-inv-back')}
        </div>

        <div class="flex flex-col md:flex-row flex-1 gap-3 md:gap-6 min-h-0">
          <!-- IZQUIERDA: entrenador (>=50% alto) -->
          <div class="w-full md:w-1/3 flex">
            ${panelCard(
              `<div class="w-full h-full flex flex-col items-center justify-center text-center gap-4" style="min-height:min(50vh, 320px);">
                 <img src="${this.trainerSprite()}" alt="entrenador" class="pixelated block mx-auto" style="width:clamp(120px,30vw,220px);height:clamp(120px,30vw,220px);object-fit:contain;image-rendering:pixelated;" />
                 <span class="text-black" style="${FONT} font-size:16px;">${u?.username ?? ''}</span>
                 <span class="text-gray-600" style="${FONT} font-size:11px;">Lv. ${u?.level ?? 1} · 🪙 ${u?.coins ?? 0}</span>
                 <span class="text-gray-500" style="${FONT} font-size:9px;">${pokemon.length} Pokémon · ${items.length} objetos</span>
               </div>`,
              'flex-1 flex w-full'
            )}
          </div>

          <!-- DERECHA: dos secciones con scroll -->
          <div class="flex-1 flex flex-col gap-3 md:gap-6 min-h-0">
            <div class="flex-1 flex flex-col min-h-0">
              ${panelCard(
                `<h3 class="text-black mb-3" style="${FONT} font-size:13px;">POKÉMON OBTENIDOS</h3>
                 <div class="${grid}" style="${gridStyle}">${pokeGrid}</div>`,
                'flex-1 flex flex-col min-h-0'
              )}
            </div>
            <div class="flex-1 flex flex-col min-h-0">
              ${panelCard(
                `<h3 class="text-black mb-3" style="${FONT} font-size:13px;">OBJETOS</h3>
                 <div class="${grid}" style="${gridStyle}">${itemGrid}</div>`,
                'flex-1 flex flex-col min-h-0'
              )}
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById('btn-inv-back')?.addEventListener('click', () => this.onClose());

    // Click izq: ficha · Enter/Espacio: ficha · Click derecho: menú de acciones.
    this.container.querySelectorAll<HTMLElement>('.pkmn-cell').forEach((cell) => {
      const p = pokemon.find((x) => x.id === cell.dataset.id);
      if (!p) return;
      cell.addEventListener('click', () => this.openDetail(p));
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openDetail(p);
        }
      });
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(p, e.clientX, e.clientY);
      });
    });

    // Objetos (bolas): click izquierdo o derecho abre el menú de acciones.
    this.container.querySelectorAll<HTMLElement>('.item-cell').forEach((cell) => {
      const it = items.find((x) => x.kind === cell.dataset.kind && x.itemKey === cell.dataset.key);
      if (!it) return;
      const open = (e: MouseEvent) => {
        e.preventDefault();
        this.showItemContextMenu(it, e.clientX, e.clientY);
      };
      cell.addEventListener('click', open);
      cell.addEventListener('contextmenu', open);
    });
  }
}
