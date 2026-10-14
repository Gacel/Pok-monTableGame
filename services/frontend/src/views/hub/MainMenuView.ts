import { authState } from '../../auth/AuthState';
import {
  showPlayMenu,
  showCommunityMenu,
  showShopMenu,
  showAuctionHouse,
  showSettings,
  showInventory,
  showPrivacyPolicy,
  showTermsOfService,
} from '../../main';
import { apiFetch } from '../../net/api';
import { FONT, hubPanel, panelCard, panelTitle, menuButton } from './panel';

interface RankingEntry {
  username: string;
  avatarUrl: string | null;
  level: number;
  wins: number;
  losses: number;
  abandons: number;
}

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

      <!-- Barra del entrenador (ancho completo) -->
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

      <!-- Layout a dos columnas: ranking izq · menú der -->
      <div class="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full">

        <!-- Columna izquierda: Ranking -->
        <div class="w-full sm:w-5/12">
          ${panelCard(
            `<h3 class="text-black text-center mb-3 border-b-2 border-gray-300 pb-2" style="${FONT} font-size:clamp(10px, 2vw, 13px);">🏆 RANKING</h3>
             <p class="text-gray-400 text-center mb-2" style="${FONT} font-size:clamp(6px, 1.2vw, 8px);">Active trainers · last 48h</p>
             <div id="ranking-slot">
               <p class="text-gray-400 text-center animate-pulse" style="${FONT} font-size:9px;">Loading...</p>
             </div>`,
            'h-full'
          )}
        </div>

        <!-- Columna derecha: Menú + acciones -->
        <div class="w-full sm:w-7/12 flex flex-col gap-4">
          ${panelCard(
            `<div class="flex flex-col gap-3 sm:gap-4 w-full">
              ${menuButton({ id: 'btn-play', label: 'JUGAR', icon: '🎮', sublabel: 'Un jugador (vs IA) o multijugador', color: 'red' })}
              ${menuButton({ id: 'btn-community', label: 'COMUNIDAD', icon: '👥', sublabel: 'Amigos · añadir · enviar regalo', color: 'blue' })}
              ${menuButton({ id: 'btn-shop', label: 'TIENDA', icon: '🛒', sublabel: 'Cosméticos · pokéballs · recuperar', color: 'yellow' })}
              ${menuButton({ id: 'btn-auction', label: 'CASA DE SUBASTAS', icon: '⚖️', sublabel: 'Todo lo comercializable', color: 'purple' })}
            </div>`,
            'flex flex-col items-center'
          )}

          <div class="flex items-center justify-center gap-6">
            <button id="btn-settings" class="text-white hover:text-yellow-300 flex items-center gap-2" style="${FONT} font-size:13px;">⚙️ CONFIGURACIÓN</button>
            <span class="text-gray-500">·</span>
            <button id="btn-logout" class="text-white hover:text-red-400 underline" style="${FONT} font-size:13px;">CERRAR SESIÓN</button>
          </div>
        </div>

      </div>

      <!-- Legal links -->
      <div class="flex items-center gap-4 mt-6">
        <button id="btn-privacy" class="text-gray-400 hover:text-yellow-300 underline" style="${FONT} font-size:9px;">Privacy Policy</button>
        <span class="text-gray-600">·</span>
        <button id="btn-terms" class="text-gray-400 hover:text-yellow-300 underline" style="${FONT} font-size:9px;">Terms of Service</button>
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
    document.getElementById('btn-privacy')?.addEventListener('click', () => showPrivacyPolicy());
    document.getElementById('btn-terms')?.addEventListener('click', () => showTermsOfService());

    this.loadRanking();
  }

  private async loadRanking(): Promise<void> {
    const slot = document.getElementById('ranking-slot');
    if (!slot) return;

    try {
      const res = await apiFetch('/api/users/ranking');
      const data = (await res.json()) as { success: boolean; ranking: RankingEntry[] };
      if (!data.ranking?.length) {
        slot.innerHTML = `<p class="text-gray-400 text-center" style="${FONT} font-size:9px;">No active trainers</p>`;
        return;
      }

      const hdr = `${FONT} font-size:clamp(6px, 1.1vw, 8px);`;
      const cell = `${FONT} font-size:clamp(7px, 1.3vw, 9px);`;

      const rows = data.ranking.slice(0, 10).map((e, i) => {
        const pos = i + 1;
        const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}`;
        const sprite = e.avatarUrl === 'boy' ? 'red' : e.avatarUrl === 'girl' ? 'may' : e.avatarUrl || 'red';
        const rowBg = i % 2 === 0 ? 'bg-gray-50' : 'bg-white';
        return `
          <tr class="${rowBg}">
            <td class="py-1 px-1 text-center" style="${cell}">${medal}</td>
            <td class="py-1 px-1">
              <div class="flex items-center gap-1">
                <img src="https://play.pokemonshowdown.com/sprites/trainers/${sprite}.png" class="w-6 h-6 object-contain pixelated" />
                <span class="text-black truncate" style="${cell}">${e.username}</span>
                <span class="text-gray-400" style="${FONT} font-size:clamp(5px, 0.8vw, 7px);">Lv.${e.level}</span>
              </div>
            </td>
            <td class="py-1 px-1 text-center text-green-700" style="${cell}">${e.wins}</td>
            <td class="py-1 px-1 text-center text-red-600" style="${cell}">${e.losses}</td>
            <td class="py-1 px-1 text-center text-yellow-600" style="${cell}">${e.abandons}</td>
          </tr>`;
      }).join('');

      slot.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b-2 border-gray-200">
                <th class="py-1 px-1 text-gray-500 text-center" style="${hdr}">#</th>
                <th class="py-1 px-1 text-gray-500 text-left" style="${hdr}">TRAINER</th>
                <th class="py-1 px-1 text-green-600 text-center" style="${hdr}">W</th>
                <th class="py-1 px-1 text-red-500 text-center" style="${hdr}">L</th>
                <th class="py-1 px-1 text-yellow-500 text-center" style="${hdr}">A</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } catch {
      slot.innerHTML = `<p class="text-red-400 text-center" style="${FONT} font-size:9px;">Could not load ranking</p>`;
    }
  }
}
