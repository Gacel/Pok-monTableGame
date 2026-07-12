import { FONT } from './panel';
import { escapeHtml } from '../../utils/html';

/**
 * Menú contextual (botón derecho) con la estética retro del juego: marco tipo
 * consola (borde amarillo + relieve negro), fuente Press Start 2P.
 *
 * Uso: `openContextMenu(e.clientX, e.clientY, items, título?)`. Se cierra al hacer
 * click fuera, con Esc, al hacer scroll o al redimensionar. Un único menú activo.
 */
export interface ContextMenuItem {
  label: string;
  icon?: string;
  /** Estilo de acción destructiva (texto rojo). */
  danger?: boolean;
  onClick: () => void;
}

let active: HTMLElement | null = null;

function onDocDown(e: MouseEvent): void {
  if (active && !active.contains(e.target as Node)) closeContextMenu();
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeContextMenu();
}

/** Cierra el menú contextual abierto (si lo hay). Idempotente. */
export function closeContextMenu(): void {
  if (!active) return;
  window.removeEventListener('mousedown', onDocDown, true);
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', closeContextMenu);
  window.removeEventListener('scroll', closeContextMenu, true);
  active.remove();
  active = null;
}

export function openContextMenu(
  x: number,
  y: number,
  items: ContextMenuItem[],
  title?: string
): void {
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'fixed z-[210] select-none';
  menu.style.cssText =
    'min-width:190px; background:#111827; border:3px solid #fbbf24; border-radius:8px; box-shadow:0 0 0 3px #000, 0 8px 24px rgba(0,0,0,0.7); padding:5px; opacity:0;';

  const header = title
    ? `<div class="uppercase text-yellow-400 truncate" style="${FONT} font-size:8px; padding:5px 7px 6px; border-bottom:2px solid #374151; margin-bottom:4px;">${escapeHtml(title)}</div>`
    : '';
  menu.innerHTML =
    header +
    items
      .map(
        (it, i) =>
          `<button data-idx="${i}" class="ctx-item w-full flex items-center gap-2 text-left rounded ${
            it.danger ? 'text-red-300 hover:bg-red-900/60' : 'text-white hover:bg-blue-700'
          }" style="${FONT} font-size:9px; padding:8px; line-height:1.3;">
             <span style="width:14px; text-align:center;">${it.icon ?? ''}</span>
             <span class="flex-1">${escapeHtml(it.label)}</span>
           </button>`
      )
      .join('');
  document.body.appendChild(menu);
  active = menu;

  // Clamp dentro del viewport tras medir el tamaño real.
  const rect = menu.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - rect.width - 6);
  const py = Math.min(y, window.innerHeight - rect.height - 6);
  menu.style.left = `${Math.max(6, px)}px`;
  menu.style.top = `${Math.max(6, py)}px`;
  menu.style.opacity = '1';

  menu.querySelectorAll<HTMLButtonElement>('.ctx-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      const item = items[idx];
      closeContextMenu();
      item?.onClick();
    });
  });

  // Listeners de cierre en el siguiente tick (no capturar el evento que lo abrió).
  setTimeout(() => {
    window.addEventListener('mousedown', onDocDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', closeContextMenu);
    window.addEventListener('scroll', closeContextMenu, true);
  }, 0);
}
