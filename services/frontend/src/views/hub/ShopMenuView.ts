import { showMainMenu } from '../../main';
import { apiFetch } from '../../net/api';
import { getSprite } from '../../net/PokeSprites';
import { authState } from '../../auth/AuthState';
import { FONT, hubPanel, panelTitle, panelCard, menuButton, backButton } from './panel';
import { gachaAudio } from './GachaAudio';

/** Sprites reales de pokéballs (bitmap PokeAPI). */
const BALL_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
const BALLS = [
  { key: 'normal', name: 'POKÉBALL', sprite: 'poke-ball.png', price: 500 },
  { key: 'super', name: 'SUPERBALL', sprite: 'great-ball.png', price: 1000 },
  { key: 'ultra', name: 'ULTRABALL', sprite: 'ultra-ball.png', price: 2000 },
  { key: 'master', name: 'MASTERBALL', sprite: 'master-ball.png', price: 10000 },
];

const TIER_LABEL: Record<number, string> = { 1: 'COMÚN', 2: 'RARO', 3: 'ÉPICO', 4: 'LEGENDARIO' };
const TIER_COLOR: Record<number, string> = { 1: '#9ca3af', 2: '#60a5fa', 3: '#c084fc', 4: '#fbbf24' };

/**
 * Capa VISTA: TIENDA. Pokéball sorpresa con LOOT real: según el precio de la
 * bola, mayor probabilidad de Pokémon buenos. Compra autoritativa en el servidor
 * (POST /api/shop/ball) y revelado del Pokémon obtenido.
 */
export class ShopMenuView {
  private container: HTMLElement;
  private step: 'root' | 'balls' | 'opening' | 'sky_cinematic' | 'fullscreen_reveal' | 'reveal' = 'root';
  private openingBall: string | null = null;
  private notice = '';
  private busy = false;
  private reveal: {
    name: string;
    tier: number;
    sprite: string;
    isShiny: boolean;
  } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  private coins(): number {
    return authState.user?.coins ?? 0;
  }

  public render() {
    if (this.step === 'balls') return this.renderBalls();
    if (this.step === 'opening') return this.renderOpening();
    if (this.step === 'sky_cinematic') return this.renderSkyCinematic();
    if (this.step === 'fullscreen_reveal') return this.renderFullscreenReveal();
    if (this.step === 'reveal') return this.renderReveal();
    this.renderRoot();
  }

  private renderRoot() {
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('TIENDA')}
      ${panelCard(
        `<div class="flex flex-col gap-4 w-full max-w-xl">
          ${menuButton({ label: 'COSMÉTICOS', icon: '🎨', color: 'purple', disabled: true })}
          ${menuButton({ id: 'btn-balls', label: 'POKÉBALL SORPRESA', icon: '🎁', color: 'red' })}
          ${menuButton({ label: 'RECUPERA UN POKÉMON', icon: '💾', sublabel: 'Solo perdido en Survival (single) · 10000 🪙', color: 'blue', disabled: true })}
          ${menuButton({ label: 'ENVIAR OFERTA DE RECUPERACIÓN', icon: '🤝', sublabel: 'Con contraoferta del otro jugador', color: 'green', disabled: true })}
          ${menuButton({ label: 'PLAN PREMIUM', icon: '⭐', color: 'yellow', disabled: true })}
        </div>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 720 }
    );
    document.getElementById('btn-balls')?.addEventListener('click', () => {
      this.step = 'balls';
      this.render();
    });
    document.getElementById('btn-back')?.addEventListener('click', () => showMainMenu());
  }

  private renderBalls() {
    const coins = this.coins();
    const ballCard = (b: (typeof BALLS)[number]) => {
      const afford = coins >= b.price && !this.busy;
      return `
      <button data-ball="${b.key}" ${afford ? '' : 'disabled'} class="ball-card flex flex-col items-center justify-between gap-2 rounded border-4 border-gray-800 shadow-[4px_4px_0_#000] transition-all ${
        afford ? 'bg-white hover:bg-yellow-100 active:mt-1' : 'bg-gray-300 opacity-60 cursor-not-allowed'
      }" style="padding:16px 12px;">
        <img src="${BALL_SPRITE}/${b.sprite}" alt="${b.name}" class="w-16 h-16 object-contain" style="image-rendering: pixelated;" />
        <span class="text-black" style="${FONT} font-size:10px;">${b.name}</span>
        <span class="text-gray-700" style="${FONT} font-size:10px;">${b.price} 🪙</span>
      </button>`;
    };

    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('POKÉBALL SORPRESA')}
      <p class="text-white text-center mb-3" style="${FONT} font-size:11px;">Tu saldo: <span class="text-yellow-300">${coins} 🪙</span></p>
      ${panelCard(
        `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 w-full max-w-3xl">${BALLS.map(ballCard).join('')}</div>
         ${this.notice ? `<p class="text-red-500 text-center mt-4" style="${FONT} font-size:9px;">⚠ ${this.notice}</p>` : ''}
         <p class="text-gray-500 text-center mt-4" style="${FONT} font-size:7px;">A mayor calidad de la Pokéball, mayor probabilidad de capturar Pokémon inusuales y legendarios.</p>`,
        'flex flex-col items-center'
      )}
      ${backButton()}
      `,
      { minHeight: 600 }
    );

