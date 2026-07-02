import { showMainMenu, showSinglePlayerMenu, showMultiplayerMenu } from '../../main';
import { FONT, hubPanel, panelTitle, backButton } from './panel';

/**
 * Capa VISTA: JUGAR. Dos ramas del árbol:
 *  - UN JUGADOR  → vs IA / Survival (pendiente de motor de IA).
 *  - MULTIJUGADOR → local u online (1v1 / 2v2 / battle royale).
 */
export class PlayMenuView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    const bigOption = (
      id: string,
      icon: string,
      title: string,
      desc: string,
      color: string,
      border: string
    ) => `
      <button id="${id}" class="flex flex-col items-center justify-center text-center rounded-lg border-b-8 ${border} active:border-b-0 active:mt-2 transition-all ${color}" style="${FONT} padding:40px 28px; box-shadow:0 6px 0 #000; min-height:240px;">
        <span style="font-size:48px;">${icon}</span>
        <span style="font-size:22px;" class="mt-4">${title}</span>
        <span class="text-[11px] opacity-80 mt-4 leading-relaxed" style="max-width:280px;">${desc}</span>
      </button>`;

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('JUGAR')}
      <div class="grid grid-cols-2 gap-8 w-full" style="max-width:820px;">
        ${bigOption('btn-single', '🧍', 'UN JUGADOR', 'Enfréntate a la IA (fácil, normal, difícil, hardcore) o al modo Survival.', 'bg-green-600 hover:bg-green-500 text-white', 'border-green-800')}
        ${bigOption('btn-multi', '👥', 'MULTIJUGADOR', 'Local (misma pantalla) u online: 1 vs 1, 2 vs 2 o battle royale.', 'bg-red-600 hover:bg-red-500 text-white', 'border-red-800')}
      </div>
      ${backButton()}
      `
    );

    document.getElementById('btn-single')?.addEventListener('click', () => showSinglePlayerMenu());
    document.getElementById('btn-multi')?.addEventListener('click', () => showMultiplayerMenu());
    document.getElementById('btn-back')?.addEventListener('click', () => showMainMenu());
  }
}
