import { showMainMenu } from '../../main';
import { hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';

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
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('POKÉBALL SORPRESA')}
      ${panelCard(
        `<div class="grid grid-cols-2 gap-4" style="width:640px; max-width:100%;">
          ${menuButton({ label: 'NORMAL', icon: '⚪', sublabel: '500 🪙', color: 'gray', disabled: true })}
          ${menuButton({ label: 'SUPERBALL', icon: '🔵', sublabel: '1000 🪙', color: 'blue', disabled: true })}
          ${menuButton({ label: 'ULTRABALL', icon: '🟡', sublabel: '2000 🪙', color: 'yellow', disabled: true })}
          ${menuButton({ label: 'MASTERBALL', icon: '🟣', sublabel: '10000 🪙', color: 'purple', disabled: true })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 640 }
    );
    document.getElementById('btn-back')?.addEventListener('click', () => {
      this.step = 'root';
      this.render();
    });
  }
}
