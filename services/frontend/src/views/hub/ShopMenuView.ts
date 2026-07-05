import { showMainMenu } from '../../main';
import { apiFetch } from '../../net/api';
import { getSprite } from '../../net/PokeSprites';
import { authState } from '../../auth/AuthState';
import { FONT, hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';

/** Sprites reales de pokéballs (bitmap PokeAPI). */
const BALL_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
const BALLS = [
  { key: 'normal', name: 'NORMAL', sprite: 'poke-ball.png', price: 500 },
  { key: 'super', name: 'SUPERBALL', sprite: 'great-ball.png', price: 1000 },
  { key: 'ultra', name: 'ULTRABALL', sprite: 'ultra-ball.png', price: 2000 },
  { key: 'master', name: 'MASTERBALL', sprite: 'master-ball.png', price: 10000 },
];

const TIER_LABEL: Record<number, string> = { 1: 'COMÚN', 2: 'RARO', 3: 'ÉPICO', 4: 'LEGENDARIO' };
const TIER_COLOR: Record<number, string> = { 1: '#9ca3af', 2: '#60a5fa', 3: '#c084fc', 4: '#fbbf24' };

/**
 * Capa VISTA: TIENDA. Pokéball sorpresa con LOOT real: según el precio de la
 * bola, mayor probabilidad de Pokémon buenos. Compra autoritativa en el servidor
 * (POST /api/shop/ball) y revelado del Pokémon obtenido.
 */
export class ShopMenuView {
  private container: HTMLElement;
  private step: 'root' | 'balls' | 'reveal' = 'root';
  private notice = '';
  private busy = false;
  private reveal: { name: string; tier: number; sprite: string } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  private coins(): number {
    return authState.user?.coins ?? 0;
  }

  public render() {
    if (this.step === 'balls') return this.renderBalls();
    if (this.step === 'reveal') return this.renderReveal();
    this.renderRoot();
  }

  private renderRoot() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('TIENDA')}
      ${panelCard(
        `<div class="flex flex-col gap-4" style="width:620px; max-width:100%;">
          ${menuButton({ label: 'COSMÉTICOS', icon: '🎨', color: 'purple', disabled: true })}
          ${menuButton({ id: 'btn-balls', label: 'POKÉBALL SORPRESA', icon: '🎁', color: 'red' })}
          ${menuButton({ label: 'RECUPERA UN POKÉMON', icon: '💾', sublabel: 'Solo perdido en Survival (single) · 10000 🪙', color: 'blue', disabled: true })}
          ${menuButton({ label: 'ENVIAR OFERTA DE RECUPERACIÓN', icon: '🤝', sublabel: 'Con contraoferta del otro jugador', color: 'green', disabled: true })}
          ${menuButton({ label: 'PLAN PREMIUM', icon: '⭐', color: 'yellow', disabled: true })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 720 }
    );
    document.getElementById('btn-balls')?.addEventListener('click', () => {
      this.step = 'balls';
      this.render();
    });
    document.getElementById('btn-back')?.addEventListener('click', () => showMainMenu());
  }

  private renderBalls() {
    const coins = this.coins();
    const ballCard = (b: (typeof BALLS)[number]) => {
      const afford = coins >= b.price && !this.busy;
      return `
      <button data-ball="${b.key}" ${afford ? '' : 'disabled'} class="ball-card flex flex-col items-center justify-between gap-2 rounded border-4 border-gray-800 shadow-[4px_4px_0_#000] transition-all ${
        afford ? 'bg-white hover:bg-yellow-100 active:mt-1' : 'bg-gray-300 opacity-60 cursor-not-allowed'
      }" style="padding:16px 12px;">
        <img src="${BALL_SPRITE}/${b.sprite}" alt="${b.name}" class="w-16 h-16 object-contain" style="image-rendering: pixelated;" />
        <span class="text-black" style="${FONT} font-size:10px;">${b.name}</span>
        <span class="text-gray-700" style="${FONT} font-size:10px;">${b.price} 🪙</span>
      </button>`;
    };

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('POKÉBALL SORPRESA')}
      <p class="text-white text-center mb-3" style="${FONT} font-size:11px;">Tu saldo: <span class="text-yellow-300">${coins} 🪙</span></p>
      ${panelCard(
        `<div class="grid grid-cols-4 gap-4" style="width:720px; max-width:100%;">${BALLS.map(ballCard).join('')}</div>
         ${this.notice ? `<p class="text-red-500 text-center mt-4" style="${FONT} font-size:9px;">⚠ ${this.notice}</p>` : ''}
         <p class="text-gray-500 text-center mt-4" style="${FONT} font-size:7px;">A más cara la bola, más probabilidad de Pokémon buenos.</p>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 600 }
    );

    this.container.querySelectorAll<HTMLButtonElement>('.ball-card').forEach((btn) => {
      btn.addEventListener('click', () => void this.buy(btn.dataset.ball!));
    });
    document.getElementById('btn-back')?.addEventListener('click', () => {
      this.step = 'root';
      this.notice = '';
      this.render();
    });
  }

  private async buy(ball: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.notice = '';
    try {
      const res = await apiFetch('/api/shop/ball', { method: 'POST', body: JSON.stringify({ ball }) });
      const data = await res.json();
      if (res.ok && data.pokemon) {
        // Actualiza el saldo local (sin notify para no salir de la tienda).
        if (authState.user) authState.user.coins = data.coins;
        this.reveal = { name: data.pokemon.name, tier: data.pokemon.tier, sprite: '' };
        this.busy = false;
        await this.loadRevealSprite();
        this.step = 'reveal';
        this.render();
        return;
      }
      this.notice = data.error ?? 'No se pudo comprar';
    } catch {
      this.notice = 'Error de red';
    }
    this.busy = false;
    this.renderBalls();
  }

  private async loadRevealSprite(): Promise<void> {
    if (!this.reveal) return;
    this.reveal.sprite = await getSprite(this.reveal.name);
  }

  private renderReveal() {
    const rv = this.reveal;
    if (!rv) {
      this.step = 'balls';
      return this.renderBalls();
    }
    const color = TIER_COLOR[rv.tier] ?? '#fff';
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('¡HAS OBTENIDO!')}
      ${panelCard(
        `<div class="flex flex-col items-center gap-4" style="width:420px; max-width:100%;">
          <img src="${rv.sprite}" alt="${rv.name}" class="w-32 h-32 object-contain" style="image-rendering:pixelated;" />
          <span class="uppercase text-black" style="${FONT} font-size:16px;">${rv.name}</span>
          <span style="${FONT} font-size:11px; color:${color};">★ ${TIER_LABEL[rv.tier] ?? ''}</span>
          <span class="text-gray-600" style="${FONT} font-size:9px;">Añadido a tu inventario · saldo ${this.coins()} 🪙</span>
        </div>`,
        'flex flex-col items-center'
      )}
      <div class="flex gap-4 mt-6">
        <button id="btn-again" class="px-6 py-3 rounded bg-red-600 hover:bg-red-500 text-white border-b-4 border-red-800 active:border-b-0" style="${FONT} font-size:11px; box-shadow:0 4px 0 #000;">🎁 OTRA VEZ</button>
        <button id="btn-shop-back" class="px-6 py-3 rounded bg-gray-600 hover:bg-gray-500 text-white border-b-4 border-gray-800 active:border-b-0" style="${FONT} font-size:11px; box-shadow:0 4px 0 #000;">◀ TIENDA</button>
      </div>
      `,
      { minHeight: 560 }
    );
    document.getElementById('btn-again')?.addEventListener('click', () => {
      this.reveal = null;
      this.step = 'balls';
      this.render();
    });
    document.getElementById('btn-shop-back')?.addEventListener('click', () => {
      this.reveal = null;
      this.step = 'root';
      this.render();
    });
  }
}
