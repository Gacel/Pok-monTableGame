import type { GameMode } from '@transcendence/shared';
import { showPlayMenu, startLocalGame, showLobby } from '../../main';
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
    const bigOption = (
      id: string,
      badge: string,
      icon: string,
      title: string,
      desc: string,
      color: string,
      border: string
    ) => `
      <button id="${id}" class="flex flex-col items-center justify-center text-center rounded-lg border-b-8 ${border} active:border-b-0 active:mt-2 transition-all ${color}" style="${FONT} padding:36px 28px; box-shadow:0 6px 0 #000; min-height:230px;">
        <span class="text-[9px] bg-yellow-400 text-black px-2 py-1 rounded mb-3">${badge}</span>
        <span style="font-size:44px;">${icon}</span>
        <span style="font-size:20px;" class="mt-3">${title}</span>
        <span class="text-[10px] opacity-80 mt-3 leading-relaxed" style="max-width:260px;">${desc}</span>
      </button>`;

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('MULTIJUGADOR')}
      <div class="grid grid-cols-2 gap-8 w-full" style="max-width:800px;">
        ${bigOption('btn-local', '👥 MISMA PANTALLA', '🎮', 'PARTIDA LOCAL', 'Varios jugadores por turnos en este mismo navegador.', 'bg-red-600 hover:bg-red-500 text-white', 'border-red-800')}
        ${bigOption('btn-online', '🌐 OTRO NAVEGADOR', '📡', 'EN LÍNEA', 'Crea o busca una sala y juega contra otros jugadores.', 'bg-blue-600 hover:bg-blue-500 text-white', 'border-blue-800')}
      </div>
      ${backButton()}
      `
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
