import { showMainMenu, showSinglePlayerMenu, showMultiplayerMenu } from '../../main';
import { hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';

/**
 * Capa VISTA: JUGAR. Dos ramas del árbol:
 *  - UN JUGADOR  → vs IA / Survival (pendiente de motor de IA).
 *  - MULTIJUGADOR → local u online (1v1 / 2v2 / battle royale).
 * Disposición en lista vertical (estilo tienda).
 */
export class PlayMenuView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('JUGAR')}
      ${panelCard(
        `<div class="flex flex-col gap-4 w-full max-w-xl">
          ${menuButton({ id: 'btn-single', label: 'UN JUGADOR', icon: '🧍', sublabel: 'IA (fácil/normal/difícil/hardcore) o Survival', color: 'green' })}
          ${menuButton({ id: 'btn-multi', label: 'MULTIJUGADOR', icon: '👥', sublabel: 'Local u online · 1v1 · 2v2 · battle royale', color: 'red' })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 560 }
    );

    document.getElementById('btn-single')?.addEventListener('click', () => showSinglePlayerMenu());
    document.getElementById('btn-multi')?.addEventListener('click', () => showMultiplayerMenu());
    document.getElementById('btn-back')?.addEventListener('click', () => showMainMenu());
  }
}
