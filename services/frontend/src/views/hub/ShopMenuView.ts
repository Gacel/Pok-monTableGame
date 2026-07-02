import { showMainMenu } from '../../main';
import { FONT, hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';

/** Sprites reales de pokéballs (bitmap PokeAPI). Mostrados a tamaño avatar. */
const BALL_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
const BALLS = [
  { key: 'normal', name: 'NORMAL', sprite: 'poke-ball.png', price: 500 },
  { key: 'super', name: 'SUPERBALL', sprite: 'great-ball.png', price: 1000 },
  { key: 'ultra', name: 'ULTRABALL', sprite: 'ultra-ball.png', price: 2000 },
  { key: 'master', name: 'MASTERBALL', sprite: 'master-ball.png', price: 10000 },
];

/**
 * Capa VISTA: TIENDA (placeholders navegables; sin economía todavía).
 * Árbol: Cosméticos · Pokéball sorpresa (Normal/Super/Ultra/Master) ·
 * Recuperar Pokémon (Survival single) · Enviar oferta de recuperación · Plan Premium.
 */
export class ShopMenuView {
  private container: HTMLElement;
  private step: 'root' | 'balls' = 'root';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    if (this.step === 'balls') return this.renderBalls();
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
    const ballCard = (b: (typeof BALLS)[number]) => `
      <div class="flex flex-col items-center justify-between gap-2 rounded border-4 border-gray-800 bg-white shadow-[4px_4px_0_#000] opacity-90" style="padding:18px 14px;">
        <img src="${BALL_SPRITE}/${b.sprite}" alt="${b.name}" class="w-16 h-16 object-contain" style="image-rendering: pixelated;" />
        <span class="text-black" style="${FONT} font-size:11px;">${b.name}</span>
        <span class="text-gray-700 flex items-center gap-1" style="${FONT} font-size:10px;">${b.price} 🪙</span>
        <span class="text-gray-400" style="${FONT} font-size:8px;">🔒 pronto</span>
      </div>`;

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('POKÉBALL SORPRESA')}
      ${panelCard(
        `<div class="grid grid-cols-4 gap-4" style="width:720px; max-width:100%;">
          ${BALLS.map(ballCard).join('')}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 560 }
    );
    document.getElementById('btn-back')?.addEventListener('click', () => {
      this.step = 'root';
      this.render();
    });
  }
}
