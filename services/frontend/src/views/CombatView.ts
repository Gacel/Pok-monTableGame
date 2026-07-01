import { GameState } from '../models/GameState';
import type { CombatAction } from '../models/Types';

/**
 * Capa VISTA: escena de combate estilo juego de lucha (bitmap frente a frente)
 * con menú de acciones tipo Pokémon/FF7. Lee el estado autoritativo y emite la
 * acción elegida; no calcula daño (eso lo hace el servidor).
 */
export class CombatView {
  private state: GameState;
  private onAction: (action: CombatAction) => void;
  private overlay: HTMLElement | null;

  constructor(state: GameState, onAction: (action: CombatAction) => void) {
    this.state = state;
    this.onAction = onAction;
    this.overlay = document.getElementById('combat-overlay');
  }

  render(): void {
    if (!this.overlay) return;
    const combat = this.state.match?.combat ?? null;
    if (!this.state.match || this.state.match.status !== 'combat' || !combat) {
      this.overlay.classList.add('hidden');
      this.overlay.innerHTML = '';
      return;
    }

    const { attacker, defender } = combat;
    const actorIsAttacker = combat.turnActorId === combat.attackerId;
    const actorPlayer = actorIsAttacker ? combat.attackerPlayer : combat.defenderPlayer;
    const res = this.state.match.resources[actorPlayer];
    const totalCandy = res ? res.FIRE_CANDY + res.WATER_CANDY + res.GRASS_CANDY : 0;
    const typeCandy = res
      ? (actorIsAttacker ? attacker : defender).type === 'FIRE'
        ? res.FIRE_CANDY
        : (actorIsAttacker ? attacker : defender).type === 'WATER'
          ? res.WATER_CANDY
          : res.GRASS_CANDY
      : 0;

    const spriteA = this.state.pokeGifs[attacker.name ?? ''] ?? '';
    const spriteD = this.state.pokeGifs[defender.name ?? ''] ?? '';

    const hpBar = (p: typeof attacker, align: string) => {
      const pct = Math.max(0, Math.min(100, (p.hp / (p.maxHp || 1)) * 100));
      const col = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';
      return `
        <div class="w-48 ${align}">
          <div class="text-[10px] text-white mb-1 uppercase" style="font-family:'Press Start 2P',monospace;">${(p.name ?? p.id).toUpperCase()}</div>
          <div class="w-full h-5 bg-gray-700 rounded overflow-hidden border-2 border-black relative">
            <div class="h-full ${col} transition-all duration-500" style="width:${pct}%"></div>
            <div class="absolute inset-0 flex items-center justify-center text-[8px] text-white" style="font-family:'Press Start 2P',monospace;">${p.hp}/${p.maxHp}</div>
          </div>
        </div>`;
    };

    const actorName = (actorIsAttacker ? attacker : defender).name ?? actorPlayer;
    const turnColor = actorPlayer === this.state.match.players[0] ? '#f87171' : '#60a5fa';
    const canHab = typeCandy >= 1;
    const canObj = totalCandy >= 2;

    const actionBtn = (id: string, label: string, sub: string, enabled: boolean) => `
      <button data-action="${id}" ${enabled ? '' : 'disabled'}
        class="flex flex-col items-start px-4 py-2 rounded border-b-4 active:border-b-0 active:mt-1 text-left ${enabled ? 'bg-gray-800 hover:bg-gray-700 border-black text-white' : 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'}"
        style="font-family:'Press Start 2P',monospace;">
        <span class="text-[11px]">${label}</span>
        <span class="text-[7px] text-gray-400 mt-1">${sub}</span>
      </button>`;

    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="absolute inset-0 flex flex-col" style="background:linear-gradient(180deg,#1e3a8a 0%,#0f172a 55%,#334155 100%);">
        <!-- Arena -->
        <div class="flex-1 relative">
          <div class="absolute top-8 left-10">${hpBar(defender, 'text-left')}</div>
          <div class="absolute top-8 right-10">${hpBar(attacker, 'text-right ml-auto')}</div>

          <!-- Suelo -->
          <div class="absolute bottom-0 left-0 w-full h-24" style="background:linear-gradient(180deg,#4b5563,#1f2937);"></div>

          <!-- Atacante (frente-izquierda, mira a la derecha) -->
          <img src="${spriteA}" alt="attacker" class="absolute" style="left:16%;bottom:70px;width:150px;height:150px;image-rendering:pixelated;transform:scaleX(-1);filter:drop-shadow(0 8px 6px rgba(0,0,0,.6));" />
          <!-- Defensor (frente-derecha) -->
          <img src="${spriteD}" alt="defender" class="absolute" style="right:16%;bottom:90px;width:130px;height:130px;image-rendering:pixelated;filter:drop-shadow(0 8px 6px rgba(0,0,0,.6));" />
        </div>

        <!-- Panel inferior: turno + log + acciones -->
        <div class="bg-black bg-opacity-90 border-t-4 border-yellow-500 p-4">
          <div class="flex justify-between items-start gap-4">
            <div class="flex-1">
              <div class="text-[10px] mb-2" style="font-family:'Press Start 2P',monospace;color:${turnColor};">
                TURNO: ${actorName.toUpperCase()} (${actorPlayer})
              </div>
              <div class="text-[8px] text-gray-300 leading-relaxed max-h-20 overflow-hidden" style="font-family:'Press Start 2P',monospace;">
                ${combat.log.slice(-4).map((l) => `<div>› ${l}</div>`).join('')}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              ${actionBtn('ATACAR', 'ATACAR', 'daño básico', true)}
              ${actionBtn('HABILIDAD', 'HABILIDAD', `x1.6 · 1 ${(actorIsAttacker ? attacker : defender).type[0]}candy`, canHab)}
              ${actionBtn('OBJETO', 'OBJETO', 'cura · 2 candy', canObj)}
              ${actionBtn('HUIR', 'HUIR', 'con riesgo', true)}
            </div>
          </div>
        </div>
      </div>`;

    this.overlay.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.action as CombatAction | undefined;
        if (a) this.onAction(a);
      });
    });
  }
}