    this.container.querySelectorAll<HTMLButtonElement>('.ball-card').forEach((btn) => {
      btn.addEventListener('click', () => void this.buy(btn.dataset.ball!));
    });
    document.getElementById('btn-back')?.addEventListener('click', () => {
      this.step = 'root';
      this.notice = '';
      this.render();
    });
  }

  private async buy(ball: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.notice = '';
    try {
      const res = await apiFetch('/api/shop/ball', { method: 'POST', body: JSON.stringify({ ball }) });
      const data = await res.json();
      if (res.ok && data.pokemon) {
        // Actualiza el saldo local (sin notify para no salir de la tienda).
        if (authState.user) authState.user.coins = data.coins;
        this.reveal = { name: data.pokemon.name, tier: data.pokemon.tier, isShiny: !!data.pokemon.isShiny, sprite: '' };
        this.openingBall = ball;
        this.step = 'opening';
        gachaAudio.playTension();
        this.render();

        // A los 2.0s la bola explota hacia nosotros y la interfaz desaparece
        setTimeout(() => {
          const pb = document.getElementById('opening-pokeball');
          if (pb) {
            // Sacamos la bola al body para que sobreviva al fundido de la UI
            const rect = pb.getBoundingClientRect();
            document.body.appendChild(pb);
            pb.style.position = 'fixed';
            pb.style.top = `${rect.top}px`;
            pb.style.left = `${rect.left}px`;
            pb.style.margin = '0';
            pb.style.zIndex = '10000';
            
            pb.style.animation = 'pokeball-explode-zoom 0.5s cubic-bezier(0.5, 0, 1, 1) forwards';
          }
          
          // Hacemos desaparecer suavemente toda la ventana de la tienda que hay debajo
          this.container.style.transition = 'opacity 0.4s ease-in, transform 0.4s ease-in';
          this.container.style.opacity = '0';
          this.container.style.transform = 'scale(0.95)';
        }, 2000);

        setTimeout(() => {
          const pb = document.getElementById('opening-pokeball');
          if (pb) pb.remove();
          
          this.container.style.transition = 'none';
          this.container.style.opacity = '1';
          this.container.style.transform = 'none';
          
          this.step = 'sky_cinematic';
          gachaAudio.playEpicSky();
          this.render();
          
          // Sky cinematic takes 5.0s now for dramatic pause
          setTimeout(async () => {
            await this.loadRevealSprite();
            this.step = 'fullscreen_reveal';
            gachaAudio.playExplosion();
            this.render();
            
            // Sync with catch.mp3
            await gachaAudio.playTrack('/assets/sounds/catch.mp3');
            
            // 1.5s de silencio tras terminar, con magia visual en el último 0.6s
            await new Promise(r => setTimeout(r, 900));
            
            const fs = document.getElementById('fullscreen-gacha');
            if (fs) {
              document.body.appendChild(fs);
              fs.style.pointerEvents = 'none';
              
              const fsBg = document.getElementById('fs-bg');
              const fsSpin = document.getElementById('fs-spin');
              if (fsBg) fsBg.style.animation = 'magic-bg-explode 0.6s ease-in forwards';
              if (fsSpin) fsSpin.style.animation = 'magic-bg-explode 0.6s ease-in forwards';
              
              const img = fs.querySelector('img');
              const texts = fs.querySelectorAll('span');
              
              texts.forEach(t => {
                (t as HTMLElement).style.transition = 'opacity 0.3s ease';
                (t as HTMLElement).style.opacity = '0';
              });
              
              this.step = 'reveal';
              this.render();
              
              const newImg = this.container.querySelector('img');
              if (img && newImg) {
                const first = img.getBoundingClientRect();
                const last = newImg.getBoundingClientRect();
                
                const deltaX = last.left - first.left;
                const deltaY = last.top - first.top;
                const scaleW = last.width / first.width;
                const scaleH = last.height / first.height;
                
                img.classList.add('seamless-transition-img');
                img.style.transformOrigin = 'top left';
                img.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleW}, ${scaleH})`;
                
                newImg.style.opacity = '0';
              }
              
              await new Promise(r => setTimeout(r, 600));
              fs.remove();
              if (newImg) newImg.style.opacity = '1';
            } else {
              this.step = 'reveal';
              this.render();
            }
            
            this.busy = false;
            gachaAudio.playTrack('/assets/sounds/victory.mp3');
            
          }, 5000);
          
        }, 2500);
        
        return;
      }
      this.notice = data.error ?? 'No se pudo comprar';
    } catch {
      this.notice = 'Error de red';
    }
    this.busy = false;
    this.renderBalls();
  }

  private async loadRevealSprite(): Promise<void> {
    if (!this.reveal) return;
    this.reveal.sprite = await getSprite(this.reveal.name, this.reveal.isShiny);
  }

  private renderOpening() {
    const ballObj = BALLS.find(b => b.key === this.openingBall) || BALLS[0];
    this.container.innerHTML = hubPanel(
      `
      <div class="relative flex flex-col items-center justify-center w-full h-full" style="min-height: 560px;">
        <!-- Shaking Ball -->
        <img id="opening-pokeball" src="${BALL_SPRITE}/${ballObj.sprite}" class="w-48 h-48 object-contain animate-gacha-shake relative z-10" style="image-rendering: pixelated; filter: drop-shadow(0 0 20px rgba(255,255,255,0.5)); transform-origin: center center;" />
      </div>
      `,
      { minHeight: 560 }
    );
  }

  private renderSkyCinematic() {
    const rv = this.reveal;
    if (!rv) return;
    const color = TIER_COLOR[rv.tier] ?? '#fff';
    const ballObj = BALLS.find(b => b.key === this.openingBall) || BALLS[0];
    
    // Contenedor orgánico y mágico
    this.container.innerHTML = `
      <div class="fixed inset-0 overflow-hidden" style="background-color: #030308; z-index: 10000;">
        <!-- Organic Nebulas -->
        <div class="absolute w-[150%] h-[150%] top-[-25%] left-[-25%] mix-blend-screen opacity-80" style="
          background: 
            radial-gradient(ellipse at 20% 30%, rgba(138, 43, 226, 0.5) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(0, 191, 255, 0.4) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(255, 20, 147, 0.3) 0%, transparent 60%);
          animation: organic-nebula 15s infinite alternate ease-in-out;
        "></div>
        <div class="absolute w-[150%] h-[150%] top-[-25%] left-[-25%] mix-blend-screen opacity-60" style="
          background: 
            radial-gradient(circle at 70% 20%, rgba(255, 215, 0, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 30% 80%, rgba(75, 0, 130, 0.5) 0%, transparent 60%);
          animation: organic-nebula 12s infinite alternate-reverse ease-in-out;
        "></div>
        
        <!-- 3D Parallax Starfield -->
        <div id="starfield-container" class="absolute inset-0"></div>
        
        <div id="meteor-container" class="absolute inset-0"></div>
        
        <!-- Fogonazo final blanco -->
        <div class="absolute inset-0 bg-white pointer-events-none opacity-0" style="animation: gacha-flash 0.5s ease-out 4.7s forwards; z-index: 50;"></div>
      </div>
    `;
    
    this.spawnStars();
    setTimeout(() => this.spawnMeteors(rv.tier, color, `${BALL_SPRITE}/${ballObj.sprite}`), 50);
  }

  private spawnStars() {
    const container = document.getElementById('starfield-container');
    if (!container) return;
    
    for (let i = 0; i < 150; i++) {
      const star = document.createElement('div');
      star.className = 'organic-star';
      
      const size = Math.random() * 2 + 1;
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      
      star.style.opacity = `${Math.random()}`;
      
      const duration = 10 + Math.random() * 20;
      star.style.animation = `sky-pan-up ${duration}s linear infinite`;
      
      container.appendChild(star);
    }
  }

  private spawnMeteors(_tier: number, finalColor: string, spriteUrl: string) {
    const container = document.getElementById('meteor-container');
    if (!container) return;
    
    const colors = Object.values(TIER_COLOR);
    
    // Spawn 8 fake meteors with organic zigzag trajectories
    for(let i=0; i<8; i++) {
      setTimeout(() => {
        if (!document.getElementById('meteor-container')) return;
        const mColor = colors[Math.floor(Math.random() * colors.length)];
        const m = this.createMeteorElement(mColor, spriteUrl);
        const anim = Math.random() > 0.5 ? 'meteor-zigzag-1' : 'meteor-zigzag-2';
        m.style.animation = `${anim} ${1.5 + Math.random()}s linear forwards`;
        container.appendChild(m);
        gachaAudio.playMeteor();
      }, Math.random() * 2500);
    }
    
    // Spawn the true meteor crashing with a dramatic pause
    setTimeout(() => {
      if (!document.getElementById('meteor-container')) return;
      const main = this.createMeteorElement(finalColor, spriteUrl, true);
      main.style.animation = `meteor-final-hover 2.0s forwards`;
      container.appendChild(main);
      gachaAudio.playMeteor();
    }, 2800);
  }

  private createMeteorElement(color: string, spriteUrl: string, isFinal = false): HTMLElement {
    const d = document.createElement('div');
    d.style.position = 'absolute';
    d.style.top = '0';
    d.style.left = '0';
    
    // Teardrop Fire Trail
    const trail = document.createElement('div');
    trail.className = 'meteor-teardrop';
    trail.style.background = `linear-gradient(to top, ${color}, ${color}aa, transparent)`;
    if (isFinal) {
      trail.style.width = '60px';
      trail.style.height = '350px';
    }
    
    // Glowing Halo
    const halo = document.createElement('div');
    halo.className = 'meteor-halo';
    halo.style.backgroundColor = color;
    halo.style.boxShadow = `0 0 ${isFinal ? '80px 40px' : '40px 20px'} ${color}`;
    halo.style.animation = 'meteor-pulse-glow 0.3s alternate infinite';
    if (isFinal) {
      halo.style.width = '100px';
      halo.style.height = '100px';
    }
    
    // Crisp Pokeball
    const head = document.createElement('img');
    head.src = spriteUrl;
    head.className = 'meteor-ball';
    if (isFinal) {
      head.style.width = '80px';
      head.style.height = '80px';
    }
    
    d.appendChild(trail);
    d.appendChild(halo);
    d.appendChild(head);
    return d;
  }

  private generateSparkles(tier: number, color: string, isShiny: boolean): string {
    // Si es shiny multiplicamos brutalmente las estrellas
    const baseCount = Math.floor(Math.pow(2, tier) * 1.5);
    const count = isShiny ? baseCount * 3 : baseCount;
    
    let html = '';
    for(let i = 0; i < count; i++) {
      const top = Math.random() * 140 - 20; 
      const left = Math.random() * 140 - 20;
      const delay = Math.random() * 2;
      const size = Math.floor(Math.random() * (isShiny ? 40 : 25) + 15);
      
      let bg = 'white';
      if (isShiny) {
        // Enjambre dorado y del color de rareza
        const r = Math.random();
        if (r < 0.3) bg = color;
        else if (r < 0.6) bg = '#FFD700'; // Dorado puro
      } else {
        const isColored = Math.random() < 0.4;
        bg = isColored ? color : 'white';
      }
      
      html += `<div class="magical-sparkle" style="top: ${top}%; left: ${left}%; width: ${size}px; height: ${size}px; animation-delay: ${delay}s; background-color: ${bg}; box-shadow: 0 0 15px ${bg};"></div>`;
    }
    return html;
  }

  private renderFullscreenReveal() {
    const rv = this.reveal;
    if (!rv) return;
    const color = TIER_COLOR[rv.tier] ?? '#fff';
    
    // Renderiza a pantalla completa (por encima de toda la UI)
    this.container.innerHTML = `
      <div id="fullscreen-gacha" class="fixed inset-0 flex flex-col items-center justify-center overflow-hidden" style="z-index: 10000; animation: gacha-flash-in 0.5s ease-out forwards;">
        <!-- Separate background layer to animate later -->
        <div id="fs-bg" class="absolute inset-0" style="background-color: #111;"></div>
        
        <!-- Sunburst Spin -->
        <div id="fs-spin" class="absolute w-[300vmax] h-[300vmax] flex items-center justify-center opacity-60 animate-gacha-spin" style="background: repeating-conic-gradient(from 0deg, transparent 0deg 15deg, ${color} 15deg 30deg); transform-origin: center;"></div>
        
        <!-- Pokemon Pop -->
        <div class="relative z-10 flex flex-col items-center gap-6 animate-gacha-pop">
          <div class="relative">
            <img src="${rv.sprite}" alt="${rv.name}" class="w-64 h-64 md:w-96 md:h-96 object-contain relative z-10" style="image-rendering:pixelated; filter: drop-shadow(0 20px 20px rgba(0,0,0,0.8));" />
            <!-- Dynamic Sparkles -->
            ${this.generateSparkles(rv.tier, color, rv.isShiny)}
          </div>
          <span class="uppercase text-white" style="${FONT} font-size:36px; text-shadow: 4px 4px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000;">${rv.name}</span>
          <span style="${FONT} font-size:24px; color:${color}; text-shadow: 2px 2px 0 #000;">★ ${TIER_LABEL[rv.tier] ?? ''} ${rv.isShiny ? '✨ SHINY ✨' : ''} ★</span>
        </div>
      </div>
    `;
    
    setTimeout(() => this.spawnParticles(rv.tier, color, 'fullscreen-gacha'), 50);
  }

  private renderReveal() {
    const rv = this.reveal;
    if (!rv) {
      this.step = 'balls';
      return this.renderBalls();
    }
    const color = TIER_COLOR[rv.tier] ?? '#fff';
    this.container.innerHTML = hubPanel(
      `
      ${panelTitle('¡HAS OBTENIDO!')}
      
      <div class="relative flex flex-col items-center justify-center w-full overflow-hidden py-12 rounded mt-4" style="background-color: #111; border: 4px solid ${color};">
        <!-- Sunburst Spin -->
        <div class="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] flex items-center justify-center opacity-40 animate-gacha-spin" style="background: repeating-conic-gradient(from 0deg, transparent 0deg 15deg, ${color} 15deg 30deg); transform-origin: center;"></div>
        
        <div class="relative z-10 flex flex-col items-center gap-4">
          <div class="relative">
            <img src="${rv.sprite}" alt="${rv.name}" class="w-48 h-48 object-contain relative z-10" style="image-rendering:pixelated; filter: drop-shadow(0 10px 10px rgba(0,0,0,0.8));" />
            <!-- Dynamic Sparkles -->
            ${this.generateSparkles(rv.tier, color, rv.isShiny)}
          </div>
          <span class="uppercase text-white" style="${FONT} font-size:20px; text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000;">${rv.name}</span>
          <span style="${FONT} font-size:14px; color:${color}; text-shadow: 1px 1px 0 #000;">★ ${TIER_LABEL[rv.tier] ?? ''} ${rv.isShiny ? '✨ SHINY ✨' : ''} ★</span>
        </div>
      </div>
      
      <p class="text-gray-400 text-center mt-6 mb-6" style="${FONT} font-size:10px;">Añadido a tu inventario · saldo ${this.coins()} 🪙</p>
      
      <div class="flex gap-4">
        <button id="btn-again" class="px-6 py-3 rounded bg-red-600 hover:bg-red-500 text-white border-b-4 border-red-800 active:border-b-0 transition-colors" style="${FONT} font-size:11px; box-shadow:0 4px 0 #000;">🎁 OTRA VEZ</button>
        <button id="btn-shop-back" class="px-6 py-3 rounded bg-gray-600 hover:bg-gray-500 text-white border-b-4 border-gray-800 active:border-b-0 transition-colors" style="${FONT} font-size:11px; box-shadow:0 4px 0 #000;">◀ TIENDA</button>
      </div>
      `,
      { minHeight: 560 }
    );
    document.getElementById('btn-again')?.addEventListener('click', () => {
      gachaAudio.stopTrack();
      this.reveal = null;
      this.step = 'balls';
      this.render();
    });
    document.getElementById('btn-shop-back')?.addEventListener('click', () => {
      gachaAudio.stopTrack();
      this.reveal = null;
      this.step = 'root';
      this.render();
    });
  }

  private spawnParticles(tier: number, color: string, containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // ABSOLUTE MADNESS: 300 particles per tier!
    const count = tier * 300; 
    
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.style.position = 'absolute';
      p.style.top = '50%';
      p.style.left = '50%';
      p.style.width = '6px';
      p.style.height = '6px';
      p.style.backgroundColor = (Math.random() > 0.5) ? color : '#fff';
      p.style.borderRadius = (Math.random() > 0.5) ? '50%' : '0';
      p.style.zIndex = '20';
      
      // Vector de explosión radial aleatorio súper rápido
      const angle = Math.random() * Math.PI * 2;
      const velocity = 50 + Math.random() * (400 + tier * 200);
      const tx = Math.cos(angle) * velocity;
      const ty = Math.sin(angle) * velocity;
      
      p.style.setProperty('--tx', `${tx}px`);
      p.style.setProperty('--ty', `${ty}px`);
      p.style.animation = `gacha-particle-fly ${0.5 + Math.random()}s cubic-bezier(0,.9,.3,1) forwards`;
      
      container.appendChild(p);
      
      // Auto-destrucción del DOM
      setTimeout(() => p.remove(), 2000);
    }
  }
}
