import { apiFetch } from '../../net/api';
import { getSprite } from '../../net/PokeSprites';
import { escapeHtml } from '../../utils/html';
import { FONT } from './panel';
import { POKEMON_TYPES, typeAdvantage } from '@transcendence/shared';
import type { MovementPattern, PokemonMove, PokemonType } from '../../models/Types';

/**
 * Ficha modal reutilizable de un Pokémon (inventario y draft).
 *
 * Datos autoritativos (stats + ataques curados) desde `GET /api/game/pokedex/:name`
 * — el servidor los trae de PokeAPI UNA sola vez y luego sirve desde SQLite, así
 * que este modal NO genera llamadas duplicadas a la API externa.
 *
 * Las fortalezas/debilidades/resistencias se derivan en el cliente de la rueda de
 * tipos `typeAdvantage` (@transcendence/shared, misma fuente que usan combate e IA),
 * sin pedir datos extra.
 */

const TYPE_COLOR: Record<string, string> = {
  FIRE: '#f08030', WATER: '#6890f0', GRASS: '#78c850', ELECTRIC: '#f8d030',
  NORMAL: '#a8a878', POISON: '#a040a0', FAIRY: '#ee99ac', ICE: '#98d8d8',
  PSYCHIC: '#f85888', DRAGON: '#7038f8', FLYING: '#a890f0',
};

const PATTERN_LABEL: Record<MovementPattern, string> = {
  FLYING: 'Volador · Alfil',
  TANK: 'Tanque · Rey',
  SPEEDSTER: 'Velocista · Caballo',
};

const CLASS_LABEL: Record<string, string> = {
  physical: '⚔ Físico',
  special: '✨ Especial',
  status: '🌀 Estado',
};

/** Datos conocidos al abrir (se pintan al instante; el resto llega del servidor). */
export interface PokemonDetailSeed {
  name: string;
  type?: PokemonType;
  level?: number;
  movementPattern?: MovementPattern;
  hp?: number;
  atk?: number;
  def?: number;
  /** Sprite ya precargado por la vista (evita re-fetch). */
  spriteUrl?: string;
}

interface PokedexData {
  name: string;
  type: PokemonType;
  movementPattern: MovementPattern;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  moves: PokemonMove[];
}

/** Relaciones de tipo derivadas de la rueda `typeAdvantage`. */
function typeRelations(type: PokemonType): {
  strong: PokemonType[];
  weak: PokemonType[];
  resist: PokemonType[];
} {
  const strong: PokemonType[] = [];
  const weak: PokemonType[] = [];
  const resist: PokemonType[] = [];
  for (const t of POKEMON_TYPES) {
    if (t === type) continue;
    if (typeAdvantage(type, t) > 1) strong.push(t); // pega x1.5 a este tipo
    const incoming = typeAdvantage(t, type);
    if (incoming > 1) weak.push(t); // recibe x1.5 de este tipo
    else if (incoming < 1) resist.push(t); // recibe x0.5 de este tipo
  }
  return { strong, weak, resist };
}

function typeBadge(t: string, size = 6): string {
  return `<span style="${FONT} font-size:${size}px; background:${TYPE_COLOR[t] ?? '#666'}; color:#000; padding:2px 5px; border-radius:4px; line-height:1;">${escapeHtml(t)}</span>`;
}

function statChip(label: string, val: number | undefined, color: string): string {
  return `
    <div class="flex flex-col items-center rounded bg-gray-800/80 border border-gray-700" style="padding:4px 8px;">
      <span class="text-gray-400" style="${FONT} font-size:5px;">${label}</span>
      <span style="${FONT} font-size:9px; color:${color};">${val ?? '—'}</span>
    </div>`;
}

function relRow(label: string, color: string, types: PokemonType[]): string {
  const badges = types.length
    ? types.map((t) => typeBadge(t, 5)).join(' ')
    : `<span class="text-gray-500" style="${FONT} font-size:6px;">—</span>`;
  return `
    <div class="flex items-start gap-2" style="margin-top:5px;">
      <span style="${FONT} font-size:5.5px; color:${color}; min-width:74px; line-height:1.6;">${label}</span>
      <span class="flex flex-wrap gap-1">${badges}</span>
    </div>`;
}

