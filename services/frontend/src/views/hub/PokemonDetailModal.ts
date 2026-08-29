import { apiFetch } from '../../net/api';
import { getSprite } from '../../net/PokeSprites';
import { escapeHtml } from '../../utils/html';
import { playEvolutionFx } from '../../utils/EvolutionFx';
import { FONT } from './panel';
import { gameAlert } from './GameModal';
import { POKEMON_TYPES, typeAdvantage, typeLabelEs } from '@transcendence/shared';
import type { PokemonMove, PokemonType } from '../../models/Types';

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
  /** XP acumulada hacia el siguiente nivel (T6.4). */
  xp?: number;
  /** XP total para subir; null/undefined en el nivel máximo. */
  xpToNext?: number | null;
  hp?: number;
  atk?: number;
  def?: number;
  /** Sprite ya precargado por la vista (evita re-fetch). */
  spriteUrl?: string;
  isShiny?: boolean;
  /** Id de instancia (inventario): habilita la evolución meta (T9.3). Ausente en draft. */
  ownedId?: string;
  /** Cantidad de Caramelos Raros que tiene el jugador (T11.15). */
  candyCount?: number;
  /** Callback tras evolucionar o usar caramelo (para refrescar el inventario). */
  onEvolved?: () => void;
}

/** Resolución de evolución de la instancia (del servidor, T9.3). */
interface EvoUi {
  canEvolve: boolean;
  target: string | null;
  requirement: string;
}

/** Ataque curado + descripción y nombre en español (cacheados). */
type PokedexMove = PokemonMove & { shortEffect?: string | null; displayName?: string | null };

interface PokedexData {
  name: string;
  type: PokemonType;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  moves: PokedexMove[];
}

/** Limpia el texto de efecto de PokeAPI (sustituye placeholders tipo $effect_chance). */
function cleanEffect(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\$effect_chance/g, 'X').replace(/\s+/g, ' ').trim();
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
  return `<span style="${FONT} font-size:${size}px; background:${TYPE_COLOR[t] ?? '#666'}; color:#000; padding:2px 5px; border-radius:4px; line-height:1;">${escapeHtml(typeLabelEs(t))}</span>`;
}

/** Barra de progreso de XP hacia el siguiente nivel (T6.4). Vacía si no hay datos de XP. */
function xpBar(seed: PokemonDetailSeed): string {
  if (seed.xp == null) return '';
  const max = seed.xpToNext;
  if (max == null) {
    // Nivel máximo: sin barra, solo distintivo.
    return `<span class="text-yellow-400 mt-1" style="${FONT} font-size:6px;">★ NIVEL MÁXIMO</span>`;
  }
  const pct = Math.max(0, Math.min(100, Math.round((seed.xp / max) * 100)));
  return `
    <div class="w-32 mt-1.5">
      <div class="flex justify-between text-gray-400" style="${FONT} font-size:5px;">
        <span>XP</span><span>${seed.xp}/${max}</span>
      </div>
      <div class="w-full rounded-full bg-gray-800 border border-gray-700 overflow-hidden" style="height:6px;">
        <div class="h-full bg-green-400" style="width:${pct}%;"></div>
      </div>
    </div>`;
}

/** Bloque de evolución meta (T9.3): botón si puede evolucionar ya; si no, el requisito. */
function evolveHtml(seed: PokemonDetailSeed, evo?: EvoUi | null): string {
  if (!seed.ownedId || !evo || !evo.target) return ''; // draft o forma final: nada
  const to = evo.target.toUpperCase();
  if (evo.canEvolve) {
    return `
      <button id="pkmn-evolve-btn" class="w-full mt-3 py-2 rounded border-b-4 bg-green-600 hover:bg-green-500 text-white border-green-800 active:border-b-0" style="${FONT} font-size:9px; box-shadow:0 3px 0 #000;">
        ✨ EVOLUCIONAR A ${escapeHtml(to)}
      </button>`;
  }
  return `
    <div class="w-full mt-3 py-2 rounded bg-gray-800 border border-gray-700 text-center" style="${FONT} font-size:7px; color:#9ca3af;">
      Evoluciona a ${escapeHtml(to)} · ${escapeHtml(evo.requirement)}
    </div>`;
}

const ITEM_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';

