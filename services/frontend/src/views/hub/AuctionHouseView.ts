import { showMainMenu } from '../../main';
import { FONT, hubPanel, panelTitle, panelCard, backButton } from './panel';
import { apiFetch } from '../../net/api';
import { authState } from '../../auth/AuthState';
import { AuctionApi } from '../../net/AuctionApi';
import type { Auction } from '../../net/AuctionApi';
import { escapeHtml } from '../../utils/html';

type Tab = 'market' | 'sell' | 'mine';
interface InvPokemon { id: string; name: string; level: number; }
interface InvItem { kind: string; itemKey: string; qty: number; }

const DURATION_INFO: Record<number, string> = {
  12: '12h · comisión 5% · 100 si no vende',
  24: '24h · comisión 10% · 200 si no vende',
  48: '48h · comisión 15% · 400 si no vende',
};

/** Capa VISTA: CASA DE SUBASTAS. Mercado, publicar y mis subastas. */
export class AuctionHouseView {
  private container: HTMLElement;
  private tab: Tab = 'market';
  private notice = '';
  private inv: { pokemon: InvPokemon[]; items: InvItem[] } = { pokemon: [], items: [] };

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async render(): Promise<void> {
    this.container.innerHTML = hubPanel(
      `${panelTitle('CASA DE SUBASTAS')}
       <div id="ah-tabs" class="flex gap-2 justify-center mb-3"></div>
       <div id="ah-notice" class="text-center text-red-500 min-h-[16px] mb-2" style="${FONT} font-size:10px;"></div>
       <div id="ah-body"></div>
       ${backButton()}`,
      { minHeight: 640 }
    );
    document.getElementById('btn-back')?.addEventListener('click', () => showMainMenu());
    this.renderTabs();
    await this.renderBody();
  }

