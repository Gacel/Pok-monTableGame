import { showMainMenu } from '../../main';
import { hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';

/**
 * Capa VISTA: COMUNIDAD (placeholders navegables; sin backend todavía).
 * Árbol: Amigos conectados · Añadir amigo (Buscar / Recomendados) ·
 * Enviar regalo (Cosmético / Pokémon / Pokéballs / Monedas / Plan Premium).
 */
export class CommunityMenuView {
  private container: HTMLElement;
  private step: 'root' | 'add' | 'gift' = 'root';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    if (this.step === 'add') return this.renderAdd();
    if (this.step === 'gift') return this.renderGift();
    this.renderRoot();
  }

  private renderRoot() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('COMUNIDAD')}
      ${panelCard(
        `<div class="flex flex-col gap-4" style="width:560px; max-width:100%;">
          ${menuButton({ label: 'AMIGOS CONECTADOS', icon: '🟢', color: 'green', disabled: true })}
          ${menuButton({ id: 'btn-add', label: 'AÑADIR AMIGO', icon: '➕', color: 'blue' })}
          ${menuButton({ id: 'btn-gift', label: 'ENVIAR REGALO', icon: '🎁', color: 'purple' })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 640 }
    );
    document.getElementById('btn-add')?.addEventListener('click', () => {
      this.step = 'add';
      this.render();
    });
    document.getElementById('btn-gift')?.addEventListener('click', () => {
      this.step = 'gift';
      this.render();
    });
    document.getElementById('btn-back')?.addEventListener('click', () => showMainMenu());
  }

  private renderAdd() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('AÑADIR AMIGO')}
      ${panelCard(
        `<div class="flex flex-col gap-4" style="width:560px; max-width:100%;">
          ${menuButton({ label: 'BUSCAR AMIGO', icon: '🔍', color: 'blue', disabled: true })}
          ${menuButton({ label: 'RECOMENDADOS', icon: '✨', sublabel: 'Amigos de tus amigos', color: 'green', disabled: true })}
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
    document.getElementById('btn-back')?.addEventListener('click', () => {
      this.step = 'root';
      this.render();
    });
  }
}