function candyHtml(seed: PokemonDetailSeed): string {
  if (!seed.ownedId || !seed.candyCount || seed.candyCount < 1) return '';
  if (seed.xpToNext == null) return '';
  return `
    <button id="pkmn-candy-btn" class="w-full mt-2 py-2 rounded border-b-4 bg-yellow-500 hover:bg-yellow-400 text-black border-yellow-700 active:border-b-0 flex items-center justify-center gap-2" style="${FONT} font-size:9px; box-shadow:0 3px 0 #000;">
      <img src="${ITEM_SPRITE}/rare-candy.png" alt="Rare Candy" class="w-5 h-5" style="image-rendering:pixelated;" />
      USAR CARAMELO RARO <span class="text-yellow-900" style="font-size:7px;">(${seed.candyCount})</span>
    </button>`;
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

function moveRow(m: PokedexMove): string {
  const cls = CLASS_LABEL[m.damageClass] ?? m.damageClass;
  const meta = [
    m.power > 0 ? `Pot ${m.power}` : null,
    m.accuracy != null ? `Prec ${m.accuracy}` : null,
    m.pp != null ? `PP ${m.pp}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const desc = cleanEffect(m.shortEffect);
  // Tres líneas para que el nombre NO se corte: tipo + nombre arriba, metadatos
  // debajo (a ancho completo, sin nowrap) y la descripción al final (fuente legible).
  return `
    <li class="rounded bg-gray-800/80 border border-gray-700" style="padding:7px 9px;">
      <div class="flex items-center gap-1.5">
        ${typeBadge(m.type, 5)}
        <span class="text-white uppercase" style="${FONT} font-size:8px; line-height:1.4;">${escapeHtml((m.displayName || m.name).replace(/-/g, ' '))}</span>
      </div>
      <div class="text-gray-400 mt-1" style="${FONT} font-size:6px; line-height:1.5;">${escapeHtml(cls)}${meta ? ` · ${escapeHtml(meta)}` : ''}</div>
      ${desc ? `<p class="text-gray-200 mt-1.5 font-mono" style="font-size:10px; line-height:1.45;">${escapeHtml(desc)}</p>` : ''}
    </li>`;
}

function bodyHtml(
  seed: PokemonDetailSeed,
  data: PokedexData | null,
  sprite: string,
  loading: boolean,
  evo?: EvoUi | null
): string {
  const curType = data?.type ?? seed.type;
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
      <h3 class="text-yellow-400 uppercase mt-2" style="${FONT} font-size:13px; text-shadow:2px 2px 0 #000;">
        ${escapeHtml(name)} ${seed.isShiny ? '✨' : ''}
      </h3>
      <div class="flex items-center justify-center gap-2 flex-wrap mt-1">
        ${curType ? typeBadge(curType, 7) : ''}
        ${seed.level != null ? `<span class="text-white" style="${FONT} font-size:7px;">Lv.${escapeHtml(seed.level)}</span>` : ''}
      </div>
      ${xpBar(seed)}
    </div>

    <div class="grid grid-cols-3 gap-2 mt-3">
      ${statChip('HP', hp, '#4ade80')}
      ${statChip('ATK', atk, '#f87171')}
      ${statChip('DEF', def, '#60a5fa')}
    </div>

    ${evolveHtml(seed, evo)}
    ${candyHtml(seed)}

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
  let pdData: PokedexData | null = null;
  let loading = true;
  let evo: EvoUi | null = null;
  const paint = (): void => {
    body.innerHTML = bodyHtml(seed, pdData, sprite, loading, evo);
  };
  paint();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePokemonDetail();
  });
  overlay.querySelector('#pkmn-modal-close')?.addEventListener('click', () => closePokemonDetail());
  overlay.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('#pkmn-evolve-btn');
    if (btn && seed.ownedId && evo?.canEvolve) void doEvolve(seed);
  });
  overlay.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('#pkmn-candy-btn');
    if (btn && seed.ownedId && seed.candyCount && seed.candyCount > 0) void doUseCandy(seed);
  });
  document.addEventListener('keydown', onKey);

  // Sprite: si la vista no lo precargó, lo pedimos (cacheado en memoria por PokeSprites).
  if (!sprite) {
    void getSprite(seed.name, !!seed.isShiny).then((s) => {
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
      pdData = res.ok && json.pokemon ? (json.pokemon as PokedexData) : null;
    } catch {
      /* sin datos */
    }
    if (activeOverlay === overlay) {
      loading = false;
      paint();
    }
  })();

  // Evolución (solo instancias del inventario).
  if (seed.ownedId) {
    void (async () => {
      try {
        const res = await apiFetch(`/api/inventory/pokemon/${seed.ownedId}/evolution`);
        const json = await res.json();
        if (activeOverlay !== overlay) return;
        if (res.ok && json.evolution) {
          evo = json.evolution as EvoUi;
          paint();
        }
      } catch {
        /* sin info de evolución */
      }
    })();
  }
}

async function doUseCandy(seed: PokemonDetailSeed): Promise<void> {
  if (!seed.ownedId) return;
  try {
    const res = await apiFetch(`/api/inventory/pokemon/${seed.ownedId}/use-candy`, { method: 'POST' });
    const json = await res.json();
    if (res.ok && json.success) {
      void gameAlert(`¡Subió a nivel ${json.level}!`);
      closePokemonDetail();
      seed.onEvolved?.();
    } else {
      void gameAlert(json.error ?? 'No se pudo usar el caramelo');
    }
  } catch {
    void gameAlert('Error de red al usar caramelo');
  }
}

/** Ejecuta la evolución meta de la instancia y refresca (T9.3). */
async function doEvolve(seed: PokemonDetailSeed): Promise<void> {
  if (!seed.ownedId) return;
  try {
    const res = await apiFetch(`/api/inventory/pokemon/${seed.ownedId}/evolve`, { method: 'POST' });
    const json = await res.json();
    if (res.ok && json.success) {
      const card = document.getElementById('pkmn-modal-card');
      if (card) {
        card.style.position = 'relative';
        const rect = card.getBoundingClientRect();
        await playEvolutionFx(card, rect.width / 2, rect.height / 3, String(json.evolvedTo ?? ''));
      }
      closePokemonDetail();
      seed.onEvolved?.();
    } else {
      void gameAlert(json.error ?? 'No se pudo evolucionar');
    }
  } catch {
    void gameAlert('Error de red al evolucionar');
  }
}
