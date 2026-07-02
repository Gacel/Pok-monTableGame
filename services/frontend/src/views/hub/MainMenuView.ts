import { authState } from '../../auth/AuthState';
import {
  showPlayMenu,
  showCommunityMenu,
  showShopMenu,
  showAuctionHouse,
  showSettings,
} from '../../main';
import { FONT, hubPanel, panelCard } from './panel';

/**
 * Capa VISTA: menú principal (raíz del árbol). Secciones:
 * JUGAR · COMUNIDAD · TIENDA · CASA DE SUBASTAS. Configuración y Cerrar sesión
 * quedan como acciones secundarias. Ver docs/FRONTEND_MENU.md §4.
 */
export class MainMenuView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render() {
    const user = authState.user;
    if (!user) return;

    const spriteName =
      user.avatarUrl === 'boy' ? 'red' : user.avatarUrl === 'girl' ? 'may' : user.avatarUrl || 'red';

    const section = (
      id: string,
      icon: string,
      title: string,
      desc: string,
      color: string,
      border: string
    ) => `
      <button id="${id}" class="group flex flex-col items-start justify-center text-left rounded-lg border-b-8 ${border} active:border-b-0 active:mt-2 transition-all ${color}" style="${FONT} padding:26px 28px; box-shadow:0 6px 0 #000; min-height:150px;">
        <span style="font-size:22px;" class="flex items-center gap-3">${icon} ${title}</span>
        <span class="text-[11px] opacity-80 mt-3 leading-relaxed">${desc}</span>
      </button>`;

    this.container.innerHTML = hubPanel(
      `
      <!-- Top bar: entrenador -->
      ${panelCard(
        `
        <div class="flex justify-between items-center gap-6">
          <div class="flex items-center gap-4">
            <img src="https://play.pokemonshowdown.com/sprites/trainers/${spriteName}.png" class="w-16 h-16 object-contain pixelated bg-gray-200 border-4 border-gray-400 rounded-full" />
            <div class="flex flex-col gap-2">
              <span class="text-black" style="${FONT} font-size:16px;">${user.username}</span>
              <span class="text-gray-600" style="${FONT} font-size:11px;">Lv. ${user.level}</span>
            </div>
          </div>
          <div class="text-black flex items-center gap-2" style="${FONT} font-size:16px;">
            <span>${user.coins}</span> <span class="text-yellow-500" style="font-size:22px;">🪙</span>
          </div>
        </div>`,
        'w-full mb-8'
      )}

      <!-- Rejilla de secciones -->
      <div class="grid grid-cols-2 gap-6 w-full" style="max-width:900px;">
        ${section('btn-play', '🎮', 'JUGAR', 'Un jugador (vs IA) o Multijugador (local y online)', 'bg-red-600 hover:bg-red-500 text-white', 'border-red-800')}
        ${section('btn-community', '👥', 'COMUNIDAD', 'Amigos conectados · añadir amigo · enviar regalo', 'bg-blue-600 hover:bg-blue-500 text-white', 'border-blue-800')}
        ${section('btn-shop', '🛒', 'TIENDA', 'Cosméticos · Pokéballs sorpresa · recuperar Pokémon', 'bg-yellow-400 hover:bg-yellow-300 text-black', 'border-yellow-600')}
        ${section('btn-auction', '⚖️', 'CASA DE SUBASTAS', 'Compra y vende todo lo comercializable', 'bg-purple-600 hover:bg-purple-500 text-white', 'border-purple-800')}
      </div>

      <!-- Acciones secundarias -->
      <div class="flex items-center gap-6 mt-10">
        <button id="btn-settings" class="text-white hover:text-yellow-300 flex items-center gap-2" style="${FONT} font-size:13px;">⚙️ CONFIGURACIÓN</button>
        <span class="text-gray-500">·</span>
        <button id="btn-logout" class="text-white hover:text-red-400 underline" style="${FONT} font-size:13px;">CERRAR SESIÓN</button>
      </div>
      `
    );

    document.getElementById('btn-play')?.addEventListener('click', () => showPlayMenu());
    document.getElementById('btn-community')?.addEventListener('click', () => showCommunityMenu());
    document.getElementById('btn-shop')?.addEventListener('click', () => showShopMenu());
    document.getElementById('btn-auction')?.addEventListener('click', () => showAuctionHouse());
    document.getElementById('btn-settings')?.addEventListener('click', () => showSettings());
    document.getElementById('btn-logout')?.addEventListener('click', () => authState.logout());
  }
}
