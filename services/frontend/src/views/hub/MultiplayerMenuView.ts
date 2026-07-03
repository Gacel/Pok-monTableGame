import type { GameMode } from '@transcendence/shared';
import { showPlayMenu, startLocalGame, showLobby, startArena } from '../../main';
import { FONT, hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';

type Channel = 'local' | 'online';

/** Config de un modo del árbol → parámetros reales del motor. Ver docs/FRONTEND_MENU.md §4.2 */
interface ModePreset {
  key: string;
  icon: string;
  label: string;
  desc: string;
  players: number;
  gameMode: GameMode;
}

const MODES: ModePreset[] = [
  { key: '1v1', icon: '⚔️', label: '1 VS 1', desc: 'Duelo · 2 jugadores · FFA', players: 2, gameMode: 'ffa' },
  { key: '2v2', icon: '🤝', label: '2 VS 2', desc: 'Parejas · 4 jugadores · P1+P3 vs P2+P4', players: 4, gameMode: 'teams' },
  { key: 'br', icon: '👑', label: 'BATTLE ROYALE', desc: 'Todos contra todos · 3-4 jugadores', players: 4, gameMode: 'ffa' },
];

/**
 * Capa VISTA: MULTIJUGADOR. Dos pasos:
 *  1) canal: LOCAL (misma pantalla) o EN LÍNEA (otro navegador).
 *  2) modo:  1 VS 1 / 2 VS 2 / BATTLE ROYALE → lanza el flujo real (draft/partida).
 */
export class MultiplayerMenuView {
  private container: HTMLElement;
  private step: 'channel' | 'mode' = 'channel';
  private channel: Channel = 'local';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    if (this.step === 'channel') this.renderChannel();
    else this.renderMode();
  }

  private renderChannel() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('MULTIJUGADOR')}
      ${panelCard(
        `<div class="flex flex-col gap-4" style="width:560px; max-width:100%;">
          ${menuButton({ id: 'btn-local', label: 'PARTIDA LOCAL', icon: '🎮', sublabel: 'Misma pantalla · varios jugadores por turnos', color: 'red' })}
          ${menuButton({ id: 'btn-online', label: 'EN LÍNEA', icon: '📡', sublabel: 'Otro navegador · crear o buscar sala', color: 'blue' })}
          ${menuButton({ id: 'btn-arena', label: 'ARENA', icon: '🏟️', sublabel: 'Mundo vivo · entra directo (aunque estés solo) · máx 4', color: 'green' })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 620 }
    );

    document.getElementById('btn-local')?.addEventListener('click', () => {
      this.channel = 'local';
      this.step = 'mode';
      this.render();
    });
    document.getElementById('btn-online')?.addEventListener('click', () => {
      this.channel = 'online';
      this.step = 'mode';
      this.render();
    });
    document.getElementById('btn-arena')?.addEventListener('click', () => startArena());
    document.getElementById('btn-back')?.addEventListener('click', () => showPlayMenu());
  }

  private renderMode() {
    const channelLabel = this.channel === 'local' ? 'LOCAL · misma pantalla' : 'EN LÍNEA · otro navegador';
    const color = this.channel === 'local' ? 'red' : 'blue';

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('ELIGE MODO')}
      ${panelCard(
        `
        <p class="text-gray-700 text-center mb-6" style="${FONT} font-size:11px;">${channelLabel}</p>
        <div class="flex flex-col gap-4" style="width:560px; max-width:100%;">
          ${MODES.map((m) =>
            menuButton({
              id: `btn-mode-${m.key}`,
              label: m.label,
              icon: m.icon,
              sublabel: m.desc,
              color: color as 'red' | 'blue',
            })
          ).join('')}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 700 }
    );

    for (const m of MODES) {
      document.getElementById(`btn-mode-${m.key}`)?.addEventListener('click', () => {
        this.launch(m);
      });
    }
    document.getElementById('btn-back')?.addEventListener('click', () => {
      this.step = 'channel';
      this.render();
    });
  }

  /** Lanza el flujo real ya desarrollado con la config del modo elegido. */
  private launch(m: ModePreset) {
    if (this.channel === 'local') {
      startLocalGame({ players: m.players, gameMode: m.gameMode });
    } else {
      showLobby({ capacity: m.players, gameMode: m.gameMode });
    }
  }
}
