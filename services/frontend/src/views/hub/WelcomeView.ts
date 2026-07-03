import { playClickSound } from '../../utils/audio';

export class WelcomeView {
  private container: HTMLElement;
  private onStart: () => void;
  private state: 'INITIAL' | 'CINEMATIC' | 'READY' = 'INITIAL';

  constructor(container: HTMLElement, onStart: () => void) {
    this.container = container;
    this.onStart = onStart;
  }

  public render() {
    // Para añadir más fondos, simplemente mételos en la carpeta y añade el nombre a esta lista!
    const backgrounds = ['fondo.png', 'fondo2.png', 'fondo3.png'];
    const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];

    this.container.innerHTML = `
      <style>
        @keyframes welcomeFloat {
          0%, 100% { 
            transform: scale(1.1) translateY(-20vh) rotate(0deg); 
            filter: drop-shadow(0 8px 12px rgba(0,0,0,0.8));
          }
          50% { 
            transform: scale(1.1) translateY(-23vh) rotate(0deg); 
            filter: drop-shadow(0 15px 15px rgba(0,0,0,0.5));
          }
        }
        @keyframes logoZoomIn {
          0% { 
            transform: scale(0) translateY(150px) rotate(-15deg); 
            opacity: 0; 
            filter: blur(20px) brightness(2.5) drop-shadow(0 0 50px rgba(255, 215, 0, 1)); 
          }
          30% { 
            transform: scale(1.3) translateY(-5vh) rotate(8deg); 
            opacity: 1; 
            filter: blur(0px) brightness(1.5) drop-shadow(0 0 40px rgba(255, 255, 255, 0.9)); 
          }
          55% { 
            transform: scale(0.9) translateY(15vh) rotate(-5deg); 
            filter: brightness(1) drop-shadow(0 5px 10px rgba(0, 0, 0, 0.6)); 
          }
          70% { 
            transform: scale(1.2) translateY(-10vh) rotate(3deg); 
            filter: brightness(1.3) drop-shadow(0 15px 30px rgba(255, 255, 255, 0.7)); 
          }
          85% { 
            transform: scale(1.05) translateY(0vh) rotate(-2deg); 
            filter: brightness(1.1) drop-shadow(0 8px 15px rgba(255, 215, 0, 0.4)); 
          }
          100% { 
            transform: scale(1.1) translateY(-20vh) rotate(0deg); 
            filter: drop-shadow(0 8px 12px rgba(0,0,0,0.8)); 
          }
        }
        @keyframes logoShine {
          0%, 47% { left: -100%; opacity: 0; }
          48% { left: -100%; opacity: 1; }
          65% { left: 200%; opacity: 1; }
          
          66%, 79% { left: -100%; opacity: 0; }
          80% { left: -100%; opacity: 1; }
          97% { left: 200%; opacity: 1; }
          
          98%, 100% { left: -100%; opacity: 0; }
        }
        @keyframes logoIdleShine {
          0% { left: -100%; opacity: 0; }
          1% { left: -100%; opacity: 1; }
          30% { left: 200%; opacity: 1; }
          31%, 100% { left: -100%; opacity: 0; }
        }
        @keyframes logoPulse {
          0% { transform: scale(1.1) translateY(-20vh); filter: drop-shadow(0 8px 12px rgba(0,0,0,0.8)); }
          50% { transform: scale(1.25) translateY(-20vh); filter: brightness(1.2) drop-shadow(0 0 30px rgba(255,255,255,0.6)); }
          100% { transform: scale(1.1) translateY(-20vh); filter: drop-shadow(0 8px 12px rgba(0,0,0,0.8)); }
        }
        .animate-welcome-float {
          animation: welcomeFloat 5s ease-in-out infinite;
        }
        .animate-logo-intro {
          animation: logoZoomIn 7.2s ease-in-out forwards;
        }
        .animate-logo-shine {
          animation: logoShine 7.2s ease-in-out forwards;
        }
        .animate-logo-idle-shine {
          animation: logoIdleShine 4s ease-in-out infinite;
        }
        @keyframes pressStartFantasy {
          0%, 100% { 
            transform: scale(0.98); 
            opacity: 0.6; 
            filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.2)); 
          }
          50% { 
            transform: scale(1.02); 
            opacity: 1; 
            filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.6)); 
          }
        }
        @keyframes pressStartClick {
          0%, 100% { 
            transform: scale(1.1); 
            opacity: 1; 
            filter: brightness(2) drop-shadow(0 0 20px rgba(255, 255, 255, 1)); 
          }
          50% { 
            transform: scale(1.1); 
            opacity: 0; 
            filter: brightness(2) drop-shadow(0 0 20px rgba(255, 255, 255, 1)); 
          }
        }
        .animate-press-start-fantasy {
          animation: pressStartFantasy 1.5s ease-in-out infinite;
        }
        .animate-press-start-click {
          animation: pressStartClick 0.08s linear infinite;
        }
        @keyframes bgFantasy {
          0% { 
            transform: scale(1.4) rotate(3deg); 
            filter: blur(10px) brightness(0.3) saturate(0%) hue-rotate(0deg); 
          }
          15% {
            transform: scale(1.35) rotate(2deg);
            filter: blur(15px) brightness(0.8) saturate(250%) hue-rotate(-60deg);
          }
          40% { 
            transform: scale(1.2) rotate(-2deg); 
            filter: blur(8px) brightness(1.5) saturate(200%) hue-rotate(90deg); 
          }
          70% { 
            transform: scale(1.05) rotate(1deg); 
            filter: blur(2px) brightness(1) saturate(150%) hue-rotate(30deg); 
          }
          100% { 
            transform: scale(1) rotate(0deg); 
            filter: blur(0px) brightness(1.05) saturate(110%) hue-rotate(0deg); 
          }
        }
        @keyframes jellyWobble {
          0% { transform: scale3d(1, 1, 1); }
          30% { transform: scale3d(1.25, 0.75, 1); }
          40% { transform: scale3d(0.75, 1.25, 1); }
          50% { transform: scale3d(1.15, 0.85, 1); }
          65% { transform: scale3d(0.95, 1.05, 1); }
          75% { transform: scale3d(1.05, 0.95, 1); }
          100% { transform: scale3d(1, 1, 1); }
        }
        @keyframes pokeballStruggle {
          0%, 15% { 
            transform: rotate(0deg) translateX(0px); 
            filter: brightness(1) drop-shadow(0 0 20px rgba(255,255,255,0.15)); 
          }
          
          /* Primer tambaleo (suave) */
          18% { transform: rotate(-12deg) translateX(-1px); }
          22% { transform: rotate(8deg) translateX(1px); }
          26% { transform: rotate(-4deg) translateX(0px); }
          30%, 45% { 
            transform: rotate(0deg) translateX(0px); 
            filter: brightness(1) drop-shadow(0 0 20px rgba(255,255,255,0.15)); 
          }
          
          /* Segundo tambaleo (medio) */
          48% { transform: rotate(15deg) translateX(1px); filter: brightness(1.1) drop-shadow(0 0 25px rgba(255,150,150,0.3)); }
          52% { transform: rotate(-12deg) translateX(-1px); }
          56% { transform: rotate(8deg) translateX(1px); }
          60%, 75% { 
            transform: rotate(0deg) translateX(0px); 
            filter: brightness(1) drop-shadow(0 0 20px rgba(255,255,255,0.15)); 
          }

          /* Tercer tambaleo (fuerte con resplandor rojo) */
          78% { transform: rotate(-25deg) translateX(-2px); filter: brightness(1.3) drop-shadow(0 0 35px rgba(255,50,50,0.6)); }
          81% { transform: rotate(30deg) translateX(2px); filter: brightness(1.6) drop-shadow(0 0 50px rgba(255,0,0,0.9)); }
          84% { transform: rotate(-20deg) translateX(-1px); filter: brightness(1.3) drop-shadow(0 0 35px rgba(255,50,50,0.6)); }
          87% { transform: rotate(12deg) translateX(1px); filter: brightness(1.1) drop-shadow(0 0 25px rgba(255,100,100,0.4)); }
          90%, 100% { 
            transform: rotate(0deg) translateX(0px); 
            filter: brightness(1) drop-shadow(0 0 20px rgba(255,255,255,0.15)); 
          }
        }
        @keyframes pokeballHover {
          0% { transform: rotate(0deg) scale(1); }
          
          /* Vibración corta fluye hacia latido */
          5% { transform: rotate(-4deg) scale(1.02) translateX(-1px); }
          10% { transform: rotate(4deg) scale(1.02) translateX(1px); }
          15% { transform: rotate(-2deg) scale(1.01) translateX(0); }
          
          /* Latido fuerte empalmado */
          20% { transform: scale(1.08); }
          25% { transform: scale(0.98) rotate(2deg); }
          
          /* Sacudida violenta y rápida */
          30% { transform: rotate(6deg) scale(1.02) translateX(1px); }
          33% { transform: rotate(-7deg) scale(1.03) translateX(-2px); }
          36% { transform: rotate(8deg) scale(1.04) translateX(2px); }
          39% { transform: rotate(-6deg) scale(1.02) translateX(-1px); }
          
          /* Doble latido fluyendo desde la sacudida */
          44% { transform: scale(1.06) rotate(0deg); }
          48% { transform: scale(0.99) rotate(-2deg); }
          52% { transform: scale(1.08) rotate(1deg); }
          57% { transform: scale(1) rotate(0deg); }

          /* Tensión agónica hacia un lado (lenta) */
          65% { transform: rotate(-12deg) scale(1.02); }
          72% { transform: rotate(-14deg) scale(1.03); }
          
          /* Chasquido fuerte al lado opuesto (liberación de tensión) */
          75% { transform: rotate(8deg) scale(1.02) translateX(2px); }
          
          /* Temblores leves enlazando de vuelta al inicio */
          80% { transform: rotate(-3deg) scale(1.01); }
          85% { transform: rotate(4deg) scale(1.01); }
          90% { transform: rotate(-4deg) scale(1.01); }
          95% { transform: rotate(2deg) scale(1.01); }
          
          100% { transform: rotate(0deg) scale(1); }
        }
        .animate-pokeball-struggle:hover {
          animation: pokeballHover 3.5s ease-in-out infinite !important;
          transform-origin: center 75%;
          cursor: pointer;
          filter: brightness(1.2) drop-shadow(0 0 30px rgba(255,255,255,0.5)) !important;
        }
        @keyframes pokeballOpen {
          0% { transform: scale(1); filter: brightness(1); }
          20% { transform: scale(0.9); filter: brightness(1.5); }
          50% { transform: scale(1.5); filter: brightness(5) drop-shadow(0 0 100px white); opacity: 1; }
          100% { transform: scale(3); filter: brightness(10) drop-shadow(0 0 200px white); opacity: 0; }
        }
        .animate-pokeball-open {
          animation: pokeballOpen 0.5s ease-out forwards !important;
          pointer-events: none;
        }
        .animate-pokeball-struggle {
          animation: pokeballStruggle 3.5s ease-in-out infinite;
          transform-origin: 50% 75%;
        }
        .animate-jelly-wobble {
          animation: jellyWobble 0.8s both;
        }
        .animate-bg-fantasy {
          animation: bgFantasy 7.2s ease-in-out forwards;
        }
        .animate-logo-pulse {
          animation: logoPulse 0.5s ease-out forwards;
        }
      </style>
      <div id="welcome-screen" class="absolute inset-0 w-full h-full bg-black flex flex-col items-center justify-center overflow-hidden group select-none">
        
        <!-- Background Image (Starts distorted/dark to match 0% of bgFantasy) -->
        <img id="welcome-bg" src="/assets/welcome/${randomBg}" alt="Fondo" class="absolute inset-0 w-full h-full object-cover" draggable="false" style="transform: scale(1.4) rotate(3deg); filter: blur(10px) brightness(0.3) saturate(0%) hue-rotate(0deg);">
        
        <!-- Title / Logo (Calculates exact object-cover scale factor for 16:9, safely clamped on mobile) -->
        <div id="logo-container" class="relative z-10 flex flex-col items-center justify-center w-full hidden">
          <div id="logo-wrapper" class="relative animate-logo-intro drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] cursor-pointer" style="width: min(95vw, calc(max(100vw, 100vh * 16/9) * 0.352));">
            <img src="/assets/welcome/logo.png" alt="Logo" class="w-full h-auto object-contain" draggable="false">
            
            <!-- Metallic shine mask -->
            <div class="absolute inset-0 pointer-events-none" style="-webkit-mask-image: url('/assets/welcome/logo.png'); -webkit-mask-size: 100% 100%; -webkit-mask-repeat: no-repeat; -webkit-mask-position: center;">
              <!-- The sweeping shine bar -->
              <div id="logo-shine-bar" class="absolute top-0 bottom-0 w-[60%] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.9)] to-transparent skew-x-[-30deg] animate-logo-shine"></div>
            </div>
          </div>
        </div>

        <!-- Press Start prompt -->
        <div id="press-start" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group/btn text-4xl md:text-6xl lg:text-7xl hidden transition-all duration-300 hover:scale-105">
          <div id="press-start-inner" class="flex items-center gap-8 transition-all duration-300 group-hover/btn:brightness-110 group-hover/btn:drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
            <div class="text-yellow-400 group-hover/btn:-translate-x-2 transition-transform drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]" style="font-family: 'Press Start 2P', monospace;">▶</div>
            <div class="text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-widest uppercase" style="font-family: 'Press Start 2P', monospace; text-shadow: 4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;">
              PRESS START
            </div>
            <div class="text-yellow-400 group-hover/btn:translate-x-2 transition-transform drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]" style="font-family: 'Press Start 2P', monospace;">◀</div>
          </div>
        </div>

        <!-- Initial prompt (before animation) -->
        <div id="initial-prompt" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-8">
          <img src="/assets/welcome/masterball_fondo.png" alt="Masterball" class="w-32 h-32 md:w-48 md:h-48 object-contain animate-pokeball-struggle transition-transform">
          <div class="text-gray-300 text-xs md:text-sm text-center tracking-widest drop-shadow-lg animate-pulse pointer-events-none" style="font-family: 'Press Start 2P', monospace;">
            CLICK OR PRESS ENTER TO BEGIN
          </div>
        </div>

        <p class="absolute bottom-6 right-6 text-xs text-white z-10 drop-shadow-lg" style="font-family: 'Press Start 2P', monospace; text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000;">© 2026 jvalle-d, sbenitez</p>
        
        <!-- Skip button -->
        <button id="skip-btn" class="hidden absolute bottom-24 right-0 bg-gray-900/90 border-4 border-gray-500 border-r-0 text-white px-5 py-4 z-50 hover:bg-gray-700 transition-colors flex items-center gap-4 text-xs" style="font-family: 'Press Start 2P', monospace; box-shadow: -4px 4px 0 rgba(0,0,0,0.8);">
          SALTAR 
          <div class="flex items-center gap-1 opacity-70">
            <div class="w-0 h-0 border-t-[6px] border-t-transparent border-l-[8px] border-l-white border-b-[6px] border-b-transparent"></div>
            <div class="w-[4px] h-[12px] bg-white"></div>
          </div>
        </button>
        
        <!-- Audio placeholder -->
        <audio id="welcome-music" loop src="/assets/welcome/theme.mp3"></audio>
      </div>
    `;