function moveRow(m: PokemonMove): string {
  const cls = CLASS_LABEL[m.damageClass] ?? m.damageClass;
  const meta = [
    m.power > 0 ? `Pot ${m.power}` : null,
    m.accuracy != null ? `Prec ${m.accuracy}` : null,
    m.pp != null ? `PP ${m.pp}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `
    <li class="flex items-center justify-between gap-2 rounded bg-gray-800/80 border border-gray-700" style="padding:5px 7px;">
      <span class="flex items-center gap-1.5 min-w-0">
        ${typeBadge(m.type, 5)}
        <span class="text-white uppercase truncate" style="${FONT} font-size:7px;">${escapeHtml(m.name.replace(/-/g, ' '))}</span>
      </span>
      <span class="text-gray-300 whitespace-nowrap" style="${FONT} font-size:5.5px;">${escapeHtml(cls)}${meta ? ` · ${escapeHtml(meta)}` : ''}</span>
    </li>`;
}

function bodyHtml(
  seed: PokemonDetailSeed,
  data: PokedexData | null,
  sprite: string,
  loading: boolean
): string {
  const curType = data?.type ?? seed.type;
  const pattern = data?.movementPattern ?? seed.movementPattern;
  const hp = data?.hp ?? seed.hp;
  const atk = data?.atk ?? seed.atk;
  const def = data?.def ?? seed.def;
  const name = data?.name ?? seed.name;
  const rel = curType ? typeRelations(curType) : null;

  const movesHtml = loading
    ? `<p class="text-gray-400 animate-pulse" style="${FONT} font-size:7px;">Cargando ataques…</p>`
    : data && data.moves.length
      ? `<ul class="flex flex-col gap-1.5">${data.moves.map(moveRow).join('')}</ul>`
      : `<p class="text-gray-500" style="${FONT} font-size:7px;">Sin ataques disponibles.</p>`;

  return `
    <div class="flex flex-col items-center text-center">
      <div class="w-24 h-24 flex items-center justify-center rounded-lg bg-gray-950/60 border-2 border-gray-700">
        <img id="pkmn-modal-sprite" src="${escapeHtml(sprite)}" alt="${escapeHtml(name)}" class="w-20 h-20 object-contain" style="image-rendering:pixelated;" />
      </div>
      <h3 class="text-yellow-400 uppercase mt-2" style="${FONT} font-size:13px; text-shadow:2px 2px 0 #000;">${escapeHtml(name)}</h3>
      <div class="flex items-center justify-center gap-2 flex-wrap mt-1">
        ${curType ? typeBadge(curType, 7) : ''}
        ${seed.level != null ? `<span class="text-white" style="${FONT} font-size:7px;">Lv.${escapeHtml(seed.level)}</span>` : ''}
      </div>
      ${pattern ? `<span class="text-gray-300 mt-1" style="${FONT} font-size:6px;">${PATTERN_LABEL[pattern]}</span>` : ''}
    </div>

    <div class="grid grid-cols-3 gap-2 mt-3">
      ${statChip('HP', hp, '#4ade80')}
      ${statChip('ATK', atk, '#f87171')}
      ${statChip('DEF', def, '#60a5fa')}
    </div>

    <h4 class="text-white mt-4 mb-1.5" style="${FONT} font-size:8px;">ATAQUES APRENDIDOS</h4>
    ${movesHtml}

    <h4 class="text-white mt-4 mb-1" style="${FONT} font-size:8px;">TIPO Y AFINIDADES</h4>
    <div class="rounded bg-gray-950/40 border border-gray-800" style="padding:6px 8px;">
      ${
        rel
          ? `${relRow('FUERTE ▶', '#4ade80', rel.strong)}
             ${relRow('DÉBIL ✗', '#f87171', rel.weak)}
             ${relRow('RESISTE ◆', '#60a5fa', rel.resist)}`
          : `<p class="text-gray-400 animate-pulse" style="${FONT} font-size:7px;">Cargando…</p>`
      }
    </div>`;
}

// Un único modal activo a la vez (evita apilar fichas y listeners huérfanos).
let activeOverlay: HTMLElement | null = null;

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closePokemonDetail();
}

/** Cierra la ficha abierta (si la hay). Idempotente. */
export function closePokemonDetail(): void {
  if (!activeOverlay) return;
  document.removeEventListener('keydown', onKey);
  activeOverlay.remove();
  activeOverlay = null;
}

/** Abre la ficha modal de un Pokémon. Pinta al instante lo conocido y completa con el servidor. */
export function openPokemonDetail(seed: PokemonDetailSeed): void {
  closePokemonDetail();

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4';
  overlay.style.background = 'rgba(0,0,0,0.72)';
  overlay.innerHTML = `
    <div id="pkmn-modal-card" class="relative bg-gray-900 w-full" style="max-width:min(380px, 94vw); border:6px solid #fff; border-radius:12px; box-shadow:0 0 0 6px #000, 0 0 40px rgba(0,0,0,0.85);">
      <button id="pkmn-modal-close" aria-label="Cerrar" class="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white border-2 border-white flex items-center justify-center z-10" style="${FONT} font-size:11px; box-shadow:0 2px 0 #000;">✕</button>
      <div class="bg-blue-900 border-4 border-black overflow-y-auto" style="border-radius:6px; box-shadow: inset 0 0 30px rgba(0,0,0,0.6); padding:clamp(14px, 3vw, 22px); max-height:88vh;">
        <div id="pkmn-modal-body"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  activeOverlay = overlay;

  const body = overlay.querySelector('#pkmn-modal-body') as HTMLElement;
  let sprite = seed.spriteUrl ?? '';
  const paint = (data: PokedexData | null, loading: boolean): void => {
    body.innerHTML = bodyHtml(seed, data, sprite, loading);
  };
  paint(null, true);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePokemonDetail();
  });
  overlay.querySelector('#pkmn-modal-close')?.addEventListener('click', () => closePokemonDetail());
  document.addEventListener('keydown', onKey);

  // Sprite: si la vista no lo precargó, lo pedimos (cacheado en memoria por PokeSprites).
  if (!sprite) {
    void getSprite(seed.name).then((s) => {
      if (activeOverlay !== overlay || !s) return;
      sprite = s;
      const img = overlay.querySelector('#pkmn-modal-sprite') as HTMLImageElement | null;
      if (img) img.src = s;
    });
  }

  // Datos autoritativos (cache-first en el servidor).
  void (async () => {
    try {
      const res = await apiFetch(`/api/game/pokedex/${encodeURIComponent(seed.name)}`);
      const json = await res.json();
      if (activeOverlay !== overlay) return; // el usuario cerró o abrió otra ficha
      paint(res.ok && json.pokemon ? (json.pokemon as PokedexData) : null, false);
    } catch {
      if (activeOverlay === overlay) paint(null, false);
    }
  })();
}
