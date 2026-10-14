import { apiFetch } from '../../net/api';
import { FONT, hubPanel, panelTitle, panelCard, backButton } from './panel';

interface RankingEntry {
  username: string;
  avatarUrl: string | null;
  level: number;
  wins: number;
  losses: number;
  abandons: number;
}

export class RankingView {
  private container: HTMLElement;
  private onBack: () => void;

  constructor(container: HTMLElement, onBack: () => void) {
    this.container = container;
    this.onBack = onBack;
  }

  public async render(): Promise<void> {
    this.container.innerHTML = hubPanel(
      `${panelTitle('🏆 RANKING')}
       <p class="text-gray-300 text-center mb-4" style="${FONT} font-size:clamp(8px, 1.5vw, 10px);">Active trainers in the last 48 hours</p>
       <div id="ranking-content" class="w-full max-w-2xl">
         <p class="text-white text-center animate-pulse" style="${FONT} font-size:12px;">Loading...</p>
       </div>
       ${backButton()}`,
      { minHeight: 820 }
    );

    document.getElementById('btn-back')?.addEventListener('click', () => this.onBack());

    try {
      const res = await apiFetch('/api/users/ranking');
      const data = (await res.json()) as { success: boolean; ranking: RankingEntry[] };
      this.renderTable(data.ranking);
    } catch {
      this.renderError();
    }
  }

  private renderTable(entries: RankingEntry[]): void {
    const content = document.getElementById('ranking-content');
    if (!content) return;

    if (!entries.length) {
      content.innerHTML = panelCard(
        `<p class="text-gray-500 text-center" style="${FONT} font-size:11px;">No active trainers found</p>`
      );
      return;
    }

    const headerStyle = `${FONT} font-size:clamp(7px, 1.3vw, 9px);`;
    const cellStyle = `${FONT} font-size:clamp(8px, 1.5vw, 10px);`;

    const rows = entries
      .map((e, i) => {
        const pos = i + 1;
        const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}`;
        const sprite = e.avatarUrl === 'boy' ? 'red' : e.avatarUrl === 'girl' ? 'may' : e.avatarUrl || 'red';
        const rowBg = i % 2 === 0 ? 'bg-gray-50' : 'bg-white';
        return `
          <tr class="${rowBg}">
            <td class="py-2 px-2 text-center" style="${cellStyle}">${medal}</td>
            <td class="py-2 px-1">
              <div class="flex items-center gap-2">
                <img src="https://play.pokemonshowdown.com/sprites/trainers/${sprite}.png" class="w-8 h-8 object-contain pixelated" />
                <div>
                  <span class="text-black" style="${cellStyle}">${e.username}</span>
                  <span class="text-gray-400 ml-1" style="${FONT} font-size:clamp(6px, 1vw, 8px);">Lv.${e.level}</span>
                </div>
              </div>
            </td>
            <td class="py-2 px-2 text-center text-green-700" style="${cellStyle}">${e.wins}</td>
            <td class="py-2 px-2 text-center text-red-600" style="${cellStyle}">${e.losses}</td>
            <td class="py-2 px-2 text-center text-yellow-600" style="${cellStyle}">${e.abandons}</td>
          </tr>`;
      })
      .join('');

    content.innerHTML = panelCard(`
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b-2 border-gray-300">
              <th class="py-2 px-2 text-gray-600 text-center" style="${headerStyle}">#</th>
              <th class="py-2 px-1 text-gray-600 text-left" style="${headerStyle}">TRAINER</th>
              <th class="py-2 px-2 text-green-700 text-center" style="${headerStyle}">W</th>
              <th class="py-2 px-2 text-red-600 text-center" style="${headerStyle}">L</th>
              <th class="py-2 px-2 text-yellow-600 text-center" style="${headerStyle}">A</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  private renderError(): void {
    const content = document.getElementById('ranking-content');
    if (!content) return;
    content.innerHTML = panelCard(
      `<p class="text-red-500 text-center" style="${FONT} font-size:11px;">Could not load ranking</p>`
    );
  }
}