    const audio = this.container.querySelector('#welcome-music') as HTMLAudioElement;
    audio.volume = 0.5;
    
    const screen = document.getElementById('welcome-screen');
    const pressStart = document.getElementById('press-start');
    const bg = document.getElementById('welcome-bg');
    const logoContainer = document.getElementById('logo-container');
    const logoWrapper = logoContainer?.querySelector('#logo-wrapper');
    const skipBtn = document.getElementById('skip-btn');
    const initialPrompt = document.getElementById('initial-prompt');

    let readyTimeout: number;
    let isProceeding = false;

    const transitionToIdle = () => {
      this.state = 'READY';
      clearTimeout(readyTimeout);

      if (audio) {
        audio.currentTime = 7.2;
      }

      if (skipBtn) skipBtn.style.display = 'none';

      if (bg) {
        bg.classList.remove('animate-bg-fantasy');
        bg.style.transform = 'scale(1) rotate(0deg)';
        bg.style.filter = 'blur(0px) brightness(1.05) saturate(110%) hue-rotate(0deg)';
      }

      if (logoWrapper) {
        logoWrapper.classList.remove('animate-logo-intro');
        logoWrapper.classList.add('animate-welcome-float');
      }

      if (pressStart) {
        pressStart.classList.remove('top-1/2', '-translate-y-1/2', 'text-4xl', 'md:text-6xl', 'lg:text-7xl');
        pressStart.classList.add('bottom-[15%]', 'text-3xl', 'md:text-4xl', 'lg:text-5xl');
        pressStart.style.display = 'block';
        
        const inner = document.getElementById('press-start-inner');
        if (inner) {
          inner.classList.add('animate-press-start-fantasy');
          inner.classList.remove('gap-8');
          inner.classList.add('gap-6');
        }
      }

      const shineBar = logoContainer?.querySelector('#logo-shine-bar');
      if (shineBar) {
        shineBar.classList.remove('animate-logo-shine');
        void (shineBar as HTMLElement).offsetWidth; // trigger reflow
        shineBar.classList.add('animate-logo-idle-shine');
      }
    };

