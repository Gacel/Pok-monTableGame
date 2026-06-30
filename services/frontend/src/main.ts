import './style.css';

interface Hex {
  q: number;
  r: number;
}

interface Tile {
  hex: Hex;
  biome: 'FIRE' | 'WATER' | 'GRASS' | 'SAND' | 'ICE';
  occupant: any | null;
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Activar pixel art mode en canvas (sin antialiasing)
ctx.imageSmoothingEnabled = false;

const HEX_SIZE = 45;
const CENTER_X = canvas.width / 2;
const CENTER_Y = canvas.height / 2;

// Cargar texturas tipo GBA
const textures = {
  FIRE: new Image(),
  WATER: new Image(),
  GRASS: new Image(),
  SAND: new Image(),
  ICE: new Image()
};

textures.FIRE.src = '/assets/fire.png';
textures.WATER.src = '/assets/water.png';
textures.GRASS.src = '/assets/grass.png';
textures.SAND.src = '/assets/sand.png';
textures.ICE.src = '/assets/ice.png';

const pokeGifs: Record<string, string> = {};
const pokeStatic: Record<string, string> = {};

async function preloadImages() {
  const promises = Object.values(textures).map(img => {
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // Continue even if one fails
    });
  });
  await Promise.all(promises);
}

async function loadPokeSprite(name: string): Promise<string | null> {
  if (pokeGifs[name]) return pokeGifs[name];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
    if (!res.ok) return null;
    const data = await res.json();
    
    // Extraer GIF animado de la Generación 5 (Black/White)
    const gifUrl = data.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default 
      || data.sprites?.front_default;
      
    const staticUrl = data.sprites?.front_default || gifUrl;
    
    if (!gifUrl) return null;
    
    pokeGifs[name] = gifUrl;
    pokeStatic[name] = staticUrl;
    return gifUrl;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function getBiomeTexture(biome: string) {
  switch(biome) {
    case 'FIRE': return textures.FIRE;
    case 'WATER': return textures.WATER;
    case 'GRASS': return textures.GRASS;
    case 'SAND': return textures.SAND;
    case 'ICE': return textures.ICE;
    default: return textures.GRASS;
  }
}

// Bucle de renderizado
function drawHex(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, img?: HTMLImageElement) {
  const points = [];
  const isoScale = 0.55;
  for (let i = 0; i < 6; i++) {
    const angle_deg = 60 * i - 30;
    const angle_rad = Math.PI / 180 * angle_deg;
    points.push({ x: size * Math.cos(angle_rad), y: size * Math.sin(angle_rad) * isoScale });
  }

  // 1. Dibujar las caras laterales para profundidad (efecto bloque 3D)
  const depth = 12; 
  ctx.beginPath();
  // Vértices inferiores (del 1 al 4 cubren la parte de abajo en isométrico)
  ctx.moveTo(x + points[1].x, y + points[1].y);
  ctx.lineTo(x + points[2].x, y + points[2].y);
  ctx.lineTo(x + points[3].x, y + points[3].y);
  ctx.lineTo(x + points[4].x, y + points[4].y);
  // Bajar por el eje Y visual
  ctx.lineTo(x + points[4].x, y + points[4].y + depth);
  ctx.lineTo(x + points[3].x, y + points[3].y + depth);
  ctx.lineTo(x + points[2].x, y + points[2].y + depth);
  ctx.lineTo(x + points[1].x, y + points[1].y + depth);
  ctx.closePath();
  ctx.fillStyle = '#654321'; // Marrón tierra para los laterales
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#3e2723'; // Marrón muy oscuro para los bordes del suelo
  ctx.stroke();

  // 2. Dibujar la cara superior (textura o color sólido)
  ctx.beginPath();
  ctx.moveTo(x + points[0].x, y + points[0].y);
  for (let i = 1; i < 6; i++) {
    ctx.lineTo(x + points[i].x, y + points[i].y);
  }
  ctx.closePath();

  if (img && img.complete && img.naturalHeight !== 0) {
    ctx.save();
    ctx.clip();
    
    // Calcular escala para la textura 64x64
    const imgSize = size * 2.5; 
    
    ctx.scale(1, isoScale);
    ctx.drawImage(img, x - imgSize / 2, y / isoScale - imgSize / 2, imgSize, imgSize);
    
    ctx.restore();
  } else {
    // Colores por defecto si falla la imagen
    const fallback = img === textures.FIRE ? '#ef4444' : 
                     img === textures.WATER ? '#3b82f6' : 
                     img === textures.SAND ? '#eab308' : 
                     img === textures.ICE ? '#93c5fd' : '#22c55e';
    ctx.fillStyle = fallback;
    ctx.fill();
  }
  
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.stroke();
}

function hexToPixel(q: number, r: number, size: number) {
  const isoScale = 0.55;
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 3 / 2 * r * isoScale;
  return { x: x + CENTER_X, y: y + CENTER_Y };
}

// Lógica de Hexágonos Inversa
function axialRound(x: number, y: number) {
  const z = -x - y;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  }
  return { q: rx, r: ry };
}

