import { GameState } from '../models/GameState';

export class HUDView {
  private state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  public render() {
    const p1Tile = this.state.currentTiles.find(t => t.occupant?.playerId === 'player1');
    const p2Tile = this.state.currentTiles.find(t => t.occupant?.playerId === 'player2');
    
    this.updatePlayerHUD('p1', p1Tile);
    this.updatePlayerHUD('p2', p2Tile);
  }

  private updatePlayerHUD(playerId: 'p1' | 'p2', tile: any) {
    const el = document.getElementById(`hud-${playerId}`);
    if (tile && tile.occupant && el) {
      el.classList.remove('hidden');
      const occ = tile.occupant;
      const nameEl = document.getElementById(`hud-${playerId}-name`);
      if (nameEl) nameEl.textContent = occ.name ? occ.name.toUpperCase() : playerId.toUpperCase();
      const avatarEl = document.getElementById(`hud-${playerId}-avatar`) as HTMLImageElement;
      if (avatarEl && occ.name) avatarEl.src = this.state.pokeGifs[occ.name] || '';
      
      const hp = occ.hp ?? 100;
      const maxHp = occ.maxHp ?? 100;
      const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
      
      const barEl = document.getElementById(`hud-${playerId}-hp-bar`);
      if (barEl) barEl.style.width = `${pct}%`;
      const textEl = document.getElementById(`hud-${playerId}-hp-text`);
      if (textEl) textEl.textContent = `${hp}/${maxHp}`;
    } else if (el) {
      el.classList.add('hidden');
    }
  }
}