    const proceedToLogin = () => {
      if (isProceeding && this.state !== 'READY') return;
      isProceeding = true;
      
      clearTimeout(readyTimeout);

      if (screen) {
        screen.style.transition = 'opacity 0.5s ease';
        screen.style.opacity = '0';
      }

      const fadeAudio = setInterval(() => {
        if (audio.volume >= 0.05) {
          audio.volume -= 0.05;
        } else {
          audio.pause();
          clearInterval(fadeAudio);
        }
      }, 50);

      document.removeEventListener('keydown', keydownHandler);

      setTimeout(() => {
        clearInterval(fadeAudio);
        audio.pause();
        this.onStart();
      }, 500);
    };

    const playStartAnimationAndProceed = () => {
      if (isProceeding) return;
      isProceeding = true;
      playClickSound();
      
      const inner = document.getElementById('press-start-inner');
      if (inner) {
        inner.classList.remove('animate-press-start-fantasy');
        inner.classList.add('animate-press-start-click');
      }
      
      setTimeout(() => {
        proceedToLogin();
      }, 800);
    };

    const handleInteraction = (e?: Event) => {
      const isSkipClick = e?.type === 'click' && skipBtn && (e.target === skipBtn || skipBtn.contains(e.target as Node));

      if (this.state === 'CINEMATIC') {
        if (skipBtn?.classList.contains('hidden')) {
          // Show skip button on first interaction
          skipBtn.classList.remove('hidden');
          return;
        }

        // If skip button is visible, only proceed on Space/Enter or clicking the button
        if (e?.type === 'keydown' || isSkipClick) {
          transitionToIdle();
        }
        return;
      }

      if (this.state === 'INITIAL') {
        this.state = 'CINEMATIC';
        
        const mb = initialPrompt?.querySelector('img');
        if (mb) mb.classList.add('animate-pokeball-open');
        const text = initialPrompt?.querySelector('div');
        if (text) text.style.display = 'none';
        
        setTimeout(() => {
          if (initialPrompt) initialPrompt.style.display = 'none';
        }, 500);
        
        audio.play().catch(console.error);

        if (bg) {
          bg.style.transform = '';
          bg.style.filter = '';
          bg.classList.add('animate-bg-fantasy');
        }

        if (logoContainer) {
          logoContainer.classList.remove('hidden');
        }

        readyTimeout = window.setTimeout(transitionToIdle, 7200);

        return;
      }

      if (this.state === 'READY') {
        // If it's a mouse click anywhere on the screen, ignore it.
        // It's handled specifically by the pressStart button listener below.
        if (e instanceof MouseEvent) {
          return;
        }
        // Keyboard space/enter still works globally
        if (e instanceof KeyboardEvent && (e.code === 'Space' || e.code === 'Enter')) {
          playStartAnimationAndProceed();
        }
      }
    };

    screen?.addEventListener('click', handleInteraction);

    pressStart?.addEventListener('click', (e) => {
      if (this.state === 'READY') {
        e.stopPropagation();
        playStartAnimationAndProceed();
      }
    });

    logoWrapper?.addEventListener('click', (e) => {
      if (this.state === 'READY') {
        e.stopPropagation();
        const img = logoWrapper.querySelector('img');
        if (img) {
          img.classList.remove('animate-jelly-wobble');
          void img.offsetWidth; // trigger reflow to restart animation
          img.classList.add('animate-jelly-wobble');
        }
      }
    });

    const keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleInteraction(e);
      }
    };
    document.addEventListener('keydown', keydownHandler);
  }
}
