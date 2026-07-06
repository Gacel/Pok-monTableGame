/**
 * Helpers de UI del hub (estilo "consola 8-bit").
 *
 * Reproducen EXACTAMENTE el estilo existente (triple marco blanco/negro sobre
 * panel azul, tarjetas blancas, botones con relieve) pero a **tamaño grande**,
 * aprovechando el lienzo 1600×1000 en lugar de la tarjeta pequeña `scale-125`.
 *
 * Un único sitio controla el marco y los botones → sin deriva por copia de clases.
 */

export const FONT = "font-family:'Press Start 2P',monospace;";

export interface HubPanelOpts {
  /** Ancho del panel en px (dentro del lienzo de 1600). Def. 1200. */
  width?: number;
  /** Alto mínimo en px. Def. 760. */
  minHeight?: number;
}

/**
 * Marco "consola" grande y centrado. Envuelve el contenido interior.
 *
 * RESPONSIVE (ver docs/RESPONSIVE.md): la capa #hub-layer se renderiza a tamaño
 * REAL del dispositivo (fuera del lienzo 1600×1000 escalado), así que aquí usamos
 * medidas fluidas en lugar de px fijos:
 *   - ancho:  min(width px, 96vw)  → nunca desborda en móvil
 *   - alto:   min-height acotado a 82vh → en pantallas bajas el hub-layer hace scroll
 *   - padding: clamp() → se encoge en móvil, tamaño completo en escritorio
 */
export function hubPanel(inner: string, opts: HubPanelOpts = {}): string {
  const width = opts.width ?? 1200;
  const minHeight = opts.minHeight ?? 760;
  return `
    <div class="w-full flex justify-center p-2 sm:p-4">
      <div class="relative bg-gray-900 w-full" style="max-width:min(${width}px, 96vw); border:6px solid #fff; border-radius:12px; box-shadow:0 0 0 6px #000, 0 0 40px rgba(0,0,0,0.85);">
        <div class="bg-blue-900 border-4 border-black flex flex-col items-center relative w-full" style="min-height:min(${minHeight}px, 82vh); border-radius:6px; box-shadow: inset 0 0 30px rgba(0,0,0,0.6); padding:clamp(16px, 4vw, 40px);">
          ${inner}
        </div>
      </div>
    </div>`;
}

/** Título grande de sección, estilo rótulo retro. Fuente fluida. */
export function panelTitle(text: string): string {
  return `<h2 class="text-yellow-400 text-center mb-6 sm:mb-8" style="${FONT} font-size:clamp(18px, 4.5vw, 34px); text-shadow: 3px 3px 0 #3b4cca, -3px -3px 0 #3b4cca, 3px -3px 0 #3b4cca, -3px 3px 0 #3b4cca;">${text}</h2>`;
}

/** Tarjeta blanca interior (contenedor de opciones). Padding fluido. */
export function panelCard(inner: string, extraClass = ''): string {
  return `<div class="bg-white border-4 border-gray-800 shadow-[6px_6px_0_#000] rounded-lg ${extraClass}" style="padding:clamp(14px, 2.5vw, 28px);">${inner}</div>`;
}

type BtnColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'gray';

const BTN_BG: Record<BtnColor, string> = {
  red: 'bg-red-600 hover:bg-red-500 text-white border-red-800',
  blue: 'bg-blue-600 hover:bg-blue-500 text-white border-blue-800',
  green: 'bg-green-600 hover:bg-green-500 text-white border-green-800',
  yellow: 'bg-yellow-400 hover:bg-yellow-300 text-black border-yellow-600',
  purple: 'bg-purple-600 hover:bg-purple-500 text-white border-purple-800',
  gray: 'bg-gray-600 hover:bg-gray-500 text-white border-gray-800',
};

export interface MenuButtonOpts {
  id?: string;
  /** Pares data-* (p. ej. { mode: 'ffa' }) → data-mode="ffa". */
  data?: Record<string, string>;
  label: string;
  sublabel?: string;
  icon?: string;
  color?: BtnColor;
  /** Deshabilitado con aspecto "candado / pronto". */
  disabled?: boolean;
  /** Texto de bloqueo (p. ej. "1000 monedas"); implica disabled. */
  lock?: string;
  /** Clase(s) extra en el botón (p. ej. col-span). */
  extraClass?: string;
}

/** Botón de menú grande con relieve 8-bit. */
export function menuButton(o: MenuButtonOpts): string {
  const disabled = o.disabled || !!o.lock;
  const color = o.color ?? 'red';
  const dataAttrs = o.data
    ? Object.entries(o.data)
        .map(([k, v]) => `data-${k}="${v}"`)
        .join(' ')
    : '';
  const idAttr = o.id ? `id="${o.id}"` : '';

  if (disabled) {
    const lockLine = o.lock
      ? `<span class="text-[9px] sm:text-[10px] text-gray-300 mt-1">🔒 ${o.lock}</span>`
      : `<span class="text-[9px] sm:text-[10px] text-gray-300 mt-1">🔒 pronto</span>`;
    return `
      <button ${idAttr} ${dataAttrs} disabled class="w-full flex flex-col items-center justify-center gap-1 rounded border-2 border-gray-600 bg-gray-700/70 text-gray-300 cursor-not-allowed ${o.extraClass ?? ''}" style="${FONT} padding:clamp(12px, 2vw, 18px) clamp(10px, 1.6vw, 16px);">
        <span style="font-size:clamp(12px, 2.4vw, 16px);">${o.icon ? `${o.icon} ` : ''}${o.label}</span>
        ${o.sublabel ? `<span class="text-[9px] sm:text-[10px] text-gray-400 mt-1">${o.sublabel}</span>` : ''}
        ${lockLine}
      </button>`;
  }

  return `
    <button ${idAttr} ${dataAttrs} class="w-full flex flex-col items-center justify-center gap-1 rounded border-b-4 active:border-b-0 active:mt-1 transition-all ${BTN_BG[color]} ${o.extraClass ?? ''}" style="${FONT} padding:clamp(12px, 2vw, 18px) clamp(10px, 1.6vw, 16px); box-shadow:0 4px 0 #000;">
      <span style="font-size:clamp(12px, 2.4vw, 16px);">${o.icon ? `${o.icon} ` : ''}${o.label}</span>
      ${o.sublabel ? `<span class="text-[9px] sm:text-[10px] opacity-80 mt-1">${o.sublabel}</span>` : ''}
    </button>`;
}

/** Botón "◀ VOLVER" estándar (texto claro, subrayado). */
export function backButton(id = 'btn-back'): string {
  return `<button id="${id}" class="text-white hover:text-yellow-300 underline mt-5 sm:mt-6" style="${FONT} font-size:clamp(11px, 2vw, 13px);">◀ VOLVER</button>`;
}
