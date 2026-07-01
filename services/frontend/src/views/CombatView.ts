import { GameState } from '../models/GameState';
import type { CombatAction, CombatState, Pokemon } from '../models/Types';

/**
 * Capa VISTA: escena de combate estilo juego de lucha (bitmap frente a frente)
 * con menú de acciones tipo Pokémon/FF7 y fase de resultado. Lee el estado
 * autoritativo y emite acciones; no calcula daño (eso lo hace el servidor).
 */
export class CombatView {
  private state: GameState;
  private onAction: (action: CombatAction) => void;
  private onContinue: () => void;
  private overlay: HTMLElement | null;

  constructor(
    state: GameState,
    onAction: (action: CombatAction) => void,
    onContinue: () => void
  ) {
    this.state = state;
    this.onAction = onAction;
    this.onContinue = onContinue;
    this.overlay = document.getElementById('combat-overlay');
  }

  render(): void {
    if (!this.overlay) return;
    const match = this.state.match;
    const combat = match?.combat ?? null;
    if (!match || match.status !== 'combat' || !combat) {
      this.overlay.classList.add('hidden');
      this.overlay.innerHTML = '';
      return;
    }

    const finished = combat.status === 'finished';
    const actorIsAttacker = combat.turnActorId === combat.attackerId;
    const actor = actorIsAttacker ? combat.attacker : combat.defender;
    const actorPlayer = actorIsAttacker ? combat.attackerPlayer : combat.defenderPlayer;
    const isP1 = actorPlayer === match.players[0];
    const turnColor = isP1 ? '#f87171' : '#60a5fa';

    const lastLog = combat.log[combat.log.length - 1] ?? '';

    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="absolute inset-0 flex flex-col" style="background:linear-gradient(180deg,#1e3a8a 0%,#0f172a 55%,#334155 100%);">

        <!-- Turno (arriba, centrado, grande) -->
        <div class="pt-5 pb-3 text-center">
          ${
            finished
              ? `<div class="text-lg text-yellow-400" style="font-family:'Press Start 2P',monospace;text-shadow:2px 2px 0 #000;">RESULTADO</div>`
              : `<div class="text-lg" style="font-family:'Press Start 2P',monospace;color:${turnColor};text-shadow:2px 2px 0 #000;">
                   TURNO: ${(actor.name ?? actor.id).toUpperCase()} <span class="text-white text-sm">(${actorPlayer})</span>
                 </div>
                 <div class="text-[9px] text-gray-300 mt-2" style="font-family:'Press Start 2P',monospace;">Elige tu acción</div>`
          }
        </div>

        <!-- Arena -->
        <div class="flex-1 relative">
          <!-- Defensor: izquierda -->
          <div class="absolute top-2 left-10">${this.hpBar(combat.defender, !actorIsAttacker && !finished)}</div>
          <!-- Atacante: derecha -->
          <div class="absolute top-2 right-10">${this.hpBar(combat.attacker, actorIsAttacker && !finished)}</div>

          <div class="absolute bottom-0 left-0 w-full h-24" style="background:linear-gradient(180deg,#4b5563,#1f2937);"></div>

          <img src="${this.sprite(combat.defender)}" alt="def" class="absolute" style="left:15%;bottom:78px;width:150px;height:150px;image-rendering:pixelated;transform:scaleX(-1);filter:drop-shadow(0 8px 6px rgba(0,0,0,.6)) ${!actorIsAttacker && !finished ? 'brightness(1.15)' : ''};" />
          <img src="${this.sprite(combat.attacker)}" alt="atk" class="absolute" style="right:15%;bottom:96px;width:150px;height:150px;image-rendering:pixelated;filter:drop-shadow(0 8px 6px rgba(0,0,0,.6)) ${actorIsAttacker && !finished ? 'brightness(1.15)' : ''};" />

          <!-- Última acción (prominente) -->
          <div class="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 px-4 py-2 rounded text-[9px] text-yellow-200 text-center max-w-lg" style="font-family:'Press Start 2P',monospace;">
            ${this.escape(lastLog)}
          </div>
        </div>

        <!-- Panel inferior -->
        <div class="bg-black bg-opacity-90 border-t-4 border-yellow-500 p-4 min-h-[120px]">
          ${finished ? this.resultPanel(combat) : this.actionPanel(combat, actorIsAttacker)}
        </div>
      </div>`;

    if (finished) {
      this.overlay.querySelector('#combat-continue')?.addEventListener('click', () => this.onContinue());
    } else {
      this.overlay.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const a = btn.dataset.action as CombatAction | undefined;
          if (a) this.onAction(a);
        });
      });
    }
  }

  private sprite(p: Pokemon): string {
    return this.state.pokeGifs[p.name ?? ''] ?? '';
  }

  private hpBar(p: Pokemon, active: boolean): string {
    const pct = Math.max(0, Math.min(100, (p.hp / (p.maxHp || 1)) * 100));
    const col = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';
    return `
      <div class="w-52 ${active ? 'ring-2 ring-yellow-400 rounded p-1' : 'p-1'}">
        <div class="text-[10px] text-white mb-1 uppercase" style="font-family:'Press Start 2P',monospace;">
          ${active ? '▶ ' : ''}${(p.name ?? p.id).toUpperCase()}
        </div>
        <div class="w-full h-6 bg-gray-700 rounded overflow-hidden border-2 border-black relative">
          <div class="h-full ${col} transition-all duration-500" style="width:${pct}%"></div>
          <div class="absolute inset-0 flex items-center justify-center text-[9px] text-white" style="font-family:'Press Start 2P',monospace;text-shadow:1px 1px 0 #000;">${p.hp}/${p.maxHp} HP</div>
        </div>
      </div>`;
  }

  private actionPanel(combat: CombatState, actorIsAttacker: boolean): string {
    const match = this.state.match!;
    const actor = actorIsAttacker ? combat.attacker : combat.defender;
    const res = match.resources[actorIsAttacker ? combat.attackerPlayer : combat.defenderPlayer];
    const total = res ? res.FIRE_CANDY + res.WATER_CANDY + res.GRASS_CANDY : 0;
    const typeCandy = res
      ? actor.type === 'FIRE'
        ? res.FIRE_CANDY
        : actor.type === 'WATER'
          ? res.WATER_CANDY
          : res.GRASS_CANDY
      : 0;

    const btn = (id: string, label: string, sub: string, enabled: boolean) => `
      <button data-action="${id}" ${enabled ? '' : 'disabled'}
        class="flex flex-col items-start px-4 py-3 rounded border-b-4 active:border-b-0 active:mt-1 text-left ${enabled ? 'bg-gray-800 hover:bg-yellow-600 border-black text-white' : 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'}"
        style="font-family:'Press Start 2P',monospace;">
        <span class="text-[12px]">${label}</span>
        <span class="text-[7px] text-gray-300 mt-1">${sub}</span>
      </button>`;

    return `
      <div class="grid grid-cols-4 gap-2 max-w-4xl mx-auto">
        ${btn('ATACAR', 'ATACAR', 'daño básico', true)}
        ${btn('HABILIDAD', 'HABILIDAD', `x1.6 · 1 candy`, typeCandy >= 1)}
        ${btn('OBJETO', 'OBJETO', 'cura 30% · 2 candy', total >= 2)}
        ${btn('HUIR', 'HUIR', 'con riesgo', true)}
      </div>`;
  }

  private resultPanel(combat: CombatState): string {
    const nameById = (id: string | null) => {
      if (id === combat.attackerId) return (combat.attacker.name ?? id).toUpperCase();
      if (id === combat.defenderId) return (combat.defender.name ?? id).toUpperCase();
      return (id ?? '').toUpperCase();
    };
    let text: string;
    if (combat.outcome === 'fled') {
      text = `${nameById(combat.loserId)} huyó del combate`;
    } else {
      text = `¡${nameById(combat.winnerId)} venció a ${nameById(combat.loserId)}!`;
    }
    return `
      <div class="flex flex-col items-center gap-4">
        <div class="text-sm text-white text-center" style="font-family:'Press Start 2P',monospace;text-shadow:2px 2px 0 #000;">${this.escape(text)}</div>
        <button id="combat-continue" class="px-6 py-3 bg-green-600 hover:bg-green-500 text-white text-xs rounded border-b-4 border-green-800 active:border-b-0 active:mt-1" style="font-family:'Press Start 2P',monospace;">
          CONTINUAR ▶
        </button>
      </div>`;
  }

  private escape(s: string): string {
    return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c);
  }
}
