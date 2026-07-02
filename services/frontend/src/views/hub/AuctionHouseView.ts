import { showMainMenu } from '../../main';
import { FONT, hubPanel, panelTitle, panelCard, backButton } from './panel';

/**
 * Capa VISTA: CASA DE SUBASTAS (placeholder navegable; sin backend todavía).
 * Objetivo: mercado de todo lo comercializable (Pokémon, cosméticos, objetos).
 */
export class AuctionHouseView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('CASA DE SUBASTAS')}
      ${panelCard(
        `<div class="flex flex-col items-center text-center gap-5" style="width:620px; max-width:100%;">
          <span style="font-size:64px;">⚖️</span>
          <p class="text-black leading-relaxed" style="${FONT} font-size:13px;">Compra y vende todo lo comercializable: Pokémon, cosméticos y objetos.</p>
          <p class="text-gray-500" style="${FONT} font-size:11px;">🔒 Próximamente</p>
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 600 }
    );
    document.getElementById('btn-back')?.addEventListener('click', () => showMainMenu());
  }
}
