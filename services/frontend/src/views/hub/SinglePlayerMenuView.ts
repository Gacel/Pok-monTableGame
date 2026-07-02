import { showPlayMenu } from '../../main';
import { FONT, hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';

/**
 * Capa VISTA: UN JUGADOR (vs IA). Dificultades + Survival.
 *
 * No hay motor de IA todavía (ver docs/FRONTEND_MENU.md §3): todas las opciones
 * son placeholders navegables deshabilitados ("pronto"). HARDCORE se muestra
 * bloqueado por logro (1000 monedas).
 */
export class SinglePlayerMenuView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('UN JUGADOR')}
      ${panelCard(
        `
        <p class="text-black text-center mb-6" style="${FONT} font-size:12px;">ELIGE DIFICULTAD</p>
        <div class="grid grid-cols-2 gap-4" style="width:640px; max-width:100%;">
          ${menuButton({ label: 'IA FÁCIL', icon: '🟢', color: 'green', disabled: true })}
          ${menuButton({ label: 'IA NORMAL', icon: '🔵', color: 'blue', disabled: true })}
          ${menuButton({ label: 'IA DIFÍCIL', icon: '🟠', color: 'yellow', disabled: true })}
          ${menuButton({ label: 'IA HARDCORE', icon: '🔴', color: 'red', lock: '1000 monedas (logro)' })}
          ${menuButton({ label: 'SURVIVAL MODE', icon: '💀', color: 'purple', disabled: true, extraClass: 'col-span-2' })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 680 }
    );

    document.getElementById('btn-back')?.addEventListener('click', () => showPlayMenu());
  }
}