  private renderTabs(): void {
    const tabs: [Tab, string][] = [['market', 'MERCADO'], ['sell', 'VENDER'], ['mine', 'MIS SUBASTAS']];
    const el = document.getElementById('ah-tabs')!;
    el.innerHTML = tabs
      .map(
        ([t, label]) =>
          `<button data-tab="${t}" class="px-3 py-2 rounded border-2 ${
            this.tab === t ? 'bg-yellow-400 text-black border-yellow-600' : 'bg-gray-800 text-white border-gray-600'
          }" style="${FONT} font-size:10px;">${label}</button>`
      )
      .join('');
    el.querySelectorAll<HTMLButtonElement>('button[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as Tab;
        this.notice = '';
        this.renderTabs();
        void this.renderBody();
      })
    );
  }

  private setNotice(msg: string): void {
    this.notice = msg;
    const el = document.getElementById('ah-notice');
    if (el) el.textContent = msg;
  }

  private async renderBody(): Promise<void> {
    const body = document.getElementById('ah-body');
    if (!body) return;
    const noticeEl = document.getElementById('ah-notice');
    if (noticeEl) noticeEl.textContent = this.notice;
    body.innerHTML = `<p class="text-center text-gray-400" style="${FONT} font-size:10px;">Cargando…</p>`;

    if (this.tab === 'market') await this.renderMarket(body);
    else if (this.tab === 'sell') await this.renderSell(body);
    else await this.renderMine(body);
  }

  private timeLeft(expiresAt: string): string {
    const end = new Date(expiresAt.replace(' ', 'T') + 'Z').getTime();
    const ms = end - Date.now();
    if (ms <= 0) return 'terminando…';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  private priceLine(a: Auction): string {
    const parts: string[] = [];
    if (a.startingPrice !== null)
      parts.push(a.currentBid !== null ? `Puja: ${a.currentBid}` : `Salida: ${a.startingPrice}`);
    if (a.buyNowPrice !== null) parts.push(`Ya: ${a.buyNowPrice}`);
    return parts.join(' · ');
  }

  private async renderMarket(body: HTMLElement): Promise<void> {
    const auctions = await AuctionApi.list();
    const myId = authState.user?.id;
    if (!auctions.length) {
      body.innerHTML = panelCard(
        `<p class="text-gray-500 text-center" style="${FONT} font-size:11px;">No hay subastas activas.</p>`
      );
      return;
    }
    const rows = auctions
      .map((a) => {
        const mine = a.sellerId === myId;
        const label = a.kind === 'pokemon' ? `${escapeHtml(a.displayName)} (Nv ${a.displayLevel ?? 1})` : escapeHtml(a.displayName);
        const actions = mine
          ? `<span class="text-gray-400" style="${FONT} font-size:9px;">(tuya)</span>`
          : `${a.startingPrice !== null ? `<button data-bid="${a.id}" class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded" style="${FONT} font-size:9px;">PUJAR</button>` : ''}
             ${a.buyNowPrice !== null ? `<button data-buy="${a.id}" class="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded" style="${FONT} font-size:9px;">COMPRAR YA</button>` : ''}`;
        return `<div class="flex items-center justify-between gap-2 bg-gray-100 rounded px-3 py-2">
          <div class="flex flex-col">
            <span class="text-black" style="${FONT} font-size:11px;">${a.kind === 'pokemon' ? '🐾' : '🎁'} ${label}</span>
            <span class="text-gray-600" style="${FONT} font-size:9px;">${this.priceLine(a)} · ⏳ ${this.timeLeft(a.expiresAt)}</span>
          </div>
          <div class="flex gap-1 items-center">${actions}</div>
        </div>`;
      })
      .join('');
    body.innerHTML = panelCard(`<div class="flex flex-col gap-2" style="width:640px; max-width:100%;">${rows}</div>`);

    body.querySelectorAll<HTMLButtonElement>('button[data-buy]').forEach((b) =>
      b.addEventListener('click', () => this.doBuy(b.dataset.buy!))
    );
    body.querySelectorAll<HTMLButtonElement>('button[data-bid]').forEach((b) =>
      b.addEventListener('click', () => this.doBid(b.dataset.bid!))
    );
  }

  private async doBuy(id: string): Promise<void> {
    const r = await AuctionApi.buy(id);
    this.setNotice(r.ok ? '✅ ¡Comprado!' : r.error ?? 'No se pudo comprar');
    await authState.fetchUserProfile();
    await this.renderBody();
  }

  private async doBid(id: string): Promise<void> {
    const raw = window.prompt('¿Cuántas monedas quieres pujar?');
    if (raw === null) return;
    const amount = parseInt(raw, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      this.setNotice('Cantidad inválida');
      return;
    }
    const r = await AuctionApi.bid(id, amount);
    this.setNotice(r.ok ? '✅ Puja realizada' : r.error ?? 'No se pudo pujar');
    await authState.fetchUserProfile();
    await this.renderBody();
  }

  private async renderSell(body: HTMLElement): Promise<void> {
    try {
      const res = await apiFetch('/api/inventory');
      const data = await res.json();
      this.inv = { pokemon: data.pokemon ?? [], items: data.items ?? [] };
    } catch {
      this.inv = { pokemon: [], items: [] };
    }
    const pokeOpts = this.inv.pokemon
      .map((p) => `<option value="pokemon:${p.id}">🐾 ${escapeHtml(p.name)} (Nv ${p.level})</option>`)
      .join('');
    const itemOpts = this.inv.items
      .filter((i) => i.qty > 0)
      .map((i) => `<option value="item:${i.kind}:${i.itemKey}">🎁 ${escapeHtml(i.itemKey)} (x${i.qty})</option>`)
      .join('');
    const input = 'w-full p-2 bg-gray-100 text-black border-2 border-gray-400 rounded';

    body.innerHTML = panelCard(
      `<div class="flex flex-col gap-3" style="width:520px; max-width:100%;">
        <label class="text-black" style="${FONT} font-size:10px;">Lote a subastar</label>
        <select id="ah-item" class="${input}" style="${FONT} font-size:10px;">
          <option value="">— elige —</option>
          ${pokeOpts}${itemOpts}
        </select>
        <label class="text-black" style="${FONT} font-size:10px;">Precio de salida (puja mínima, opcional)</label>
        <input id="ah-start" type="number" min="1" class="${input}" style="${FONT} font-size:10px;" />
        <label class="text-black" style="${FONT} font-size:10px;">Precio fijo "cómpralo ya" (opcional)</label>
        <input id="ah-buynow" type="number" min="1" class="${input}" style="${FONT} font-size:10px;" />
        <label class="text-black" style="${FONT} font-size:10px;">Duración</label>
        <select id="ah-duration" class="${input}" style="${FONT} font-size:10px;">
          <option value="12">${DURATION_INFO[12]}</option>
          <option value="24">${DURATION_INFO[24]}</option>
          <option value="48">${DURATION_INFO[48]}</option>
        </select>
        <button id="ah-publish" class="bg-yellow-500 hover:bg-yellow-400 text-black py-2 rounded border-b-4 border-yellow-700 active:border-b-0" style="${FONT} font-size:11px;">PUBLICAR SUBASTA</button>
        <p class="text-gray-500" style="${FONT} font-size:8px;">Debes indicar al menos un precio (salida o fijo). El lote queda retenido hasta que se venda o expire.</p>
      </div>`
    );

    document.getElementById('ah-publish')?.addEventListener('click', () => this.doPublish());
  }

  private async doPublish(): Promise<void> {
    const sel = (document.getElementById('ah-item') as HTMLSelectElement).value;
    if (!sel) return this.setNotice('Elige un lote');
    const start = (document.getElementById('ah-start') as HTMLInputElement).value;
    const buyNow = (document.getElementById('ah-buynow') as HTMLInputElement).value;
    const duration = parseInt((document.getElementById('ah-duration') as HTMLSelectElement).value, 10);

    const payload: Parameters<typeof AuctionApi.create>[0] = {
      kind: sel.startsWith('pokemon:') ? 'pokemon' : 'item',
      durationHours: duration,
      startingPrice: start ? parseInt(start, 10) : null,
      buyNowPrice: buyNow ? parseInt(buyNow, 10) : null,
    };
    if (payload.kind === 'pokemon') {
      payload.pokemonId = sel.slice('pokemon:'.length);
    } else {
      const [, kind, key] = sel.split(':');
      payload.itemKind = kind;
      payload.itemKey = key;
    }
    if (payload.startingPrice === null && payload.buyNowPrice === null) {
      return this.setNotice('Indica un precio de salida o un precio fijo');
    }
    const r = await AuctionApi.create(payload);
    if (r.ok) {
      this.setNotice('✅ Subasta publicada');
      this.tab = 'mine';
      this.renderTabs();
    } else {
      this.setNotice(r.error ?? 'No se pudo publicar');
    }
    await this.renderBody();
  }

  private async renderMine(body: HTMLElement): Promise<void> {
    const auctions = await AuctionApi.mine();
    if (!auctions.length) {
      body.innerHTML = panelCard(
        `<p class="text-gray-500 text-center" style="${FONT} font-size:11px;">No has publicado subastas.</p>`
      );
      return;
    }
    const statusLabel: Record<string, string> = {
      active: '🟢 Activa', sold: '💰 Vendida', expired: '⌛ No vendida', cancelled: '✖ Cancelada',
    };
    const rows = auctions
      .map((a) => {
        const label = a.kind === 'pokemon' ? `${escapeHtml(a.displayName)} (Nv ${a.displayLevel ?? 1})` : escapeHtml(a.displayName);
        const canCancel = a.status === 'active' && !a.hasBids;
        return `<div class="flex items-center justify-between gap-2 bg-gray-100 rounded px-3 py-2">
          <div class="flex flex-col">
            <span class="text-black" style="${FONT} font-size:11px;">${a.kind === 'pokemon' ? '🐾' : '🎁'} ${label}</span>
            <span class="text-gray-600" style="${FONT} font-size:9px;">${statusLabel[a.status] ?? a.status} · ${this.priceLine(a)}</span>
          </div>
          ${canCancel ? `<button data-cancel="${a.id}" class="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded" style="${FONT} font-size:9px;">CANCELAR</button>` : ''}
        </div>`;
      })
      .join('');
    body.innerHTML = panelCard(`<div class="flex flex-col gap-2" style="width:640px; max-width:100%;">${rows}</div>`);
    body.querySelectorAll<HTMLButtonElement>('button[data-cancel]').forEach((b) =>
      b.addEventListener('click', async () => {
        const r = await AuctionApi.cancel(b.dataset.cancel!);
        this.setNotice(r.ok ? 'Subasta cancelada' : r.error ?? 'No se pudo cancelar');
        await this.renderBody();
      })
    );
  }
}
