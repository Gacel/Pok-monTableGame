import type { GameState } from '../models/GameState';
import type { BoardView } from '../views/BoardView';
import type { Hex } from '../models/Types';

/**
 * Primitivas de feedback visual sobre la capa `#fx-layer`: números flotantes,
 * flash/"!" y tween de posición. Reutilizables por los tickets de feedback
 * (T1.2, T2.3, T3.2/T3.4, T4.4, T8.5). Las animaciones usan la Web Animations API
 * (`el.animate`) y cada nodo se auto-elimina al terminar; no hay CSS global.
 *
 * Los nodos se posicionan al crearse con `boardView.hexToScreen(hex)`. Si el jugador
 * hace pan/zoom durante la (~1s) animación, el nodo no sigue a la cámara: son
 * transitorios y es aceptable.
 */
export class FxLayer {
  /** Contorno negro nítido de 8 direcciones (2px) para texto sobre el tablero. */
  private static readonly OUTLINE =
    '2px 0 0 #000, -2px 0 0 #000, 0 2px 0 #000, 0 -2px 0 #000, ' +
    '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000';

  private state: GameState;
  private boardView: BoardView;
  private layer: HTMLElement | null;

  constructor(state: GameState, boardView: BoardView) {
    this.state = state;
    this.boardView = boardView;
    this.layer = document.getElementById('fx-layer');
  }

  /** Número flotante (`-N` daño rojo / `+N` curación verde) que sube y se desvanece. */
  public floatingNumber(hex: Hex, text: string, kind: 'damage' | 'heal'): void {
    if (!this.layer) return;
    const { x, y } = this.boardView.hexToScreen(hex);
    const el = document.createElement('div');
    el.className = 'absolute pointer-events-none font-bold';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = 'translate(-50%, -100%)';
    el.style.fontFamily = '"Press Start 2P", monospace';
    el.style.fontSize = `${13 * this.state.zoom}px`;
    el.style.color = kind === 'damage' ? '#ff5252' : '#5dfc7a';
    // Contorno negro nítido de 8 direcciones (estilo arcade): recorta limpio sobre
    // cualquier fondo sin emborronar el glifo (mejor que -webkit-text-stroke).
    el.style.textShadow = FxLayer.OUTLINE;
    el.style.zIndex = '9999';
    this.layer.appendChild(el);

    // Sube y se mantiene visible un tiempo antes de desvanecerse (fade tardío).
    const anim = el.animate(
      [
        { transform: 'translate(-50%, -100%)', opacity: 0 },
        { transform: 'translate(-50%, -100%) translateY(-8px)', opacity: 1, offset: 0.12 },
        { transform: 'translate(-50%, -100%) translateY(-24px)', opacity: 1, offset: 0.7 },
        { transform: 'translate(-50%, -100%) translateY(-40px)', opacity: 0 },
      ],
      { duration: 1500, easing: 'ease-out' }
    );
    anim.onfinish = () => el.remove();
    anim.oncancel = () => el.remove();
  }

  /** Destello "!" estilo emboscada revelada sobre un hex. */
  public flash(hex: Hex, text = '!'): void {
    if (!this.layer) return;
    const { x, y } = this.boardView.hexToScreen(hex);
    const el = document.createElement('div');
    el.className = 'absolute pointer-events-none font-bold';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = 'translate(-50%, -120%)';
    el.style.fontFamily = '"Press Start 2P", monospace';
    el.style.fontSize = `${18 * this.state.zoom}px`;
    el.style.color = '#fde047';
    el.style.textShadow = FxLayer.OUTLINE;
    el.style.zIndex = '9999';
    this.layer.appendChild(el);

    const anim = el.animate(
      [
        { transform: 'translate(-50%, -120%) scale(0.6)', opacity: 0 },
        { transform: 'translate(-50%, -120%) scale(1.4)', opacity: 1, offset: 0.4 },
        { transform: 'translate(-50%, -120%) scale(1.2)', opacity: 0 },
      ],
      { duration: 450, easing: 'ease-out' }
    );
    anim.onfinish = () => el.remove();
    anim.oncancel = () => el.remove();
  }

  /**
   * Anima `left/top` de un elemento existente de `fromHex` a `toHex`. Primitiva para
   * el deslizamiento de knockback/dash (su integración con el ciclo de `EntityView`
   * es de T3.2/T3.4). Resuelve al terminar la animación.
   */
  public tween(el: HTMLElement, fromHex: Hex, toHex: Hex, ms = 250): Promise<void> {
    const from = this.boardView.hexToScreen(fromHex);
    const to = this.boardView.hexToScreen(toHex);
    const anim = el.animate(
      [
        { left: `${from.x}px`, top: `${from.y}px` },
        { left: `${to.x}px`, top: `${to.y}px` },
      ],
      { duration: ms, easing: 'ease-in-out', fill: 'forwards' }
    );
    return anim.finished.then(() => undefined).catch(() => undefined);
  }
}
