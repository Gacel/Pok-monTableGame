import { authState } from '../../auth/AuthState';
import {
  showPlayMenu,
  showCommunityMenu,
  showShopMenu,
  showAuctionHouse,
  showSettings,
  showInventory,
} from '../../main';
import { FONT, hubPanel, panelCard, panelTitle, menuButton } from './panel';

/**
 * Capa VISTA: menú principal (raíz del árbol). Secciones:
 * JUGAR · COMUNIDAD · TIENDA · CASA DE SUBASTAS. Configuración y Cerrar sesión
 * quedan como acciones secundarias. Disposición en lista vertical (estilo tienda).
 * Ver docs/05-FRONTEND_MENU.md §4-5.
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

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('MENÚ PRINCIPAL')}

      <!-- Barra del entrenador -->
      ${panelCard(
        `
        <div class="flex justify-between items-center gap-6">
          <div class="flex items-center gap-4">
            <img id="btn-inventory" title="Abrir inventario" src="https://play.pokemonshowdown.com/sprites/trainers/${spriteName}.png" class="w-16 h-16 object-contain pixelated bg-gray-200 border-4 border-gray-400 rounded-full cursor-pointer hover:border-yellow-400 transition-colors" />
            <div class="flex flex-col gap-2">
              <span class="text-black" style="${FONT} font-size:16px;">${user.username}</span>
              <span class="text-gray-600" style="${FONT} font-size:11px;">Lv. ${user.level}</span>
            </div>
          </div>
          <div class="text-black flex items-center gap-2" style="${FONT} font-size:16px;">
            <span>${user.coins}</span> <span class="text-yellow-500" style="font-size:22px;">🪙</span>
          </div>
        </div>`,
        'mb-6'
      )}

      <!-- Secciones en lista vertical -->
      ${panelCard(
        `<div class="flex flex-col gap-3 sm:gap-4 w-full max-w-xl">
          ${menuButton({ id: 'btn-play', label: 'JUGAR', icon: '🎮', sublabel: 'Un jugador (vs IA) o multijugador', color: 'red' })}
          ${menuButton({ id: 'btn-community', label: 'COMUNIDAD', icon: '👥', sublabel: 'Amigos · añadir · enviar regalo', color: 'blue' })}
          ${menuButton({ id: 'btn-shop', label: 'TIENDA', icon: '🛒', sublabel: 'Cosméticos · pokéballs · recuperar', color: 'yellow' })}
          ${menuButton({ id: 'btn-auction', label: 'CASA DE SUBASTAS', icon: '⚖️', sublabel: 'Todo lo comercializable', color: 'purple' })}
        </div>`,
        'flex flex-col items-center'
      )}

      <!-- Acciones secundarias -->
      <div class="flex items-center gap-6 mt-8">
        <button id="btn-settings" class="text-white hover:text-yellow-300 flex items-center gap-2" style="${FONT} font-size:13px;">⚙️ CONFIGURACIÓN</button>
        <span class="text-gray-500">·</span>
        <button id="btn-logout" class="text-white hover:text-red-400 underline" style="${FONT} font-size:13px;">CERRAR SESIÓN</button>
      </div>
      `,
      { minHeight: 820 }
    );

    document.getElementById('btn-inventory')?.addEventListener('click', () => showInventory());
    document.getElementById('btn-play')?.addEventListener('click', () => showPlayMenu());
    document.getElementById('btn-community')?.addEventListener('click', () => showCommunityMenu());
    document.getElementById('btn-shop')?.addEventListener('click', () => showShopMenu());
    document.getElementById('btn-auction')?.addEventListener('click', () => showAuctionHouse());
    document.getElementById('btn-settings')?.addEventListener('click', () => showSettings());
    document.getElementById('btn-logout')?.addEventListener('click', () => authState.logout());
  }
}