function pixelToHex(x: number, y: number, size: number, offsetX: number, offsetY: number) {
  const isoScale = 0.55;
  const pX = x - CENTER_X - offsetX;
  const pY = y - CENTER_Y - offsetY;
  const unscaledY = pY / isoScale;
  const r = (unscaledY * 2) / (3 * size);
  const q = pX / (size * Math.sqrt(3)) - r / 2;
  return axialRound(q, r);
}

let currentTiles: Tile[] = [];
let selectedHex: { q: number, r: number } | null = null;
let cameraOffset = { x: 0, y: 0 };

async function fetchAndRender() {
  try {
    await preloadImages(); // Esperar texturas

    const res = await fetch(`/api/game/board?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    currentTiles = await res.json();
    console.log("CARGADOS LOS TILES:", currentTiles.length, "Tiles de Arena:", currentTiles.filter(t=>t.biome==='SAND').length);
    
    // Preload PokeAPI sprites
    const pokeNames = new Set<string>();
    for (const t of currentTiles) {
       if (t.occupant?.name) pokeNames.add(t.occupant.name);
    }
    await Promise.all(Array.from(pokeNames).map(name => loadPokeSprite(name)));
    
    renderBoard();
    
    // Configurar interactividad (siempre reescribir para evitar cierres obsoletos de HMR)
    canvas.onclick = async (e) => {
       const rect = canvas.getBoundingClientRect();
       const scaleX = canvas.width / rect.width;
       const scaleY = canvas.height / rect.height;
       const mouseX = (e.clientX - rect.left) * scaleX;
       const mouseY = (e.clientY - rect.top) * scaleY;
       
       const hex = pixelToHex(mouseX, mouseY, HEX_SIZE, cameraOffset.x, cameraOffset.y);
       const clickedTile = currentTiles.find(t => t.hex.q === hex.q && t.hex.r === hex.r);
       
       if (!clickedTile) {
         selectedHex = null; // Clic fuera del mapa
         renderBoard();
         return;
       }
       
       if (selectedHex) {
         // Check if we are moving
         const selectedTile = currentTiles.find(t => t.hex.q === selectedHex!.q && t.hex.r === selectedHex!.r);
         if (selectedTile && selectedTile.occupant && !clickedTile.occupant) {
            // Enviar movimiento al backend
            const moveRes = await fetch('/api/game/move', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: selectedHex, to: hex })
            });
            if (moveRes.ok) {
              const data = await moveRes.json();
              currentTiles = data.board; // Refrescar estado oficial
            }
            selectedHex = null;
            renderBoard();
            return;
         }
       }
       
       // Seleccionar
       if (clickedTile.occupant) {
         selectedHex = hex;
       } else {
         selectedHex = null;
       }
       renderBoard();
    };

    const p = document.querySelector('p');
    if (p) {
        p.textContent = `Tablero RPG interactivo (${currentTiles.length} zonas).`;
        p.classList.remove('text-gray-300');
        p.classList.add('text-green-400');
    }
  } catch (error) {
    console.error(error);
  }
}

// ─── Biome transition helpers ───────────────────────────────────────
const EDGE_DIRS: Hex[] = [
  { q: 1, r: 0 },   // edge v0-v1 → right
  { q: 0, r: 1 },   // edge v1-v2 → bottom-right
  { q: -1, r: 1 },  // edge v2-v3 → bottom-left
  { q: -1, r: 0 },  // edge v3-v4 → left
  { q: 0, r: -1 },  // edge v4-v5 → top-left
  { q: 1, r: -1 },  // edge v5-v0 → top-right
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawBiomeTransitions(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  cx: number,
  cy: number,
  tileMap: Map<string, Tile>
) {
  const isoScale = 0.55;

  // Compute hex vertices (same formula as drawHex)
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle_rad = (Math.PI / 180) * (60 * i - 30);
    points.push({
      x: cx + HEX_SIZE * Math.cos(angle_rad),
      y: cy + HEX_SIZE * Math.sin(angle_rad) * isoScale,
    });
  }

  // Quick check: does this tile have any water↔land edge?
  let needsDraw = false;
  for (let i = 0; i < 6; i++) {
    const d = EDGE_DIRS[i];
    const n = tileMap.get(`${tile.hex.q + d.q},${tile.hex.r + d.r}`);
    if (!n) continue;
    if (
      (tile.biome === 'WATER' && n.biome !== 'WATER') ||
      (tile.biome !== 'WATER' && n.biome === 'WATER')
    ) {
      needsDraw = true;
      break;
    }
  }
  if (!needsDraw) return;

  // Clip to the hex top-face so effects don't bleed
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < 6; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.clip();

  const fadeDepth = HEX_SIZE * 0.35;

  for (let edgeIdx = 0; edgeIdx < 6; edgeIdx++) {
    const d = EDGE_DIRS[edgeIdx];
    const neighbor = tileMap.get(`${tile.hex.q + d.q},${tile.hex.r + d.r}`);
    if (!neighbor) continue;

    const isWaterToLand = tile.biome === 'WATER' && neighbor.biome !== 'WATER';
    const isLandToWater = tile.biome !== 'WATER' && neighbor.biome === 'WATER';
    if (!isWaterToLand && !isLandToWater) continue;

    const v1 = points[edgeIdx];
    const v2 = points[(edgeIdx + 1) % 6];
    const edgeMidX = (v1.x + v2.x) / 2;
    const edgeMidY = (v1.y + v2.y) / 2;

    // Unit vector from edge midpoint toward hex center
    const toCX = cx - edgeMidX;
    const toCY = cy - edgeMidY;
    const dist = Math.sqrt(toCX * toCX + toCY * toCY);
    const nx = toCX / dist;
    const ny = toCY / dist;

    // Gradient strip from edge inward
    const grad = ctx.createLinearGradient(
      edgeMidX, edgeMidY,
      edgeMidX + nx * fadeDepth, edgeMidY + ny * fadeDepth
    );

    if (isWaterToLand) {
      // ── Foam / spray ──
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.50)');
      grad.addColorStop(0.35, 'rgba(200, 230, 255, 0.22)');
      grad.addColorStop(1, 'rgba(200, 230, 255, 0)');
    } else {
      // ── Shore / wet sand ──
      grad.addColorStop(0, 'rgba(210, 180, 140, 0.50)');
      grad.addColorStop(0.30, 'rgba(194, 178, 128, 0.25)');
      grad.addColorStop(1, 'rgba(194, 178, 128, 0)');
    }

    // Fill the edge strip quad
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(v1.x, v1.y);
    ctx.lineTo(v2.x, v2.y);
    ctx.lineTo(v2.x + nx * fadeDepth, v2.y + ny * fadeDepth);
    ctx.lineTo(v1.x + nx * fadeDepth, v1.y + ny * fadeDepth);
    ctx.closePath();
    ctx.fill();

    // Particle dots (foam bubbles or sand grains)
    const baseSeed = tile.hex.q * 1000 + tile.hex.r * 100 + edgeIdx;
    const count = isWaterToLand ? 6 : 8;

    for (let p = 0; p < count; p++) {
      const s = baseSeed + p * 7;
      const t = seededRandom(s) * 0.85 + 0.075;          // position along edge
      const inward = seededRandom(s + 13) * fadeDepth * 0.55;
      const px = v1.x + (v2.x - v1.x) * t + nx * inward;
      const py = v1.y + (v2.y - v1.y) * t + ny * inward;
      const r = isWaterToLand
        ? 1.2 + seededRandom(s + 19) * 2.2
        : 0.6 + seededRandom(s + 19) * 1.4;
      const alpha = 0.25 + seededRandom(s + 23) * 0.35;

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = isWaterToLand
        ? `rgba(255, 255, 255, ${alpha})`
        : `rgba(194, 164, 108, ${alpha})`;
      ctx.fill();
    }
  }

  ctx.restore();
}



function renderBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Sort tiles by Y coordinate to ensure proper depth rendering
    const sortedTiles = [...currentTiles].sort((a, b) => {
      const pA = hexToPixel(a.hex.q, a.hex.r, HEX_SIZE);
      const pB = hexToPixel(b.hex.q, b.hex.r, HEX_SIZE);
      return pA.y - pB.y;
    });

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const tile of sortedTiles) {
      const p = hexToPixel(tile.hex.q, tile.hex.r, HEX_SIZE);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    
    const boardWidth = maxX - minX;
    const boardHeight = maxY - minY;
    
    cameraOffset.x = (canvas.width / 2 - (minX + boardWidth / 2)) - 30;
    cameraOffset.y = (canvas.height / 2 - (minY + boardHeight / 2)) + 40;

    ctx.save();
    ctx.translate(cameraOffset.x, cameraOffset.y);

    // Build tile lookup for biome transition effects
    const tileMap = new Map<string, Tile>();
    for (const t of sortedTiles) tileMap.set(`${t.hex.q},${t.hex.r}`, t);

    for (const tile of sortedTiles) {
      const { x, y } = hexToPixel(tile.hex.q, tile.hex.r, HEX_SIZE);
      drawHex(ctx, x, y, HEX_SIZE, getBiomeTexture(tile.biome));
      drawBiomeTransitions(ctx, tile, x, y, tileMap);

      // Resaltar selección
      if (selectedHex && selectedHex.q === tile.hex.q && selectedHex.r === tile.hex.r) {
         ctx.save();
         const points = [];
         const isoScale = 0.55;
         for (let i = 0; i < 6; i++) {
           const angle_deg = 60 * i - 30;
           const angle_rad = Math.PI / 180 * angle_deg;
           points.push({ x: HEX_SIZE * Math.cos(angle_rad), y: HEX_SIZE * Math.sin(angle_rad) * isoScale });
         }
         ctx.beginPath();
         ctx.moveTo(x + points[0].x, y + points[0].y);
         for (let i = 1; i < 6; i++) ctx.lineTo(x + points[i].x, y + points[i].y);
         ctx.closePath();
         ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
         ctx.fill();
         ctx.lineWidth = 3;
         ctx.strokeStyle = '#fff';
         ctx.stroke();
         ctx.restore();
      }
    }
    ctx.restore();
    
    updateDOMEntities(sortedTiles);
    updateFightingHUD();
}

function updateFightingHUD() {
  const p1Tile = currentTiles.find(t => t.occupant?.playerId === 'player1');
  const p2Tile = currentTiles.find(t => t.occupant?.playerId === 'player2');
  
  const elP1 = document.getElementById('hud-p1');
  if (p1Tile && p1Tile.occupant && elP1) {
    elP1.classList.remove('hidden');
    const occ = p1Tile.occupant;
    const nameEl = document.getElementById('hud-p1-name');
    if (nameEl) nameEl.textContent = occ.name ? occ.name.toUpperCase() : 'P1';
    const avatarEl = document.getElementById('hud-p1-avatar') as HTMLImageElement;
    if (avatarEl && occ.name) avatarEl.src = pokeStatic[occ.name] || pokeGifs[occ.name] || '';
    
    const hp = occ.hp ?? 100;
    const maxHp = occ.maxHp ?? 100;
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    
    const barEl = document.getElementById('hud-p1-hp-bar');
    if (barEl) barEl.style.width = `${pct}%`;
    const textEl = document.getElementById('hud-p1-hp-text');
    if (textEl) textEl.textContent = `${hp}/${maxHp}`;
  } else if (elP1) {
    elP1.classList.add('hidden');
  }

  const elP2 = document.getElementById('hud-p2');
  if (p2Tile && p2Tile.occupant && elP2) {
    elP2.classList.remove('hidden');
    const occ = p2Tile.occupant;
    const nameEl = document.getElementById('hud-p2-name');
    if (nameEl) nameEl.textContent = occ.name ? occ.name.toUpperCase() : 'P2';
    const avatarEl = document.getElementById('hud-p2-avatar') as HTMLImageElement;
    if (avatarEl && occ.name) avatarEl.src = pokeStatic[occ.name] || pokeGifs[occ.name] || '';
    
    const hp = occ.hp ?? 100;
    const maxHp = occ.maxHp ?? 100;
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    
    const barEl = document.getElementById('hud-p2-hp-bar');
    if (barEl) barEl.style.width = `${pct}%`;
    const textEl = document.getElementById('hud-p2-hp-text');
    if (textEl) textEl.textContent = `${hp}/${maxHp}`;
  } else if (elP2) {
    elP2.classList.add('hidden');
  }
}

function updateDOMEntities(sortedTiles: Tile[]) {
    const entitiesLayer = document.getElementById('entities-layer');
    if (!entitiesLayer) return;
    
    // Rastrear los ocupantes actuales para borrar los viejos
    const currentOccupantIds = new Set<string>();

    for (const tile of sortedTiles) {
      if (tile.occupant && tile.occupant.name && pokeGifs[tile.occupant.name]) {
          const occupantId = tile.occupant.id;
          currentOccupantIds.add(occupantId);
          
          const { x, y } = hexToPixel(tile.hex.q, tile.hex.r, HEX_SIZE);
          const screenX = x + cameraOffset.x;
          const screenY = y + cameraOffset.y;
          const sSize = HEX_SIZE * 1.5; 
          
          let img = document.getElementById(`img-${occupantId}`) as HTMLImageElement;
          if (!img) {
            img = document.createElement('img');
            img.id = `img-${occupantId}`;
            img.src = pokeGifs[tile.occupant.name];
            img.className = 'absolute';
            img.style.width = `${sSize}px`;
            img.style.height = `${sSize}px`;
            img.style.imageRendering = 'pixelated';
            // Animación mágica de CSS
            img.style.transition = 'left 0.4s cubic-bezier(0.25, 1, 0.5, 1), top 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
            entitiesLayer.appendChild(img);
          }
          
          img.style.left = `${screenX - sSize/2}px`;
          img.style.top = `${screenY - sSize/1.1}px`;
          img.style.zIndex = Math.floor(screenY).toString();
          
          let label = document.getElementById(`lbl-${occupantId}`) as HTMLDivElement;
          if (!label) {
            label = document.createElement('div');
            label.id = `lbl-${occupantId}`;
            label.textContent = tile.occupant.playerId;
            label.className = 'absolute text-white font-bold drop-shadow-md';
            label.style.fontFamily = '"Press Start 2P", monospace';
            label.style.fontSize = '8px';
            label.style.transform = 'translate(-50%, -100%)';
            label.style.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
            label.style.transition = 'left 0.4s cubic-bezier(0.25, 1, 0.5, 1), top 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
            entitiesLayer.appendChild(label);
          }
          
          label.style.left = `${screenX}px`;
          label.style.top = `${screenY - sSize/1.1 - 10}px`;
          label.style.zIndex = Math.floor(screenY + 1).toString();
      }
    }
    
    // Limpieza de entidades que ya no existen
    Array.from(entitiesLayer.children).forEach(child => {
       const id = child.id.replace('img-', '').replace('lbl-', '');
       if (!currentOccupantIds.has(id)) {
           child.remove();
       }
    });
}

fetchAndRender();
