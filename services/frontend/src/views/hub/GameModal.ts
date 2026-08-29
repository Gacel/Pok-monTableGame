import { FONT } from './panel';

const Z = 'z-[300]';

function overlay(inner: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `fixed inset-0 ${Z} flex items-center justify-center p-4`;
  el.style.background = 'rgba(0,0,0,0.75)';
  el.innerHTML = `
    <div class="relative bg-gray-900 w-full text-center" style="max-width:min(380px,94vw); border:6px solid #fff; border-radius:12px; box-shadow:0 0 0 6px #000, 0 0 40px rgba(0,0,0,0.85);">
      <div class="bg-blue-900 border-4 border-black" style="border-radius:6px; box-shadow:inset 0 0 30px rgba(0,0,0,0.6); padding:22px;">
        ${inner}
      </div>
    </div>`;
  return el;
}

function btnHtml(label: string, id: string, color: 'green' | 'red' | 'gray'): string {
  const bg: Record<string, string> = {
    green: 'bg-green-600 hover:bg-green-500 border-green-800 text-white',
    red: 'bg-red-600 hover:bg-red-500 border-red-800 text-white',
    gray: 'bg-gray-600 hover:bg-gray-500 border-gray-800 text-white',
  };
  return `<button id="${id}" class="${bg[color]} px-5 py-2.5 rounded border-b-4 active:border-b-0" style="${FONT} font-size:11px;">${label}</button>`;
}

export function gameAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const el = overlay(`
      <p class="text-white mb-4" style="${FONT} font-size:11px; line-height:1.6;">${message}</p>
      ${btnHtml('ACEPTAR', 'gm-ok', 'green')}
    `);
    const close = () => { el.remove(); resolve(); };
    el.querySelector('#gm-ok')!.addEventListener('click', close);
    document.body.appendChild(el);
  });
}

export function gameConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const el = overlay(`
      <p class="text-white mb-4" style="${FONT} font-size:11px; line-height:1.6;">${message}</p>
      <div class="flex items-center justify-center gap-3">
        ${btnHtml('SÍ', 'gm-yes', 'green')}
        ${btnHtml('NO', 'gm-no', 'red')}
      </div>
    `);
    const close = (val: boolean) => { el.remove(); resolve(val); };
    el.querySelector('#gm-yes')!.addEventListener('click', () => close(true));
    el.querySelector('#gm-no')!.addEventListener('click', () => close(false));
    document.body.appendChild(el);
  });
}

export function gamePrompt(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const el = overlay(`
      <p class="text-white mb-4" style="${FONT} font-size:11px; line-height:1.6;">${message}</p>
      <input id="gm-input" type="text" value="${defaultValue}" class="w-full mb-4 px-3 py-2 rounded bg-gray-800 text-white border-2 border-gray-600 focus:border-yellow-400 outline-none" style="${FONT} font-size:12px;" />
      <div class="flex items-center justify-center gap-3">
        ${btnHtml('ACEPTAR', 'gm-ok', 'green')}
        ${btnHtml('CANCELAR', 'gm-cancel', 'gray')}
      </div>
    `);
    const input = el.querySelector<HTMLInputElement>('#gm-input')!;
    const close = (val: string | null) => { el.remove(); resolve(val); };
    el.querySelector('#gm-ok')!.addEventListener('click', () => close(input.value));
    el.querySelector('#gm-cancel')!.addEventListener('click', () => close(null));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value); });
    document.body.appendChild(el);
    input.focus();
  });
}
