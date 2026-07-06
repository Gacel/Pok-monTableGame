import { showPlayMenu, startLocalGame } from '../../main';
import type { BotLevel } from '../../controllers/botStrategy';
import { FONT, hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';

/**
 * Capa VISTA: UN JUGADOR (vs IA). Lanza una partida LOCAL 1v1 (tú = P1, la IA =
 * P2) con el nivel elegido, reutilizando el flujo de startLocalGame → draft →
 * tablero. HARDCORE queda bloqueado por logro; SURVIVAL, pendiente de modo.
 * Ver botStrategy.ts (3 niveles) y docs/RESPONSIVE.md.
 */
export class SinglePlayerMenuView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Partida rápida contra la IA: 1v1 FFA, P1 humano y P2 bot del nivel dado. */
  private startVsAI(level: BotLevel) {
    startLocalGame({ players: 2, gameMode: 'ffa', bots: { player2: level } });
  }

  public render() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('UN JUGADOR')}
      ${panelCard(
        `
        <p class="text-black text-center mb-6" style="${FONT} font-size:clamp(10px, 2.4vw, 12px);">ELIGE DIFICULTAD</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 w-full max-w-2xl">
          ${menuButton({ id: 'btn-ai-1', label: 'IA FÁCIL', icon: '🟢', color: 'green' })}
          ${menuButton({ id: 'btn-ai-2', label: 'IA NORMAL', icon: '🔵', color: 'blue' })}
          ${menuButton({ id: 'btn-ai-3', label: 'IA DIFÍCIL', icon: '🟠', color: 'yellow' })}
          ${menuButton({ label: 'IA HARDCORE', icon: '🔴', color: 'red', lock: '1000 monedas (logro)' })}
          ${menuButton({ label: 'SURVIVAL MODE', icon: '💀', color: 'purple', disabled: true, extraClass: 'col-span-1 sm:col-span-2' })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 680 }
    );

    document.getElementById('btn-ai-1')?.addEventListener('click', () => this.startVsAI(1));
    document.getElementById('btn-ai-2')?.addEventListener('click', () => this.startVsAI(2));
    document.getElementById('btn-ai-3')?.addEventListener('click', () => this.startVsAI(3));
    document.getElementById('btn-back')?.addEventListener('click', () => showPlayMenu());
  }
}
